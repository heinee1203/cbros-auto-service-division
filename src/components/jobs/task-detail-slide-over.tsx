"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import {
  Play,
  Square,
  Clock,
  Camera,
  Package,
  Edit2,
  Trash2,
  Lock,
  Pause,
  CheckCircle,
  ArrowRight,
  Info,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SlideOver } from "@/components/ui/slide-over";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatPeso } from "@/lib/utils";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
} from "@/types/enums";
import { MILESTONE_LABELS } from "@/lib/constants";
import {
  updateTaskAction,
  transitionTaskStatusAction,
  deleteTaskAction,
} from "@/lib/actions/task-actions";
import {
  clockInAction,
  clockOutAction,
} from "@/lib/actions/time-entry-actions";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TaskDetailSlideOverProps {
  open: boolean;
  onClose: () => void;
  task: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    estimatedHours: number;
    actualHours: number;
    hourlyRate: number;
    sortOrder: number;
    serviceCatalog?: {
      id: string;
      name: string;
      category: string;
      requiredMilestonePhotos: string | null;
    } | null;
    assignedTechnician?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    dependsOnTask?: { id: string; name: string; status: string } | null;
    milestonePhotos?: Record<string, { count: number; latest?: string }>;
  } | null;
  jobOrderId: string;
  activeClockEntry?: { id: string; taskId: string; clockIn: string } | null;
  currentUserId?: string;
  overrunSettings: { warningPct: number; criticalPct: number };
}

type Tab = "details" | "time" | "photos" | "materials";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "details", label: "Details", icon: Info },
  { id: "time", label: "Time", icon: Clock },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "materials", label: "Materials", icon: Package },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusTransitions(
  status: string
): { label: string; newStatus: string; icon: React.ElementType; variant: string }[] {
  switch (status) {
    case "QUEUED":
      return [
        { label: "Start", newStatus: "IN_PROGRESS", icon: Play, variant: "accent" },
      ];
    case "IN_PROGRESS":
      return [
        { label: "Pause", newStatus: "PAUSED", icon: Pause, variant: "warning" },
        { label: "Send to QC", newStatus: "QC_REVIEW", icon: CheckCircle, variant: "accent" },
      ];
    case "PAUSED":
      return [
        { label: "Resume", newStatus: "IN_PROGRESS", icon: Play, variant: "accent" },
      ];
    case "QC_REVIEW":
      return [
        { label: "Mark Done", newStatus: "DONE", icon: CheckCircle, variant: "success" },
        { label: "Rework", newStatus: "REWORK", icon: ArrowRight, variant: "danger" },
      ];
    case "REWORK":
      return [
        { label: "Start Rework", newStatus: "IN_PROGRESS", icon: Play, variant: "accent" },
      ];
    case "DONE":
      return [];
    default:
      return [];
  }
}

const transitionVariantClasses: Record<string, string> = {
  accent: "bg-accent-500 hover:bg-accent-600 text-white",
  warning: "bg-warning hover:bg-warning-600 text-white",
  success: "bg-success hover:bg-success-600 text-white",
  danger: "bg-danger hover:bg-danger-600 text-white",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TaskDetailSlideOver({
  open,
  onClose,
  task,
  jobOrderId,
  activeClockEntry,
  overrunSettings,
}: TaskDetailSlideOverProps) {
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEstimatedHours, setEditEstimatedHours] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");

  // Live timer state
  const [elapsed, setElapsed] = useState(0);
  const frameRef = useRef<number | null>(null);

  const isClockRunning = activeClockEntry?.taskId === task?.id;
  const clockInTime = isClockRunning ? activeClockEntry?.clockIn : null;

  // Reset tab and editing when task changes
  useEffect(() => {
    if (open && task) {
      setActiveTab("details");
      setIsEditing(false);
    }
  }, [open, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate edit form when entering edit mode
  useEffect(() => {
    if (isEditing && task) {
      setEditName(task.name);
      setEditDescription(task.description ?? "");
      setEditEstimatedHours(String(task.estimatedHours));
      setEditHourlyRate(String(task.hourlyRate));
    }
  }, [isEditing, task]);

  // Live timer
  useEffect(() => {
    if (!clockInTime) {
      setElapsed(0);
      return;
    }
    const update = () => {
      const ms = Date.now() - new Date(clockInTime).getTime();
      setElapsed(ms);
      frameRef.current = requestAnimationFrame(update);
    };
    frameRef.current = requestAnimationFrame(update);
    const onVisChange = () => {
      if (!document.hidden && clockInTime) {
        setElapsed(Date.now() - new Date(clockInTime).getTime());
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [clockInTime]);

  // ----- Actions -----
  const handleTransition = useCallback(
    (newStatus: string) => {
      if (!task) return;
      startTransition(async () => {
        const result: ActionResult = await transitionTaskStatusAction(
          task.id,
          jobOrderId,
          newStatus
        );
        if (result.success) {
          toast.success(`Task status changed to ${TASK_STATUS_LABELS[newStatus as keyof typeof TASK_STATUS_LABELS] ?? newStatus}`);
        } else {
          toast.error(result.error ?? "Failed to update status");
        }
      });
    },
    [task, jobOrderId]
  );

  const handleSaveEdit = useCallback(() => {
    if (!task) return;
    startTransition(async () => {
      const result: ActionResult = await updateTaskAction(task.id, jobOrderId, {
        name: editName,
        description: editDescription || null,
        estimatedHours: parseFloat(editEstimatedHours) || 0,
        hourlyRate: parseFloat(editHourlyRate) || 0,
      });
      if (result.success) {
        toast.success("Task updated");
        setIsEditing(false);
      } else {
        toast.error(result.error ?? "Failed to update task");
      }
    });
  }, [task, jobOrderId, editName, editDescription, editEstimatedHours, editHourlyRate]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    startTransition(async () => {
      const result: ActionResult = await deleteTaskAction(task.id, jobOrderId);
      if (result.success) {
        toast.success("Task deleted");
        setShowDeleteConfirm(false);
        onClose();
      } else {
        toast.error(result.error ?? "Failed to delete task");
      }
    });
  }, [task, jobOrderId, onClose]);

  const handleClockIn = useCallback(() => {
    if (!task) return;
    startTransition(async () => {
      const result: ActionResult = await clockInAction(task.id, jobOrderId, "TABLET_CLOCK");
      if (result.success) {
        toast.success("Timer started");
      } else {
        toast.error(result.error ?? "Failed to start timer");
      }
    });
  }, [task, jobOrderId]);

  const handleClockOut = useCallback(() => {
    if (!activeClockEntry) return;
    startTransition(async () => {
      const result: ActionResult = await clockOutAction(activeClockEntry.id);
      if (result.success) {
        toast.success("Timer stopped");
      } else {
        toast.error(result.error ?? "Failed to stop timer");
      }
    });
  }, [activeClockEntry]);

  // ----- Milestone parsing -----
  const requiredMilestones: string[] = (() => {
    try {
      const raw = task?.serviceCatalog?.requiredMilestonePhotos;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const capturedMilestoneCount = requiredMilestones.filter(
    (id) => (task?.milestonePhotos?.[id]?.count ?? 0) > 0
  ).length;

  // ----- Overrun -----
  const overrunPct =
    task && task.estimatedHours > 0
      ? (task.actualHours / task.estimatedHours) * 100
      : 0;
  const overrunVariant: "default" | "warning" | "danger" =
    overrunPct >= overrunSettings.criticalPct
      ? "danger"
      : overrunPct >= overrunSettings.warningPct
        ? "warning"
        : "default";

  if (!task) return null;

  // ----- Render Tabs Content -----
  const renderDetailsTab = () => {
    if (isEditing) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">
              Task Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={editEstimatedHours}
                onChange={(e) => setEditEstimatedHours(e.target.value)}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">
                Hourly Rate (centavos)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={editHourlyRate}
                onChange={(e) => setEditHourlyRate(e.target.value)}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveEdit}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    const transitions = getStatusTransitions(task.status);

    return (
      <div className="space-y-5">
        {/* Status + actions row */}
        <div className="flex items-center justify-between">
          <Badge
            className={
              TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS] ?? ""
            }
          >
            {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
          </Badge>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg hover:bg-surface-100 transition-colors text-surface-400 hover:text-surface-600"
              title="Edit task"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg hover:bg-danger-50 transition-colors text-surface-400 hover:text-danger"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task info */}
        <div className="space-y-3">
          {task.description && (
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Description
              </p>
              <p className="text-sm text-surface-600 mt-1">{task.description}</p>
            </div>
          )}

          {task.serviceCatalog && (
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Service
              </p>
              <p className="text-sm text-surface-600 mt-1">
                {task.serviceCatalog.name}
                <span className="text-surface-400 ml-1">
                  ({task.serviceCatalog.category})
                </span>
              </p>
            </div>
          )}

          {task.assignedTechnician && (
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Assigned To
              </p>
              <p className="text-sm text-surface-600 mt-1">
                {task.assignedTechnician.firstName} {task.assignedTechnician.lastName}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Estimated Hours
              </p>
              <p className="text-sm text-surface-600 mt-1">{task.estimatedHours}h</p>
            </div>
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Hourly Rate
              </p>
              <p className="text-sm text-surface-600 mt-1">
                {formatPeso(task.hourlyRate)}/hr
              </p>
            </div>
          </div>

          {task.dependsOnTask && (
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Depends On
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Lock className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-sm text-surface-600">
                  {task.dependsOnTask.name}
                </span>
                <Badge
                  className={cn(
                    "text-[10px]",
                    TASK_STATUS_COLORS[
                      task.dependsOnTask.status as keyof typeof TASK_STATUS_COLORS
                    ] ?? ""
                  )}
                >
                  {TASK_STATUS_LABELS[
                    task.dependsOnTask.status as keyof typeof TASK_STATUS_LABELS
                  ] ?? task.dependsOnTask.status}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Status transition buttons */}
        {transitions.length > 0 && (
          <div className="pt-2 border-t border-surface-100">
            <p className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-2">
              Actions
            </p>
            <div className="flex gap-2">
              {transitions.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.newStatus}
                    onClick={() => handleTransition(t.newStatus)}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
                      transitionVariantClasses[t.variant] ?? transitionVariantClasses.accent
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTimeTab = () => {
    return (
      <div className="space-y-4">
        {/* Running total */}
        <div className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
          <div>
            <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
              Time Logged
            </p>
            <p className="text-lg font-semibold text-primary mt-0.5">
              {task.actualHours}h{" "}
              <span className="text-sm font-normal text-surface-400">
                of {task.estimatedHours}h estimated
              </span>
            </p>
          </div>
          {overrunPct > 0 && (
            <Badge variant={overrunVariant}>
              {overrunVariant === "danger" && (
                <AlertTriangle className="w-3 h-3 mr-1" />
              )}
              {Math.round(overrunPct)}%
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        {task.estimatedHours > 0 && (
          <div className="w-full bg-surface-100 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                overrunVariant === "danger"
                  ? "bg-danger"
                  : overrunVariant === "warning"
                    ? "bg-warning"
                    : "bg-accent-500"
              )}
              style={{
                width: `${Math.min(overrunPct, 100)}%`,
              }}
            />
          </div>
        )}

        {/* Placeholder */}
        <div className="py-8 text-center text-sm text-surface-400">
          Time entries for this task will appear here
        </div>
      </div>
    );
  };

  const renderPhotosTab = () => {
    if (requiredMilestones.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-surface-400">
          No milestone photos required for this service
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Progress summary */}
        <div className="p-3 bg-surface-50 rounded-lg">
          <p className="text-sm font-medium text-surface-600">
            {capturedMilestoneCount} of {requiredMilestones.length} milestones
            documented
          </p>
          <div className="w-full bg-surface-200 rounded-full h-2 mt-2">
            <div
              className="h-2 rounded-full bg-accent-500 transition-all"
              style={{
                width: `${
                  requiredMilestones.length > 0
                    ? (capturedMilestoneCount / requiredMilestones.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Milestone list */}
        <div className="space-y-2">
          {requiredMilestones.map((milestoneId) => {
            const photoData = task.milestonePhotos?.[milestoneId];
            const count = photoData?.count ?? 0;
            const captured = count > 0;

            return (
              <div
                key={milestoneId}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  captured
                    ? "border-success-200 bg-success-50"
                    : "border-surface-200 bg-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <Camera
                    className={cn(
                      "w-4 h-4",
                      captured ? "text-success-500" : "text-surface-300"
                    )}
                  />
                  <span className="text-sm text-surface-600">
                    {MILESTONE_LABELS[milestoneId] ?? milestoneId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {captured ? (
                    <Badge variant="success">
                      {count} photo{count !== 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMaterialsTab = () => {
    return (
      <div className="py-8 text-center text-sm text-surface-400">
        Materials log will appear here
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "details":
        return renderDetailsTab();
      case "time":
        return renderTimeTab();
      case "photos":
        return renderPhotosTab();
      case "materials":
        return renderMaterialsTab();
    }
  };

  // ----- Quick Clock Footer -----
  const clockFooter = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-surface-400" />
        {isClockRunning ? (
          <span className="text-sm font-mono font-semibold text-accent-600">
            {formatElapsed(elapsed)}
          </span>
        ) : (
          <span className="text-sm text-surface-400">Timer idle</span>
        )}
      </div>
      {isClockRunning ? (
        <button
          onClick={handleClockOut}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-danger text-white hover:bg-danger-600 transition-colors disabled:opacity-50"
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
      ) : (
        <button
          onClick={handleClockIn}
          disabled={isPending || task.status === "DONE"}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          Start Timer
        </button>
      )}
    </div>
  );

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={task.name}
        description={
          task.assignedTechnician
            ? `${task.assignedTechnician.firstName} ${task.assignedTechnician.lastName}`
            : undefined
        }
        footer={clockFooter}
        wide
      >
        {/* Tab navigation */}
        <div className="flex gap-1 mb-4 p-1 bg-surface-50 rounded-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-accent-100 text-accent-700"
                    : "text-surface-400 hover:text-surface-600 hover:bg-surface-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {renderTabContent()}
      </SlideOver>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={isPending}
      />
    </>
  );
}

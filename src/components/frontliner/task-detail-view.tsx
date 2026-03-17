"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  startTaskAction,
  pauseTaskAction,
  completeTaskAction,
} from "@/lib/actions/frontliner-actions";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types/enums";
import { MILESTONE_LABELS } from "@/lib/constants";
import { formatPeso } from "@/lib/utils";
import type { TaskStatus } from "@/types/enums";
import {
  ArrowLeft,
  Clock,
  Camera,
  Package,
  FileText,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SerializedTask {
  id: string;
  name: string;
  status: string;
  description: string | null;
  estimatedHours: number;
  actualHours: number;
  jobOrderId: string;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    vehicle: {
      plateNumber: string;
      make: string;
      model: string;
    };
  };
  serviceCatalog: {
    id: string;
    name: string;
    category: string;
    requiredMilestonePhotos: string | null;
  } | null;
  timeEntries: {
    id: string;
    clockIn: string;
    clockOut: string | null;
    breakMinutes: number;
    netMinutes: number;
    technician: { id: string; firstName: string; lastName: string };
  }[];
  materialUsages: {
    id: string;
    itemDescription: string;
    quantity: number;
    unit: string;
    actualCost: number;
  }[];
  photos: {
    id: string;
    category: string | null;
    thumbnailPath: string;
    fullSizePath: string;
    stage: string;
  }[];
}

interface TaskDetailViewProps {
  task: SerializedTask;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TaskDetailView({ task }: TaskDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadingMilestone, setUploadingMilestone] = useState<string | null>(
    null
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const statusLabel =
    TASK_STATUS_LABELS[task.status as TaskStatus] || task.status;
  const statusColor =
    TASK_STATUS_COLORS[task.status as TaskStatus] || "";

  // Parse required milestones
  let requiredMilestones: string[] = [];
  if (task.serviceCatalog?.requiredMilestonePhotos) {
    try {
      requiredMilestones = JSON.parse(
        task.serviceCatalog.requiredMilestonePhotos
      );
    } catch {
      // ignore
    }
  }

  // Map photos by category for quick lookup
  const progressPhotos = task.photos.filter((p) => p.stage === "PROGRESS");
  const photosByCategory: Record<string, (typeof task.photos)[0]> = {};
  for (const p of progressPhotos) {
    if (p.category) {
      photosByCategory[p.category] = p;
    }
  }

  const completedMilestones = requiredMilestones.filter(
    (m) => photosByCategory[m]
  ).length;

  // ---------------------------------------------------------------------------
  // Action handler
  // ---------------------------------------------------------------------------
  function handleAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(result.error || "Action failed");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Photo upload
  // ---------------------------------------------------------------------------
  async function handlePhotoUpload(milestone: string, file: File) {
    setUploadingMilestone(milestone);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "TASK");
      formData.append("entityId", task.id);
      formData.append("stage", "PROGRESS");
      formData.append("category", milestone);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      toast.success(
        `${MILESTONE_LABELS[milestone] || milestone} photo uploaded`
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setUploadingMilestone(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Action button (same logic as TaskCard)
  // ---------------------------------------------------------------------------
  function renderActionButton() {
    switch (task.status) {
      case "QUEUED":
        return (
          <button
            onClick={() =>
              handleAction(
                () => startTaskAction(task.id, task.jobOrder.id),
                "Task started"
              )
            }
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? "Starting..." : "Start Task"}
          </button>
        );
      case "IN_PROGRESS":
        return (
          <div className="space-y-2">
            <button
              onClick={() =>
                handleAction(
                  () => pauseTaskAction(task.id),
                  "Task paused"
                )
              }
              disabled={isPending}
              className="h-12 w-full rounded-xl bg-amber-600 font-semibold text-sm text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? "Pausing..." : "Pause"}
            </button>
            <button
              onClick={() =>
                handleAction(
                  () => completeTaskAction(task.id),
                  "Task completed"
                )
              }
              disabled={isPending}
              className="w-full text-center text-xs font-medium text-[var(--sch-text-muted)] hover:text-[var(--sch-text)] transition-colors py-1"
            >
              Mark Complete
            </button>
          </div>
        );
      case "PAUSED":
        return (
          <button
            onClick={() =>
              handleAction(
                () => startTaskAction(task.id, task.jobOrder.id),
                "Task resumed"
              )
            }
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? "Resuming..." : "Resume"}
          </button>
        );
      case "QC_REVIEW":
        return (
          <button
            disabled
            className="h-12 w-full rounded-xl bg-[var(--sch-surface)] font-semibold text-sm text-[var(--sch-text-dim)] cursor-not-allowed"
          >
            Awaiting QC
          </button>
        );
      case "DONE":
        return (
          <button
            disabled
            className="h-12 w-full rounded-xl bg-[var(--sch-surface)] font-semibold text-sm text-[var(--sch-text-dim)] cursor-not-allowed"
          >
            &#10003; Completed
          </button>
        );
      case "REWORK":
        return (
          <button
            onClick={() =>
              handleAction(
                () => startTaskAction(task.id, task.jobOrder.id),
                "Rework started"
              )
            }
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-red-600 font-semibold text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Starting..." : "Start Rework"}
          </button>
        );
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4 pb-8">
      {/* ----------------------------------------------------------------- */}
      {/* Header card                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[var(--sch-card)] rounded-xl p-5">
        <Link
          href="/frontliner/my-tasks"
          className="inline-flex items-center gap-1 text-sm text-[var(--sch-text-muted)] hover:text-[var(--sch-text)] transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          My Tasks
        </Link>

        <h1 className="text-xl font-bold text-[var(--sch-text)]">
          {task.name}
        </h1>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-mono text-sm text-[var(--sch-text-muted)]">
            {task.jobOrder.jobOrderNumber}
          </span>
          <span className="font-mono text-sm text-[var(--sch-text)]">
            {task.jobOrder.vehicle.plateNumber}
          </span>
        </div>

        <p className="text-sm text-[var(--sch-text-muted)] mt-0.5">
          {task.jobOrder.vehicle.make} {task.jobOrder.vehicle.model}
        </p>

        <div className="flex items-center gap-3 mt-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
          <span className="font-mono text-xs text-[var(--sch-text-muted)]">
            {task.actualHours.toFixed(1)}h / {task.estimatedHours.toFixed(1)}h
          </span>
        </div>

        <div className="mt-4">{renderActionButton()}</div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Time Log                                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-[var(--sch-text-muted)]" />
          <h2 className="text-lg font-semibold text-[var(--sch-text)]">
            Time Log
          </h2>
        </div>

        {task.timeEntries.length === 0 ? (
          <div className="bg-[var(--sch-card)] rounded-xl p-4 text-center">
            <p className="text-sm text-[var(--sch-text-muted)]">
              No time entries yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {task.timeEntries.map((entry) => {
              const isActive = !entry.clockOut;
              const duration = entry.clockOut
                ? entry.netMinutes
                : Math.max(
                    0,
                    Math.round(
                      (Date.now() - new Date(entry.clockIn).getTime()) / 60000
                    ) - entry.breakMinutes
                  );

              return (
                <div
                  key={entry.id}
                  className="bg-[var(--sch-card)] rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-[var(--sch-text-muted)]">
                      {formatDate(entry.clockIn)}
                    </p>
                    <p className="font-mono text-sm text-[var(--sch-text)]">
                      {formatTime(entry.clockIn)}
                      {" \u2192 "}
                      {entry.clockOut ? (
                        formatTime(entry.clockOut)
                      ) : (
                        <span className="text-emerald-400">now</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="font-mono text-sm font-medium text-[var(--sch-text)]">
                        {formatDuration(duration)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Milestone Photos                                                  */}
      {/* ----------------------------------------------------------------- */}
      {requiredMilestones.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--sch-text-muted)]" />
              <h2 className="text-lg font-semibold text-[var(--sch-text)]">
                Photos
              </h2>
            </div>
            <span className="text-xs font-mono text-[var(--sch-text-muted)]">
              {completedMilestones} of {requiredMilestones.length} milestones
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {requiredMilestones.map((milestone) => {
              const photo = photosByCategory[milestone];
              const label = MILESTONE_LABELS[milestone] || milestone;
              const isUploading = uploadingMilestone === milestone;

              return (
                <div
                  key={milestone}
                  className="bg-[var(--sch-card)] rounded-lg overflow-hidden"
                >
                  {photo ? (
                    <div className="relative aspect-square">
                      <Image
                        src={photo.thumbnailPath}
                        alt={label}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 200px"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        fileInputRefs.current[milestone]?.click()
                      }
                      disabled={isUploading}
                      className="w-full aspect-square flex flex-col items-center justify-center gap-1 text-[var(--sch-text-muted)] hover:text-[var(--sch-accent)] transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </button>
                  )}
                  <p className="text-xs text-center py-1.5 text-[var(--sch-text-muted)] truncate px-1">
                    {label}
                  </p>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[milestone] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handlePhotoUpload(milestone, file);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Materials                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-[var(--sch-text-muted)]" />
          <h2 className="text-lg font-semibold text-[var(--sch-text)]">
            Materials
          </h2>
        </div>

        {task.materialUsages.length === 0 ? (
          <div className="bg-[var(--sch-card)] rounded-xl p-4 text-center">
            <p className="text-sm text-[var(--sch-text-muted)]">
              No materials logged
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {task.materialUsages.map((mu) => (
              <div
                key={mu.id}
                className="bg-[var(--sch-card)] rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-[var(--sch-text)]">
                    {mu.itemDescription}
                  </p>
                  <p className="text-xs text-[var(--sch-text-muted)]">
                    {mu.quantity} {mu.unit}
                  </p>
                </div>
                <span className="font-mono text-sm text-[var(--sch-text)]">
                  {formatPeso(mu.actualCost)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Notes (read-only display of task description)                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-[var(--sch-text-muted)]" />
          <h2 className="text-lg font-semibold text-[var(--sch-text)]">
            Notes
          </h2>
        </div>

        <div className="bg-[var(--sch-card)] rounded-xl p-4">
          {task.description ? (
            <p className="text-sm text-[var(--sch-text)] whitespace-pre-wrap">
              {task.description}
            </p>
          ) : (
            <p className="text-sm text-[var(--sch-text-muted)] text-center">
              No notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

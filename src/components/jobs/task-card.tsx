"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TASK_STATUS_COLORS } from "@/types/enums";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { clockInAction, forceClockOutAndInAction } from "@/lib/actions/time-entry-actions";
import { clockOutAction } from "@/lib/actions/time-entry-actions";
import type { TaskStatus } from "@/types/enums";

interface TaskCardProps {
  task: {
    id: string;
    name: string;
    status: string;
    estimatedHours: number;
    actualHours: number;
    isRework: boolean;
    assignedTechnician: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    dependsOnTask: {
      id: string;
      name: string;
      status: string;
    } | null;
    serviceCatalog: {
      id: string;
      name: string;
      category: string;
      requiredMilestonePhotos: string | null;
    } | null;
    _count: { timeEntries: number };
  };
  jobOrderId: string;
  overrunSettings: { warningPct: number; criticalPct: number };
  activeClockEntry?: {
    id: string;
    taskId: string;
    clockIn: string;
  } | null;
  onClick: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function TaskCard({
  task,
  jobOrderId,
  overrunSettings,
  activeClockEntry,
  onClick,
}: TaskCardProps) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const frameRef = useRef<number | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  const isActiveOnThisTask =
    activeClockEntry && activeClockEntry.taskId === task.id;
  const clockInTime = isActiveOnThisTask ? activeClockEntry.clockIn : null;

  useEffect(() => {
    if (!clockInTime) return;
    const update = () => {
      const el = Date.now() - new Date(clockInTime).getTime();
      setElapsed(el);
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
      cancelAnimationFrame(frameRef.current!);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [clockInTime]);

  // Overrun calculation
  const overrunRatio =
    task.estimatedHours > 0 ? task.actualHours / task.estimatedHours : 0;
  const overrunPct = overrunRatio * 100;
  const isCritical = overrunPct >= overrunSettings.criticalPct;
  const isWarning =
    !isCritical && overrunPct >= overrunSettings.warningPct;

  // Dependency lock
  const isBlocked =
    task.dependsOnTask !== null && task.dependsOnTask.status !== "DONE";

  const handleClockIn = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setClockLoading(true);
      try {
        const result = await clockInAction(task.id, jobOrderId, "TABLET_CLOCK");
        if (!result.success) {
          if (result.data?.conflictEntry) {
            setShowConflictDialog(true);
          } else {
            toast.error(result.error || "Clock in failed");
          }
        } else {
          toast.success("Clocked in");
          router.refresh();
        }
      } catch {
        toast.error("Clock in failed");
      } finally {
        setClockLoading(false);
      }
    },
    [task.id, jobOrderId, router]
  );

  const handleClockOut = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeClockEntry) return;
      setClockLoading(true);
      try {
        const result = await clockOutAction(activeClockEntry.id);
        if (!result.success) {
          toast.error(result.error || "Clock out failed");
        } else {
          const mins = (result.data?.durationMinutes as number) || 0;
          toast.success(`Clocked out (${mins} min)`);
          router.refresh();
        }
      } catch {
        toast.error("Clock out failed");
      } finally {
        setClockLoading(false);
      }
    },
    [activeClockEntry, router]
  );

  const handleForceSwitch = useCallback(async () => {
    setClockLoading(true);
    setShowConflictDialog(false);
    try {
      const result = await forceClockOutAndInAction(
        task.id,
        jobOrderId,
        "TABLET_CLOCK"
      );
      if (!result.success) {
        toast.error(result.error || "Switch failed");
      } else {
        toast.success("Switched task");
        router.refresh();
      }
    } catch {
      toast.error("Switch failed");
    } finally {
      setClockLoading(false);
    }
  }, [task.id, jobOrderId, router]);

  const statusColor =
    TASK_STATUS_COLORS[task.status as TaskStatus] || "bg-surface-200 text-surface-600";

  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          "bg-white rounded-lg border border-surface-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
          isCritical && "border-l-4 border-l-red-500",
          isWarning && !isCritical && "border-l-4 border-l-yellow-500"
        )}
      >
        {/* Task name + rework badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-semibold text-sm text-primary leading-tight">
            {task.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {task.isRework && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                REWORK
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                statusColor
              )}
            >
              {task.status === "QC_REVIEW" ? "QC" : task.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Assigned tech */}
        {task.assignedTechnician && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-[9px] font-bold">
              {task.assignedTechnician.firstName.charAt(0)}
              {task.assignedTechnician.lastName.charAt(0)}
            </div>
            <span className="text-xs text-surface-500">
              {task.assignedTechnician.firstName}{" "}
              {task.assignedTechnician.lastName}
            </span>
          </div>
        )}

        {/* Hours */}
        <div className="text-xs text-surface-400 mb-1.5">
          {task.actualHours.toFixed(1)}h / {task.estimatedHours.toFixed(1)}h est.
        </div>

        {/* Dependency lock */}
        {isBlocked && task.dependsOnTask && (
          <div className="flex items-center gap-1 text-xs text-surface-400 mb-1.5">
            <Lock className="w-3 h-3" />
            <span>Waiting on: {task.dependsOnTask.name}</span>
          </div>
        )}

        {/* Quick Clock */}
        {task.status !== "DONE" && task.status !== "QC_REVIEW" && (
          <div className="mt-2 pt-2 border-t border-surface-100">
            {isActiveOnThisTask ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-blue-600 font-medium">
                  {formatElapsed(elapsed)}
                </span>
                <button
                  onClick={handleClockOut}
                  disabled={clockLoading}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              </div>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={clockLoading || isBlocked}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                Start
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        onConfirm={handleForceSwitch}
        title="Already Clocked In"
        message="You are already clocked in to another task. Would you like to clock out of that task and start this one?"
        confirmLabel="Switch Task"
        cancelLabel="Cancel"
        variant="warning"
        loading={clockLoading}
      />
    </>
  );
}

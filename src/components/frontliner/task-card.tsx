"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  startTaskAction,
  pauseTaskAction,
  completeTaskAction,
} from "@/lib/actions/frontliner-actions";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types/enums";
import type { TaskStatus } from "@/types/enums";

interface TaskCardProps {
  task: {
    id: string;
    name: string;
    status: string;
    estimatedHours: number;
    actualHours: number;
    jobOrder: {
      id: string;
      jobOrderNumber: string;
      vehicle: { plateNumber: string; make: string; model: string };
    };
  };
  onAction?: () => void;
}

const BORDER_COLORS: Record<string, string> = {
  QUEUED: "border-amber-500",
  IN_PROGRESS: "border-emerald-500",
  PAUSED: "border-amber-500",
  QC_REVIEW: "border-blue-500",
  DONE: "border-[var(--sch-border)]",
  REWORK: "border-red-500",
};

export function TaskCard({ task, onAction }: TaskCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const statusLabel =
    TASK_STATUS_LABELS[task.status as TaskStatus] || task.status;
  const statusColor =
    TASK_STATUS_COLORS[task.status as TaskStatus] || "";
  const borderColor = BORDER_COLORS[task.status] || "border-[var(--sch-border)]";

  const progressPct =
    task.estimatedHours > 0
      ? Math.min(100, (task.actualHours / task.estimatedHours) * 100)
      : 0;

  function handleAction(action: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successMsg);
        router.refresh();
        onAction?.();
      } else {
        toast.error(result.error || "Action failed");
      }
    });
  }

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
              className="w-full text-center text-xs font-medium text-[var(--sch-text-muted)] hover:text-[var(--sch-text)] transition-colors h-12 min-h-[48px]"
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

  return (
    <div
      className={`rounded-xl border-l-4 bg-[var(--sch-card)] p-4 ${borderColor}`}
    >
      {/* JO number + plate */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-[var(--sch-text-muted)]">
          {task.jobOrder.jobOrderNumber}
        </span>
        <span className="font-mono text-sm text-[var(--sch-text)]">
          {task.jobOrder.vehicle.plateNumber}
        </span>
      </div>

      {/* Make + model */}
      <p className="text-xs text-[var(--sch-text-dim)] mt-0.5">
        {task.jobOrder.vehicle.make} {task.jobOrder.vehicle.model}
      </p>

      {/* Task name */}
      <p className="text-lg font-semibold text-[var(--sch-text)] mt-2">
        {task.name}
      </p>

      {/* Status badge + hours */}
      <div className="flex items-center gap-3 mt-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {statusLabel}
        </span>
        <span className="font-mono text-xs text-[var(--sch-text-muted)]">
          {task.actualHours.toFixed(1)}h / {task.estimatedHours.toFixed(1)}h
        </span>
      </div>

      {/* Hours progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-[var(--sch-surface)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--sch-accent)] transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Action button */}
      <div className="mt-4">{renderActionButton()}</div>
    </div>
  );
}

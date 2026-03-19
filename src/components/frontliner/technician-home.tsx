"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clockOutAction,
  startBreakAction,
  endBreakAction,
} from "@/lib/actions/time-entry-actions";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types/enums";
import type { TaskStatus } from "@/types/enums";
import { formatPeso } from "@/lib/utils";

interface ActiveEntry {
  id: string;
  clockIn: string;
  taskId: string;
  taskName: string;
  jobOrderId: string;
  jobOrderNumber: string;
  breakMinutes: number;
  onBreak: boolean;
}

interface TaskItem {
  id: string;
  name: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    vehicle: {
      plateNumber: string;
      make: string;
      model: string;
    };
  };
}

interface CommissionData {
  thisWeek: { amount: number; jobs: number };
  lastWeek: { amount: number; jobs: number; status: string | null };
}

interface TechnicianHomeProps {
  firstName: string;
  activeEntry: ActiveEntry | null;
  dailyHours: string;
  tasks: TaskItem[];
  commission?: CommissionData;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function LiveTimer({ clockIn }: { clockIn: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const startTime = new Date(clockIn).getTime();

    function update() {
      const diff = Date.now() - startTime;
      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      setElapsed(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }

    update();
    let rafId: number;
    let lastSecond = Math.floor(Date.now() / 1000);

    function tick() {
      const currentSecond = Math.floor(Date.now() / 1000);
      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;
        update();
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [clockIn]);

  return (
    <span className="font-mono text-3xl font-bold text-[var(--sch-text)]">
      {elapsed}
    </span>
  );
}

export function TechnicianHome({
  firstName,
  activeEntry,
  dailyHours,
  tasks,
  commission,
}: TechnicianHomeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClockOut = useCallback(() => {
    if (!activeEntry) return;
    startTransition(async () => {
      const result = await clockOutAction(activeEntry.id);
      if (result.success) {
        toast.success("Clocked out successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Clock out failed");
      }
    });
  }, [activeEntry, router]);

  const handleStartBreak = useCallback(() => {
    if (!activeEntry) return;
    startTransition(async () => {
      const result = await startBreakAction(activeEntry.id);
      if (result.success) {
        toast.success("Break started");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to start break");
      }
    });
  }, [activeEntry, router]);

  const handleEndBreak = useCallback(() => {
    if (!activeEntry) return;
    startTransition(async () => {
      const result = await endBreakAction(activeEntry.id);
      if (result.success) {
        toast.success("Break ended");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to end break");
      }
    });
  }, [activeEntry, router]);

  const displayTasks = tasks.slice(0, 3);

  return (
    <div className="space-y-6 p-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-[var(--sch-text)]">
        {getGreeting()}, {firstName} {"👋"}
      </h1>

      {/* Clock Status Card */}
      <div className="rounded-xl border-l-4 border-[var(--sch-accent)] bg-[var(--sch-card)] p-5">
        {activeEntry && !activeEntry.onBreak && (
          <div className="space-y-4">
            <div>
              <p className="text-[var(--sch-text)]">
                Working on <span className="font-semibold">{activeEntry.taskName}</span>
              </p>
              <p className="font-mono text-sm text-[var(--sch-text-muted)]">
                {activeEntry.jobOrderNumber}
              </p>
            </div>
            <LiveTimer clockIn={activeEntry.clockIn} />
            <div className="flex gap-3">
              <button
                onClick={handleStartBreak}
                disabled={isPending}
                className="h-12 min-h-[48px] flex-1 rounded-lg border border-[var(--sch-border)] font-semibold text-[var(--sch-text)] transition-colors hover:bg-[var(--sch-surface)]"
              >
                Take Break
              </button>
              <button
                onClick={handleClockOut}
                disabled={isPending}
                className="h-12 min-h-[48px] flex-1 rounded-lg bg-red-600 font-semibold text-white transition-colors hover:bg-red-700"
              >
                Clock Out
              </button>
            </div>
          </div>
        )}

        {activeEntry && activeEntry.onBreak && (
          <div className="space-y-4">
            <p className="text-[var(--sch-text)]">
              On break &mdash; <span className="font-semibold">{activeEntry.taskName}</span>
            </p>
            <button
              onClick={handleEndBreak}
              disabled={isPending}
              className="h-12 min-h-[48px] w-full rounded-lg bg-[var(--sch-accent)] font-semibold text-black transition-colors hover:opacity-90"
            >
              End Break
            </button>
          </div>
        )}

        {!activeEntry && (
          <div className="space-y-4">
            <p className="text-[var(--sch-text-muted)]">Not clocked in</p>
            <Link
              href="/frontliner/clock"
              className="flex h-12 min-h-[48px] items-center justify-center rounded-lg bg-amber-500 font-semibold text-black transition-colors hover:bg-amber-400"
            >
              Clock In &rarr;
            </Link>
          </div>
        )}

        <p className="mt-3 font-mono text-sm text-[var(--sch-text-muted)]">
          Today: {dailyHours}
        </p>
      </div>

      {/* My Commission */}
      {commission && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--sch-text)] mb-3">
            My Commission
          </h2>
          <div className="rounded-xl bg-[var(--sch-card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--sch-text-muted)]">This Week</span>
              <span className="font-mono font-semibold text-[var(--sch-text)]">
                {formatPeso(commission.thisWeek.amount)}{" "}
                <span className="text-sm font-normal text-[var(--sch-text-muted)]">
                  ({commission.thisWeek.jobs} {commission.thisWeek.jobs === 1 ? "job" : "jobs"})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--sch-text-muted)]">Last Week</span>
              <span className="font-mono font-semibold text-[var(--sch-text)]">
                {formatPeso(commission.lastWeek.amount)}{" "}
                <span className="text-sm font-normal text-[var(--sch-text-muted)]">
                  ({commission.lastWeek.jobs} {commission.lastWeek.jobs === 1 ? "job" : "jobs"})
                </span>
                {commission.lastWeek.status === "PAID" && (
                  <span className="ml-1.5 inline-block rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                    PAID
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* My Tasks Today */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--sch-text)]">
            My Tasks Today
          </h2>
          {tasks.length > 3 && (
            <Link
              href="/frontliner/my-tasks"
              className="text-sm font-medium text-[var(--sch-accent)]"
            >
              View all &rarr;
            </Link>
          )}
        </div>

        {displayTasks.length === 0 ? (
          <div className="rounded-xl bg-[var(--sch-card)] p-6 text-center text-[var(--sch-text-muted)]">
            No tasks assigned
          </div>
        ) : (
          <div className="space-y-3">
            {displayTasks.map((task) => {
              const statusLabel =
                TASK_STATUS_LABELS[task.status as TaskStatus] || task.status;
              const statusColor =
                TASK_STATUS_COLORS[task.status as TaskStatus] || "";
              // Extract just the text color class
              const textColorClass =
                statusColor.split(" ").find((c) => c.startsWith("text-")) || "";

              return (
                <Link
                  key={task.id}
                  href={`/frontliner/my-tasks/${task.id}`}
                  className="block rounded-xl bg-[var(--sch-card)] p-4 transition-colors hover:bg-[var(--sch-surface)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-[var(--sch-text-muted)]">
                        {task.jobOrder.vehicle.plateNumber}
                        <span className="ml-2 font-sans">
                          {task.jobOrder.vehicle.make} {task.jobOrder.vehicle.model}
                        </span>
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--sch-text)]">
                        {task.name}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                        <span className="font-mono text-sm text-[var(--sch-text-muted)]">
                          {task.actualHours.toFixed(1)}h / {task.estimatedHours.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

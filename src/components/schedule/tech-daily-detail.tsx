"use client";

import { SlideOver } from "@/components/ui/slide-over";
import {
  type TechTask,
  type TechTimeEntry,
  parseWorkSchedule,
  getWorkingHours,
  isDayOff,
  getTaskDateRange,
  getDateKey,
} from "./tech-timeline-types";
import { Clock, Coffee, AlertTriangle, Briefcase } from "lucide-react";

interface TechDailyDetailProps {
  open: boolean;
  onClose: () => void;
  techId: string;
  techName: string;
  date: Date;
  tasks: TechTask[];
  timeEntries: TechTimeEntry[];
  workSchedule: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${ampm}`;
}

function getEntriesForHour(
  entries: TechTimeEntry[],
  hour: number,
  date: Date
): TechTimeEntry[] {
  return entries.filter((e) => {
    const clockIn = new Date(e.clockIn);
    const clockOut = e.clockOut ? new Date(e.clockOut) : new Date();
    const hourStart = new Date(date);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(date);
    hourEnd.setHours(hour + 1, 0, 0, 0);
    return clockIn < hourEnd && clockOut > hourStart;
  });
}

/** Get tasks active on this date (hour param reserved for future per-hour scheduling) */
function getTasksForDate(
  tasks: TechTask[],
  date: Date
): TechTask[] {
  const dk = getDateKey(date);
  return tasks.filter((task) => {
    const { start, end } = getTaskDateRange(task);
    const startKey = getDateKey(start);
    const endKey = getDateKey(end);
    return dk >= startKey && dk <= endKey;
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function statusDotColor(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "DONE":
      return "bg-green-500";
    case "PAUSED":
      return "bg-amber-500";
    case "QC_REVIEW":
      return "bg-purple-500";
    case "REWORK":
      return "bg-red-500";
    case "QUEUED":
    default:
      return "bg-surface-400";
  }
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TechDailyDetail({
  open,
  onClose,
  techName,
  date,
  tasks,
  timeEntries,
  workSchedule,
}: TechDailyDetailProps) {
  const schedule = parseWorkSchedule(workSchedule);
  const dayOff = isDayOff(schedule, date);
  const availableHours = getWorkingHours(schedule, date);

  // Scheduled hours: sum of estimatedHours for tasks active on this date
  const activeTasks = getTasksForDate(tasks, date);
  const scheduledHours = activeTasks.reduce(
    (sum, t) => sum + t.estimatedHours,
    0
  );

  // Actual hours from time entries on this date
  const dk = getDateKey(date);
  const dayEntries = timeEntries.filter((e) => {
    const entryDate = getDateKey(new Date(e.clockIn));
    return entryDate === dk;
  });
  const actualMinutes = dayEntries.reduce((sum, e) => sum + e.netMinutes, 0);
  const actualHours = actualMinutes / 60;

  const isOvertime = actualHours > availableHours && availableHours > 0;
  const isOnTrack = !isOvertime;

  // Hour slots 7 AM - 6 PM
  const hourSlots = Array.from({ length: 12 }, (_, i) => i + 7);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={techName}
      description={formatFullDate(date)}
    >
      <div className="space-y-6" style={{ background: '#0F1729', margin: '-24px', padding: '24px' }}>
        {/* Day Off Badge */}
        {dayOff && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Day Off</span>
          </div>
        )}

        {/* Summary Section — 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-400">Available</p>
            </div>
            <p className="text-lg font-semibold text-white">
              {availableHours}h
            </p>
          </div>

          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-400">Scheduled</p>
            </div>
            <p className="text-lg font-semibold text-white">
              {scheduledHours}h
            </p>
          </div>

          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-400">Actual</p>
            </div>
            <p className="text-lg font-semibold text-white">
              {actualHours.toFixed(1)}h
            </p>
          </div>

          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              {isOvertime ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-green-500" />
              )}
              <p className="text-xs text-slate-400">Status</p>
            </div>
            <p
              className={`text-lg font-semibold ${
                isOvertime ? "text-red-600" : "text-green-600"
              }`}
            >
              {isOvertime ? "Overtime" : "On Track"}
            </p>
          </div>
        </div>

        {/* Hourly Timeline */}
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase mb-2">
            Hourly Timeline
          </p>
          <div className="space-y-0.5">
            {hourSlots.map((hour) => {
              const hourTasks = getTasksForDate(activeTasks, date);
              const hourEntries = getEntriesForHour(dayEntries, hour, date);
              const hasBreaks = hourEntries.some((e) => e.breakMinutes > 0);
              const hasTask = hourTasks.length > 0;
              const hasEntry = hourEntries.length > 0;

              return (
                <div
                  key={hour}
                  className="flex items-start gap-3 py-1.5 border-b border-white/5"
                >
                  <span className="text-xs text-slate-400 w-16 flex-shrink-0 pt-0.5">
                    {formatHour(hour)}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Scheduled tasks */}
                    {hourTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 mr-1"
                      >
                        <span className="font-medium">
                          {task.jobOrder.jobOrderNumber}
                        </span>
                        <span className="text-blue-500">{task.name}</span>
                      </div>
                    ))}

                    {/* Actual time entries */}
                    {hourEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 mr-1"
                      >
                        <span>
                          {formatTime(entry.clockIn)}
                          {" - "}
                          {entry.clockOut
                            ? formatTime(entry.clockOut)
                            : "Active"}
                        </span>
                      </div>
                    ))}

                    {/* Break indicator */}
                    {hasBreaks && (
                      <div className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded inline-flex items-center gap-1">
                        <Coffee className="w-3 h-3" />
                        <span>Break</span>
                      </div>
                    )}

                    {/* Idle: has entry but no task */}
                    {hasEntry && !hasTask && !hasBreaks && (
                      <div className="bg-white/5 text-slate-400 text-xs px-2 py-0.5 rounded inline-block">
                        Idle
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tasks List */}
        {activeTasks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase">
              Tasks
            </p>
            {activeTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${statusDotColor(task.status)}`}
                />
                <span className="font-medium text-white">
                  {task.jobOrder.jobOrderNumber}
                </span>
                <span className="text-slate-400">{task.name}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {task.estimatedHours}h est
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {activeTasks.length === 0 && dayEntries.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks or entries for this day</p>
          </div>
        )}
      </div>
    </SlideOver>
  );
}

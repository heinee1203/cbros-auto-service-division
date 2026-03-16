import { addDaysToDate, getDateKey, getTimelineDays, formatShortDate, hexToRgba } from "./bay-timeline-types";

// Re-export bay timeline utilities
export { addDaysToDate, getDateKey, getTimelineDays, formatShortDate, hexToRgba };

export interface TechTimelineTech {
  id: string;
  firstName: string;
  lastName: string;
  workSchedule: string | null; // JSON string
  maxConcurrentJobs: number;
  assignedTasks: TechTask[];
  timeEntries: TechTimeEntry[];
}

export interface TechTask {
  id: string;
  name: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  assignedTechnicianId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    status: string;
    priority: string;
    scheduledStartDate: string | null;
    scheduledEndDate: string | null;
    vehicle: { plateNumber: string; make: string; model: string } | null;
  };
}

export interface TechTimeEntry {
  id: string;
  taskId: string;
  clockIn: string;
  clockOut: string | null;
  netMinutes: number;
  breakMinutes: number;
  isOvertime: boolean;
}

export interface WorkSchedule {
  mon?: DaySchedule;
  tue?: DaySchedule;
  wed?: DaySchedule;
  thu?: DaySchedule;
  fri?: DaySchedule;
  sat?: DaySchedule;
  sun?: DaySchedule;
}

export interface DaySchedule {
  start: string; // "08:00"
  end: string;   // "17:00"
  off?: boolean;
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  mon: { start: "08:00", end: "17:00" },
  tue: { start: "08:00", end: "17:00" },
  wed: { start: "08:00", end: "17:00" },
  thu: { start: "08:00", end: "17:00" },
  fri: { start: "08:00", end: "17:00" },
  sat: { start: "08:00", end: "12:00", off: true },
  sun: { start: "08:00", end: "17:00", off: true },
};

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const TECH_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export interface TechDragState {
  taskId: string;
  originalTechId: string;
  originalStartCol: number;
  originalColSpan: number;
  dayOffset: number;
  techOffset: number;
}

/** Parse workSchedule JSON string safely */
export function parseWorkSchedule(raw: string | null): WorkSchedule | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkSchedule;
  } catch {
    return null;
  }
}

/** Get working hours for a technician on a specific date */
export function getWorkingHours(schedule: WorkSchedule | null, date: Date): number {
  if (!schedule) return 8;
  const dayKey = DAY_KEYS[date.getDay()];
  const day = schedule[dayKey];
  if (!day || day.off) return 0;
  const [sh, sm] = day.start.split(":").map(Number);
  const [eh, em] = day.end.split(":").map(Number);
  return Math.max(0, (eh + em / 60) - (sh + sm / 60));
}

/** Check if a day is a day off */
export function isDayOff(schedule: WorkSchedule | null, date: Date): boolean {
  if (!schedule) return date.getDay() === 0 || date.getDay() === 6;
  const dayKey = DAY_KEYS[date.getDay()];
  const day = schedule[dayKey];
  return !day || !!day.off;
}

/** Get task date range for timeline positioning */
export function getTaskDateRange(task: TechTask): { start: Date; end: Date } {
  const startStr = task.jobOrder.scheduledStartDate || task.startedAt || task.createdAt;
  const endStr = task.completedAt || task.jobOrder.scheduledEndDate;
  const start = new Date(startStr);
  const end = endStr
    ? new Date(endStr)
    : addDaysToDate(start, Math.max(0, Math.ceil(task.estimatedHours / 8) - 1));
  return { start, end };
}

/** Get task span within the visible timeline range */
export function getTaskSpan(
  task: TechTask,
  rangeStart: Date,
  rangeDays: number
): { startCol: number; colSpan: number } | null {
  const { start, end } = getTaskDateRange(task);
  const rangeEnd = addDaysToDate(rangeStart, rangeDays - 1);

  // Task is completely outside visible range
  if (end < rangeStart || start > rangeEnd) return null;

  // Clamp to visible range
  const clampedStart = start < rangeStart ? rangeStart : start;
  const clampedEnd = end > rangeEnd ? rangeEnd : end;

  const startDayIndex = Math.floor(
    (clampedStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const endDayIndex = Math.floor(
    (clampedEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    startCol: startDayIndex + 2, // +2 because col 1 is the label column
    colSpan: Math.max(1, endDayIndex - startDayIndex + 1),
  };
}

/** Calculate capacity metrics for a tech over a date range */
export function calcTechCapacity(
  tech: TechTimelineTech,
  rangeStart: Date,
  rangeDays: number
) {
  const schedule = parseWorkSchedule(tech.workSchedule);
  let availableHours = 0;
  let scheduledHours = 0;
  let actualMinutes = 0;

  const days = getTimelineDays(rangeStart, rangeDays);

  for (const day of days) {
    availableHours += getWorkingHours(schedule, day);
  }

  for (const task of tech.assignedTasks) {
    if (task.status !== "DONE") {
      scheduledHours += task.estimatedHours;
    }
  }

  for (const entry of tech.timeEntries) {
    actualMinutes += entry.netMinutes;
  }

  const actualHours = actualMinutes / 60;
  const loadPercent = availableHours > 0
    ? Math.round((scheduledHours / availableHours) * 100)
    : 0;

  return { availableHours, scheduledHours, actualHours, loadPercent };
}

/** Status color mapping for task blocks */
export const TASK_STATUS_BLOCK_COLORS: Record<string, { bg: string; border: string }> = {
  QUEUED: { bg: "bg-surface-100", border: "border-l-surface-400" },
  IN_PROGRESS: { bg: "bg-blue-50", border: "border-l-blue-500" },
  PAUSED: { bg: "bg-amber-50", border: "border-l-amber-500" },
  QC_REVIEW: { bg: "bg-purple-50", border: "border-l-purple-500" },
  DONE: { bg: "bg-green-50", border: "border-l-green-500" },
  REWORK: { bg: "bg-red-50", border: "border-l-red-500" },
};

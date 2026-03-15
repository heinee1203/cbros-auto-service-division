// Bay Timeline Gantt Chart — Types & Utilities

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineBay {
  id: string;
  name: string;
  type: string;
  color: string | null;
  sortOrder: number;
  capacity: number;
  isActive: boolean;
  assignments: TimelineAssignment[];
}

export interface TimelineAssignment {
  id: string;
  bayId: string;
  startDate: string; // ISO
  endDate: string | null; // ISO or null = ongoing
  notes: string | null;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    status: string;
    priority: string;
    customer: { firstName: string; lastName: string };
    vehicle: {
      plateNumber: string;
      make: string;
      model: string;
      color: string;
    } | null;
    primaryTechnician: { firstName: string; lastName: string } | null;
  };
}

export interface DragState {
  assignmentId: string;
  originalBayId: string;
  originalStartCol: number;
  originalColSpan: number;
  mode: "move" | "resize";
  dayOffset: number;
  bayOffset: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default bay color (indigo) when bay.color is null */
export const DEFAULT_BAY_COLOR = "#6366F1";

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Normalize a date to midnight (strip time component), returns new Date */
function toMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Array of Date objects for the timeline range */
export function getTimelineDays(start: Date, count: number): Date[] {
  const days: Date[] = [];
  const base = toMidnight(start);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Number of days between two dates (can be negative) */
export function getDaysBetween(a: Date, b: Date): number {
  const aMid = toMidnight(a).getTime();
  const bMid = toMidnight(b).getTime();
  return Math.round((bMid - aMid) / 86_400_000);
}

/**
 * Get grid column start and span for an assignment, clamped to visible range.
 * startCol is 1-indexed (for CSS grid). colSpan is at least 1.
 * rangeStart is the first visible day, rangeDays is number of visible days.
 */
export function getAssignmentSpan(
  assignment: TimelineAssignment,
  rangeStart: Date,
  rangeDays: number,
): { startCol: number; colSpan: number } {
  const start = toMidnight(new Date(assignment.startDate));
  const rangeStartMid = toMidnight(rangeStart);

  // If ongoing (no end date), extend to end of visible range
  const end = assignment.endDate
    ? toMidnight(new Date(assignment.endDate))
    : addDaysToDate(rangeStartMid, rangeDays);

  // Calculate raw columns relative to rangeStart (1-indexed)
  const rawStartCol = getDaysBetween(rangeStartMid, start) + 1;
  // endCol is exclusive (CSS grid convention): day after end date
  const rawEndCol = getDaysBetween(rangeStartMid, end) + 2;

  // Clamp to visible range
  const startCol = Math.max(1, rawStartCol);
  const endCol = Math.min(rangeDays + 1, rawEndCol);

  const colSpan = Math.max(1, endCol - startCol);

  return { startCol, colSpan };
}

/** Whether assignment has no end date (ongoing) */
export function isOngoing(assignment: TimelineAssignment): boolean {
  return assignment.endDate === null;
}

/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace(/^#/, "");

  // Expand 3-char hex to 6-char
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Add days to a date, returns new Date */
export function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format date as "Mon 15" */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    day: "numeric",
  });
}

/** Format date as "YYYY-MM-DD" */
export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

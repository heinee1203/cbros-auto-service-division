// src/components/schedule/calendar-types.ts

// Appointment as returned by API (matches getAppointments include from scheduler service)
export interface CalendarAppointment {
  id: string;
  customerId: string;
  vehicleId: string | null;
  estimateId: string | null;
  type: string;
  scheduledDate: string; // ISO
  scheduledTime: string; // "HH:MM"
  duration: number; // minutes
  status: string;
  notes: string | null;
  createdAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    company: string | null;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string;
  } | null;
  estimate: {
    id: string;
    requestNumber: string;
    status: string;
  } | null;
  createdByUser: {
    firstName: string;
    lastName: string;
  };
}

export type CalendarView = "month" | "week" | "day" | "list";

export interface CalendarFilters {
  status?: string;
  type?: string;
}

// ── Date helpers ──────────────────────────────────────────────────────────

export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  // Extend to full weeks (Sunday start)
  start.setDate(start.getDate() - start.getDay());
  end.setDate(end.getDate() + (6 - end.getDay()));
  return { start, end };
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
}

export function formatWeekRange(date: Date): string {
  const { start, end } = getWeekRange(date);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-PH", opts)} – ${end.toLocaleDateString("en-PH", { ...opts, year: "numeric" })}`;
}

export function formatTimeSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ── Shared color maps (avoid duplication across views) ────────────────────

/** Dot colors: color-name → hex (month view chips, widget dots) */
export const TYPE_DOT_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  purple: "#a855f7",
  surface: "#94a3b8",
};

/** Block colors: color-name → {bg, border, text} (week/day view blocks) */
export const TYPE_BLOCK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8" },
  green: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
  amber: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" },
  purple: { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce" },
  surface: { bg: "#f8fafc", border: "#94a3b8", text: "#475569" },
};

/** Map enum color names to Badge component variant props */
export const BADGE_VARIANT_MAP: Record<string, "default" | "success" | "warning" | "danger" | "accent" | "outline"> = {
  blue: "accent",
  green: "success",
  amber: "warning",
  purple: "accent",
  surface: "default",
  red: "danger",
};

export function getBadgeVariant(color: string): "default" | "success" | "warning" | "danger" | "accent" | "outline" {
  return BADGE_VARIANT_MAP[color] || "default";
}

// Group appointments by date key
export function groupByDate(appointments: CalendarAppointment[]): Map<string, CalendarAppointment[]> {
  const map = new Map<string, CalendarAppointment[]>();
  for (const appt of appointments) {
    const key = appt.scheduledDate.split("T")[0];
    const arr = map.get(key) || [];
    arr.push(appt);
    map.set(key, arr);
  }
  return map;
}

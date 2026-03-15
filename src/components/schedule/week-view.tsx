"use client";

import {
  CalendarAppointment,
  getWeekRange,
  isSameDay,
  isToday,
  getDateKey,
  groupByDate,
  formatTimeSlot,
} from "./calendar-types";
import { APPOINTMENT_TYPE_COLORS } from "@/types/enums";

// ── Color helpers ───────────────────────────────────────────────────────────

const TYPE_COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8" },
  green: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
  amber: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" },
  purple: { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce" },
  surface: { bg: "#f8fafc", border: "#94a3b8", text: "#475569" },
};

function getColors(type: string) {
  const colorName = APPOINTMENT_TYPE_COLORS[type as keyof typeof APPOINTMENT_TYPE_COLORS] || "surface";
  return TYPE_COLOR_MAP[colorName] || TYPE_COLOR_MAP.surface;
}

// ── Hours displayed ─────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM – 7 PM

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h} ${period}`;
}

// ── Component ───────────────────────────────────────────────────────────────

interface WeekViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

export default function WeekView({ currentDate, appointments, onAppointmentClick }: WeekViewProps) {
  const { start } = getWeekRange(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const grouped = groupByDate(appointments);

  return (
    <div className="relative h-[720px] overflow-y-auto border border-surface-200 rounded-lg bg-white">
      {/* Sticky header row */}
      <div className="sticky top-0 z-10 flex border-b border-surface-200 bg-white">
        {/* Time gutter label */}
        <div className="w-[60px] shrink-0" />
        {/* Day headers */}
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex-1 text-center text-sm py-2 border-l border-surface-100 ${
                today ? "text-accent-600 font-bold" : "text-surface-600"
              }`}
            >
              {day.toLocaleDateString("en-PH", { weekday: "short" })}{" "}
              {day.getDate()}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex">
        {/* Left gutter — time labels */}
        <div className="w-[60px] shrink-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-[60px] border-t border-surface-100 pr-2 text-right text-xs text-surface-400 leading-none pt-1"
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const key = getDateKey(day);
          const dayAppts = grouped.get(key) || [];

          return (
            <div key={key} className="relative flex-1 border-l border-surface-100">
              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="h-[60px] border-t border-surface-100" />
              ))}

              {/* Appointment blocks */}
              {dayAppts.map((appt) => {
                const [h, m] = appt.scheduledTime.split(":").map(Number);
                const colors = getColors(appt.type);
                return (
                  <div
                    key={appt.id}
                    className="absolute left-0 right-0 mx-0.5 rounded px-1 py-0.5 cursor-pointer text-xs overflow-hidden"
                    style={{
                      top: `${(h - 7) * 60 + m}px`,
                      height: `${Math.max(appt.duration, 20)}px`,
                      backgroundColor: colors.bg,
                      borderLeft: `4px solid ${colors.border}`,
                      color: colors.text,
                    }}
                    onClick={() => onAppointmentClick(appt)}
                  >
                    <div className="font-medium truncate">{formatTimeSlot(appt.scheduledTime)}</div>
                    <div className="truncate">{appt.customer.lastName}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

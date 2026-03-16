"use client";

import {
  CalendarAppointment,
  getWeekRange,
  isToday,
  getDateKey,
  groupByDate,
  formatTimeSlot,
  TYPE_BLOCK_COLORS,
} from "./calendar-types";
import { APPOINTMENT_TYPE_COLORS } from "@/types/enums";

function getColors(type: string) {
  const colorName = APPOINTMENT_TYPE_COLORS[type as keyof typeof APPOINTMENT_TYPE_COLORS] || "surface";
  return TYPE_BLOCK_COLORS[colorName] || TYPE_BLOCK_COLORS.surface;
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
    <div className="relative h-[720px] overflow-y-auto border rounded-lg" style={{ borderColor: 'var(--sch-border)', background: 'var(--sch-surface)' }}>
      {/* Sticky header row */}
      <div className="sticky top-0 z-10 flex border-b" style={{ borderColor: 'var(--sch-border)', background: 'var(--sch-bg)' }}>
        {/* Time gutter label */}
        <div className="w-[60px] shrink-0" />
        {/* Day headers */}
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex-1 text-center text-sm py-2 border-l ${
                today ? "text-accent-400 font-bold" : ""
              }`}
              style={{ borderColor: 'var(--sch-border)', ...(!today ? { color: 'var(--sch-text-muted)' } : {}) }}
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
              className="h-[60px] border-t pr-2 text-right text-xs leading-none pt-1" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
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
            <div key={key} className="relative flex-1 border-l" style={{ borderColor: 'var(--sch-border)' }}>
              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="h-[60px] border-t" style={{ borderColor: 'var(--sch-border)' }} />
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

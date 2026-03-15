"use client";

import {
  CalendarAppointment,
  formatTimeSlot,
  TYPE_BLOCK_COLORS,
} from "./calendar-types";
import {
  APPOINTMENT_TYPE_COLORS,
  APPOINTMENT_TYPE_LABELS,
} from "@/types/enums";

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

interface DayViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

export default function DayView({ currentDate, appointments, onAppointmentClick }: DayViewProps) {
  // Filter to only appointments for currentDate
  const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
  const dayAppts = appointments.filter((a) => a.scheduledDate.split("T")[0] === dateKey);

  return (
    <div className="relative h-[720px] overflow-y-auto border border-surface-200 rounded-lg bg-white">
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

        {/* Single content column */}
        <div className="relative flex-1 border-l border-surface-100">
          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="h-[60px] border-t border-surface-100" />
          ))}

          {/* Appointment blocks */}
          {dayAppts.map((appt) => {
            const [h, m] = appt.scheduledTime.split(":").map(Number);
            const colors = getColors(appt.type);
            const typeLabel =
              APPOINTMENT_TYPE_LABELS[appt.type as keyof typeof APPOINTMENT_TYPE_LABELS] || appt.type;

            return (
              <div
                key={appt.id}
                className="absolute left-0 right-0 mx-1 rounded px-2 py-1 cursor-pointer text-sm overflow-hidden"
                style={{
                  top: `${(h - 7) * 60 + m}px`,
                  height: `${Math.max(appt.duration, 20)}px`,
                  backgroundColor: colors.bg,
                  borderLeft: `4px solid ${colors.border}`,
                  color: colors.text,
                }}
                onClick={() => onAppointmentClick(appt)}
              >
                <div className="font-medium truncate">
                  {formatTimeSlot(appt.scheduledTime)} — {typeLabel}
                </div>
                <div className="truncate">
                  {appt.customer.firstName} {appt.customer.lastName}
                </div>
                {appt.vehicle && (
                  <div className="truncate text-xs opacity-80">
                    {appt.vehicle.make} {appt.vehicle.model} - {appt.vehicle.plateNumber}
                  </div>
                )}
                {appt.customer.phone && (
                  <div className="truncate text-xs opacity-80">{appt.customer.phone}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  CalendarAppointment,
  getMonthRange,
  isToday,
  getDateKey,
  groupByDate,
  formatTimeSlot,
} from "./calendar-types";
import { APPOINTMENT_TYPE_COLORS } from "@/types/enums";

interface MonthViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

const TYPE_COLOR_MAP: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  purple: "#a855f7",
  surface: "#94a3b8",
};

function getTypeColor(type: string): string {
  const colorName =
    APPOINTMENT_TYPE_COLORS[type as keyof typeof APPOINTMENT_TYPE_COLORS] ||
    "surface";
  return TYPE_COLOR_MAP[colorName] || TYPE_COLOR_MAP.surface;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({
  currentDate,
  appointments,
  onDateClick,
  onAppointmentClick,
}: MonthViewProps) {
  const { start, end } = getMonthRange(currentDate);
  const grouped = groupByDate(appointments);

  const days: Date[] = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  const currentMonth = currentDate.getMonth();

  return (
    <div className="grid grid-cols-7 gap-px bg-surface-200">
      {/* Header row */}
      {DAY_HEADERS.map((day) => (
        <div
          key={day}
          className="text-xs font-medium text-surface-400 text-center py-2 bg-white"
        >
          {day}
        </div>
      ))}

      {/* Day cells */}
      {days.map((date) => {
        const key = getDateKey(date);
        const dayAppointments = grouped.get(key) || [];
        const isCurrentMonth = date.getMonth() === currentMonth;
        const today = isToday(date);
        const visibleAppointments = dayAppointments.slice(0, 3);
        const remaining = dayAppointments.length - 3;

        return (
          <div
            key={key}
            className={`min-h-[100px] p-1 ${
              isCurrentMonth ? "bg-white" : "bg-surface-50"
            }`}
            onClick={() => onDateClick(date)}
          >
            {/* Day number */}
            <div className="mb-0.5">
              {today ? (
                <span className="w-7 h-7 rounded-full bg-accent-600 text-white flex items-center justify-center text-sm font-medium">
                  {date.getDate()}
                </span>
              ) : (
                <span
                  className={`text-sm font-medium cursor-pointer ${
                    isCurrentMonth ? "text-surface-900" : "text-surface-300"
                  }`}
                >
                  {date.getDate()}
                </span>
              )}
            </div>

            {/* Appointment chips */}
            <div className="space-y-0.5">
              {visibleAppointments.map((appt) => (
                <button
                  key={appt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAppointmentClick(appt);
                  }}
                  className="w-full flex items-center gap-1 text-xs px-1 py-0.5 rounded cursor-pointer hover:bg-surface-100 truncate text-left"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getTypeColor(appt.type) }}
                  />
                  <span className="truncate">
                    {formatTimeSlot(appt.scheduledTime)} {appt.customer.lastName}
                  </span>
                </button>
              ))}

              {remaining > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateClick(date);
                  }}
                  className="text-xs text-accent-600 font-medium px-1 hover:underline cursor-pointer"
                >
                  +{remaining} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

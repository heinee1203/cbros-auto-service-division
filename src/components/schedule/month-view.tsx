"use client";

import {
  CalendarAppointment,
  getMonthRange,
  isToday,
  getDateKey,
  groupByDate,
  formatTimeSlot,
  TYPE_DOT_COLORS,
} from "./calendar-types";
import { APPOINTMENT_TYPE_COLORS } from "@/types/enums";

interface MonthViewProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

function getTypeColor(type: string): string {
  const colorName =
    APPOINTMENT_TYPE_COLORS[type as keyof typeof APPOINTMENT_TYPE_COLORS] ||
    "surface";
  return TYPE_DOT_COLORS[colorName] || TYPE_DOT_COLORS.surface;
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
    <div className="grid grid-cols-7 gap-px bg-white/10">
      {/* Header row */}
      {DAY_HEADERS.map((day) => (
        <div
          key={day}
          className="text-xs font-medium text-slate-400 text-center py-2 bg-white/5"
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
              isCurrentMonth ? "bg-white/5" : "bg-transparent"
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
                    isCurrentMonth ? "text-white" : "text-slate-500"
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
                  className="w-full flex items-center gap-1 text-xs px-1 py-0.5 rounded cursor-pointer hover:bg-white/10 truncate text-left text-slate-300"
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

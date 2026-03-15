"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarView, formatMonthYear, formatWeekRange } from "./calendar-types";
import { APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from "@/types/enums";
import { formatDate } from "@/lib/utils";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  filters: { status?: string; type?: string };
  onFiltersChange: (filters: { status?: string; type?: string }) => void;
  onNewAppointment: () => void;
  canManage: boolean;
}

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "list", label: "List" },
];

export function CalendarHeader({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  filters,
  onFiltersChange,
  onNewAppointment,
  canManage,
}: CalendarHeaderProps) {
  function navigate(direction: 1 | -1) {
    const d = new Date(currentDate);
    switch (view) {
      case "month":
        d.setMonth(d.getMonth() + direction);
        break;
      case "week":
        d.setDate(d.getDate() + 7 * direction);
        break;
      case "day":
        d.setDate(d.getDate() + direction);
        break;
      case "list":
        d.setMonth(d.getMonth() + direction);
        break;
    }
    onDateChange(d);
  }

  function getTitle(): string {
    switch (view) {
      case "month":
        return formatMonthYear(currentDate);
      case "week":
        return formatWeekRange(currentDate);
      case "day":
        return formatDate(currentDate);
      case "list":
        return formatMonthYear(currentDate);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
      {/* Row 1: Navigation + title + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-primary min-w-[200px] text-center">
            {getTitle()}
          </h2>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onDateChange(new Date())}
            className="text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
          >
            Today
          </button>
          {canManage && (
            <button
              type="button"
              onClick={onNewAppointment}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-semibold hover:bg-accent-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Appointment
            </button>
          )}
        </div>
      </div>

      {/* Row 2: View tabs + filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onViewChange(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                view === opt.value
                  ? "bg-accent-600 text-white"
                  : "text-surface-500 hover:text-primary hover:bg-surface-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filters.type ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, type: e.target.value || undefined })
            }
            className="text-sm border border-surface-200 rounded-lg px-2 py-1.5 text-surface-600 bg-white"
          >
            <option value="">All Types</option>
            {Object.entries(APPOINTMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filters.status ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, status: e.target.value || undefined })
            }
            className="text-sm border border-surface-200 rounded-lg px-2 py-1.5 text-surface-600 bg-white"
          >
            <option value="">All Statuses</option>
            {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

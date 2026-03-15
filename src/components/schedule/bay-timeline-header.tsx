"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysToDate } from "./bay-timeline-types";

interface BayTimelineHeaderProps {
  startDate: Date;
  onStartDateChange: (date: Date) => void;
  days: number;
  onDaysChange: (days: number) => void;
}

const DAY_OPTIONS = [7, 14, 30] as const;

export function BayTimelineHeader({
  startDate,
  onStartDateChange,
  days,
  onDaysChange,
}: BayTimelineHeaderProps) {
  const endDate = addDaysToDate(startDate, days - 1);

  const formatRange = () => {
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    const startStr = startDate.toLocaleDateString("en-PH", opts);
    const endStr = endDate.toLocaleDateString("en-PH", opts);
    return `${startStr} – ${endStr}`;
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    onStartDateChange(today);
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left side: arrows + today + date range */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStartDateChange(addDaysToDate(startDate, -7))}
          className="rounded-lg border border-surface-200 p-1.5 hover:bg-surface-50 transition-colors"
          aria-label="Previous 7 days"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onStartDateChange(addDaysToDate(startDate, 7))}
          className="rounded-lg border border-surface-200 p-1.5 hover:bg-surface-50 transition-colors"
          aria-label="Next 7 days"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleToday}
          className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium hover:bg-surface-50 transition-colors"
        >
          Today
        </button>
        <span className="ml-2 text-sm font-medium text-surface-700">
          {formatRange()}
        </span>
      </div>

      {/* Right side: day range pills */}
      <div className="flex items-center rounded-lg bg-surface-100 p-1">
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDaysChange(option)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              days === option
                ? "bg-white shadow-sm text-surface-900"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            {option}d
          </button>
        ))}
      </div>
    </div>
  );
}

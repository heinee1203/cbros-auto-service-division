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
          className="rounded-lg border border-white/10 p-1.5 hover:bg-white/5 transition-colors text-slate-400"
          aria-label="Previous 7 days"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onStartDateChange(addDaysToDate(startDate, 7))}
          className="rounded-lg border border-white/10 p-1.5 hover:bg-white/5 transition-colors text-slate-400"
          aria-label="Next 7 days"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleToday}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/5 transition-colors text-white"
        >
          Today
        </button>
        <span className="ml-2 text-sm font-medium text-slate-300">
          {formatRange()}
        </span>
      </div>

      {/* Right side: day range pills */}
      <div className="flex items-center rounded-lg bg-white/5 p-1">
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDaysChange(option)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              days === option
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {option}d
          </button>
        ))}
      </div>
    </div>
  );
}

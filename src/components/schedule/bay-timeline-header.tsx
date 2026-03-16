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
          className="rounded-lg border p-1.5 transition-colors" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
          aria-label="Previous 7 days"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onStartDateChange(addDaysToDate(startDate, 7))}
          className="rounded-lg border p-1.5 transition-colors" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
          aria-label="Next 7 days"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleToday}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text)' }}
        >
          Today
        </button>
        <span className="ml-2 text-sm font-medium" style={{ color: 'var(--sch-text-muted)' }}>
          {formatRange()}
        </span>
      </div>

      {/* Right side: day range pills */}
      <div className="flex items-center rounded-lg p-1" style={{ background: 'var(--sch-surface)' }}>
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onDaysChange(option)}
            className="rounded-md px-3 py-1 text-sm font-medium transition-colors"
            style={
              days === option
                ? { background: 'var(--sch-surface-hover)', color: 'var(--sch-text)' }
                : { color: 'var(--sch-text-muted)' }
            }
          >
            {option}d
          </button>
        ))}
      </div>
    </div>
  );
}

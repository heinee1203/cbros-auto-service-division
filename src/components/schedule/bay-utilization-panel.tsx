"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  TimelineBay,
  TimelineAssignment,
  DEFAULT_BAY_COLOR,
  getDaysBetween,
  addDaysToDate,
} from "./bay-timeline-types";

interface BayUtilizationPanelProps {
  bays: TimelineBay[];
  startDate: Date;
  days: number;
}

interface BayUtilization {
  bay: TimelineBay;
  utilization: number;
  nextAvailable: string;
  nextAvailableColor: "green" | "red" | "default";
}

function toMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeOccupiedDays(
  assignments: TimelineAssignment[],
  rangeStart: Date,
  rangeDays: number,
): number {
  const rangeStartMid = toMidnight(rangeStart);
  const rangeEnd = addDaysToDate(rangeStartMid, rangeDays);

  let total = 0;
  for (const a of assignments) {
    const aStart = toMidnight(new Date(a.startDate));
    // Ongoing assignments extend through the range end
    const aEnd = a.endDate ? toMidnight(new Date(a.endDate)) : rangeEnd;

    // Overlap: max(aStart, rangeStart) to min(aEnd, rangeEnd - 1 day)
    const overlapStart = aStart > rangeStartMid ? aStart : rangeStartMid;
    const overlapEnd = aEnd < rangeEnd ? aEnd : addDaysToDate(rangeEnd, -1);

    const overlapDays = getDaysBetween(overlapStart, overlapEnd) + 1;
    if (overlapDays > 0) {
      total += overlapDays;
    }
  }

  // Cap at total days in range
  return Math.min(total, rangeDays);
}

function computeNextAvailable(
  assignments: TimelineAssignment[],
): { label: string; color: "green" | "red" | "default" } {
  // Check for ongoing assignment
  const hasOngoing = assignments.some((a) => a.endDate === null);
  if (hasOngoing) {
    return { label: "Occupied", color: "red" };
  }

  const today = toMidnight(new Date());

  // Find the last assignment that overlaps with or extends past today
  let latestEnd: Date | null = null;
  for (const a of assignments) {
    if (!a.endDate) continue;
    const aEnd = toMidnight(new Date(a.endDate));
    if (aEnd >= today) {
      if (!latestEnd || aEnd > latestEnd) {
        latestEnd = aEnd;
      }
    }
  }

  if (!latestEnd) {
    return { label: "Available now", color: "green" };
  }

  const nextDay = addDaysToDate(latestEnd, 1);
  const formatted = nextDay.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  return { label: `Next: ${formatted}`, color: "default" };
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export default function BayUtilizationPanel({
  bays,
  startDate,
  days,
}: BayUtilizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const bayUtilizations = useMemo<BayUtilization[]>(() => {
    return bays.map((bay) => {
      const occupied = computeOccupiedDays(bay.assignments, startDate, days);
      const utilization = days > 0 ? (occupied / days) * 100 : 0;
      const next = computeNextAvailable(bay.assignments);
      return {
        bay,
        utilization,
        nextAvailable: next.label,
        nextAvailableColor: next.color,
      };
    });
  }, [bays, startDate, days]);

  const shopAverage = useMemo(() => {
    if (bayUtilizations.length === 0) return 0;
    const sum = bayUtilizations.reduce((acc, b) => acc + b.utilization, 0);
    return sum / bayUtilizations.length;
  }, [bayUtilizations]);

  return (
    <div className="border border-surface-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-primary hover:bg-surface-50 transition-colors rounded-lg"
      >
        <span>Utilization</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-surface-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Shop Average */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-surface-500 w-36 shrink-0">
              Shop Average
            </span>
            <div className="flex-1 bg-surface-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(shopAverage, 100)}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-primary w-12 text-right">
              {formatPercent(shopAverage)}
            </span>
            {/* Spacer to align with next-available column */}
            <span className="w-28 shrink-0" />
          </div>

          <div className="border-t border-surface-100" />

          {/* Per-bay rows */}
          {bayUtilizations.map(({ bay, utilization, nextAvailable, nextAvailableColor }) => (
            <div key={bay.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-36 shrink-0">
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: bay.color || DEFAULT_BAY_COLOR }}
                />
                <span className="text-sm font-medium text-primary truncate">
                  {bay.name}
                </span>
              </div>
              <div className="flex-1 bg-surface-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-primary w-12 text-right">
                {formatPercent(utilization)}
              </span>
              <span
                className={`text-xs w-28 shrink-0 text-right ${
                  nextAvailableColor === "green"
                    ? "text-emerald-600"
                    : nextAvailableColor === "red"
                      ? "text-red-500"
                      : "text-surface-500"
                }`}
              >
                {nextAvailable}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

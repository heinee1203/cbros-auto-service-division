"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { BAY_TYPE_LABELS, type BayType } from "@/types/enums";
import {
  type TimelineAssignment,
  type TimelineBay,
  DEFAULT_BAY_COLOR,
  formatShortDate,
  getAssignmentSpan,
  getDateKey,
  getTimelineDays,
} from "./bay-timeline-types";
import { BayAssignmentBlock } from "./bay-assignment-block";

interface BayTimelineGridProps {
  bays: TimelineBay[];
  startDate: Date;
  days: number;
  onAssignmentClick: (assignment: TimelineAssignment) => void;
  onEmptyCellClick: (bayId: string, date: Date) => void;
}

export interface BayTimelineGridHandle {
  scrollToBay: (bayId: string) => void;
}

const BayTimelineGrid = forwardRef<BayTimelineGridHandle, BayTimelineGridProps>(
  function BayTimelineGrid(
    { bays, startDate, days, onAssignmentClick, onEmptyCellClick },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(ref, () => ({
      scrollToBay(bayId: string) {
        const row = rowRefs.current.get(bayId);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    }));

    const timelineDays = getTimelineDays(startDate, days);
    const todayKey = getDateKey(new Date());

    return (
      <div
        ref={containerRef}
        className="overflow-x-auto border border-surface-200 rounded-lg bg-white min-h-[400px] max-h-[70vh]"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `180px repeat(${days}, minmax(60px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div className="sticky top-0 z-10 bg-surface-50 border-b border-surface-200 border-r border-r-surface-100 px-3 py-2" />
          {timelineDays.map((day) => {
            const key = getDateKey(day);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`sticky top-0 z-10 border-b border-surface-200 px-1 py-2 text-center text-xs ${
                  isToday ? "bg-amber-50 font-semibold" : "bg-surface-50"
                }`}
              >
                {formatShortDate(day)}
              </div>
            );
          })}

          {/* Bay rows */}
          {bays.map((bay) => {
            const bayColor = bay.color || DEFAULT_BAY_COLOR;
            const typeLabel =
              BAY_TYPE_LABELS[bay.type as BayType] ?? bay.type;

            return (
              <div
                key={bay.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(bay.id, el);
                }}
                className="grid col-span-full border-t border-surface-100"
                style={{
                  gridTemplateColumns: `180px repeat(${days}, minmax(60px, 1fr))`,
                  gridTemplateRows: "1fr",
                }}
              >
                {/* Bay label cell */}
                <div className="border-r border-surface-100 px-3 py-2 flex items-center gap-2 row-start-1 col-start-1">
                  <span
                    className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bayColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {bay.name}
                    </div>
                    <div className="text-xs text-surface-400">{typeLabel}</div>
                  </div>
                </div>

                {/* Empty clickable cells */}
                {timelineDays.map((day, i) => {
                  const key = getDateKey(day);
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onEmptyCellClick(bay.id, day)}
                      className={`row-start-1 border-r border-surface-50 hover:bg-surface-50 transition-colors ${
                        isToday ? "bg-amber-50/50" : ""
                      }`}
                      style={{ gridColumn: i + 2 }}
                      aria-label={`Assign to ${bay.name} on ${formatShortDate(day)}`}
                    />
                  );
                })}

                {/* Assignment blocks */}
                {bay.assignments.map((assignment) => {
                  const { startCol, colSpan } = getAssignmentSpan(
                    assignment,
                    startDate,
                    days,
                  );
                  // +1 to account for the bay label column
                  const gridStartCol = startCol + 1;

                  return (
                    <BayAssignmentBlock
                      key={assignment.id}
                      assignment={assignment}
                      bayColor={bayColor}
                      onClick={() => onAssignmentClick(assignment)}
                      startCol={gridStartCol}
                      colSpan={colSpan}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

export { BayTimelineGrid };

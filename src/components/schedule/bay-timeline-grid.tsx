"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { BAY_TYPE_LABELS, type BayType } from "@/types/enums";
import {
  type DragState,
  type TimelineAssignment,
  type TimelineBay,
  DEFAULT_BAY_COLOR,
  formatShortDate,
  getAssignmentSpan,
  getDateKey,
  getTimelineDays,
  hexToRgba,
} from "./bay-timeline-types";
import { BayAssignmentBlock } from "./bay-assignment-block";

interface BayTimelineGridProps {
  bays: TimelineBay[];
  startDate: Date;
  days: number;
  onAssignmentClick: (assignment: TimelineAssignment) => void;
  onEmptyCellClick: (bayId: string, date: Date) => void;
  // Drag-and-drop props (optional)
  dragState?: DragState | null;
  onBlockPointerDown?: (
    e: React.PointerEvent,
    assignmentId: string,
    bayId: string,
    startCol: number,
    colSpan: number,
    mode: "move" | "resize",
  ) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  ghostStyle?: React.CSSProperties | null;
}

export interface BayTimelineGridHandle {
  scrollToBay: (bayId: string) => void;
}

const BayTimelineGrid = forwardRef<BayTimelineGridHandle, BayTimelineGridProps>(
  function BayTimelineGrid(
    {
      bays,
      startDate,
      days,
      onAssignmentClick,
      onEmptyCellClick,
      dragState,
      onBlockPointerDown,
      onPointerMove,
      onPointerUp,
      ghostStyle,
    },
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

    // Find the dragged assignment for the ghost overlay
    const draggedAssignment =
      dragState
        ? bays
            .flatMap((b) => b.assignments)
            .find((a) => a.id === dragState.assignmentId)
        : null;

    const draggedBayColor =
      dragState && draggedAssignment
        ? (bays.find((b) => b.id === dragState.originalBayId)?.color ??
          DEFAULT_BAY_COLOR)
        : null;

    return (
      <div
        ref={containerRef}
        className="overflow-x-auto border border-white/10 rounded-lg bg-white/5 min-h-[400px] max-h-[70vh]"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `180px repeat(${days}, minmax(60px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div className="sticky top-0 z-10 bg-white/5 border-b border-white/10 border-r border-r-white/5 px-3 py-2" />
          {timelineDays.map((day) => {
            const key = getDateKey(day);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`sticky top-0 z-10 border-b border-white/10 px-1 py-2 text-center text-xs text-slate-400 ${
                  isToday ? "bg-amber-500/10 font-semibold text-amber-400" : "bg-white/5"
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
                className="grid col-span-full border-t border-white/5"
                style={{
                  gridTemplateColumns: `180px repeat(${days}, minmax(60px, 1fr))`,
                  gridTemplateRows: "1fr",
                }}
              >
                {/* Bay label cell */}
                <div className="border-r border-white/5 px-3 py-2 flex items-center gap-2 row-start-1 col-start-1">
                  <span
                    className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bayColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate text-white">
                      {bay.name}
                    </div>
                    <div className="text-xs text-slate-400">{typeLabel}</div>
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
                      className={`row-start-1 border-r border-white/5 hover:bg-white/5 transition-colors ${
                        isToday ? "bg-amber-500/5" : ""
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

                  const isBeingDragged =
                    dragState?.assignmentId === assignment.id;

                  return (
                    <BayAssignmentBlock
                      key={assignment.id}
                      assignment={assignment}
                      bayColor={bayColor}
                      onClick={() => onAssignmentClick(assignment)}
                      startCol={gridStartCol}
                      colSpan={colSpan}
                      enableDrag={!!onBlockPointerDown}
                      onPointerDown={
                        onBlockPointerDown
                          ? (e, mode) =>
                              onBlockPointerDown(
                                e,
                                assignment.id,
                                bay.id,
                                gridStartCol,
                                colSpan,
                                mode,
                              )
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Ghost overlay for the block being dragged */}
          {dragState && draggedAssignment && draggedBayColor && ghostStyle && (
            <div
              className="pointer-events-none opacity-60 rounded-md overflow-hidden"
              style={{
                position: "absolute",
                gridColumn: `${dragState.originalStartCol + 1} / span ${dragState.originalColSpan}`,
                // Position it using CSS grid placement, then translate via ghostStyle
                zIndex: 50,
                background: hexToRgba(draggedBayColor, 0.25),
                borderLeft: `3px solid ${draggedBayColor}`,
                minHeight: "48px",
                padding: "4px 8px",
                ...ghostStyle,
              }}
            >
              <div className="text-xs font-bold truncate">
                {draggedAssignment.jobOrder.vehicle?.plateNumber ??
                  draggedAssignment.jobOrder.jobOrderNumber}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export { BayTimelineGrid };

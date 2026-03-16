"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  type TechTimelineTech,
  type TechTask,
  type TechDragState,
  TECH_COLORS,
  isDayOff,
  parseWorkSchedule,
  calcTechCapacity,
  getTaskSpan,
  TASK_STATUS_BLOCK_COLORS,
  getTimelineDays,
  formatShortDate,
  getDateKey,
  hexToRgba,
} from "./tech-timeline-types";

export interface TechTimelineGridHandle {
  scrollToTech: (techId: string) => void;
}

interface TechTimelineGridProps {
  techs: TechTimelineTech[];
  startDate: Date;
  days: number;
  onTaskClick: (task: TechTask, techId: string) => void;
  onEmptyCellClick?: (techId: string, date: Date) => void;
  dragState: TechDragState | null;
  onBlockPointerDown: (
    e: React.PointerEvent,
    taskId: string,
    techId: string,
    startCol: number,
    colSpan: number,
    mode: "move" | "resize",
  ) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  ghostStyle: React.CSSProperties | null;
}

/** Diagonal stripe pattern for day-off cells */
const DAY_OFF_STRIPE_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 5px)",
};

/** Load bar color based on percentage */
function getLoadColor(pct: number): string {
  if (pct >= 100) return "#EF4444"; // red
  if (pct >= 75) return "#F59E0B"; // amber
  return "#22C55E"; // green
}

/** Get initials from first + last name */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const TechTimelineGrid = forwardRef<TechTimelineGridHandle, TechTimelineGridProps>(
  function TechTimelineGrid(
    {
      techs,
      startDate,
      days,
      onTaskClick,
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
      scrollToTech(techId: string) {
        const row = rowRefs.current.get(techId);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    }));

    const timelineDays = getTimelineDays(startDate, days);
    const todayKey = getDateKey(new Date());

    // Find the dragged task for the ghost overlay
    const draggedTask =
      dragState
        ? techs
            .flatMap((t) => t.assignedTasks)
            .find((task) => task.id === dragState.taskId)
        : null;

    const draggedTechColor =
      dragState
        ? TECH_COLORS[
            techs.findIndex((t) => t.id === dragState.originalTechId) %
              TECH_COLORS.length
          ]
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
            gridTemplateColumns: `200px repeat(${days}, minmax(60px, 1fr))`,
          }}
        >
          {/* Header row — empty label cell + day columns */}
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

          {/* Tech rows */}
          {techs.map((tech, techIndex) => {
            const schedule = parseWorkSchedule(tech.workSchedule);
            const { loadPercent } = calcTechCapacity(tech, startDate, days);
            const techColor = TECH_COLORS[techIndex % TECH_COLORS.length];
            const initials = getInitials(tech.firstName, tech.lastName);
            const hasActiveClock = tech.timeEntries.some(
              (entry) => entry.clockOut === null,
            );

            return (
              <div
                key={tech.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(tech.id, el);
                }}
                className="grid col-span-full border-t border-white/5"
                style={{
                  gridTemplateColumns: `200px repeat(${days}, minmax(60px, 1fr))`,
                  gridTemplateRows: "1fr",
                  minHeight: "64px",
                }}
              >
                {/* Tech label cell */}
                <div className="border-r border-white/5 px-3 py-2 flex items-center gap-2 row-start-1 col-start-1">
                  {/* Avatar circle */}
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: techColor }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold truncate text-white">
                        {tech.firstName} {tech.lastName}
                      </span>
                      {/* Active clock indicator */}
                      {hasActiveClock && (
                        <span className="flex-shrink-0 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </div>
                    {/* Load progress bar */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-10 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, loadPercent)}%`,
                            backgroundColor: getLoadColor(loadPercent),
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {loadPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Empty clickable cells per day */}
                {timelineDays.map((day, i) => {
                  const key = getDateKey(day);
                  const isToday = key === todayKey;
                  const dayOff = isDayOff(schedule, day);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onEmptyCellClick?.(tech.id, day)}
                      className={`row-start-1 border-r border-white/5 hover:bg-white/5 transition-colors ${
                        isToday ? "bg-amber-500/5" : ""
                      } ${dayOff ? "bg-white/5" : ""}`}
                      style={{
                        gridColumn: i + 2,
                        ...(dayOff ? DAY_OFF_STRIPE_STYLE : {}),
                      }}
                      aria-label={`Assign to ${tech.firstName} ${tech.lastName} on ${formatShortDate(day)}`}
                    />
                  );
                })}

                {/* Task blocks */}
                {tech.assignedTasks.map((task) => {
                  const span = getTaskSpan(task, startDate, days);
                  if (!span) return null;

                  const { startCol, colSpan } = span;
                  const statusColors =
                    TASK_STATUS_BLOCK_COLORS[task.status] ??
                    TASK_STATUS_BLOCK_COLORS.QUEUED;

                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onTaskClick(task, tech.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onTaskClick(task, tech.id);
                        }
                      }}
                      aria-label={`${task.name} – ${task.jobOrder.jobOrderNumber}`}
                      onPointerDown={(e) =>
                        onBlockPointerDown(
                          e,
                          task.id,
                          tech.id,
                          startCol,
                          colSpan,
                          "move",
                        )
                      }
                      className={`row-start-1 ${statusColors.bg} border-l-[3px] ${statusColors.border} rounded-md mx-0.5 my-1 px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden z-[1] select-none touch-none`}
                      style={{
                        gridColumn: `${startCol} / span ${colSpan}`,
                      }}
                    >
                      <div className="text-xs font-bold truncate">
                        {task.jobOrder.jobOrderNumber}
                      </div>
                      <div className="text-xs truncate">
                        {task.jobOrder.vehicle?.plateNumber ?? "—"}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {task.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Ghost overlay for the block being dragged */}
          {dragState && draggedTask && draggedTechColor && ghostStyle && (
            <div
              className="pointer-events-none opacity-60 rounded-md overflow-hidden"
              style={{
                position: "absolute",
                gridColumn: `${dragState.originalStartCol} / span ${dragState.originalColSpan}`,
                zIndex: 50,
                background: hexToRgba(draggedTechColor, 0.25),
                borderLeft: `3px solid ${draggedTechColor}`,
                minHeight: "48px",
                padding: "4px 8px",
                ...ghostStyle,
              }}
            >
              <div className="text-xs font-bold truncate">
                {draggedTask.jobOrder.jobOrderNumber}
              </div>
              <div className="text-xs truncate">
                {draggedTask.name}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export { TechTimelineGrid };

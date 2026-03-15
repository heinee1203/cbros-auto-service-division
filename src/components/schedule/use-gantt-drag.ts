"use client";

import { useCallback, useRef, useState } from "react";
import type { DragState } from "./bay-timeline-types";
import { addDaysToDate, getDateKey } from "./bay-timeline-types";

// ---------------------------------------------------------------------------
// Touch device detection
// ---------------------------------------------------------------------------

export const isTouchDevice =
  typeof window !== "undefined" && "ontouchstart" in window;

// ---------------------------------------------------------------------------
// Options & Return types
// ---------------------------------------------------------------------------

interface UseGanttDragOptions {
  columnWidth: number;
  rowHeight: number;
  bayIds: string[];
  startDate: Date;
  onDragEnd: (result: {
    assignmentId: string;
    newBayId?: string;
    newStartDate?: string;
    newEndDate?: string;
  }) => void;
}

interface UseGanttDragReturn {
  dragState: DragState | null;
  isDragging: boolean;
  handlePointerDown: (
    e: React.PointerEvent,
    assignmentId: string,
    bayId: string,
    startCol: number,
    colSpan: number,
    mode: "move" | "resize",
  ) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  ghostStyle: React.CSSProperties | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGanttDrag({
  columnWidth,
  rowHeight,
  bayIds,
  startDate,
  onDragEnd,
}: UseGanttDragOptions): UseGanttDragReturn {
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Mutable refs so pointer-move doesn't depend on stale closures
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const metaRef = useRef<{
    assignmentId: string;
    bayId: string;
    startCol: number;
    colSpan: number;
    mode: "move" | "resize";
  } | null>(null);
  const dxRef = useRef(0);
  const dyRef = useRef(0);

  // ---- Pointer Down ----
  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent,
      assignmentId: string,
      bayId: string,
      startCol: number,
      colSpan: number,
      mode: "move" | "resize",
    ) => {
      // Skip drag on touch devices
      if (isTouchDevice) return;

      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      dxRef.current = 0;
      dyRef.current = 0;
      metaRef.current = { assignmentId, bayId, startCol, colSpan, mode };

      setDragState({
        assignmentId,
        originalBayId: bayId,
        originalStartCol: startCol,
        originalColSpan: colSpan,
        mode,
        dayOffset: 0,
        bayOffset: 0,
      });
    },
    [],
  );

  // ---- Pointer Move ----
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!metaRef.current) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      dxRef.current = dx;
      dyRef.current = dy;

      const dayOffset = Math.round(dx / columnWidth);
      const bayOffset =
        metaRef.current.mode === "move" ? Math.round(dy / rowHeight) : 0;

      setDragState((prev) =>
        prev ? { ...prev, dayOffset, bayOffset } : prev,
      );
    },
    [columnWidth, rowHeight],
  );

  // ---- Pointer Up ----
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const meta = metaRef.current;
      if (!meta) return;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be released
      }

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      const dayOffset = Math.round(dx / columnWidth);
      const bayOffset =
        meta.mode === "move" ? Math.round(dy / rowHeight) : 0;

      if (dayOffset !== 0 || bayOffset !== 0) {
        // startCol is 1-indexed and relative to the grid (already offset by
        // the bay-label column in the grid component). Convert back to a
        // date index: column 2 = day 0 of the range, column 3 = day 1, etc.
        const dayIndex = meta.startCol - 2; // 0-based day index
        const originalStart = addDaysToDate(startDate, dayIndex);
        const originalEnd = addDaysToDate(
          startDate,
          dayIndex + meta.colSpan - 1,
        );

        if (meta.mode === "move") {
          const newStart = addDaysToDate(originalStart, dayOffset);
          const newEnd = addDaysToDate(originalEnd, dayOffset);

          const originalBayIndex = bayIds.indexOf(meta.bayId);
          const newBayIndex = clamp(
            originalBayIndex + bayOffset,
            0,
            bayIds.length - 1,
          );
          const newBayId = bayIds[newBayIndex];

          onDragEnd({
            assignmentId: meta.assignmentId,
            newBayId:
              newBayId !== meta.bayId ? newBayId : undefined,
            newStartDate: getDateKey(newStart),
            newEndDate: getDateKey(newEnd),
          });
        } else {
          // resize — only change end date
          const newEnd = addDaysToDate(originalEnd, dayOffset);
          // Prevent resizing to before or on start date
          if (newEnd >= originalStart) {
            onDragEnd({
              assignmentId: meta.assignmentId,
              newEndDate: getDateKey(newEnd),
            });
          }
        }
      }

      // Reset
      metaRef.current = null;
      dxRef.current = 0;
      dyRef.current = 0;
      setDragState(null);
    },
    [bayIds, columnWidth, onDragEnd, rowHeight, startDate],
  );

  // ---- Ghost style ----
  const ghostStyle: React.CSSProperties | null = dragState
    ? { transform: `translate(${dxRef.current}px, ${dyRef.current}px)` }
    : null;

  return {
    dragState,
    isDragging: dragState !== null,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ghostStyle,
  };
}

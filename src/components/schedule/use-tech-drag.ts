"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import type { TechDragState } from "./tech-timeline-types";

// ---------------------------------------------------------------------------
// Touch device detection
// ---------------------------------------------------------------------------

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && "ontouchstart" in window;
}

// ---------------------------------------------------------------------------
// Options & Return types
// ---------------------------------------------------------------------------

interface UseTechDragOptions {
  rowHeight: number;
  techIds: string[];
  onDragEnd: (result: { taskId: string; newTechId: string }) => void;
}

interface UseTechDragReturn {
  dragState: TechDragState | null;
  isDragging: boolean;
  handlePointerDown: (
    e: React.PointerEvent,
    taskId: string,
    techId: string,
    startCol: number,
    colSpan: number,
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

export function useTechDrag({
  rowHeight,
  techIds,
  onDragEnd,
}: UseTechDragOptions): UseTechDragReturn {
  const [dragState, setDragState] = useState<TechDragState | null>(null);

  // Mutable refs so pointer-move doesn't depend on stale closures
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const metaRef = useRef<{
    taskId: string;
    techId: string;
    startCol: number;
    colSpan: number;
  } | null>(null);
  const dxRef = useRef(0);
  const dyRef = useRef(0);

  // ---- Pointer Down ----
  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent,
      taskId: string,
      techId: string,
      startCol: number,
      colSpan: number,
    ) => {
      // Skip drag on touch devices
      if (isTouchDevice()) return;

      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      dxRef.current = 0;
      dyRef.current = 0;
      metaRef.current = { taskId, techId, startCol, colSpan };

      setDragState({
        taskId,
        originalTechId: techId,
        originalStartCol: startCol,
        originalColSpan: colSpan,
        dayOffset: 0,
        techOffset: 0,
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

      // Track dayOffset for visual feedback only; techOffset for reassignment
      const dayOffset = Math.round(dx / rowHeight); // approximate visual shift
      const techOffset = Math.round(dy / rowHeight);

      setDragState((prev) =>
        prev ? { ...prev, dayOffset, techOffset } : prev,
      );
    },
    [rowHeight],
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

      const dy = e.clientY - startYRef.current;
      const techOffset = Math.round(dy / rowHeight);

      if (techOffset !== 0) {
        const originalTechIndex = techIds.indexOf(meta.techId);
        const newTechIndex = clamp(
          originalTechIndex + techOffset,
          0,
          techIds.length - 1,
        );
        const newTechId = techIds[newTechIndex];

        if (newTechId !== meta.techId) {
          onDragEnd({
            taskId: meta.taskId,
            newTechId,
          });
        }
      }

      // Reset
      metaRef.current = null;
      dxRef.current = 0;
      dyRef.current = 0;
      setDragState(null);
    },
    [techIds, onDragEnd, rowHeight],
  );

  // ---- Ghost style ----
  // Derive ghost position from dragState offsets (which are updated via setState)
  // rather than reading mutable refs during render
  const ghostStyle: React.CSSProperties | null = useMemo(() => {
    if (!dragState) return null;
    const dy = dragState.techOffset * rowHeight;
    return { transform: `translate(0px, ${dy}px)` };
  }, [dragState, rowHeight]);

  return {
    dragState,
    isDragging: dragState !== null,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ghostStyle,
  };
}

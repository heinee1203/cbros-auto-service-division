"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

import { BayTimelineHeader } from "./bay-timeline-header";
import { BayTimelineGrid, type BayTimelineGridHandle } from "./bay-timeline-grid";
import BayOccupancyBar from "./bay-occupancy-bar";
import BayUtilizationPanel from "./bay-utilization-panel";
import { BayAssignmentDetail } from "./bay-assignment-detail";
import { BayAssignModal } from "./bay-assign-modal";
import { useGanttDrag } from "./use-gantt-drag";
import {
  type TimelineAssignment,
  type TimelineBay,
  DEFAULT_BAY_COLOR,
  addDaysToDate,
} from "./bay-timeline-types";
import { EmptyState } from "@/components/ui/empty-state";

export default function BayTimeline() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Start of current week (Sunday)
    return d;
  });
  const [days, setDays] = useState(14);
  const [bays, setBays] = useState<TimelineBay[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-over and modal states
  const [selectedAssignment, setSelectedAssignment] =
    useState<TimelineAssignment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBayId, setAssignBayId] = useState<string | undefined>();
  const [assignDate, setAssignDate] = useState<string | undefined>();

  // Grid ref for scrolling
  const gridRef = useRef<BayTimelineGridHandle>(null);

  // Data fetching
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    const endDate = addDaysToDate(startDate, days);
    const res = await fetch(
      `/api/bays/timeline?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
    );
    if (res.ok) {
      const data = await res.json();
      setBays(data);
    }
    setLoading(false);
  }, [startDate, days]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Drag hook
  const {
    dragState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ghostStyle,
  } = useGanttDrag({
    columnWidth: 60,
    rowHeight: 56,
    bayIds: bays.map((b) => b.id),
    startDate,
    onDragEnd: async (result) => {
      const { updateBayAssignmentAction } = await import(
        "@/lib/actions/scheduler-actions"
      );
      const res = await updateBayAssignmentAction(result.assignmentId, {
        bayId: result.newBayId,
        startDate: result.newStartDate,
        endDate: result.newEndDate,
      });
      if (res.success) {
        toast.success("Assignment updated");
        fetchTimeline();
      } else {
        toast.error(res.error || "Failed to update");
      }
    },
  });

  // Handlers
  const handleAssignmentClick = (assignment: TimelineAssignment) => {
    setSelectedAssignment(assignment);
    setDetailOpen(true);
  };

  const handleEmptyCellClick = (bayId: string, date: Date) => {
    setAssignBayId(bayId);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    setAssignDate(`${y}-${m}-${d}`);
    setAssignOpen(true);
  };

  const handleBayChipClick = (bayId: string) => {
    gridRef.current?.scrollToBay(bayId);
  };

  const handleUpdated = () => {
    setDetailOpen(false);
    setAssignOpen(false);
    setSelectedAssignment(null);
    setAssignBayId(undefined);
    setAssignDate(undefined);
    fetchTimeline();
  };

  return (
    <div className="space-y-4">
      <BayTimelineHeader
        startDate={startDate}
        onStartDateChange={setStartDate}
        days={days}
        onDaysChange={setDays}
      />
      <BayOccupancyBar bays={bays} onBayClick={handleBayChipClick} />
      {loading ? (
        <div className="flex items-center justify-center py-12 text-surface-400">
          Loading bay timeline...
        </div>
      ) : bays.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Bays"
          description="Create bays in Settings to start scheduling."
        />
      ) : (
        <BayTimelineGrid
          ref={gridRef}
          bays={bays}
          startDate={startDate}
          days={days}
          onAssignmentClick={handleAssignmentClick}
          onEmptyCellClick={handleEmptyCellClick}
          dragState={dragState}
          onBlockPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ghostStyle={ghostStyle}
        />
      )}
      <BayUtilizationPanel bays={bays} startDate={startDate} days={days} />

      <BayAssignmentDetail
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedAssignment(null);
        }}
        assignment={selectedAssignment}
        bayName={
          selectedAssignment
            ? bays.find((b) => b.id === selectedAssignment.bayId)?.name || ""
            : ""
        }
        bayColor={
          selectedAssignment
            ? bays.find((b) => b.id === selectedAssignment.bayId)?.color ||
              DEFAULT_BAY_COLOR
            : DEFAULT_BAY_COLOR
        }
        allBays={bays.map((b) => ({ id: b.id, name: b.name }))}
        onUpdated={handleUpdated}
      />

      <BayAssignModal
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false);
          setAssignBayId(undefined);
          setAssignDate(undefined);
        }}
        prefilledBayId={assignBayId}
        prefilledDate={assignDate}
        allBays={bays.map((b) => ({ id: b.id, name: b.name }))}
        onAssigned={handleUpdated}
      />
    </div>
  );
}

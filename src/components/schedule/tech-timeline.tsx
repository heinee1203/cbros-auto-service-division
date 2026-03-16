"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { TechTimelineHeader } from "./tech-timeline-header";
import { TechTimelineGrid, type TechTimelineGridHandle } from "./tech-timeline-grid";
import TechCapacityBar from "./tech-capacity-bar";
import UnassignedTasksBanner from "./unassigned-tasks-banner";
import { TechDailyDetail } from "./tech-daily-detail";
import { useTechDrag } from "./use-tech-drag";
import {
  type TechTimelineTech,
  type TechTask,
  type TechTimeEntry,
  addDaysToDate,
} from "./tech-timeline-types";
import { EmptyState } from "@/components/ui/empty-state";
import { reassignTaskAction } from "@/lib/actions/scheduler-actions";

export default function TechTimeline() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Start of current week (Sunday)
    return d;
  });
  const [days, setDays] = useState(14);
  const [techs, setTechs] = useState<TechTimelineTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Daily detail slide-over state
  const [dailyDetailOpen, setDailyDetailOpen] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [selectedTechName, setSelectedTechName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTasks, setSelectedTasks] = useState<TechTask[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<TechTimeEntry[]>([]);
  const [selectedWorkSchedule, setSelectedWorkSchedule] = useState<
    string | null
  >(null);

  // Grid ref
  const gridRef = useRef<TechTimelineGridHandle>(null);

  // Data fetching
  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const endDate = addDaysToDate(startDate, days);
      const res = await fetch(
        `/api/technicians/timeline?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setTechs(data);
      }
    } catch {
      toast.error("Failed to load technician schedules");
    } finally {
      setLoading(false);
    }
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
  } = useTechDrag({
    rowHeight: 64,
    techIds: techs.map((t) => t.id),
    onDragEnd: async (result) => {
      const res = await reassignTaskAction({
        taskId: result.taskId,
        newTechnicianId: result.newTechId,
      });
      if (res.success) {
        toast.success("Task reassigned");
        fetchTimeline();
        setRefreshTrigger((n) => n + 1);
      } else {
        toast.error(res.error || "Failed to reassign");
      }
    },
  });

  // Task click handler — open daily detail for that tech on the task's date
  const handleTaskClick = (task: TechTask, techId: string) => {
    const tech = techs.find((t) => t.id === techId);
    if (!tech) return;

    const taskDate = task.startedAt
      ? new Date(task.startedAt)
      : task.jobOrder.scheduledStartDate
        ? new Date(task.jobOrder.scheduledStartDate)
        : new Date();

    setSelectedTechId(techId);
    setSelectedTechName(`${tech.firstName} ${tech.lastName}`);
    setSelectedDate(taskDate);
    setSelectedTasks(tech.assignedTasks);
    setSelectedEntries(tech.timeEntries);
    setSelectedWorkSchedule(tech.workSchedule);
    setDailyDetailOpen(true);
  };

  // Empty cell click handler
  const handleEmptyCellClick = (techId: string, date: Date) => {
    const tech = techs.find((t) => t.id === techId);
    if (!tech) return;
    setSelectedTechId(techId);
    setSelectedTechName(`${tech.firstName} ${tech.lastName}`);
    setSelectedDate(date);
    setSelectedTasks(tech.assignedTasks);
    setSelectedEntries(tech.timeEntries);
    setSelectedWorkSchedule(tech.workSchedule);
    setDailyDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <TechTimelineHeader
        startDate={startDate}
        onStartDateChange={setStartDate}
        days={days}
        onDaysChange={setDays}
      />
      <TechCapacityBar techs={techs} startDate={startDate} days={days} />
      <UnassignedTasksBanner
        onViewAssign={() => toast.info("Unassigned tasks view coming soon")}
        refreshTrigger={refreshTrigger}
      />
      {loading ? (
        <div className="flex items-center justify-center py-12 text-surface-400">
          Loading technician schedule...
        </div>
      ) : techs.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Technicians"
          description="Add technicians in Settings to start scheduling."
        />
      ) : (
        <TechTimelineGrid
          ref={gridRef}
          techs={techs}
          startDate={startDate}
          days={days}
          onTaskClick={handleTaskClick}
          onEmptyCellClick={handleEmptyCellClick}
          dragState={dragState}
          onBlockPointerDown={(e, taskId, techId, startCol, colSpan, _mode) =>
            handlePointerDown(e, taskId, techId, startCol, colSpan)
          }
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ghostStyle={ghostStyle}
        />
      )}
      <TechDailyDetail
        open={dailyDetailOpen}
        onClose={() => setDailyDetailOpen(false)}
        techId={selectedTechId}
        techName={selectedTechName}
        date={selectedDate}
        tasks={selectedTasks}
        timeEntries={selectedEntries}
        workSchedule={selectedWorkSchedule}
      />
    </div>
  );
}

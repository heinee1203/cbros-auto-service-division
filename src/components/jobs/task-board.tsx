"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { LayoutGrid, List, Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TASK_BOARD_COLUMNS } from "@/lib/constants";
import { transitionTaskStatusAction } from "@/lib/actions/task-actions";
import TaskCard from "@/components/jobs/task-card";
import TaskListView from "@/components/jobs/task-list-view";
import { EmptyState } from "@/components/ui/empty-state";

// Type for a single task from getTasksByJobOrder
type TaskItem = {
  id: string;
  name: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  isRework: boolean;
  sortOrder: number;
  assignedTechnician: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  dependsOnTask: {
    id: string;
    name: string;
    status: string;
  } | null;
  serviceCatalog: {
    id: string;
    name: string;
    category: string;
    requiredMilestonePhotos: string | null;
  } | null;
  _count: { timeEntries: number };
};

interface TaskBoardClientProps {
  tasks: {
    tasks: TaskItem[];
    photosByTaskId: Record<string, unknown[]>;
  };
  jobOrderId: string;
  technicians: Array<{ id: string; firstName: string; lastName: string }>;
  overrunSettings: { warningPct: number; criticalPct: number };
  activeClockEntry?: {
    id: string;
    taskId: string;
    clockIn: string;
  } | null;
  currentUserId?: string;
}

export default function TaskBoardClient({
  tasks: taskData,
  jobOrderId,
  technicians,
  overrunSettings,
  activeClockEntry,
}: TaskBoardClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [filterTechId, setFilterTechId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const allTasks = taskData.tasks;

  // Group tasks by status column
  const tasksByColumn = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    for (const col of TASK_BOARD_COLUMNS) {
      map[col.id] = [];
    }
    for (const task of allTasks) {
      // REWORK tasks go to QUEUED column
      const colId = task.status === "REWORK" ? "QUEUED" : task.status;
      if (map[colId]) {
        map[colId].push(task);
      }
    }
    return map;
  }, [allTasks]);

  // Filtered tasks for display
  const filteredTasksByColumn = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    for (const col of TASK_BOARD_COLUMNS) {
      let tasks = tasksByColumn[col.id] || [];
      if (filterTechId) {
        tasks = tasks.filter((t) => t.assignedTechnician?.id === filterTechId);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        tasks = tasks.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.assignedTechnician?.firstName.toLowerCase().includes(q) ||
            t.assignedTechnician?.lastName.toLowerCase().includes(q)
        );
      }
      map[col.id] = tasks;
    }
    return map;
  }, [tasksByColumn, filterTechId, searchQuery]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, destination } = result;
      if (!destination) return;

      const newStatus = destination.droppableId;
      const task = allTasks.find((t) => t.id === draggableId);
      if (!task) return;

      // Same column — no status change needed
      if (task.status === newStatus) return;

      const actionResult = await transitionTaskStatusAction(
        draggableId,
        jobOrderId,
        newStatus
      );
      if (!actionResult.success) {
        toast.error(actionResult.error || "Failed to move task");
        router.refresh();
      } else {
        toast.success(`Task moved to ${newStatus.replace("_", " ")}`);
        router.refresh();
      }
    },
    [allTasks, jobOrderId, router]
  );

  const handleTaskClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_task: Record<string, any>) => {
      // For now, just log. A detail slide-over can be added later.
      // Could navigate or open a slide-over
    },
    []
  );

  if (allTasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No Tasks Yet"
        description="Tasks will appear here once they are added to this job order."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>

        {/* Technician filter */}
        <select
          value={filterTechId}
          onChange={(e) => setFilterTechId(e.target.value)}
          className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
        >
          <option value="">All Technicians</option>
          {technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.firstName} {tech.lastName}
            </option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex items-center bg-surface-100 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode("board")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              viewMode === "board"
                ? "bg-white text-primary shadow-sm"
                : "text-surface-500 hover:text-primary"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Board
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              viewMode === "list"
                ? "bg-white text-primary shadow-sm"
                : "text-surface-500 hover:text-primary"
            )}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* Board or List view */}
      {viewMode === "list" ? (
        <TaskListView
          tasks={allTasks}
          jobOrderId={jobOrderId}
          overrunSettings={overrunSettings}
          onTaskClick={handleTaskClick}
          filterTechnicianId={filterTechId}
          searchQuery={searchQuery}
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {TASK_BOARD_COLUMNS.map((col) => {
              const colTasks = filteredTasksByColumn[col.id] || [];
              return (
                <div
                  key={col.id}
                  className="flex-shrink-0 min-w-[280px] w-72 flex flex-col"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-semibold text-surface-600 uppercase tracking-wider">
                      {col.label}
                    </h3>
                    <span className="text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full font-medium">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 rounded-lg p-2 space-y-2 min-h-[120px] transition-colors",
                          snapshot.isDraggingOver
                            ? "bg-accent-50 border-2 border-dashed border-accent-300"
                            : "bg-surface-50 border border-surface-200"
                        )}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  dragSnapshot.isDragging && "rotate-2 opacity-90"
                                )}
                              >
                                <TaskCard
                                  task={task}
                                  jobOrderId={jobOrderId}
                                  overrunSettings={overrunSettings}
                                  activeClockEntry={activeClockEntry}
                                  onClick={() => handleTaskClick(task)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colTasks.length === 0 && (
                          <p className="text-xs text-surface-300 text-center py-4">
                            No tasks
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

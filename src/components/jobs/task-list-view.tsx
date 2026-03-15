"use client";

import { useState, useMemo } from "react";
import { Lock, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/types/enums";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/types/enums";

type SortKey =
  | "name"
  | "technician"
  | "status"
  | "estimatedHours"
  | "actualHours"
  | "progress";
type SortDir = "asc" | "desc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskRow = Record<string, any> & {
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

interface TaskListViewProps {
  tasks: TaskRow[];
  jobOrderId: string;
  overrunSettings: { warningPct: number; criticalPct: number };
  onTaskClick: (task: TaskRow) => void;
  filterTechnicianId: string;
  searchQuery: string;
}

export default function TaskListView({
  tasks,
  overrunSettings,
  onTaskClick,
  filterTechnicianId,
  searchQuery,
}: TaskListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...tasks];

    // Filter by technician
    if (filterTechnicianId) {
      result = result.filter(
        (t) => t.assignedTechnician?.id === filterTechnicianId
      );
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.assignedTechnician?.firstName.toLowerCase().includes(q) ||
          t.assignedTechnician?.lastName.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "technician":
          cmp = (a.assignedTechnician?.firstName || "").localeCompare(
            b.assignedTechnician?.firstName || ""
          );
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "estimatedHours":
          cmp = a.estimatedHours - b.estimatedHours;
          break;
        case "actualHours":
          cmp = a.actualHours - b.actualHours;
          break;
        case "progress": {
          const pA =
            a.estimatedHours > 0 ? a.actualHours / a.estimatedHours : 0;
          const pB =
            b.estimatedHours > 0 ? b.actualHours / b.estimatedHours : 0;
          cmp = pA - pB;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tasks, filterTechnicianId, searchQuery, sortKey, sortDir]);

  const SortHeader = ({
    label,
    field,
    className,
  }: {
    label: string;
    field: SortKey;
    className?: string;
  }) => (
    <th
      className={cn(
        "px-3 py-2 text-left text-xs font-medium text-surface-500 cursor-pointer hover:text-primary select-none",
        className
      )}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            "w-3 h-3",
            sortKey === field ? "text-primary" : "text-surface-300"
          )}
        />
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-surface-200">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 border-b border-surface-200">
          <tr>
            <SortHeader label="Name" field="name" />
            <SortHeader label="Technician" field="technician" />
            <SortHeader label="Status" field="status" />
            <SortHeader label="Est. Hours" field="estimatedHours" />
            <SortHeader label="Actual Hours" field="actualHours" />
            <SortHeader label="Progress %" field="progress" />
            <th className="px-3 py-2 text-left text-xs font-medium text-surface-500">
              Dependency
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {filteredAndSorted.map((task) => {
            const progress =
              task.estimatedHours > 0
                ? (task.actualHours / task.estimatedHours) * 100
                : 0;
            const isCritical = progress >= overrunSettings.criticalPct;
            const isWarning =
              !isCritical && progress >= overrunSettings.warningPct;
            const isBlocked =
              task.dependsOnTask !== null &&
              task.dependsOnTask.status !== "DONE";
            const statusColor =
              TASK_STATUS_COLORS[task.status as TaskStatus] ||
              "bg-surface-200 text-surface-600";
            const statusLabel =
              TASK_STATUS_LABELS[task.status as TaskStatus] || task.status;

            return (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="hover:bg-surface-50 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-primary">{task.name}</span>
                    {task.isRework && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">
                        REWORK
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-surface-600">
                  {task.assignedTechnician ? (
                    <span>
                      {task.assignedTechnician.firstName}{" "}
                      {task.assignedTechnician.lastName}
                    </span>
                  ) : (
                    <span className="text-surface-300">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Badge className={statusColor}>{statusLabel}</Badge>
                </td>
                <td className="px-3 py-2.5 text-surface-600">
                  {task.estimatedHours.toFixed(1)}h
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5",
                    isCritical && "bg-red-50 text-red-700 font-medium",
                    isWarning && "bg-yellow-50 text-yellow-700 font-medium",
                    !isCritical && !isWarning && "text-surface-600"
                  )}
                >
                  {task.actualHours.toFixed(1)}h
                </td>
                <td className="px-3 py-2.5 text-surface-600">
                  {task.estimatedHours > 0
                    ? `${Math.round(progress)}%`
                    : "-"}
                </td>
                <td className="px-3 py-2.5">
                  {isBlocked && task.dependsOnTask ? (
                    <div className="flex items-center gap-1 text-xs text-surface-400">
                      <Lock className="w-3 h-3" />
                      <span>{task.dependsOnTask.name}</span>
                    </div>
                  ) : task.dependsOnTask ? (
                    <span className="text-xs text-success-600">
                      {task.dependsOnTask.name} (Done)
                    </span>
                  ) : (
                    <span className="text-surface-300">-</span>
                  )}
                </td>
              </tr>
            );
          })}
          {filteredAndSorted.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-8 text-center text-sm text-surface-400"
              >
                No tasks match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

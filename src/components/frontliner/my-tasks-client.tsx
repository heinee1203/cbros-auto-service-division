"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TaskCard } from "@/components/frontliner/task-card";

interface TaskItem {
  id: string;
  name: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    vehicle: { plateNumber: string; make: string; model: string };
  };
}

interface MyTasksClientProps {
  tasks: TaskItem[];
}

type FilterTab = "active" | "completed";

export function MyTasksClient({ tasks }: MyTasksClientProps) {
  const [filter, setFilter] = useState<FilterTab>("active");

  const activeTasks = tasks.filter((t) => t.status !== "DONE");
  const completedTasks = tasks.filter((t) => t.status === "DONE");

  const displayTasks = filter === "active" ? activeTasks : completedTasks;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/frontliner"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--sch-surface)] text-[var(--sch-text-muted)] transition-colors hover:bg-[var(--sch-card)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--sch-text)]">My Tasks</h1>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("active")}
          className={`h-12 flex-1 rounded-xl font-semibold text-sm transition-colors ${
            filter === "active"
              ? "bg-[var(--sch-accent)] text-black"
              : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)]"
          }`}
        >
          Active ({activeTasks.length})
        </button>
        <button
          onClick={() => setFilter("completed")}
          className={`h-12 flex-1 rounded-xl font-semibold text-sm transition-colors ${
            filter === "completed"
              ? "bg-[var(--sch-accent)] text-black"
              : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)]"
          }`}
        >
          Completed ({completedTasks.length})
        </button>
      </div>

      {/* Task list */}
      {displayTasks.length === 0 ? (
        <div className="rounded-xl bg-[var(--sch-card)] p-8 text-center text-[var(--sch-text-muted)]">
          {filter === "active" ? "No active tasks" : "No completed tasks"}
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

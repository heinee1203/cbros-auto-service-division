import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getActiveEntry,
  getDailyEntries,
  getAssignedTasksForTech,
} from "@/lib/services/time-entries";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const technicianId = session.user.id;

  const [rawActiveEntry, dailyEntries, rawAssignedTasks] = await Promise.all([
    getActiveEntry(technicianId),
    getDailyEntries(technicianId, new Date()),
    getAssignedTasksForTech(technicianId),
  ]);

  const dailyTotalMinutes = dailyEntries.reduce(
    (sum, entry) => sum + entry.netMinutes,
    0
  );

  const hours = Math.floor(dailyTotalMinutes / 60);
  const mins = dailyTotalMinutes % 60;
  const dailyHours =
    hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  // Determine if on break by checking notes for breakStartedAt
  let onBreak = false;
  if (rawActiveEntry?.notes) {
    try {
      const parsed = JSON.parse(rawActiveEntry.notes);
      onBreak = !!parsed.breakStartedAt;
    } catch {
      // notes was not JSON
    }
  }

  const activeEntry = rawActiveEntry
    ? {
        id: rawActiveEntry.id,
        clockIn: rawActiveEntry.clockIn.toISOString(),
        taskId: rawActiveEntry.task.id,
        taskName: rawActiveEntry.task.name,
        jobOrderId: rawActiveEntry.jobOrder.id,
        jobOrderNumber: rawActiveEntry.jobOrder.jobOrderNumber,
        breakMinutes: rawActiveEntry.breakMinutes,
        onBreak,
      }
    : null;

  const assignedTasks = rawAssignedTasks.map((task) => ({
    taskId: task.id,
    taskName: task.name,
    taskStatus: task.status,
    jobOrderId: task.jobOrder.id,
    jobOrderNumber: task.jobOrder.jobOrderNumber,
  }));

  return NextResponse.json({
    activeEntry,
    dailyTotalMinutes,
    dailyHours,
    assignedTasks,
  });
}

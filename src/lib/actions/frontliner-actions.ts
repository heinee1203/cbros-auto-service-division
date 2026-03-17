"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { transitionTaskStatus } from "@/lib/services/tasks";
import {
  clockOut,
  getActiveEntry,
  forceClockOutAndIn,
} from "@/lib/services/time-entries";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// 1. startTaskAction — clock out of current → transition to IN_PROGRESS → clock in
// ---------------------------------------------------------------------------
export async function startTaskAction(
  taskId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    // Transition task to IN_PROGRESS
    await transitionTaskStatus(taskId, "IN_PROGRESS", session.user.id);

    // Force clock out of any current entry and clock in to new task
    await forceClockOutAndIn(
      session.user.id,
      taskId,
      jobOrderId,
      "TABLET_CLOCK"
    );

    revalidatePath("/frontliner");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to start task",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. pauseTaskAction — clock out → transition to PAUSED
// ---------------------------------------------------------------------------
export async function pauseTaskAction(
  taskId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const active = await getActiveEntry(session.user.id);
    if (active) {
      await clockOut(active.id, session.user.id);
    }

    await transitionTaskStatus(taskId, "PAUSED", session.user.id);

    revalidatePath("/frontliner");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to pause task",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. completeTaskAction — clock out if on this task → transition to DONE
// ---------------------------------------------------------------------------
export async function completeTaskAction(
  taskId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const active = await getActiveEntry(session.user.id);
    if (active && active.taskId === taskId) {
      await clockOut(active.id, session.user.id);
    }

    await transitionTaskStatus(taskId, "DONE", session.user.id);

    revalidatePath("/frontliner");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to complete task",
    };
  }
}

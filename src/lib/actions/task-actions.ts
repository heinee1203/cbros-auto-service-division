"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { taskSchema } from "@/lib/validators";
import {
  createTask,
  updateTask,
  reorderTasks,
  transitionTaskStatus,
  bulkTransitionStatus,
} from "@/lib/services/tasks";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// 1. createTaskAction
// ---------------------------------------------------------------------------
export async function createTaskAction(
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "tasks:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = taskSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await createTask(jobOrderId, parsed.data, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { taskId: result.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create task",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. updateTaskAction
// ---------------------------------------------------------------------------
export async function updateTaskAction(
  taskId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "tasks:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const partialSchema = taskSchema.partial();
  const parsed = partialSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await updateTask(taskId, parsed.data, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update task",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. reorderTasksAction
// ---------------------------------------------------------------------------
export async function reorderTasksAction(
  jobOrderId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "tasks:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await reorderTasks(jobOrderId, orderedIds);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reorder tasks",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. transitionTaskStatusAction
// ---------------------------------------------------------------------------
export async function transitionTaskStatusAction(
  taskId: string,
  jobOrderId: string,
  newStatus: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "tasks:update_status")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await transitionTaskStatus(taskId, newStatus, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to transition task status",
    };
  }
}

// ---------------------------------------------------------------------------
// 5. bulkTransitionStatusAction
// ---------------------------------------------------------------------------
export async function bulkTransitionStatusAction(
  taskIds: string[],
  jobOrderId: string,
  newStatus: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "tasks:update_status")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const result = await bulkTransitionStatus(
      taskIds,
      newStatus,
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    return {
      success: true,
      data: {
        succeeded: result.succeeded,
        failed: result.failed,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to bulk transition task statuses",
    };
  }
}

// ---------------------------------------------------------------------------
// 6. deleteTaskAction
// ---------------------------------------------------------------------------
export async function deleteTaskAction(
  taskId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "tasks:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete task",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { manualTimeEntrySchema } from "@/lib/validators";
import {
  clockIn,
  forceClockOutAndIn,
  clockOut,
  startBreak,
  endBreak,
  createManualEntry,
  updateEntry,
  deleteEntry,
} from "@/lib/services/time-entries";
import type { ActionResult } from "@/lib/actions/estimate-actions";
import type { TimeEntrySource } from "@/types/enums";

// ---------------------------------------------------------------------------
// 1. clockInAction
// ---------------------------------------------------------------------------
export async function clockInAction(
  taskId: string,
  jobOrderId: string,
  source?: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const result = await clockIn(
      session.user.id,
      taskId,
      jobOrderId,
      (source || "TABLET_CLOCK") as TimeEntrySource
    );

    if ("conflict" in result) {
      return {
        success: false,
        error: "Already clocked in",
        data: { conflictEntry: result.existingEntry },
      };
    }

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { timeEntryId: result.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Clock in failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. forceClockOutAndInAction
// ---------------------------------------------------------------------------
export async function forceClockOutAndInAction(
  newTaskId: string,
  newJobOrderId: string,
  source?: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const result = await forceClockOutAndIn(
      session.user.id,
      newTaskId,
      newJobOrderId,
      (source || "TABLET_CLOCK") as TimeEntrySource,
    );

    revalidatePath(`/jobs/${newJobOrderId}`);
    return { success: true, data: { timeEntryId: result.id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Force clock out and in failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. clockOutAction
// ---------------------------------------------------------------------------
export async function clockOutAction(
  timeEntryId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const entry = await clockOut(timeEntryId, session.user.id);

    revalidatePath(`/jobs/${entry.jobOrderId}`);
    return {
      success: true,
      data: {
        timeEntryId: entry.id,
        jobOrderId: entry.jobOrderId,
        durationMinutes: entry.netMinutes,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Clock out failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. startBreakAction
// ---------------------------------------------------------------------------
export async function startBreakAction(
  timeEntryId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await startBreak(timeEntryId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Start break failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 5. endBreakAction
// ---------------------------------------------------------------------------
export async function endBreakAction(
  timeEntryId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await endBreak(timeEntryId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "End break failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 6. createManualEntryAction
// ---------------------------------------------------------------------------
export async function createManualEntryAction(
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role, "time:edit_others")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = manualTimeEntrySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const entry = await createManualEntry(parsed.data, session.user.id);

    revalidatePath(`/jobs/${parsed.data.jobOrderId}`);
    return { success: true, data: { timeEntryId: entry.id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Create manual entry failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 7. updateEntryAction
// ---------------------------------------------------------------------------
export async function updateEntryAction(
  timeEntryId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role, "time:edit_others")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const entry = await updateEntry(timeEntryId, data as { clockIn?: string; clockOut?: string; breakMinutes?: number; notes?: string }, session.user.id);

    revalidatePath(`/jobs/${entry.jobOrderId}`);
    return { success: true, data: { timeEntryId: entry.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Update entry failed",
    };
  }
}

// ---------------------------------------------------------------------------
// 8. deleteEntryAction
// ---------------------------------------------------------------------------
export async function deleteEntryAction(
  timeEntryId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role, "time:edit_others")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const entry = await deleteEntry(timeEntryId, session.user.id);

    revalidatePath(`/jobs/${entry.jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Delete entry failed",
    };
  }
}

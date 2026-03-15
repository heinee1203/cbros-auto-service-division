"use server";

import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import * as scheduler from "@/lib/services/scheduler";
import {
  createBaySchema,
  updateBaySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  assignBaySchema,
} from "@/lib/validators";

type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

// ============================================================================
// BAY ACTIONS
// ============================================================================

export async function getBaysAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:view"))
    return { success: false, error: "Permission denied" };

  try {
    const bays = await scheduler.getBays();
    return { success: true, data: bays };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch bays" };
  }
}

export async function createBayAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_manage"))
    return { success: false, error: "Permission denied" };

  const parsed = createBaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const bay = await scheduler.createBay(parsed.data);
    revalidatePath("/settings");
    revalidatePath("/schedule/bays");
    return { success: true, data: bay };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create bay" };
  }
}

export async function updateBayAction(id: string, input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_manage"))
    return { success: false, error: "Permission denied" };

  const parsed = updateBaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const bay = await scheduler.updateBay(id, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/schedule/bays");
    return { success: true, data: bay };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update bay" };
  }
}

export async function deleteBayAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_manage"))
    return { success: false, error: "Permission denied" };

  try {
    await scheduler.deleteBay(id);
    revalidatePath("/settings");
    revalidatePath("/schedule/bays");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete bay" };
  }
}

// ============================================================================
// APPOINTMENT ACTIONS
// ============================================================================

export async function createAppointmentAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const appointment = await scheduler.createAppointment({
      ...parsed.data,
      scheduledDate: new Date(parsed.data.scheduledDate),
      createdBy: session.user.id,
    });
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true, data: appointment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create appointment" };
  }
}

export async function updateAppointmentAction(id: string, input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  const parsed = updateAppointmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const data: any = { ...parsed.data };
    if (data.scheduledDate) data.scheduledDate = new Date(data.scheduledDate);
    const appointment = await scheduler.updateAppointment(id, data);
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true, data: appointment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update appointment" };
  }
}

export async function updateAppointmentStatusAction(id: string, input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  const parsed = updateAppointmentStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const appointment = await scheduler.updateAppointmentStatus(id, parsed.data.status, parsed.data.notes);
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true, data: appointment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

export async function cancelAppointmentAction(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  try {
    await scheduler.cancelAppointment(id, reason);
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel appointment" };
  }
}

// ============================================================================
// BAY ASSIGNMENT ACTIONS
// ============================================================================

export async function assignJobToBayAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_assign"))
    return { success: false, error: "Permission denied" };

  const parsed = assignBaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const assignment = await scheduler.assignJobToBay({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      createdBy: session.user.id,
    });
    revalidatePath("/schedule/bays");
    revalidatePath("/jobs");
    return { success: true, data: assignment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to assign bay" };
  }
}

export async function releaseFromBayAction(assignmentId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_assign"))
    return { success: false, error: "Permission denied" };

  try {
    await scheduler.releaseFromBay(assignmentId);
    revalidatePath("/schedule/bays");
    revalidatePath("/jobs");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to release from bay" };
  }
}

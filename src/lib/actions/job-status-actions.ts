"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/estimate-actions";

/** Valid forward/backward transitions for the Kanban board arrows */
const VALID_TRANSITIONS: Record<string, string[]> = {
  CHECKED_IN: ["IN_PROGRESS"],
  IN_PROGRESS: ["CHECKED_IN", "QC_PENDING"],
  QC_PENDING: ["IN_PROGRESS", "QC_PASSED", "QC_FAILED_REWORK"],
  QC_PASSED: ["QC_PENDING", "AWAITING_PAYMENT"],
  QC_FAILED_REWORK: ["IN_PROGRESS"],
  AWAITING_PAYMENT: ["QC_PASSED", "PARTIAL_PAYMENT", "FULLY_PAID"],
  PARTIAL_PAYMENT: ["AWAITING_PAYMENT", "FULLY_PAID"],
  FULLY_PAID: ["PARTIAL_PAYMENT", "RELEASED"],
  RELEASED: [],
};

/**
 * Move a job forward or backward one status step.
 * Used by the < > arrows on board cards.
 */
export async function advanceJobStatusAction(
  jobOrderId: string,
  direction: "forward" | "backward"
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const job = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { status: true },
  });
  if (!job) return { success: false, error: "Job not found" };

  const transitions = VALID_TRANSITIONS[job.status] || [];
  if (transitions.length === 0) {
    return { success: false, error: "No valid transitions from this status" };
  }

  // Backward = first in array (previous status), Forward = last in array (next status)
  let newStatus: string;
  if (direction === "backward") {
    newStatus = transitions[0];
  } else {
    newStatus = transitions[transitions.length - 1];
  }

  await prisma.jobOrder.update({
    where: { id: jobOrderId },
    data: {
      status: newStatus,
      ...(newStatus === "RELEASED" ? { actualCompletionDate: new Date() } : {}),
    },
  });

  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      type: "status_change",
      title: `Status changed: ${job.status} → ${newStatus}`,
      description: `Job moved ${direction} from ${job.status} to ${newStatus}`,
      userId: session.user.id,
      metadata: JSON.stringify({
        fromStatus: job.status,
        toStatus: newStatus,
        direction,
      }),
    },
  });

  revalidatePath("/schedule/floor");
  revalidatePath("/jobs");
  return { success: true, data: { newStatus } };
}

/**
 * Quick "Done / Paid" advancement through the payment/release flow.
 * QC_PASSED → AWAITING_PAYMENT → FULLY_PAID → RELEASED
 */
export async function markDonePaidAction(
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const job = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { status: true },
  });
  if (!job) return { success: false, error: "Job not found" };

  const DONE_FLOW: Record<string, string> = {
    QC_PASSED: "AWAITING_PAYMENT",
    AWAITING_PAYMENT: "FULLY_PAID",
    PARTIAL_PAYMENT: "FULLY_PAID",
    FULLY_PAID: "RELEASED",
  };

  const newStatus = DONE_FLOW[job.status];
  if (!newStatus) {
    return { success: false, error: `Cannot mark done/paid from status: ${job.status}` };
  }

  await prisma.jobOrder.update({
    where: { id: jobOrderId },
    data: {
      status: newStatus,
      ...(newStatus === "RELEASED" ? { actualCompletionDate: new Date() } : {}),
    },
  });

  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      type: "status_change",
      title: `Quick advance: ${job.status} → ${newStatus}`,
      description: `Job quick-advanced from ${job.status} to ${newStatus}`,
      userId: session.user.id,
      metadata: JSON.stringify({
        fromStatus: job.status,
        toStatus: newStatus,
        quickAdvance: true,
      }),
    },
  });

  revalidatePath("/schedule/floor");
  revalidatePath("/jobs");
  return { success: true, data: { newStatus } };
}

/**
 * Quick-assign a technician to a job and all its unassigned tasks.
 */
export async function quickAssignTechAction(
  jobOrderId: string,
  technicianId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.jobOrder.update({
    where: { id: jobOrderId },
    data: { primaryTechnicianId: technicianId },
  });

  // Also assign tech to all unassigned tasks on this job
  await prisma.task.updateMany({
    where: {
      jobOrderId,
      assignedTechnicianId: null,
      deletedAt: null,
    },
    data: { assignedTechnicianId: technicianId },
  });

  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      type: "assignment_change",
      title: "Technician assigned via quick-assign",
      description: `Technician ${technicianId} assigned to job and unassigned tasks`,
      userId: session.user.id,
      metadata: JSON.stringify({ technicianId }),
    },
  });

  revalidatePath("/schedule/floor");
  revalidatePath("/jobs");
  return { success: true };
}

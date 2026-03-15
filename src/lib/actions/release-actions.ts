"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { releaseRecordSchema, belongingReturnSchema } from "@/lib/validators";
import * as releaseService from "@/lib/services/release";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// 1. validatePreReleaseAction
// ---------------------------------------------------------------------------
export async function validatePreReleaseAction(
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "release:create")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    const result = await releaseService.validatePreRelease(jobOrderId);
    return {
      success: true,
      data: result as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to validate pre-release",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. createReleaseAction
// ---------------------------------------------------------------------------
export async function createReleaseAction(
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "release:create")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    const record = await releaseService.createReleaseRecord(
      jobOrderId,
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { id: record.id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to create release record",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. updateReleaseAction
// ---------------------------------------------------------------------------
export async function updateReleaseAction(
  releaseId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "release:create")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = releaseRecordSchema.partial().safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await releaseService.updateReleaseRecord(
      releaseId,
      parsed.data,
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update release record",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. completeReleaseAction
// ---------------------------------------------------------------------------
export async function completeReleaseAction(
  releaseId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "release:create")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await releaseService.completeRelease(releaseId, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to complete release",
    };
  }
}

// ---------------------------------------------------------------------------
// 5. returnBelongingAction
// ---------------------------------------------------------------------------
export async function returnBelongingAction(
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "release:create")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = belongingReturnSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await prisma.intakeBelonging.update({
      where: { id: parsed.data.belongingId },
      data: {
        isReturned: parsed.data.isReturned,
        returnedAt: parsed.data.isReturned ? new Date() : null,
        ...(parsed.data.notes !== undefined && {
          condition: parsed.data.notes,
        }),
      },
    });
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update belonging",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { qcChecklistResultSchema } from "@/lib/validators";
import * as qc from "@/lib/services/qc";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// 1. createQCInspectionAction
// ---------------------------------------------------------------------------
export async function createQCInspectionAction(
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "qc:inspect")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const inspection = await qc.createQCInspection(
      jobOrderId,
      session.user.id
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { id: inspection.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create QC inspection",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. updateChecklistItemAction
// ---------------------------------------------------------------------------
export async function updateChecklistItemAction(
  itemId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "qc:inspect")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = qcChecklistResultSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await qc.updateChecklistItem(
      itemId,
      {
        status: parsed.data.status,
        notes: parsed.data.notes,
        photoId: parsed.data.photoId,
      },
      session.user.id
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update checklist item",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. submitQCInspectionAction
// ---------------------------------------------------------------------------
export async function submitQCInspectionAction(
  inspectionId: string,
  jobOrderId: string,
  notes?: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "qc:inspect")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const result = await qc.submitQCInspection(
      inspectionId,
      session.user.id,
      notes
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return {
      success: true,
      data: { result: result.result, failedCount: result.failedCount },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to submit QC inspection",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. updateQCTemplateAction
// ---------------------------------------------------------------------------
const qcTemplateItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  sortOrder: z.coerce.number().int().min(0),
});

export async function updateQCTemplateAction(
  category: string,
  items: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "settings:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = z.array(qcTemplateItemSchema).safeParse(items);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await qc.updateQCChecklistTemplate(category, parsed.data);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update QC template",
    };
  }
}

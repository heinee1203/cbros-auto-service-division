"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { supplementSchema, supplementLineItemSchema } from "@/lib/validators";
import * as supplements from "@/lib/services/supplements";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// 1. createSupplementAction
// ---------------------------------------------------------------------------
export async function createSupplementAction(
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "estimates:create")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = supplementSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const supplement = await supplements.createSupplement(
      jobOrderId,
      parsed.data,
      session.user.id
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return {
      success: true,
      data: { id: supplement.id, supplementNumber: supplement.supplementNumber },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create supplement",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. addSupplementLineItemAction
// ---------------------------------------------------------------------------
export async function addSupplementLineItemAction(
  supplementId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "estimates:edit")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = supplementLineItemSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const lineItem = await supplements.addSupplementLineItem(
      supplementId,
      parsed.data,
      session.user.id
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { id: lineItem.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add line item",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. updateSupplementLineItemAction
// ---------------------------------------------------------------------------
export async function updateSupplementLineItemAction(
  lineItemId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "estimates:edit")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const partialSchema = supplementLineItemSchema.partial();
  const parsed = partialSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await supplements.updateSupplementLineItem(
      lineItemId,
      parsed.data,
      session.user.id
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update line item",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. deleteSupplementLineItemAction
// ---------------------------------------------------------------------------
export async function deleteSupplementLineItemAction(
  lineItemId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "estimates:edit")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await supplements.deleteSupplementLineItem(lineItemId, session.user.id);

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete line item",
    };
  }
}

// ---------------------------------------------------------------------------
// 5. submitSupplementForApprovalAction
// ---------------------------------------------------------------------------
export async function submitSupplementForApprovalAction(
  supplementId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "estimates:edit")) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const approvalToken = await supplements.submitForApproval(
      supplementId,
      session.user.id
    );

    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { approvalToken } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to submit for approval",
    };
  }
}

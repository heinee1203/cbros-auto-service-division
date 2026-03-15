"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  damageEntrySchema,
  belongingSchema,
  intakeRecordSchema,
  jobOrderConfigSchema,
  type DamageEntryInput,
  type BelongingInput,
  type IntakeRecordInput,
  type JobOrderConfigInput,
} from "@/lib/validators";
import {
  createJobOrderFromEstimate,
  addDamageEntry,
  updateDamageEntry,
  deleteDamageEntry,
  addBelonging,
  deleteBelonging,
  updateIntakeRecord,
  completeIntake,
} from "@/lib/services/intake";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// 1. beginIntakeAction
// ---------------------------------------------------------------------------
export async function beginIntakeAction(
  estimateRequestId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const result = await createJobOrderFromEstimate(
    estimateRequestId,
    session.user.id
  );

  revalidatePath("/jobs");
  revalidatePath("/estimates");
  return {
    success: true,
    data: {
      jobOrderId: result.jobOrder.id,
      intakeRecordId: result.intakeRecord.id,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. addDamageEntryAction
// ---------------------------------------------------------------------------
export async function addDamageEntryAction(
  intakeRecordId: string,
  input: DamageEntryInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = damageEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const entry = await addDamageEntry(intakeRecordId, parsed.data, session.user.id);
  return { success: true, data: { id: entry.id } };
}

// ---------------------------------------------------------------------------
// 3. updateDamageEntryAction
// ---------------------------------------------------------------------------
export async function updateDamageEntryAction(
  id: string,
  input: Partial<DamageEntryInput>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const partialSchema = damageEntrySchema.partial();
  const parsed = partialSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await updateDamageEntry(id, parsed.data, session.user.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 4. deleteDamageEntryAction
// ---------------------------------------------------------------------------
export async function deleteDamageEntryAction(
  id: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await deleteDamageEntry(id, session.user.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 5. addBelongingAction
// ---------------------------------------------------------------------------
export async function addBelongingAction(
  intakeRecordId: string,
  input: BelongingInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = belongingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const belonging = await addBelonging(intakeRecordId, parsed.data, session.user.id);
  return { success: true, data: { id: belonging.id } };
}

// ---------------------------------------------------------------------------
// 6. deleteBelongingAction
// ---------------------------------------------------------------------------
export async function deleteBelongingAction(
  id: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await deleteBelonging(id, session.user.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 7. updateIntakeRecordAction
// ---------------------------------------------------------------------------
export async function updateIntakeRecordAction(
  intakeRecordId: string,
  input: IntakeRecordInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = intakeRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await updateIntakeRecord(intakeRecordId, parsed.data, session.user.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 8. completeIntakeAction
// ---------------------------------------------------------------------------
export async function completeIntakeAction(
  intakeRecordId: string,
  config: JobOrderConfigInput,
  signatures: {
    customerSignature?: string | null;
    advisorSignature: string;
  }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = jobOrderConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const signaturesObj = {
    customerSignature: signatures.customerSignature,
    customerSignedAt: signatures.customerSignature ? new Date() : null,
    advisorSignature: signatures.advisorSignature,
    advisorSignedAt: new Date(),
    advisorId: session.user.id,
  };

  const result = await completeIntake(
    intakeRecordId,
    parsed.data,
    signaturesObj,
    session.user.id
  );

  revalidatePath("/jobs");
  revalidatePath("/estimates");
  return { success: true, data: { jobOrderId: result.id } };
}

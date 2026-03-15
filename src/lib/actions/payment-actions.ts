"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { paymentSchema } from "@/lib/validators";
import { pesosToCentavos } from "@/lib/utils";
import * as payments from "@/lib/services/payments";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  warning?: string;
};

// ---------------------------------------------------------------------------
// 1. recordPaymentAction
// ---------------------------------------------------------------------------
export async function recordPaymentAction(
  invoiceId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "payments:process")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = paymentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const centavoAmount = pesosToCentavos(parsed.data.amount);
    const payment = await payments.recordPayment(
      invoiceId,
      {
        amount: centavoAmount,
        method: parsed.data.method,
        referenceNumber: parsed.data.referenceNumber ?? undefined,
        last4Digits: parsed.data.last4Digits ?? undefined,
        approvalCode: parsed.data.approvalCode ?? undefined,
        checkBank: parsed.data.checkBank ?? undefined,
        checkDate: parsed.data.checkDate ?? undefined,
        notes: parsed.data.notes ?? undefined,
      },
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    revalidatePath("/invoices");
    return { success: true, data: { id: payment.id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. voidPaymentAction
// ---------------------------------------------------------------------------
export async function voidPaymentAction(
  paymentId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "payments:process")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await payments.voidPayment(paymentId, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    revalidatePath("/invoices");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to void payment",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. generateReceiptAction
// ---------------------------------------------------------------------------
export async function generateReceiptAction(
  paymentId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:view")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    const receipt = await payments.generateReceipt(paymentId);
    // Serialize to plain object (strips Date instances, Prisma metadata)
    const serialized = JSON.parse(JSON.stringify(receipt)) as Record<
      string,
      unknown
    >;
    return { success: true, data: serialized };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to generate receipt",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  invoiceLineItemSchema,
  invoiceDiscountSchema,
  invoiceEditSchema,
} from "@/lib/validators";
import * as invoices from "@/lib/services/invoices";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// Helper: get a setting value with fallback
// ---------------------------------------------------------------------------
async function getSettingValue(
  key: string,
  defaultValue: string
): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? defaultValue;
}

// ---------------------------------------------------------------------------
// 1. generateInvoiceAction
// ---------------------------------------------------------------------------
export async function generateInvoiceAction(
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:create")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    const invoice = await invoices.generateInvoice(
      jobOrderId,
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    revalidatePath("/invoices");
    return {
      success: true,
      data: { id: invoice.id, invoiceNumber: invoice.invoiceNumber },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate invoice",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. updateInvoiceAction
// ---------------------------------------------------------------------------
export async function updateInvoiceAction(
  invoiceId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = invoiceEditSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await invoices.updateInvoice(invoiceId, parsed.data, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update invoice",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. applyDiscountAction
// ---------------------------------------------------------------------------
export async function applyDiscountAction(
  invoiceId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = invoiceDiscountSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check discount threshold for non-owner/manager roles
  if (!can(session.user.role, "estimates:approve_discount")) {
    const thresholdStr = await getSettingValue(
      "discount_approval_threshold",
      "500000"
    );
    const threshold = parseInt(thresholdStr, 10);

    let discountAmount: number;
    if (parsed.data.discountType === "flat") {
      discountAmount = parsed.data.discountValue;
    } else {
      // For percentage, fetch the invoice to calculate actual discount amount
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { grandTotal: true, discountValue: true },
      });
      if (!invoice) {
        return { success: false, error: "Invoice not found" };
      }
      // Calculate percentage discount on the pre-discount total
      const preDiscountTotal = invoice.grandTotal + invoice.discountValue;
      discountAmount = Math.round(
        (preDiscountTotal * parsed.data.discountValue) / 100
      );
    }

    if (discountAmount > threshold) {
      return {
        success: false,
        error: "Discount exceeds threshold — manager approval required",
      };
    }
  }

  try {
    await invoices.applyDiscount(
      invoiceId,
      parsed.data.discountType,
      parsed.data.discountValue,
      parsed.data.discountReason,
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to apply discount",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. addInvoiceLineItemAction
// ---------------------------------------------------------------------------
export async function addInvoiceLineItemAction(
  invoiceId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = invoiceLineItemSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await invoices.addInvoiceLineItem(invoiceId, parsed.data, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to add invoice line item",
    };
  }
}

// ---------------------------------------------------------------------------
// 5. updateInvoiceLineItemAction
// ---------------------------------------------------------------------------
export async function updateInvoiceLineItemAction(
  lineItemId: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = invoiceLineItemSchema.partial().safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await invoices.updateInvoiceLineItem(
      lineItemId,
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
          : "Failed to update invoice line item",
    };
  }
}

// ---------------------------------------------------------------------------
// 6. deleteInvoiceLineItemAction
// ---------------------------------------------------------------------------
export async function deleteInvoiceLineItemAction(
  lineItemId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await invoices.deleteInvoiceLineItem(lineItemId, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to delete invoice line item",
    };
  }
}

// ---------------------------------------------------------------------------
// 7. generateShareLinkAction
// ---------------------------------------------------------------------------
export async function generateShareLinkAction(
  invoiceId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    const token = await invoices.generateShareToken(invoiceId);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { token } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to generate share link",
    };
  }
}

// ---------------------------------------------------------------------------
// 8. updateInvoiceTypeAction
// ---------------------------------------------------------------------------
export async function updateInvoiceTypeAction(
  invoiceId: string,
  jobOrderId: string,
  data: {
    invoiceType: string;
    chargeAccountId?: string | null;
    creditTerms?: string | null;
  }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  if (data.invoiceType !== "CASH" && data.invoiceType !== "CHARGE") {
    return {
      success: false,
      error: 'Invoice type must be "CASH" or "CHARGE"',
    };
  }

  try {
    const updateData: Record<string, unknown> = {
      invoiceType: data.invoiceType,
      updatedBy: session.user.id,
    };

    if (data.invoiceType === "CHARGE") {
      if (!data.chargeAccountId) {
        return {
          success: false,
          error: "Charge account is required for charge invoices",
        };
      }
      updateData.chargeAccountId = data.chargeAccountId;
      updateData.creditTerms = data.creditTerms ?? "NET_30";

      // Calculate due date based on credit terms
      const termDays: Record<string, number> = {
        NET_15: 15,
        NET_30: 30,
        NET_60: 60,
        DUE_ON_RECEIPT: 0,
      };
      const days = termDays[data.creditTerms ?? "NET_30"] ?? 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      updateData.dueDate = dueDate;
    } else {
      // CASH — clear charge fields
      updateData.chargeAccountId = null;
      updateData.creditTerms = null;
      updateData.dueDate = null;
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    // If switching to CHARGE, recalculate account balance
    if (
      data.invoiceType === "CHARGE" &&
      data.chargeAccountId
    ) {
      const { recalculateAccountBalance } = await import(
        "@/lib/services/charge-accounts"
      );
      await recalculateAccountBalance(data.chargeAccountId);
    }

    revalidatePath(`/jobs/${jobOrderId}`);
    revalidatePath("/invoices");
    revalidatePath("/charge-accounts");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update invoice type",
    };
  }
}

// ---------------------------------------------------------------------------
// 9. toggleBillingModeAction
// ---------------------------------------------------------------------------
export async function toggleBillingModeAction(
  invoiceId: string,
  jobOrderId: string,
  mode: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "invoices:edit")) {
    return { success: false, error: "Permission denied" };
  }

  if (mode !== "estimated" && mode !== "actual") {
    return {
      success: false,
      error: 'Billing mode must be "estimated" or "actual"',
    };
  }

  try {
    await invoices.updateInvoice(
      invoiceId,
      { billingMode: mode },
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
          : "Failed to toggle billing mode",
    };
  }
}

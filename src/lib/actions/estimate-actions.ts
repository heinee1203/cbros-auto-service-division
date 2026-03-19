"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  estimateRequestSchema,
  estimateLineItemSchema,
  estimateVersionSchema,
  type EstimateRequestInput,
  type EstimateLineItemInput,
  type EstimateVersionInput,
} from "@/lib/validators";
import {
  createEstimateRequest,
  getNextEstimateSequence,
  updateEstimateRequestStatus,
} from "@/lib/services/estimate-requests";
import {
  createEstimateWithVersion,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  duplicateLineItem,
  updateLineItemOrder,
  updateVersionDetails,
  generateApprovalToken,
} from "@/lib/services/estimates";
import { signTechReview, signMgmtApproval } from "@/lib/services/estimate-approvals";
import { sendCustomerSms } from "@/lib/services/sms";
import { prisma } from "@/lib/prisma";
import { generateDocNumber } from "@/lib/utils";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  warning?: string;
};

// ---------------------------------------------------------------------------
// 1. createEstimateRequestAction
// ---------------------------------------------------------------------------
export async function createEstimateRequestAction(
  input: EstimateRequestInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = estimateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const sequence = await getNextEstimateSequence();
  const requestNumber = generateDocNumber("EST", sequence);

  const request = await createEstimateRequest(
    parsed.data,
    requestNumber,
    session.user.id
  );

  revalidatePath("/estimates");
  return { success: true, data: { id: request.id, requestNumber } };
}

// ---------------------------------------------------------------------------
// 2. startEstimateAction
// ---------------------------------------------------------------------------
export async function startEstimateAction(
  estimateRequestId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const request = await prisma.estimateRequest.findUnique({
    where: { id: estimateRequestId },
    select: { requestNumber: true },
  });

  if (!request) {
    return { success: false, error: "Estimate request not found" };
  }

  const versionLabel = `${request.requestNumber}-v1`;

  const estimate = await createEstimateWithVersion(
    estimateRequestId,
    versionLabel,
    session.user.id
  );

  await updateEstimateRequestStatus(
    estimateRequestId,
    "PENDING_ESTIMATE",
    session.user.id
  );

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateRequestId}`);

  return {
    success: true,
    data: {
      estimateId: estimate.id,
      versionId: estimate.versions[0].id,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. addLineItemAction
// ---------------------------------------------------------------------------
export async function addLineItemAction(
  estimateVersionId: string,
  input: EstimateLineItemInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = estimateLineItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = {
    ...parsed.data,
    unitCost: Math.round(parsed.data.unitCost * 100),
  };

  const lineItem = await addLineItem(estimateVersionId, data, session.user.id);
  revalidatePath("/estimates");
  return { success: true, data: { id: lineItem.id } };
}

// ---------------------------------------------------------------------------
// 4. updateLineItemAction
// ---------------------------------------------------------------------------
export async function updateLineItemAction(
  id: string,
  input: Partial<EstimateLineItemInput>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const partialSchema = estimateLineItemSchema.partial();
  const parsed = partialSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = { ...parsed.data };
  if (data.unitCost !== undefined) {
    data.unitCost = Math.round(data.unitCost * 100);
  }

  await updateLineItem(id, data, session.user.id);
  revalidatePath("/estimates");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 5. deleteLineItemAction
// ---------------------------------------------------------------------------
export async function deleteLineItemAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await deleteLineItem(id, session.user.id);
  revalidatePath("/estimates");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 6. duplicateLineItemAction
// ---------------------------------------------------------------------------
export async function duplicateLineItemAction(
  id: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const duplicate = await duplicateLineItem(id, session.user.id);
  revalidatePath("/estimates");
  return { success: true, data: { id: duplicate.id } };
}

// ---------------------------------------------------------------------------
// 7. reorderLineItemsAction
// ---------------------------------------------------------------------------
export async function reorderLineItemsAction(
  items: { id: string; sortOrder: number }[]
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await updateLineItemOrder(items, session.user.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// 8. updateVersionDetailsAction
// ---------------------------------------------------------------------------
export async function updateVersionDetailsAction(
  versionId: string,
  input: EstimateVersionInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = estimateVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = { ...parsed.data };
  if (data.discountType === "flat" && data.discountValue !== undefined) {
    data.discountValue = Math.round(data.discountValue * 100);
  }

  const totals = await updateVersionDetails(versionId, data, session.user.id);
  revalidatePath("/estimates");
  return {
    success: true,
    data: {
      rawTotal: totals.rawTotal,
      discountAmount: totals.discountAmount,
      afterDiscount: totals.afterDiscount,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
    },
  };
}

// ---------------------------------------------------------------------------
// 9. updateEstimateStatusAction
// ---------------------------------------------------------------------------
export async function updateEstimateStatusAction(
  estimateRequestId: string,
  status: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await updateEstimateRequestStatus(
    estimateRequestId,
    status,
    session.user.id
  );

  // Generate approval token when marking as sent
  let approvalToken: string | undefined;
  if (status === "ESTIMATE_SENT") {
    const estimate = await prisma.estimate.findFirst({
      where: { estimateRequestId, deletedAt: null },
      include: {
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    const latestVersion = estimate?.versions?.[0];
    if (latestVersion && !latestVersion.approvalToken) {
      approvalToken = await generateApprovalToken(latestVersion.id, session.user.id);
    } else if (latestVersion?.approvalToken) {
      approvalToken = latestVersion.approvalToken;
    }
  }

  // SMS — estimate ready for review
  if (status === "ESTIMATE_SENT" && approvalToken) {
    const estRequest = await prisma.estimateRequest.findUnique({
      where: { id: estimateRequestId },
      include: {
        vehicle: { select: { plateNumber: true } },
      },
    });
    if (estRequest) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      sendCustomerSms(
        estRequest.customerId,
        "ESTIMATE_READY",
        {
          vehiclePlate: estRequest.vehicle.plateNumber,
          link: `${baseUrl}/approve/estimate/${approvalToken}`,
        }
      ).catch((err) => console.error("[SMS] ESTIMATE_READY failed:", err));
    }
  }

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateRequestId}`);
  return { success: true, data: approvalToken ? { approvalToken } : undefined };
}

// ---------------------------------------------------------------------------
// 10. signTechReviewAction
// ---------------------------------------------------------------------------
export async function signTechReviewAction(
  versionId: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Not authenticated" };

    await signTechReview(versionId, session.user.id, signature);

    revalidatePath("/estimates");
    revalidatePath("/frontliner");
    revalidatePath("/schedule/floor");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign technical review",
    };
  }
}

// ---------------------------------------------------------------------------
// 11. signMgmtApprovalAction
// ---------------------------------------------------------------------------
export async function signMgmtApprovalAction(
  versionId: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Not authenticated" };

    await signMgmtApproval(versionId, session.user.id, signature);

    revalidatePath("/estimates");
    revalidatePath("/frontliner");
    revalidatePath("/schedule/floor");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign management approval",
    };
  }
}

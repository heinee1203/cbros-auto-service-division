import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import type { SupplementLineItemInput } from "@/lib/validators";
import { UserRole } from "@/types/enums";

// ---------------------------------------------------------------------------
// 1. createSupplement
// ---------------------------------------------------------------------------
export async function createSupplement(
  jobOrderId: string,
  data: { description: string; reason?: string | null },
  userId: string
) {
  const jobOrder = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { jobOrderNumber: true },
  });

  if (!jobOrder) {
    throw new Error("Job order not found");
  }

  const existingCount = await prisma.supplementalEstimate.count({
    where: { jobOrderId },
  });

  const supplementNumber = `SUP-${jobOrder.jobOrderNumber}-S${existingCount + 1}`;

  const supplement = await prisma.supplementalEstimate.create({
    data: {
      jobOrderId,
      supplementNumber,
      status: "DRAFT",
      description: data.description,
      reason: data.reason || null,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // Write JobActivity
  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      type: "supplement_created",
      title: `Supplemental estimate ${supplementNumber} created`,
      userId,
    },
  });

  return supplement;
}

// ---------------------------------------------------------------------------
// 2. getJobSupplements
// ---------------------------------------------------------------------------
export async function getJobSupplements(jobOrderId: string) {
  return prisma.supplementalEstimate.findMany({
    where: { jobOrderId },
    include: {
      lineItems: {
        where: { deletedAt: null },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// 3. getSupplementDetail
// ---------------------------------------------------------------------------
export async function getSupplementDetail(supplementId: string) {
  return prisma.supplementalEstimate.findUnique({
    where: { id: supplementId },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 4. addSupplementLineItem
// ---------------------------------------------------------------------------
export async function addSupplementLineItem(
  supplementId: string,
  data: SupplementLineItemInput,
  userId: string
) {
  const subtotal = Math.round(data.quantity * data.unitCost);

  const lineItem = await prisma.supplementLineItem.create({
    data: {
      supplementalEstimateId: supplementId,
      group: data.group,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      subtotal,
      notes: data.notes || null,
      estimatedHours: data.estimatedHours || null,
      sortOrder: data.sortOrder,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalculateSupplementTotals(supplementId);

  return lineItem;
}

// ---------------------------------------------------------------------------
// 5. updateSupplementLineItem
// ---------------------------------------------------------------------------
export async function updateSupplementLineItem(
  lineItemId: string,
  data: Partial<SupplementLineItemInput>,
  userId: string
) {
  const existing = await prisma.supplementLineItem.findUnique({
    where: { id: lineItemId },
  });

  if (!existing) throw new Error("Line item not found");

  const quantity = data.quantity ?? existing.quantity;
  const unitCost = data.unitCost ?? existing.unitCost;
  const subtotal =
    data.quantity !== undefined || data.unitCost !== undefined
      ? Math.round(quantity * unitCost)
      : existing.subtotal;

  const lineItem = await prisma.supplementLineItem.update({
    where: { id: lineItemId },
    data: {
      ...(data.group !== undefined && { group: data.group }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      subtotal,
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.estimatedHours !== undefined && {
        estimatedHours: data.estimatedHours || null,
      }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedBy: userId,
    },
  });

  await recalculateSupplementTotals(existing.supplementalEstimateId);

  return lineItem;
}

// ---------------------------------------------------------------------------
// 6. deleteSupplementLineItem
// ---------------------------------------------------------------------------
export async function deleteSupplementLineItem(
  lineItemId: string,
  userId: string
) {
  const lineItem = await prisma.supplementLineItem.findUnique({
    where: { id: lineItemId },
    select: { supplementalEstimateId: true },
  });

  if (!lineItem) throw new Error("Line item not found");

  await prisma.supplementLineItem.update({
    where: { id: lineItemId },
    data: { deletedAt: new Date(), updatedBy: userId },
  });

  await recalculateSupplementTotals(lineItem.supplementalEstimateId);
}

// ---------------------------------------------------------------------------
// 7. recalculateSupplementTotals
// ---------------------------------------------------------------------------
export async function recalculateSupplementTotals(supplementId: string) {
  const lineItems = await prisma.supplementLineItem.findMany({
    where: { supplementalEstimateId: supplementId, deletedAt: null },
  });

  let subtotalLabor = 0;
  let subtotalParts = 0;
  let subtotalMaterials = 0;
  let subtotalOther = 0;

  for (const item of lineItems) {
    switch (item.group) {
      case "LABOR":
        subtotalLabor += item.subtotal;
        break;
      case "PARTS":
        subtotalParts += item.subtotal;
        break;
      case "MATERIALS":
        subtotalMaterials += item.subtotal;
        break;
      default:
        subtotalOther += item.subtotal;
        break;
    }
  }

  // Prices are VAT-inclusive — no VAT added on top for supplemental estimates
  const subtotal = subtotalLabor + subtotalParts + subtotalMaterials + subtotalOther;
  const vatAmount = 0;
  const grandTotal = subtotal;

  await prisma.supplementalEstimate.update({
    where: { id: supplementId },
    data: {
      subtotalLabor,
      subtotalParts,
      subtotalMaterials,
      subtotalOther,
      vatAmount,
      grandTotal,
    },
  });
}

// ---------------------------------------------------------------------------
// 8. submitForApproval
// ---------------------------------------------------------------------------
export async function submitForApproval(
  supplementId: string,
  userId: string
) {
  const approvalToken = crypto.randomUUID();
  const approvalTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  const supplement = await prisma.supplementalEstimate.update({
    where: { id: supplementId },
    data: {
      status: "SUBMITTED",
      approvalToken,
      approvalTokenExpiry,
      updatedBy: userId,
    },
  });

  // Write JobActivity
  await prisma.jobActivity.create({
    data: {
      jobOrderId: supplement.jobOrderId,
      type: "supplement_submitted",
      title: `Supplemental estimate ${supplement.supplementNumber} submitted for approval`,
      userId,
    },
  });

  return approvalToken;
}

// ---------------------------------------------------------------------------
// 9. getSupplementByToken
// ---------------------------------------------------------------------------
export async function getSupplementByToken(token: string) {
  const supplement = await prisma.supplementalEstimate.findFirst({
    where: { approvalToken: token },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
      jobOrder: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              plateNumber: true,
              make: true,
              model: true,
              year: true,
              color: true,
            },
          },
        },
      },
    },
  });

  if (!supplement) return null;

  // Check if token expired
  if (
    supplement.approvalTokenExpiry &&
    supplement.approvalTokenExpiry < new Date()
  ) {
    return null;
  }

  return supplement;
}

// ---------------------------------------------------------------------------
// 10. approveWithSignature
// ---------------------------------------------------------------------------
export async function approveWithSignature(
  token: string,
  signature: string,
  comments?: string
) {
  const supplement = await getSupplementByToken(token);
  if (!supplement) throw new Error("Supplement not found or token expired");

  // Update supplement status
  await prisma.supplementalEstimate.update({
    where: { id: supplement.id },
    data: {
      status: "APPROVED",
      customerSignature: signature,
      approvedAt: new Date(),
      customerComments: comments || null,
      updatedBy: "customer",
    },
  });

  // Auto-create tasks from LABOR line items
  const laborItems = supplement.lineItems.filter(
    (li) => li.group === "LABOR" && !li.deletedAt
  );

  const existingTaskCount = await prisma.task.count({
    where: { jobOrderId: supplement.jobOrderId, deletedAt: null },
  });

  for (let i = 0; i < laborItems.length; i++) {
    await prisma.task.create({
      data: {
        jobOrderId: supplement.jobOrderId,
        name: laborItems[i].description,
        status: "QUEUED",
        sortOrder: existingTaskCount + i,
        estimatedHours: laborItems[i].estimatedHours || 0,
        hourlyRate: laborItems[i].unitCost,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  // Write JobActivity
  await prisma.jobActivity.create({
    data: {
      jobOrderId: supplement.jobOrderId,
      type: "supplement_approved",
      title: `Supplemental estimate ${supplement.supplementNumber} approved by customer`,
      userId: "system",
    },
  });

  // Create Notification for MANAGER/OWNER roles
  const managers = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.MANAGER, UserRole.OWNER] },
      isActive: true,
    },
    select: { id: true },
  });

  for (const manager of managers) {
    await prisma.notification.create({
      data: {
        recipientId: manager.id,
        type: "SUPPLEMENT_APPROVED",
        title: "Supplemental Estimate Approved",
        message: `Supplemental estimate ${supplement.supplementNumber} has been approved by the customer.`,
        entityType: "SupplementalEstimate",
        entityId: supplement.id,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  return supplement;
}

// ---------------------------------------------------------------------------
// 11. denySupplement
// ---------------------------------------------------------------------------
export async function denySupplement(token: string, comments?: string) {
  const supplement = await getSupplementByToken(token);
  if (!supplement) throw new Error("Supplement not found or token expired");

  await prisma.supplementalEstimate.update({
    where: { id: supplement.id },
    data: {
      status: "DENIED",
      customerComments: comments || null,
      updatedBy: "customer",
    },
  });

  // Write JobActivity
  await prisma.jobActivity.create({
    data: {
      jobOrderId: supplement.jobOrderId,
      type: "supplement_denied",
      title: `Supplemental estimate ${supplement.supplementNumber} denied by customer`,
      userId: "system",
    },
  });

  return supplement;
}

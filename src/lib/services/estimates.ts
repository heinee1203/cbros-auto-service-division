import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type {
  EstimateLineItemInput,
  EstimateVersionInput,
} from "@/lib/validators";

// ---------------------------------------------------------------------------
// 1. createEstimateWithVersion
// ---------------------------------------------------------------------------
export async function createEstimateWithVersion(
  estimateRequestId: string,
  versionLabel: string,
  userId?: string
) {
  return prisma.estimate.create({
    data: {
      estimateRequestId,
      createdBy: userId,
      updatedBy: userId,
      versions: {
        create: {
          versionNumber: 1,
          versionLabel,
          createdBy: userId,
          updatedBy: userId,
        },
      },
    },
    include: {
      versions: true,
    },
  });
}

// ---------------------------------------------------------------------------
// 2. getEstimateVersionById
// ---------------------------------------------------------------------------
export async function getEstimateVersionById(versionId: string) {
  return prisma.estimateVersion.findUnique({
    where: { id: versionId },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          serviceCatalog: true,
        },
      },
      estimate: {
        include: {
          estimateRequest: {
            include: {
              customer: true,
              vehicle: true,
            },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: calculate line item subtotal
// ---------------------------------------------------------------------------
function calculateSubtotal(
  quantity: number,
  unitCost: number,
  markup: number
): number {
  const base = Math.round(quantity * unitCost);
  return base + Math.round(base * (markup / 100));
}

// ---------------------------------------------------------------------------
// 3. addLineItem
// ---------------------------------------------------------------------------
export async function addLineItem(
  estimateVersionId: string,
  data: EstimateLineItemInput,
  userId?: string
) {
  const subtotal = calculateSubtotal(data.quantity, data.unitCost, data.markup);

  const lineItem = await prisma.estimateLineItem.create({
    data: {
      estimateVersionId,
      group: data.group,
      description: data.description,
      serviceCatalogId: data.serviceCatalogId ?? null,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      markup: data.markup,
      subtotal,
      notes: data.notes ?? null,
      estimatedHours: data.estimatedHours ?? null,
      assignedTechnicianId: data.assignedTechnicianId ?? null,
      sortOrder: data.sortOrder,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalculateVersionTotals(estimateVersionId);
  return lineItem;
}

// ---------------------------------------------------------------------------
// 4. updateLineItem
// ---------------------------------------------------------------------------
export async function updateLineItem(
  id: string,
  data: Partial<EstimateLineItemInput>,
  userId?: string
) {
  // Fetch current to merge for subtotal calculation
  const current = await prisma.estimateLineItem.findUniqueOrThrow({
    where: { id },
  });

  const quantity = data.quantity ?? current.quantity;
  const unitCost = data.unitCost ?? current.unitCost;
  const markup = data.markup ?? current.markup;
  const subtotal = calculateSubtotal(quantity, unitCost, markup);

  const lineItem = await prisma.estimateLineItem.update({
    where: { id },
    data: {
      ...(data.group !== undefined && { group: data.group }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.serviceCatalogId !== undefined && {
        serviceCatalogId: data.serviceCatalogId ?? null,
      }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      ...(data.markup !== undefined && { markup: data.markup }),
      subtotal,
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      ...(data.estimatedHours !== undefined && {
        estimatedHours: data.estimatedHours ?? null,
      }),
      ...(data.assignedTechnicianId !== undefined && {
        assignedTechnicianId: data.assignedTechnicianId ?? null,
      }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedBy: userId,
    },
  });

  await recalculateVersionTotals(current.estimateVersionId);
  return lineItem;
}

// ---------------------------------------------------------------------------
// 5. deleteLineItem (soft delete)
// ---------------------------------------------------------------------------
export async function deleteLineItem(id: string, userId?: string) {
  const lineItem = await prisma.estimateLineItem.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });

  await recalculateVersionTotals(lineItem.estimateVersionId);
  return lineItem;
}

// ---------------------------------------------------------------------------
// 6. duplicateLineItem
// ---------------------------------------------------------------------------
export async function duplicateLineItem(id: string, userId?: string) {
  const source = await prisma.estimateLineItem.findUniqueOrThrow({
    where: { id },
  });

  const duplicate = await prisma.estimateLineItem.create({
    data: {
      estimateVersionId: source.estimateVersionId,
      group: source.group,
      description: source.description,
      serviceCatalogId: source.serviceCatalogId,
      quantity: source.quantity,
      unit: source.unit,
      unitCost: source.unitCost,
      markup: source.markup,
      subtotal: source.subtotal,
      notes: source.notes,
      estimatedHours: source.estimatedHours,
      assignedTechnicianId: source.assignedTechnicianId,
      sortOrder: source.sortOrder + 1,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalculateVersionTotals(source.estimateVersionId);
  return duplicate;
}

// ---------------------------------------------------------------------------
// 7. updateLineItemOrder
// ---------------------------------------------------------------------------
export async function updateLineItemOrder(
  items: { id: string; sortOrder: number }[],
  userId?: string
) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.estimateLineItem.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder, updatedBy: userId },
      })
    )
  );
}

// ---------------------------------------------------------------------------
// 8. recalculateVersionTotals
// ---------------------------------------------------------------------------

const GROUP_FIELD_MAP: Record<string, string> = {
  LABOR: "subtotalLabor",
  PARTS: "subtotalParts",
  MATERIALS: "subtotalMaterials",
  PAINT: "subtotalPaint",
  SUBLET: "subtotalSublet",
  OTHER: "subtotalOther",
};

export async function recalculateVersionTotals(versionId: string) {
  const lineItems = await prisma.estimateLineItem.findMany({
    where: { estimateVersionId: versionId, deletedAt: null },
  });

  // Aggregate subtotals by group
  const groupTotals: Record<string, number> = {
    subtotalLabor: 0,
    subtotalParts: 0,
    subtotalMaterials: 0,
    subtotalPaint: 0,
    subtotalSublet: 0,
    subtotalOther: 0,
  };

  for (const item of lineItems) {
    const field = GROUP_FIELD_MAP[item.group] || "subtotalOther";
    groupTotals[field] += item.subtotal;
  }

  const rawTotal = Object.values(groupTotals).reduce((a, b) => a + b, 0);

  // Read current version for discount/VAT settings
  const version = await prisma.estimateVersion.findUniqueOrThrow({
    where: { id: versionId },
  });

  // Calculate discount
  let discountAmount = 0;
  if (version.discountType === "flat") {
    discountAmount = version.discountValue;
  } else if (version.discountType === "percentage") {
    discountAmount = Math.round(rawTotal * (version.discountValue / 10000));
  }

  const afterDiscount = rawTotal - discountAmount;
  const vatAmount = Math.round(afterDiscount * (version.vatRate / 100));
  const grandTotal = afterDiscount + vatAmount;

  const updated = await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      ...groupTotals,
      vatAmount,
      grandTotal,
    },
  });

  return {
    ...groupTotals,
    rawTotal,
    discountAmount,
    afterDiscount,
    vatAmount,
    grandTotal,
    updated,
  };
}

// ---------------------------------------------------------------------------
// 9. updateVersionDetails
// ---------------------------------------------------------------------------
export async function updateVersionDetails(
  versionId: string,
  data: EstimateVersionInput,
  userId?: string
) {
  await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      ...(data.discountType !== undefined && {
        discountType: data.discountType ?? null,
      }),
      ...(data.discountValue !== undefined && {
        discountValue: data.discountValue,
      }),
      ...(data.discountReason !== undefined && {
        discountReason: data.discountReason ?? null,
      }),
      ...(data.termsAndConditions !== undefined && {
        termsAndConditions: data.termsAndConditions ?? null,
      }),
      ...(data.estimatedDays !== undefined && {
        estimatedDays: data.estimatedDays ?? null,
      }),
      updatedBy: userId,
    },
  });

  return recalculateVersionTotals(versionId);
}

// ---------------------------------------------------------------------------
// 10. searchServiceCatalog
// ---------------------------------------------------------------------------
export async function searchServiceCatalog(
  query: string,
  category?: string
) {
  if (!query || query.length < 2) return [];

  const where: Record<string, unknown> = {
    isActive: true,
    OR: [
      { name: { contains: query } },
      { description: { contains: query } },
    ],
  };

  if (category) {
    where.category = category;
  }

  return prisma.serviceCatalog.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    take: 20,
  });
}

// ---------------------------------------------------------------------------
// 10b. getAllActiveServices
// ---------------------------------------------------------------------------
export async function getAllActiveServices(category?: string) {
  const where: Record<string, unknown> = { isActive: true };
  if (category) {
    where.category = category;
  }
  return prisma.serviceCatalog.findMany({
    where,
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// 11. getActiveTechnicians
// ---------------------------------------------------------------------------
export async function getActiveTechnicians() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["TECHNICIAN", "QC_INSPECTOR"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
    orderBy: { firstName: "asc" },
  });
}

// ---------------------------------------------------------------------------
// 12. getEstimateVersionByToken
// ---------------------------------------------------------------------------
export async function getEstimateVersionByToken(token: string) {
  // approvalToken is @unique, but we also need deletedAt: null for soft-delete
  // filtering — findUnique doesn't support compound where with non-unique fields,
  // so findFirst is required here.
  const version = await prisma.estimateVersion.findFirst({
    where: { approvalToken: token, deletedAt: null },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      },
      estimate: {
        include: {
          estimateRequest: {
            include: {
              customer: true,
              vehicle: true,
            },
          },
        },
      },
    },
  });

  if (!version) return null;

  // Check token expiry if set
  if (version.approvalTokenExpiry && new Date() > version.approvalTokenExpiry) {
    return null;
  }

  return version;
}

// ---------------------------------------------------------------------------
// 13. generateApprovalToken
// ---------------------------------------------------------------------------
export async function generateApprovalToken(versionId: string, userId?: string) {
  const token = randomUUID();
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      approvalToken: token,
      approvalTokenExpiry: expiry,
      updatedBy: userId,
    },
  });

  return token;
}

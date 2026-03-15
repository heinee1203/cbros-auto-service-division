import { prisma } from "@/lib/prisma";
import type { MaterialUsageInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// 1. logMaterial — Create a MaterialUsage record + activity
// ---------------------------------------------------------------------------
export async function logMaterial(
  jobOrderId: string,
  data: MaterialUsageInput,
  userId: string
) {
  const material = await prisma.materialUsage.create({
    data: {
      jobOrderId,
      taskId: data.taskId ?? null,
      itemDescription: data.itemDescription,
      partNumber: data.partNumber ?? null,
      quantity: data.quantity,
      unit: data.unit,
      actualCost: data.actualCost,
      estimatedLineItemId: data.estimatedLineItemId ?? null,
      loggedBy: userId,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // Write activity
  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      type: "material_logged",
      title: `Material logged: ${data.itemDescription}`,
      metadata: JSON.stringify({
        materialId: material.id,
        taskId: data.taskId ?? null,
        quantity: data.quantity,
        unit: data.unit,
        actualCost: data.actualCost,
      }),
      userId,
    },
  });

  return material;
}

// ---------------------------------------------------------------------------
// 2. updateMaterial
// ---------------------------------------------------------------------------
export async function updateMaterial(
  id: string,
  data: Partial<MaterialUsageInput>,
  userId: string
) {
  return prisma.materialUsage.update({
    where: { id },
    data: {
      ...(data.taskId !== undefined && { taskId: data.taskId ?? null }),
      ...(data.itemDescription !== undefined && {
        itemDescription: data.itemDescription,
      }),
      ...(data.partNumber !== undefined && {
        partNumber: data.partNumber ?? null,
      }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.actualCost !== undefined && { actualCost: data.actualCost }),
      ...(data.estimatedLineItemId !== undefined && {
        estimatedLineItemId: data.estimatedLineItemId ?? null,
      }),
      updatedBy: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// 3. deleteMaterial — soft delete
// ---------------------------------------------------------------------------
export async function deleteMaterial(id: string, userId: string) {
  return prisma.materialUsage.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
}

// ---------------------------------------------------------------------------
// 4. getTaskMaterials
// ---------------------------------------------------------------------------
export async function getTaskMaterials(taskId: string) {
  return prisma.materialUsage.findMany({
    where: { taskId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// 5. getJobMaterials — all materials for a job with related info
// ---------------------------------------------------------------------------
export async function getJobMaterials(jobOrderId: string) {
  // MaterialUsage has no direct relations to User (loggedBy is plain String)
  // or EstimateLineItem, so we fetch separately and join in memory.
  const materials = await prisma.materialUsage.findMany({
    where: { jobOrderId, deletedAt: null },
    include: {
      task: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Collect unique loggedBy user IDs
  const userIds = Array.from(new Set(materials.map((m) => m.loggedBy)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Collect unique estimatedLineItemIds
  const lineItemIds = materials
    .map((m) => m.estimatedLineItemId)
    .filter((id): id is string => id !== null);
  const lineItems = lineItemIds.length
    ? await prisma.estimateLineItem.findMany({
        where: { id: { in: lineItemIds } },
        select: { id: true, description: true, unitCost: true, quantity: true },
      })
    : [];
  const lineItemMap = new Map(lineItems.map((li) => [li.id, li]));

  return materials.map((m) => ({
    ...m,
    loggedByUser: userMap.get(m.loggedBy) ?? null,
    estimatedLineItem: m.estimatedLineItemId
      ? lineItemMap.get(m.estimatedLineItemId) ?? null
      : null,
  }));
}

// ---------------------------------------------------------------------------
// 6. getVarianceReport
// ---------------------------------------------------------------------------
export async function getVarianceReport(jobOrderId: string) {
  // Get the approved estimate version for this job
  const estimate = await prisma.estimate.findFirst({
    where: { jobOrderId, deletedAt: null },
    include: {
      versions: {
        where: { isApproved: true, deletedAt: null },
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          lineItems: {
            where: {
              deletedAt: null,
              group: { in: ["PARTS", "MATERIALS"] },
            },
          },
        },
      },
    },
  });

  const approvedVersion = estimate?.versions[0];
  if (!approvedVersion) {
    return { items: [], threshold: 20 };
  }

  // Get all materials logged for this job
  const materials = await prisma.materialUsage.findMany({
    where: { jobOrderId, deletedAt: null },
  });

  // Get the variance threshold setting
  const thresholdSetting = await prisma.setting.findUnique({
    where: { key: "material_variance_threshold_pct" },
  });
  const threshold = thresholdSetting
    ? parseFloat(thresholdSetting.value)
    : 20;

  // Build variance report
  const items = approvedVersion.lineItems.map((li) => {
    const estimatedTotal = li.unitCost * li.quantity;
    const matchedMaterials = materials.filter(
      (m) => m.estimatedLineItemId === li.id
    );
    const actualTotal = matchedMaterials.reduce(
      (sum, m) => sum + m.actualCost,
      0
    );
    const varianceAmount = actualTotal - estimatedTotal;
    const variancePct =
      estimatedTotal > 0
        ? Math.round((varianceAmount / estimatedTotal) * 10000) / 100
        : 0;

    return {
      lineItemId: li.id,
      description: li.description,
      estimatedTotal,
      actualTotal,
      varianceAmount,
      variancePct,
      overThreshold: Math.abs(variancePct) > threshold,
    };
  });

  return { items, threshold };
}

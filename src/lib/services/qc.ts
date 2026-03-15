import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/job-activities";
import { SERVICE_TO_QC_CATEGORY } from "@/lib/constants";

// ---------------------------------------------------------------------------
// 1. createQCInspection
// ---------------------------------------------------------------------------
export async function createQCInspection(
  jobOrderId: string,
  inspectorId: string
) {
  // Fetch job's service categories from estimates
  const jobOrder = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    include: {
      estimates: {
        where: { deletedAt: null },
        include: {
          estimateRequest: {
            select: { requestedCategories: true },
          },
        },
      },
    },
  });

  if (!jobOrder) throw new Error("Job order not found");

  // Parse requested categories from all estimates
  const serviceCategories = new Set<string>();
  for (const estimate of jobOrder.estimates) {
    const raw = estimate.estimateRequest?.requestedCategories;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as string[];
        for (const cat of parsed) serviceCategories.add(cat);
      } catch {
        // skip invalid JSON
      }
    }
  }

  // Map service categories to QC categories
  const qcCategorySet = new Set<string>();
  Array.from(serviceCategories).forEach((svcCat) => {
    const mapped = SERVICE_TO_QC_CATEGORY[svcCat];
    if (mapped) {
      mapped.forEach((qcCat) => qcCategorySet.add(qcCat));
    }
  });
  // Always include mechanical
  qcCategorySet.add("mechanical");
  const qcCategories = Array.from(qcCategorySet);

  // Check for re-inspection (previous failed inspection)
  const prevInspection = await prisma.qCInspection.findFirst({
    where: { jobOrderId, overallResult: "FAILED", deletedAt: null },
    orderBy: { inspectionDate: "desc" },
  });

  // Count total inspections for attempt number
  const inspectionCount = await prisma.qCInspection.count({
    where: { jobOrderId, deletedAt: null },
  });
  const attemptNumber = inspectionCount + 1;

  // Fetch inspector name
  const inspector = await prisma.user.findUnique({
    where: { id: inspectorId },
    select: { firstName: true, lastName: true },
  });
  const inspectorName = inspector
    ? `${inspector.firstName} ${inspector.lastName}`
    : "Unknown";

  let checklistItemsData: Array<{
    category: string;
    description: string;
    status: string;
    sortOrder: number;
    inspectedAt: Date | null;
    createdBy: string;
  }> = [];

  if (prevInspection) {
    // Re-inspection: only include previously failed items
    const failedItems = await prisma.qCChecklistItem.findMany({
      where: {
        qcInspectionId: prevInspection.id,
        status: "FAIL",
        deletedAt: null,
      },
    });

    checklistItemsData = failedItems.map((item, index) => ({
      category: item.category,
      description: item.description,
      status: "NA",
      sortOrder: index,
      inspectedAt: null,
      createdBy: inspectorId,
    }));
  } else {
    // Fresh inspection: load templates from settings
    let sortCounter = 0;
    for (const category of qcCategories) {
      const setting = await prisma.setting.findUnique({
        where: { key: `qc_checklist_${category}` },
      });

      if (setting) {
        try {
          const templateItems = JSON.parse(setting.value) as Array<{
            description: string;
            sortOrder: number;
          }>;
          for (const tmpl of templateItems) {
            checklistItemsData.push({
              category,
              description: tmpl.description,
              status: "NA",
              sortOrder: sortCounter + tmpl.sortOrder,
              inspectedAt: null,
              createdBy: inspectorId,
            });
          }
          sortCounter += templateItems.length;
        } catch {
          // skip invalid JSON
        }
      }
    }
  }

  // Create the inspection with checklist items
  const inspection = await prisma.qCInspection.create({
    data: {
      jobOrderId,
      inspectorId,
      overallResult: "PENDING",
      createdBy: inspectorId,
      checklistItems: {
        create: checklistItemsData,
      },
    },
    include: {
      checklistItems: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
      inspector: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  // Log activity
  await logActivity({
    jobOrderId,
    type: "qc_result",
    title: `QC Inspection #${attemptNumber} started`,
    description: `Started by ${inspectorName}`,
    userId: inspectorId,
  });

  return inspection;
}

// ---------------------------------------------------------------------------
// 2. getQCInspection
// ---------------------------------------------------------------------------
export async function getQCInspection(inspectionId: string) {
  const inspection = await prisma.qCInspection.findUnique({
    where: { id: inspectionId },
    include: {
      inspector: {
        select: { firstName: true, lastName: true },
      },
      checklistItems: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return inspection ?? null;
}

// ---------------------------------------------------------------------------
// 3. getJobQCInspections
// ---------------------------------------------------------------------------
export async function getJobQCInspections(jobOrderId: string) {
  const inspections = await prisma.qCInspection.findMany({
    where: { jobOrderId, deletedAt: null },
    orderBy: { inspectionDate: "desc" },
    include: {
      inspector: {
        select: { firstName: true, lastName: true },
      },
      _count: {
        select: { checklistItems: true },
      },
      checklistItems: {
        where: { deletedAt: null },
        select: { status: true },
      },
    },
  });

  // Compute item breakdown for each inspection
  return inspections.map((inspection) => {
    const items = inspection.checklistItems;
    const breakdown = {
      passed: items.filter((i) => i.status === "PASS").length,
      failed: items.filter((i) => i.status === "FAIL").length,
      pending: items.filter((i) => i.status === "NA").length,
    };

    // Remove checklistItems from response, keep _count and breakdown
    const { checklistItems: _items, ...rest } = inspection;
    return { ...rest, breakdown };
  });
}

// ---------------------------------------------------------------------------
// 4. updateChecklistItem
// ---------------------------------------------------------------------------
export async function updateChecklistItem(
  itemId: string,
  data: { status: string; notes?: string | null; photoId?: string | null },
  inspectorId: string
) {
  return prisma.qCChecklistItem.update({
    where: { id: itemId },
    data: {
      status: data.status,
      notes: data.notes,
      photoId: data.photoId,
      inspectedAt: new Date(),
      updatedBy: inspectorId,
    },
  });
}

// ---------------------------------------------------------------------------
// 5. submitQCInspection
// ---------------------------------------------------------------------------
export async function submitQCInspection(
  inspectionId: string,
  inspectorId: string,
  notes?: string
) {
  // Fetch inspection with all checklist items
  const inspection = await prisma.qCInspection.findUnique({
    where: { id: inspectionId },
    include: {
      checklistItems: {
        where: { deletedAt: null },
      },
      inspector: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!inspection) throw new Error("QC Inspection not found");

  const { jobOrderId } = inspection;
  const inspectorName = inspection.inspector
    ? `${inspection.inspector.firstName} ${inspection.inspector.lastName}`
    : "Unknown";

  // Verify all items have been inspected
  const uninspected = inspection.checklistItems.filter(
    (item) => item.inspectedAt === null
  );
  if (uninspected.length > 0) {
    throw new Error(
      `${uninspected.length} checklist item(s) have not been inspected yet`
    );
  }

  const failedItems = inspection.checklistItems.filter(
    (item) => item.status === "FAIL"
  );
  const failedCount = failedItems.length;

  if (failedCount === 0) {
    // ALL PASS
    await prisma.qCInspection.update({
      where: { id: inspectionId },
      data: {
        overallResult: "PASSED",
        notes,
        updatedBy: inspectorId,
      },
    });

    await prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: { status: "QC_PASSED" },
    });

    await logActivity({
      jobOrderId,
      type: "qc_result",
      title: `QC passed by ${inspectorName}`,
      userId: inspectorId,
    });

    // Notify ADVISORs
    const advisors = await prisma.user.findMany({
      where: { role: "ADVISOR", isActive: true, deletedAt: null },
    });

    if (advisors.length > 0) {
      await prisma.notification.createMany({
        data: advisors.map((advisor) => ({
          recipientId: advisor.id,
          type: "QC_PASSED",
          title: "QC Inspection Passed",
          message: `Quality control inspection passed for job ${jobOrderId}`,
          isRead: false,
          entityType: "JOB_ORDER",
          entityId: jobOrderId,
        })),
      });
    }

    // Auto-generate invoice on QC pass
    try {
      const { generateInvoice } = await import("@/lib/services/invoices");
      await generateInvoice(jobOrderId, inspectorId);
    } catch (invoiceErr) {
      // Log but don't fail QC — invoice can be generated manually
      console.error("Auto-invoice generation failed:", invoiceErr);
    }

    return { result: "PASSED" as const, failedCount: 0 };
  } else {
    // HAS FAILURES
    await prisma.qCInspection.update({
      where: { id: inspectionId },
      data: {
        overallResult: "FAILED",
        notes,
        updatedBy: inspectorId,
      },
    });

    await prisma.jobOrder.update({
      where: { id: jobOrderId },
      data: { status: "QC_FAILED_REWORK" },
    });

    // Get existing task count for sort order
    const existingTaskCount = await prisma.task.count({
      where: { jobOrderId, deletedAt: null },
    });

    // Get primary technician
    const job = await prisma.jobOrder.findUnique({
      where: { id: jobOrderId },
      select: { primaryTechnicianId: true },
    });

    // Create rework tasks
    const reworkTaskIds: string[] = [];
    for (let i = 0; i < failedItems.length; i++) {
      const failedItem = failedItems[i];
      const reworkTask = await prisma.task.create({
        data: {
          jobOrderId,
          name: `REWORK: ${failedItem.description}`,
          isRework: true,
          status: "QUEUED",
          sortOrder: existingTaskCount + i,
          estimatedHours: 0,
          actualHours: 0,
          hourlyRate: 0,
          assignedTechnicianId: job?.primaryTechnicianId ?? null,
          createdBy: inspectorId,
        },
      });
      reworkTaskIds.push(reworkTask.id);
    }

    await logActivity({
      jobOrderId,
      type: "qc_result",
      title: `QC failed — ${failedCount} items need rework`,
      userId: inspectorId,
    });

    // Notify MANAGERs and OWNERs
    const managers = await prisma.user.findMany({
      where: {
        role: { in: ["MANAGER", "OWNER"] },
        isActive: true,
        deletedAt: null,
      },
    });

    if (managers.length > 0) {
      await prisma.notification.createMany({
        data: managers.map((user) => ({
          recipientId: user.id,
          type: "QC_FAILED",
          title: "QC Inspection Failed",
          message: `Quality control inspection failed for job ${jobOrderId} — ${failedCount} items need rework`,
          isRead: false,
          entityType: "JOB_ORDER",
          entityId: jobOrderId,
        })),
      });
    }

    return { result: "FAILED" as const, failedCount, reworkTaskIds };
  }
}

// ---------------------------------------------------------------------------
// 6. getQCChecklistTemplates
// ---------------------------------------------------------------------------
export async function getQCChecklistTemplates(): Promise<
  Record<string, Array<{ description: string; sortOrder: number }>>
> {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: "qc_checklist_" } },
  });

  const templates: Record<
    string,
    Array<{ description: string; sortOrder: number }>
  > = {};

  for (const setting of settings) {
    const category = setting.key.replace("qc_checklist_", "");
    try {
      templates[category] = JSON.parse(setting.value) as Array<{
        description: string;
        sortOrder: number;
      }>;
    } catch {
      templates[category] = [];
    }
  }

  return templates;
}

// ---------------------------------------------------------------------------
// 7. updateQCChecklistTemplate
// ---------------------------------------------------------------------------
export async function updateQCChecklistTemplate(
  category: string,
  items: Array<{ description: string; sortOrder: number }>
) {
  return prisma.setting.update({
    where: { key: `qc_checklist_${category}` },
    data: { value: JSON.stringify(items) },
  });
}

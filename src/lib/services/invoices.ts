import { prisma } from "@/lib/prisma";
import { generateDocNumber } from "@/lib/utils";
import { logActivity } from "@/lib/services/job-activities";
import type { InvoiceLineItemInput } from "@/lib/validators";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Helper: Group field map for subtotal aggregation
// ---------------------------------------------------------------------------
const GROUP_FIELD_MAP: Record<string, string> = {
  LABOR: "subtotalLabor",
  PARTS: "subtotalParts",
  MATERIALS: "subtotalMaterials",
  PAINT: "subtotalPaint",
  SUBLET: "subtotalSublet",
  OTHER: "subtotalOther",
};

// ---------------------------------------------------------------------------
// Helper: Get VAT settings from Settings table
// ---------------------------------------------------------------------------
async function getVatSettings(): Promise<{ vatEnabled: boolean; vatRate: number }> {
  const [vatEnabledSetting, vatRateSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "vat_enabled" } }),
    prisma.setting.findUnique({ where: { key: "vat_rate" } }),
  ]);

  const vatEnabled = vatEnabledSetting?.value === "true";
  const vatRate = vatRateSetting ? parseFloat(vatRateSetting.value) : 12;

  return { vatEnabled, vatRate };
}

// ---------------------------------------------------------------------------
// Helper: Calculate discount amount
// ---------------------------------------------------------------------------
function calculateDiscountAmount(
  preDiscountTotal: number,
  discountType: string | null,
  discountValue: number
): number {
  if (!discountType || discountValue <= 0) return 0;

  if (discountType === "flat") {
    return discountValue;
  } else if (discountType === "percentage") {
    // discountValue is basis points (e.g., 1000 = 10%)
    return Math.round(preDiscountTotal * (discountValue / 10000));
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Helper: Build "actual" billing mode line items from TimeEntry + MaterialUsage
// ---------------------------------------------------------------------------
async function buildActualLineItems(jobOrderId: string) {
  const lineItems: Array<{
    group: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
    sortOrder: number;
  }> = [];

  let sortOrder = 0;

  // Get time entries grouped by task
  const timeEntries = await prisma.timeEntry.findMany({
    where: { jobOrderId, deletedAt: null, clockOut: { not: null } },
    include: { task: { select: { name: true } } },
  });

  // Group time entries by task
  const taskGroups = new Map<
    string,
    { taskName: string; totalMinutes: number; totalCost: number }
  >();

  for (const entry of timeEntries) {
    const taskId = entry.taskId;
    const existing = taskGroups.get(taskId);
    if (existing) {
      existing.totalMinutes += entry.netMinutes;
      existing.totalCost += entry.laborCost;
    } else {
      taskGroups.set(taskId, {
        taskName: entry.task?.name ?? "Labor",
        totalMinutes: entry.netMinutes,
        totalCost: entry.laborCost,
      });
    }
  }

  // Create LABOR line items from grouped time entries
  const taskGroupEntries = Array.from(taskGroups.values());
  for (const group of taskGroupEntries) {
    const hours = Math.round((group.totalMinutes / 60) * 100) / 100;
    const hourlyRate =
      hours > 0 ? Math.round(group.totalCost / hours) : 0;

    lineItems.push({
      group: "LABOR",
      description: group.taskName,
      quantity: hours,
      unit: "hrs",
      unitCost: hourlyRate,
      subtotal: group.totalCost,
      sortOrder: sortOrder++,
    });
  }

  // Get material usages
  const materials = await prisma.materialUsage.findMany({
    where: { jobOrderId, deletedAt: null },
  });

  // Create MATERIALS/PARTS line items from actual usage
  for (const mat of materials) {
    lineItems.push({
      group: "MATERIALS",
      description: mat.itemDescription,
      quantity: mat.quantity,
      unit: mat.unit,
      unitCost: Math.round(mat.actualCost / mat.quantity),
      subtotal: mat.actualCost,
      sortOrder: sortOrder++,
    });
  }

  return lineItems;
}

// ---------------------------------------------------------------------------
// 1. generateInvoice
// ---------------------------------------------------------------------------
export async function generateInvoice(jobOrderId: string, userId: string) {
  // Fetch job with estimates, latest version, line items, and approved supplements
  const job = await prisma.jobOrder.findUniqueOrThrow({
    where: { id: jobOrderId },
    include: {
      estimates: {
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              lineItems: {
                where: { deletedAt: null },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
      supplementalEstimates: {
        where: { status: "APPROVED", deletedAt: null },
        include: {
          lineItems: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  // Get and increment sequence atomically
  const seqSetting = await prisma.setting.findUnique({
    where: { key: "next_inv_sequence" },
  });
  const nextSeq = seqSetting ? parseInt(seqSetting.value, 10) : 1;

  await prisma.setting.upsert({
    where: { key: "next_inv_sequence" },
    update: { value: String(nextSeq + 1) },
    create: {
      key: "next_inv_sequence",
      value: String(nextSeq + 1),
      category: "sequences",
      description: "Next invoice sequence number",
    },
  });

  const invoiceNumber = generateDocNumber("INV", nextSeq);

  // Determine billing mode
  const billingMode = job.priority === "INSURANCE" ? "actual" : "estimated";

  // Build line items
  let invoiceLineItems: Array<{
    group: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
    sortOrder: number;
  }> = [];

  // Get discount info from latest estimate version
  let discountType: string | null = null;
  let discountValue = 0;
  let discountReason: string | null = null;

  if (billingMode === "estimated") {
    let sortOrder = 0;

    // Add line items from the latest estimate version
    for (const estimate of job.estimates) {
      const latestVersion = estimate.versions[0];
      if (!latestVersion) continue;

      // Capture discount from estimate
      discountType = latestVersion.discountType;
      discountValue = latestVersion.discountValue;
      discountReason = latestVersion.discountReason;

      for (const item of latestVersion.lineItems) {
        invoiceLineItems.push({
          group: item.group,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          subtotal: Math.round(item.quantity * item.unitCost),
          sortOrder: sortOrder++,
        });
      }
    }

    // Add line items from approved supplements
    for (const supplement of job.supplementalEstimates) {
      for (const item of supplement.lineItems) {
        invoiceLineItems.push({
          group: item.group,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          subtotal: Math.round(item.quantity * item.unitCost),
          sortOrder: sortOrder++,
        });
      }
    }
  } else {
    // "actual" billing mode — build from time entries + materials
    invoiceLineItems = await buildActualLineItems(jobOrderId);
  }

  // Calculate group subtotals
  const groupSubtotals: Record<string, number> = {
    subtotalLabor: 0,
    subtotalParts: 0,
    subtotalMaterials: 0,
    subtotalPaint: 0,
    subtotalSublet: 0,
    subtotalOther: 0,
  };

  for (const item of invoiceLineItems) {
    const field = GROUP_FIELD_MAP[item.group] || "subtotalOther";
    groupSubtotals[field] += item.subtotal;
  }

  // Calculate totals
  const preDiscountTotal = Object.values(groupSubtotals).reduce(
    (a, b) => a + b,
    0
  );

  const discount = calculateDiscountAmount(
    preDiscountTotal,
    discountType,
    discountValue
  );

  const vatableAmount = preDiscountTotal - discount;

  const { vatEnabled, vatRate } = await getVatSettings();
  const vatAmount = vatEnabled
    ? Math.round(vatableAmount * (vatRate / 100))
    : 0;

  const grandTotal = vatableAmount + vatAmount;
  const balanceDue = grandTotal;
  const estimatedTotal = grandTotal;

  // Calculate actualTotal for variance tracking
  const laborAgg = await prisma.timeEntry.aggregate({
    where: { jobOrderId, deletedAt: null, clockOut: { not: null } },
    _sum: { laborCost: true },
  });
  const materialAgg = await prisma.materialUsage.aggregate({
    where: { jobOrderId, deletedAt: null },
    _sum: { actualCost: true },
  });
  const actualTotal =
    (laborAgg._sum.laborCost ?? 0) + (materialAgg._sum.actualCost ?? 0);

  // Insurance split
  const insurancePays = job.isInsuranceJob ? (job.insuranceCoverage ?? 0) : 0;
  const customerCopay = job.isInsuranceJob
    ? Math.max(0, grandTotal - insurancePays)
    : grandTotal;

  // Create invoice + line items in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    // Mark any existing invoices for this job as not latest
    await tx.invoice.updateMany({
      where: { jobOrderId, isLatest: true },
      data: { isLatest: false },
    });

    const inv = await tx.invoice.create({
      data: {
        jobOrderId,
        invoiceNumber,
        billingMode,
        ...groupSubtotals,
        vatableAmount,
        vatAmount,
        discountType,
        discountValue,
        discountReason,
        grandTotal,
        paymentStatus: "UNPAID",
        totalPaid: 0,
        balanceDue,
        estimatedTotal,
        actualTotal,
        insurancePays,
        customerCopay,
        version: 1,
        isLatest: true,
        createdBy: userId,
        updatedBy: userId,
        lineItems: {
          create: invoiceLineItems.map((item) => ({
            group: item.group,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            subtotal: item.subtotal,
            sortOrder: item.sortOrder,
            createdBy: userId,
            updatedBy: userId,
          })),
        },
      },
      include: {
        lineItems: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
        payments: true,
        jobOrder: {
          include: {
            customer: true,
            vehicle: true,
          },
        },
      },
    });

    // Update job status
    await tx.jobOrder.update({
      where: { id: jobOrderId },
      data: { status: "AWAITING_PAYMENT", updatedBy: userId },
    });

    return inv;
  });

  // Log activity outside transaction
  await logActivity({
    jobOrderId,
    type: "invoice_generated",
    title: `Invoice ${invoiceNumber} generated`,
    metadata: { invoiceId: invoice.id, grandTotal, billingMode },
    userId,
  });

  return invoice;
}

// ---------------------------------------------------------------------------
// 2. getInvoice
// ---------------------------------------------------------------------------
export async function getInvoice(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      },
      payments: {
        where: { deletedAt: null },
        orderBy: { paidAt: "desc" },
      },
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 3. getJobInvoice
// ---------------------------------------------------------------------------
export async function getJobInvoice(jobOrderId: string) {
  return prisma.invoice.findFirst({
    where: { jobOrderId, isLatest: true, deletedAt: null },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      },
      payments: {
        where: { deletedAt: null },
        orderBy: { paidAt: "desc" },
      },
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 4. updateInvoice
// ---------------------------------------------------------------------------
export async function updateInvoice(
  invoiceId: string,
  data: {
    billingMode?: string;
    notes?: string | null;
    dueDate?: string | null;
  },
  userId: string
) {
  const current = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  const updateData: Record<string, unknown> = { updatedBy: userId };

  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  // If billing mode changed, rebuild line items
  if (data.billingMode && data.billingMode !== current.billingMode) {
    updateData.billingMode = data.billingMode;

    // Soft delete existing line items
    await prisma.invoiceLineItem.updateMany({
      where: { invoiceId, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    if (data.billingMode === "actual") {
      // Build from actual time entries + materials
      const actualItems = await buildActualLineItems(current.jobOrderId);

      for (const item of actualItems) {
        await prisma.invoiceLineItem.create({
          data: {
            invoiceId,
            group: item.group,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            subtotal: item.subtotal,
            sortOrder: item.sortOrder,
            createdBy: userId,
            updatedBy: userId,
          },
        });
      }
    } else {
      // "estimated" mode — rebuild from estimate
      const job = await prisma.jobOrder.findUniqueOrThrow({
        where: { id: current.jobOrderId },
        include: {
          estimates: {
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
                include: {
                  lineItems: {
                    where: { deletedAt: null },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
          supplementalEstimates: {
            where: { status: "APPROVED", deletedAt: null },
            include: {
              lineItems: {
                where: { deletedAt: null },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });

      let sortOrder = 0;
      for (const estimate of job.estimates) {
        const latestVersion = estimate.versions[0];
        if (!latestVersion) continue;

        for (const item of latestVersion.lineItems) {
          await prisma.invoiceLineItem.create({
            data: {
              invoiceId,
              group: item.group,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitCost: item.unitCost,
              subtotal: Math.round(item.quantity * item.unitCost),
              sortOrder: sortOrder++,
              createdBy: userId,
              updatedBy: userId,
            },
          });
        }
      }

      for (const supplement of job.supplementalEstimates) {
        for (const item of supplement.lineItems) {
          await prisma.invoiceLineItem.create({
            data: {
              invoiceId,
              group: item.group,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitCost: item.unitCost,
              subtotal: Math.round(item.quantity * item.unitCost),
              sortOrder: sortOrder++,
              createdBy: userId,
              updatedBy: userId,
            },
          });
        }
      }
    }
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
  });

  // Recalculate totals after any changes
  await recalculateInvoiceTotals(invoiceId);

  return getInvoice(invoiceId);
}

// ---------------------------------------------------------------------------
// 5. recalculateInvoiceTotals
// ---------------------------------------------------------------------------
export async function recalculateInvoiceTotals(invoiceId: string) {
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: { invoiceId, deletedAt: null },
  });

  // Sum by group
  const groupSubtotals: Record<string, number> = {
    subtotalLabor: 0,
    subtotalParts: 0,
    subtotalMaterials: 0,
    subtotalPaint: 0,
    subtotalSublet: 0,
    subtotalOther: 0,
  };

  for (const item of lineItems) {
    const field = GROUP_FIELD_MAP[item.group] || "subtotalOther";
    groupSubtotals[field] += item.subtotal;
  }

  const preDiscountTotal = Object.values(groupSubtotals).reduce(
    (a, b) => a + b,
    0
  );

  // Get existing discount from invoice
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  const discount = calculateDiscountAmount(
    preDiscountTotal,
    invoice.discountType,
    invoice.discountValue
  );

  const vatableAmount = preDiscountTotal - discount;

  const { vatEnabled, vatRate } = await getVatSettings();
  const vatAmount = vatEnabled
    ? Math.round(vatableAmount * (vatRate / 100))
    : 0;

  const grandTotal = vatableAmount + vatAmount;
  const balanceDue = grandTotal - invoice.totalPaid;

  // Determine payment status
  let paymentStatus: string;
  if (invoice.totalPaid <= 0) {
    paymentStatus = "UNPAID";
  } else if (invoice.totalPaid >= grandTotal) {
    paymentStatus = "PAID";
  } else {
    paymentStatus = "PARTIAL";
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      ...groupSubtotals,
      vatableAmount,
      vatAmount,
      grandTotal,
      balanceDue,
      paymentStatus,
      ...(paymentStatus === "PAID" && !invoice.paidInFullAt
        ? { paidInFullAt: new Date() }
        : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// 6. applyDiscount
// ---------------------------------------------------------------------------
export async function applyDiscount(
  invoiceId: string,
  discountType: string,
  discountValue: number,
  reason: string,
  userId: string
) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      discountType,
      discountValue,
      discountReason: reason,
      updatedBy: userId,
    },
  });

  await recalculateInvoiceTotals(invoiceId);

  const invoice = await getInvoice(invoiceId);

  await logActivity({
    jobOrderId: invoice!.jobOrderId,
    type: "invoice_updated",
    title: `Discount applied to Invoice ${invoice!.invoiceNumber}`,
    description: `${discountType} discount: ${discountValue} — ${reason}`,
    metadata: { invoiceId, discountType, discountValue },
    userId,
  });

  return invoice;
}

// ---------------------------------------------------------------------------
// 7. addInvoiceLineItem
// ---------------------------------------------------------------------------
export async function addInvoiceLineItem(
  invoiceId: string,
  data: InvoiceLineItemInput,
  userId: string
) {
  const subtotal = Math.round(data.quantity * data.unitCost);

  const lineItem = await prisma.invoiceLineItem.create({
    data: {
      invoiceId,
      group: data.group,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      subtotal,
      sortOrder: data.sortOrder,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalculateInvoiceTotals(invoiceId);

  return lineItem;
}

// ---------------------------------------------------------------------------
// 8. updateInvoiceLineItem
// ---------------------------------------------------------------------------
export async function updateInvoiceLineItem(
  lineItemId: string,
  data: Partial<InvoiceLineItemInput>,
  userId: string
) {
  const current = await prisma.invoiceLineItem.findUniqueOrThrow({
    where: { id: lineItemId },
  });

  const quantity = data.quantity ?? current.quantity;
  const unitCost = data.unitCost ?? current.unitCost;
  const subtotal = Math.round(quantity * unitCost);

  const lineItem = await prisma.invoiceLineItem.update({
    where: { id: lineItemId },
    data: {
      ...(data.group !== undefined && { group: data.group }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      subtotal,
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedBy: userId,
    },
  });

  await recalculateInvoiceTotals(current.invoiceId);

  return lineItem;
}

// ---------------------------------------------------------------------------
// 9. deleteInvoiceLineItem
// ---------------------------------------------------------------------------
export async function deleteInvoiceLineItem(
  lineItemId: string,
  userId: string
) {
  const lineItem = await prisma.invoiceLineItem.update({
    where: { id: lineItemId },
    data: { deletedAt: new Date(), updatedBy: userId },
  });

  await recalculateInvoiceTotals(lineItem.invoiceId);

  return lineItem;
}

// ---------------------------------------------------------------------------
// 10. generateShareToken
// ---------------------------------------------------------------------------
export async function generateShareToken(invoiceId: string) {
  const token = crypto.randomUUID();

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { shareToken: token },
  });

  return token;
}

// ---------------------------------------------------------------------------
// 11. getInvoiceByToken
// ---------------------------------------------------------------------------
export async function getInvoiceByToken(token: string) {
  return prisma.invoice.findFirst({
    where: { shareToken: token, deletedAt: null },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      },
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
        },
      },
    },
  });
}

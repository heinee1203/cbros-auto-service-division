import { prisma } from "@/lib/prisma";

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  from: Date;
  to: Date;
}

// 1. Daily Sales Report
export interface DailySalesRow {
  invoiceNumber: string;
  customerName: string;
  vehiclePlate: string;
  method: string;
  amount: number; // centavos
  receivedBy: string;
  time: string;
}
export interface DailySalesReport {
  date: string;
  payments: DailySalesRow[];
  totalsByMethod: Record<string, number>;
  grandTotal: number;
}

// 2. Receivables Aging Report
export interface ReceivablesRow {
  invoiceNumber: string;
  customerName: string;
  vehiclePlate: string;
  invoiceDate: string;
  total: number;
  paid: number;
  balance: number;
  ageDays: number;
  isInsurance: boolean;
}
export interface ReceivablesAgingReport {
  invoices: ReceivablesRow[];
  brackets: { label: string; total: number }[];
  grandTotal: number;
}

// 3. Job Status Report
export interface JobStatusReport {
  byStage: { stage: string; count: number }[];
  overdueJobs: {
    jobOrderNumber: string;
    customerName: string;
    targetDate: string;
    daysOverdue: number;
  }[];
  totalActive: number;
  totalOverdue: number;
}

// 4. Technician Utilization Report
export interface TechUtilRow {
  name: string;
  role: string;
  availableHours: number;
  loggedHours: number;
  utilizationPercent: number;
  overtimeHours: number;
}
export interface TechUtilizationReport {
  technicians: TechUtilRow[];
  shopTotal: {
    available: number;
    logged: number;
    utilization: number;
    overtime: number;
  };
}

// 5. Service Revenue Report
export interface ServiceRevenueRow {
  category: string;
  revenue: number;
  jobCount: number;
  avgPrice: number;
}
export interface ServiceRevenueReport {
  categories: ServiceRevenueRow[];
  grandTotal: number;
}

// 6. Parts Usage Report
export interface PartsUsageRow {
  description: string;
  partNumber: string | null;
  totalQuantity: number;
  totalCost: number;
  frequency: number;
}
export interface PartsUsageReport {
  parts: PartsUsageRow[];
  totalCost: number;
  totalBilled: number;
  margin: number;
}

// 7. Customer Report
export interface CustomerReportRow {
  name: string;
  jobCount: number;
  totalSpend: number;
  isNew: boolean;
}
export interface CustomerReport {
  customers: CustomerReportRow[];
  newCustomerCount: number;
  returningCount: number;
  returningRate: number;
}

// 8. Warranty Claims Report
export interface WarrantyClaimRow {
  claimDate: string;
  description: string;
  resolution: string | null;
  status: string;
  linkedJO: string | null;
}
export interface WarrantyClaimsReport {
  claims: WarrantyClaimRow[];
  totalClaims: number;
}

// 9. Insurance Receivables Report
export interface InsuranceReceivableRow {
  insuranceCompany: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  paid: number;
  balance: number;
  ageDays: number;
}
export interface InsuranceReceivablesReport {
  receivables: InsuranceReceivableRow[];
  grandTotal: number;
}

// ============================================================================
// Helpers
// ============================================================================

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ============================================================================
// 1. Daily Sales Report
// ============================================================================

export async function getDailySalesReport(
  date: Date
): Promise<DailySalesReport> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      invoice: {
        include: {
          jobOrder: {
            include: {
              customer: { select: { firstName: true, lastName: true } },
              vehicle: { select: { plateNumber: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Look up "received by" user names for all unique createdBy IDs
  const createdByIdSet = new Set<string>();
  for (const p of payments) {
    if (p.createdBy) createdByIdSet.add(p.createdBy);
  }
  const createdByIds = Array.from(createdByIdSet);
  const users =
    createdByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: createdByIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const userMap = new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`])
  );

  const rows: DailySalesRow[] = payments.map((p) => ({
    invoiceNumber: p.invoice.invoiceNumber,
    customerName: `${p.invoice.jobOrder.customer.firstName} ${p.invoice.jobOrder.customer.lastName}`,
    vehiclePlate: p.invoice.jobOrder.vehicle.plateNumber,
    method: p.method,
    amount: p.amount,
    receivedBy: p.createdBy ? (userMap.get(p.createdBy) ?? "Unknown") : "System",
    time: p.createdAt.toISOString(),
  }));

  const totalsByMethod: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of rows) {
    totalsByMethod[row.method] = (totalsByMethod[row.method] ?? 0) + row.amount;
    grandTotal += row.amount;
  }

  return {
    date: dayStart.toISOString().slice(0, 10),
    payments: rows,
    totalsByMethod,
    grandTotal,
  };
}

// ============================================================================
// 2. Receivables Aging Report
// ============================================================================

export async function getReceivablesAgingReport(
  insuranceOnly?: boolean
): Promise<ReceivablesAgingReport> {
  const now = new Date();

  const whereClause: Record<string, unknown> = {
    isLatest: true,
    paymentStatus: { in: ["UNPAID", "PARTIAL"] },
  };

  if (insuranceOnly) {
    whereClause.jobOrder = { isInsuranceJob: true };
  }

  const invoices = await prisma.invoice.findMany({
    where: whereClause,
    include: {
      jobOrder: {
        include: {
          customer: { select: { firstName: true, lastName: true } },
          vehicle: { select: { plateNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: ReceivablesRow[] = invoices.map((inv) => {
    const ageDays = Math.floor(
      (now.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      invoiceNumber: inv.invoiceNumber,
      customerName: `${inv.jobOrder.customer.firstName} ${inv.jobOrder.customer.lastName}`,
      vehiclePlate: inv.jobOrder.vehicle.plateNumber,
      invoiceDate: inv.createdAt.toISOString().slice(0, 10),
      total: inv.grandTotal,
      paid: inv.totalPaid,
      balance: inv.balanceDue,
      ageDays,
      isInsurance: inv.jobOrder.isInsuranceJob,
    };
  });

  // Group into aging brackets
  const bracketDefs = [
    { label: "Current (0-30 days)", min: 0, max: 30 },
    { label: "31-60 days", min: 31, max: 60 },
    { label: "61-90 days", min: 61, max: 90 },
    { label: "Over 90 days", min: 91, max: Infinity },
  ];

  const brackets = bracketDefs.map((b) => ({
    label: b.label,
    total: rows
      .filter((r) => r.ageDays >= b.min && r.ageDays <= b.max)
      .reduce((sum, r) => sum + r.balance, 0),
  }));

  const grandTotal = rows.reduce((sum, r) => sum + r.balance, 0);

  return { invoices: rows, brackets, grandTotal };
}

// ============================================================================
// 3. Job Status Report
// ============================================================================

export async function getJobStatusReport(
  dateRange: DateRange
): Promise<JobStatusReport> {
  const { from, to } = dateRange;
  const now = new Date();

  // Jobs per stage — active jobs created within range
  const jobs = await prisma.jobOrder.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { notIn: ["RELEASED", "CANCELLED"] },
    },
    select: { status: true },
  });

  const stageCounts: Record<string, number> = {};
  for (const j of jobs) {
    stageCounts[j.status] = (stageCounts[j.status] ?? 0) + 1;
  }
  const byStage = Object.entries(stageCounts).map(([stage, count]) => ({
    stage,
    count,
  }));

  // Overdue jobs (past targetCompletionDate, not released/cancelled)
  const overdueJobsList = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
      targetCompletionDate: { lt: now },
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  const overdueJobs = overdueJobsList
    .filter((j) => j.targetCompletionDate !== null)
    .map((j) => ({
      jobOrderNumber: j.jobOrderNumber,
      customerName: `${j.customer.firstName} ${j.customer.lastName}`,
      targetDate: j.targetCompletionDate!.toISOString().slice(0, 10),
      daysOverdue: Math.floor(
        (now.getTime() - j.targetCompletionDate!.getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    }));

  return {
    byStage,
    overdueJobs,
    totalActive: jobs.length,
    totalOverdue: overdueJobs.length,
  };
}

// ============================================================================
// 4. Technician Utilization Report
// ============================================================================

export async function getTechUtilizationReport(
  dateRange: DateRange
): Promise<TechUtilizationReport> {
  const { from, to } = dateRange;

  // All active technicians
  const technicians = await prisma.user.findMany({
    where: {
      role: "TECHNICIAN",
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  // Calculate available hours: working days x 8 hours
  const rangeDays = Math.max(
    1,
    (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  );
  const workingDays = Math.round(rangeDays * (22 / 30));
  const availableHoursPerTech = workingDays * 8;

  const rows: TechUtilRow[] = [];
  let shopAvailable = 0;
  let shopLogged = 0;
  let shopOvertime = 0;

  for (const tech of technicians) {
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        technicianId: tech.id,
        clockIn: { gte: from, lte: to },
      },
      select: { netMinutes: true, isOvertime: true },
    });

    const loggedHours =
      timeEntries.reduce((sum, te) => sum + te.netMinutes, 0) / 60;
    const overtimeHours =
      timeEntries
        .filter((te) => te.isOvertime)
        .reduce((sum, te) => sum + te.netMinutes, 0) / 60;
    const utilizationPercent =
      availableHoursPerTech > 0
        ? (loggedHours / availableHoursPerTech) * 100
        : 0;

    rows.push({
      name: `${tech.firstName} ${tech.lastName}`,
      role: tech.role,
      availableHours: availableHoursPerTech,
      loggedHours,
      utilizationPercent,
      overtimeHours,
    });

    shopAvailable += availableHoursPerTech;
    shopLogged += loggedHours;
    shopOvertime += overtimeHours;
  }

  return {
    technicians: rows,
    shopTotal: {
      available: shopAvailable,
      logged: shopLogged,
      utilization: shopAvailable > 0 ? (shopLogged / shopAvailable) * 100 : 0,
      overtime: shopOvertime,
    },
  };
}

// ============================================================================
// 5. Service Revenue Report
// ============================================================================

export async function getServiceRevenueReport(
  dateRange: DateRange
): Promise<ServiceRevenueReport> {
  const { from, to } = dateRange;

  // Get invoice line items from latest invoices in date range
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: {
      invoice: {
        isLatest: true,
        createdAt: { gte: from, lte: to },
      },
    },
    include: {
      invoice: {
        select: { jobOrderId: true },
      },
    },
  });

  // Group by line item group (category)
  const categoryMap: Record<
    string,
    { revenue: number; jobIds: Set<string> }
  > = {};

  for (const li of lineItems) {
    if (!categoryMap[li.group]) {
      categoryMap[li.group] = { revenue: 0, jobIds: new Set() };
    }
    categoryMap[li.group].revenue += li.subtotal;
    categoryMap[li.group].jobIds.add(li.invoice.jobOrderId);
  }

  const categories: ServiceRevenueRow[] = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      jobCount: data.jobIds.size,
      avgPrice: data.jobIds.size > 0 ? Math.round(data.revenue / data.jobIds.size) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const grandTotal = categories.reduce((sum, c) => sum + c.revenue, 0);

  return { categories, grandTotal };
}

// ============================================================================
// 6. Parts Usage Report
// ============================================================================

export async function getPartsUsageReport(
  dateRange: DateRange
): Promise<PartsUsageReport> {
  const { from, to } = dateRange;

  const materials = await prisma.materialUsage.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
  });

  // Group by description
  const partsMap: Record<
    string,
    {
      partNumber: string | null;
      totalQuantity: number;
      totalCost: number;
      frequency: number;
    }
  > = {};

  for (const m of materials) {
    const key = m.itemDescription;
    if (!partsMap[key]) {
      partsMap[key] = {
        partNumber: m.partNumber,
        totalQuantity: 0,
        totalCost: 0,
        frequency: 0,
      };
    }
    partsMap[key].totalQuantity += m.quantity;
    partsMap[key].totalCost += m.actualCost;
    partsMap[key].frequency += 1;
    // Keep the most recent partNumber if available
    if (m.partNumber) {
      partsMap[key].partNumber = m.partNumber;
    }
  }

  const parts: PartsUsageRow[] = Object.entries(partsMap)
    .map(([description, data]) => ({
      description,
      ...data,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const totalCost = parts.reduce((sum, p) => sum + p.totalCost, 0);

  // Total billed: sum of PARTS + MATERIALS line items from invoices in the same range
  const billedAgg = await prisma.invoiceLineItem.aggregate({
    _sum: { subtotal: true },
    where: {
      group: { in: ["PARTS", "MATERIALS"] },
      invoice: {
        isLatest: true,
        createdAt: { gte: from, lte: to },
      },
    },
  });
  const totalBilled = billedAgg._sum.subtotal ?? 0;

  const margin = totalBilled > 0 ? ((totalBilled - totalCost) / totalBilled) * 100 : 0;

  return { parts, totalCost, totalBilled, margin };
}

// ============================================================================
// 7. Customer Report
// ============================================================================

export async function getCustomerReport(
  dateRange: DateRange
): Promise<CustomerReport> {
  const { from, to } = dateRange;

  // Get payments in range, grouped by customer via invoice -> jobOrder
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    include: {
      invoice: {
        include: {
          jobOrder: {
            select: {
              customerId: true,
              customer: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  // Aggregate per customer
  const customerMap: Record<
    string,
    { name: string; totalSpend: number; jobIds: Set<string> }
  > = {};

  for (const p of payments) {
    const cId = p.invoice.jobOrder.customerId;
    const cName = `${p.invoice.jobOrder.customer.firstName} ${p.invoice.jobOrder.customer.lastName}`;
    if (!customerMap[cId]) {
      customerMap[cId] = { name: cName, totalSpend: 0, jobIds: new Set() };
    }
    customerMap[cId].totalSpend += p.amount;
    customerMap[cId].jobIds.add(p.invoice.jobOrderId);
  }

  // Determine new vs returning: customer is "new" if their first job was created within the range
  const customerIds = Object.keys(customerMap);
  const newCustomerIds = new Set<string>();

  if (customerIds.length > 0) {
    // For each customer, check if they had any job before the date range
    const priorJobs = await prisma.jobOrder.findMany({
      where: {
        customerId: { in: customerIds },
        createdAt: { lt: from },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const returningIds = new Set(priorJobs.map((j) => j.customerId));

    for (const cId of customerIds) {
      if (!returningIds.has(cId)) {
        newCustomerIds.add(cId);
      }
    }
  }

  const customers: CustomerReportRow[] = Object.entries(customerMap)
    .map(([cId, data]) => ({
      name: data.name,
      jobCount: data.jobIds.size,
      totalSpend: data.totalSpend,
      isNew: newCustomerIds.has(cId),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const newCustomerCount = customers.filter((c) => c.isNew).length;
  const returningCount = customers.filter((c) => !c.isNew).length;
  const total = customers.length;
  const returningRate = total > 0 ? (returningCount / total) * 100 : 0;

  return { customers, newCustomerCount, returningCount, returningRate };
}

// ============================================================================
// 8. Warranty Claims Report
// ============================================================================

export async function getWarrantyClaimsReport(
  dateRange: DateRange
): Promise<WarrantyClaimsReport> {
  const { from, to } = dateRange;

  const claims = await prisma.warrantyClaim.findMany({
    where: {
      claimDate: { gte: from, lte: to },
    },
    include: {
      warranty: {
        include: {
          jobOrder: { select: { jobOrderNumber: true } },
        },
      },
    },
    orderBy: { claimDate: "desc" },
  });

  // Look up linked job order numbers for claims that reference one
  const linkedJoIds = claims
    .map((c) => c.linkedJobOrderId)
    .filter(Boolean) as string[];
  const linkedJobs =
    linkedJoIds.length > 0
      ? await prisma.jobOrder.findMany({
          where: { id: { in: linkedJoIds } },
          select: { id: true, jobOrderNumber: true },
        })
      : [];
  const linkedJoMap = new Map(linkedJobs.map((j) => [j.id, j.jobOrderNumber]));

  const rows: WarrantyClaimRow[] = claims.map((c) => {
    // Derive status: if resolvedDate is set, it's resolved; otherwise pending
    const status = c.resolvedDate ? "RESOLVED" : "PENDING";
    return {
      claimDate: c.claimDate.toISOString().slice(0, 10),
      description: c.description,
      resolution: c.resolution,
      status,
      linkedJO: c.linkedJobOrderId
        ? (linkedJoMap.get(c.linkedJobOrderId) ?? null)
        : null,
    };
  });

  return { claims: rows, totalClaims: rows.length };
}

// ============================================================================
// 9. Insurance Receivables Report
// ============================================================================

export async function getInsuranceReceivablesReport(): Promise<InsuranceReceivablesReport> {
  const now = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      isLatest: true,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      jobOrder: {
        isInsuranceJob: true,
      },
    },
    include: {
      jobOrder: {
        include: {
          customer: { select: { firstName: true, lastName: true } },
          vehicle: { select: { plateNumber: true, insuranceCompany: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: InsuranceReceivableRow[] = invoices.map((inv) => {
    const ageDays = Math.floor(
      (now.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      insuranceCompany:
        inv.jobOrder.vehicle.insuranceCompany ?? "Unknown Insurance",
      invoiceNumber: inv.invoiceNumber,
      customerName: `${inv.jobOrder.customer.firstName} ${inv.jobOrder.customer.lastName}`,
      total: inv.grandTotal,
      paid: inv.totalPaid,
      balance: inv.balanceDue,
      ageDays,
    };
  });

  const grandTotal = rows.reduce((sum, r) => sum + r.balance, 0);

  return { receivables: rows, grandTotal };
}

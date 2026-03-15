import { prisma } from "@/lib/prisma";

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ShopOverview {
  totalRevenue: number;
  jobsCompleted: number;
  activeJobs: Record<string, number>;
  avgTicketValue: number;
  avgCycleTimeDays: number;
  avgEfficiencyRatio: number;
  newCustomers: number;
  returningCustomers: number;
  revenuePreviousPeriod: number;
  revenueChangePercent: number;
}

export interface RevenueBreakdown {
  byGroup: { group: string; total: number }[];
  byPaymentMethod: { method: string; total: number }[];
  byMonth: { month: string; total: number }[];
  topServices: { description: string; total: number; count: number }[];
  laborTotal: number;
  partsTotal: number;
}

export interface JobPipeline {
  byStatus: { status: string; count: number }[];
  overdueJobs: {
    id: string;
    jobOrderNumber: string;
    status: string;
    targetCompletionDate: Date;
    daysOverdue: number;
  }[];
  agingBrackets: {
    "0-3": number;
    "4-7": number;
    "8-14": number;
    "15-30": number;
    "30+": number;
  };
}

export interface CapacityMetrics {
  totalAvailableHours: number;
  committedHours: number;
  loggedHours: number;
  utilizationRate: number;
}

export interface TechPerformance {
  id: string;
  name: string;
  role: string;
  jobsWorked: number;
  hoursLogged: number;
  efficiencyScore: number;
  utilizationRate: number;
  reworkRate: number;
  revenueGenerated: number;
  onTimeRate: number;
  overtimeHours: number;
}

export interface TechDetail extends TechPerformance {
  taskBreakdown: {
    taskName: string;
    jobOrderNumber: string;
    estimatedHours: number;
    actualHours: number;
    efficiency: number;
  }[];
  dailyHours: { date: string; hours: number }[];
}

export interface FinancialSummary {
  totalInvoiced: number;
  totalCollected: number;
  outstandingReceivables: number;
  receivablesAging: {
    current: { total: number; insurance: number; customer: number };
    over30: { total: number; insurance: number; customer: number };
    over60: { total: number; insurance: number; customer: number };
    over90: { total: number; insurance: number; customer: number };
  };
  avgDaysToPayment: number;
  totalDiscountGiven: number;
  partsMargin: number;
  laborMargin: number;
}

export interface JobProfitability {
  revenue: number;
  laborCost: number;
  materialsCost: number;
  subletCost: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  estimateTotal: number;
  varianceAmount: number;
  variancePercent: number;
  varianceFromEstimate: number;
}

export interface DashboardMetrics {
  activeJobs: number;
  pendingEstimates: number;
  clockedIn: number;
  overdueCount: number;
  unpaidInvoices: number;
  todayRevenue: number;
  checkedInToday: number;
  releasedToday: number;
  recentActivities: {
    id: string;
    type: string;
    title: string;
    createdAt: Date;
    user: { firstName: string; lastName: string };
    jobOrder: { jobOrderNumber: string };
  }[];
}

export interface MyDashboardTechnician {
  myTasks: {
    id: string;
    name: string;
    status: string;
    estimatedHours: number;
    jobOrderNumber: string;
  }[];
  clockStatus: {
    isClockedIn: boolean;
    currentEntry: { clockIn: Date; taskName: string; jobOrderNumber: string } | null;
  };
  weekHours: number;
  monthEfficiency: number;
}

export interface MyDashboardAdvisor {
  myJobs: {
    id: string;
    jobOrderNumber: string;
    status: string;
    customerName: string;
    vehiclePlate: string;
  }[];
  pendingApprovals: number;
  readyForRelease: number;
}

// ============================================================================
// Helpers
// ============================================================================

function getPreviousPeriod(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime()),
  };
}

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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================================
// 1. Shop Overview
// ============================================================================

export async function getShopOverview(dateRange: DateRange): Promise<ShopOverview> {
  const { from, to } = dateRange;

  // Total revenue from payments in range
  const revenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: { gte: from, lte: to },
    },
  });
  const totalRevenue = revenueAgg._sum.amount ?? 0;

  // Jobs completed (RELEASED with actualCompletionDate in range)
  const jobsCompleted = await prisma.jobOrder.count({
    where: {
      status: "RELEASED",
      actualCompletionDate: { gte: from, lte: to },
    },
  });

  // Active jobs by stage (not RELEASED or CANCELLED)
  const activeJobsList = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
    },
    select: { status: true },
  });
  const activeJobs: Record<string, number> = {};
  for (const job of activeJobsList) {
    activeJobs[job.status] = (activeJobs[job.status] ?? 0) + 1;
  }

  // Average ticket value
  const avgTicketValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

  // Average cycle time (intake createdAt → actualCompletionDate for released jobs in range)
  const completedJobs = await prisma.jobOrder.findMany({
    where: {
      status: "RELEASED",
      actualCompletionDate: { gte: from, lte: to },
    },
    select: { createdAt: true, actualCompletionDate: true },
  });
  let totalCycleDays = 0;
  let cycleCount = 0;
  for (const job of completedJobs) {
    if (job.actualCompletionDate) {
      const days =
        (job.actualCompletionDate.getTime() - job.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      totalCycleDays += days;
      cycleCount++;
    }
  }
  const avgCycleTimeDays = cycleCount > 0 ? totalCycleDays / cycleCount : 0;

  // Average efficiency ratio (estimated hours / actual hours from tasks on completed jobs)
  const tasksForEfficiency = await prisma.task.findMany({
    where: {
      jobOrder: {
        status: "RELEASED",
        actualCompletionDate: { gte: from, lte: to },
      },
      actualHours: { gt: 0 },
    },
    select: { estimatedHours: true, actualHours: true },
  });
  let totalEstimated = 0;
  let totalActual = 0;
  for (const t of tasksForEfficiency) {
    totalEstimated += t.estimatedHours;
    totalActual += t.actualHours;
  }
  const avgEfficiencyRatio = totalActual > 0 ? totalEstimated / totalActual : 0;

  // New vs returning customers (jobs created in range)
  const jobsInRange = await prisma.jobOrder.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: { customerId: true },
  });
  const customerIdSet = new Set(jobsInRange.map((j) => j.customerId));
  const customerIds = Array.from(customerIdSet);

  let newCustomers = 0;
  let returningCustomers = 0;
  if (customerIds.length > 0) {
    // Check which customers had jobs before the date range
    const previousJobs = await prisma.jobOrder.findMany({
      where: {
        customerId: { in: customerIds },
        createdAt: { lt: from },
      },
      select: { customerId: true },
    });
    const returningIds = new Set(previousJobs.map((j) => j.customerId));
    for (const cId of customerIds) {
      if (returningIds.has(cId)) {
        returningCustomers++;
      } else {
        newCustomers++;
      }
    }
  }

  // Previous period revenue for comparison
  const prevPeriod = getPreviousPeriod(dateRange);
  const prevRevenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: { gte: prevPeriod.from, lte: prevPeriod.to },
    },
  });
  const revenuePreviousPeriod = prevRevenueAgg._sum.amount ?? 0;
  const revenueChangePercent =
    revenuePreviousPeriod > 0
      ? ((totalRevenue - revenuePreviousPeriod) / revenuePreviousPeriod) * 100
      : 0;

  return {
    totalRevenue,
    jobsCompleted,
    activeJobs,
    avgTicketValue,
    avgCycleTimeDays,
    avgEfficiencyRatio,
    newCustomers,
    returningCustomers,
    revenuePreviousPeriod,
    revenueChangePercent,
  };
}

// ============================================================================
// 2. Revenue Breakdown
// ============================================================================

export async function getRevenueBreakdown(dateRange: DateRange): Promise<RevenueBreakdown> {
  const { from, to } = dateRange;

  // Revenue by invoice line item group
  const invoices = await prisma.invoice.findMany({
    where: {
      isLatest: true,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      subtotalLabor: true,
      subtotalParts: true,
      subtotalMaterials: true,
      subtotalPaint: true,
      subtotalSublet: true,
      subtotalOther: true,
    },
  });

  const groupTotals: Record<string, number> = {
    LABOR: 0,
    PARTS: 0,
    MATERIALS: 0,
    PAINT: 0,
    SUBLET: 0,
    OTHER: 0,
  };
  for (const inv of invoices) {
    groupTotals.LABOR += inv.subtotalLabor;
    groupTotals.PARTS += inv.subtotalParts;
    groupTotals.MATERIALS += inv.subtotalMaterials;
    groupTotals.PAINT += inv.subtotalPaint;
    groupTotals.SUBLET += inv.subtotalSublet;
    groupTotals.OTHER += inv.subtotalOther;
  }
  const byGroup = Object.entries(groupTotals).map(([group, total]) => ({
    group,
    total,
  }));

  // Revenue by payment method and by month
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: { method: true, amount: true, createdAt: true },
  });
  const methodTotals: Record<string, number> = {};
  const monthTotals: Record<string, number> = {};
  for (const p of payments) {
    methodTotals[p.method] = (methodTotals[p.method] ?? 0) + p.amount;
    const monthKey = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
    monthTotals[monthKey] = (monthTotals[monthKey] ?? 0) + p.amount;
  }
  const byPaymentMethod = Object.entries(methodTotals).map(([method, total]) => ({
    method,
    total,
  }));
  const byMonth = Object.entries(monthTotals)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Top 10 services by invoice line items
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: {
      invoice: {
        isLatest: true,
        createdAt: { gte: from, lte: to },
      },
    },
    select: { description: true, subtotal: true },
  });
  const serviceTotals: Record<string, { total: number; count: number }> = {};
  for (const li of lineItems) {
    if (!serviceTotals[li.description]) {
      serviceTotals[li.description] = { total: 0, count: 0 };
    }
    serviceTotals[li.description].total += li.subtotal;
    serviceTotals[li.description].count += 1;
  }
  const topServices = Object.entries(serviceTotals)
    .map(([description, data]) => ({ description, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    byGroup,
    byPaymentMethod,
    byMonth,
    topServices,
    laborTotal: groupTotals.LABOR,
    partsTotal: groupTotals.PARTS,
  };
}

// ============================================================================
// 3. Job Pipeline
// ============================================================================

export async function getJobPipeline(dateRange: DateRange): Promise<JobPipeline> {
  const { from, to } = dateRange;
  const now = new Date();

  // Count of jobs per status (created in range)
  const jobsByStatus = await prisma.jobOrder.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: { status: true },
  });
  const statusCounts: Record<string, number> = {};
  for (const j of jobsByStatus) {
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  }
  const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  // Overdue jobs (past targetCompletionDate, not RELEASED/CANCELLED)
  const overdueJobsList = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
      targetCompletionDate: { lt: now },
    },
    select: {
      id: true,
      jobOrderNumber: true,
      status: true,
      targetCompletionDate: true,
    },
  });
  const overdueJobs = overdueJobsList
    .filter((j) => j.targetCompletionDate !== null)
    .map((j) => ({
      id: j.id,
      jobOrderNumber: j.jobOrderNumber,
      status: j.status,
      targetCompletionDate: j.targetCompletionDate!,
      daysOverdue: Math.floor(
        (now.getTime() - j.targetCompletionDate!.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

  // Aging brackets for active jobs
  const activeJobs = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
    },
    select: { createdAt: true },
  });
  const agingBrackets = { "0-3": 0, "4-7": 0, "8-14": 0, "15-30": 0, "30+": 0 };
  for (const j of activeJobs) {
    const ageDays = Math.floor(
      (now.getTime() - j.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (ageDays <= 3) agingBrackets["0-3"]++;
    else if (ageDays <= 7) agingBrackets["4-7"]++;
    else if (ageDays <= 14) agingBrackets["8-14"]++;
    else if (ageDays <= 30) agingBrackets["15-30"]++;
    else agingBrackets["30+"]++;
  }

  return { byStatus, overdueJobs, agingBrackets };
}

// ============================================================================
// 4. Capacity Metrics
// ============================================================================

export async function getCapacityMetrics(dateRange: DateRange): Promise<CapacityMetrics> {
  const { from, to } = dateRange;

  // Count active technicians
  const techCount = await prisma.user.count({
    where: {
      role: "TECHNICIAN",
      isActive: true,
    },
  });

  // Approximate working days in range
  const rangeDays = Math.max(
    1,
    (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  );
  const workingDays = Math.round(rangeDays * (22 / 30));
  const totalAvailableHours = techCount * workingDays * 8;

  // Committed hours: sum of estimatedHours on active jobs' tasks
  const committedAgg = await prisma.task.aggregate({
    _sum: { estimatedHours: true },
    where: {
      jobOrder: {
        status: { notIn: ["RELEASED", "CANCELLED"] },
      },
    },
  });
  const committedHours = committedAgg._sum.estimatedHours ?? 0;

  // Logged hours: sum of netMinutes from time entries in range
  const loggedAgg = await prisma.timeEntry.aggregate({
    _sum: { netMinutes: true },
    where: {
      clockIn: { gte: from, lte: to },
    },
  });
  const loggedHours = ((loggedAgg._sum.netMinutes ?? 0) / 60);

  // Utilization rate
  const utilizationRate =
    totalAvailableHours > 0 ? (loggedHours / totalAvailableHours) * 100 : 0;

  return {
    totalAvailableHours,
    committedHours,
    loggedHours,
    utilizationRate,
  };
}

// ============================================================================
// 5. Technician Performance
// ============================================================================

export async function getTechnicianPerformance(
  dateRange: DateRange
): Promise<TechPerformance[]> {
  const { from, to } = dateRange;

  // Available hours per tech for utilization
  const rangeDays = Math.max(
    1,
    (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  );
  const workingDays = Math.round(rangeDays * (22 / 30));
  const availableHoursPerTech = workingDays * 8;

  // Batch query 1: all active technicians
  // Batch query 2: all time entries in range for technicians
  // Batch query 3: all tasks assigned to technicians on jobs in range
  // Batch query 4: all released jobs in range that have technician tasks (for on-time rate)
  const [technicians, allTimeEntries, allTasks, releasedJobs] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TECHNICIAN", isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        clockIn: { gte: from, lte: to },
        technician: { role: "TECHNICIAN", isActive: true },
      },
      select: {
        technicianId: true,
        netMinutes: true,
        laborCost: true,
        isOvertime: true,
      },
    }),
    prisma.task.findMany({
      where: {
        assignedTechnicianId: { not: null },
        assignedTechnician: { role: "TECHNICIAN", isActive: true },
      },
      select: {
        assignedTechnicianId: true,
        jobOrderId: true,
        name: true,
        isRework: true,
        estimatedHours: true,
        actualHours: true,
        jobOrder: {
          select: {
            createdAt: true,
            actualCompletionDate: true,
            status: true,
          },
        },
      },
    }),
    prisma.jobOrder.findMany({
      where: {
        status: "RELEASED",
        actualCompletionDate: { gte: from, lte: to },
        tasks: {
          some: { assignedTechnicianId: { not: null } },
        },
      },
      select: {
        id: true,
        targetCompletionDate: true,
        actualCompletionDate: true,
        tasks: {
          where: { assignedTechnicianId: { not: null } },
          select: { assignedTechnicianId: true },
        },
      },
    }),
  ]);

  // Group time entries by technician
  const timeEntriesByTech = new Map<string, typeof allTimeEntries>();
  for (const te of allTimeEntries) {
    const existing = timeEntriesByTech.get(te.technicianId) ?? [];
    existing.push(te);
    timeEntriesByTech.set(te.technicianId, existing);
  }

  // Group tasks by technician
  const tasksByTech = new Map<string, typeof allTasks>();
  for (const task of allTasks) {
    const techId = task.assignedTechnicianId!;
    const existing = tasksByTech.get(techId) ?? [];
    existing.push(task);
    tasksByTech.set(techId, existing);
  }

  // Group released jobs by technician (for on-time rate)
  const jobsByTech = new Map<string, typeof releasedJobs>();
  for (const job of releasedJobs) {
    const techIds = Array.from(new Set(job.tasks.map((t) => t.assignedTechnicianId!)));
    for (const techId of techIds) {
      const existing = jobsByTech.get(techId) ?? [];
      existing.push(job);
      jobsByTech.set(techId, existing);
    }
  }

  const results: TechPerformance[] = [];

  for (const tech of technicians) {
    // Time entries for this tech
    const techTimeEntries = timeEntriesByTech.get(tech.id) ?? [];
    const hoursLogged = techTimeEntries.reduce((sum, te) => sum + te.netMinutes, 0) / 60;
    const overtimeHours =
      techTimeEntries
        .filter((te) => te.isOvertime)
        .reduce((sum, te) => sum + te.netMinutes, 0) / 60;
    const revenueGenerated = techTimeEntries.reduce((sum, te) => sum + te.laborCost, 0);

    // Tasks for this tech
    const techTasks = tasksByTech.get(tech.id) ?? [];

    // Jobs worked (distinct jobOrderIds from tasks on jobs created in range)
    const jobIdSet = new Set<string>();
    for (const t of techTasks) {
      if (t.jobOrder.createdAt >= from && t.jobOrder.createdAt <= to) {
        jobIdSet.add(t.jobOrderId);
      }
    }
    const jobsWorked = jobIdSet.size;

    // Efficiency: estimated / actual hours for tasks on completed jobs in range
    let estH = 0;
    let actH = 0;
    for (const t of techTasks) {
      if (
        t.actualHours > 0 &&
        t.jobOrder.actualCompletionDate &&
        t.jobOrder.actualCompletionDate >= from &&
        t.jobOrder.actualCompletionDate <= to
      ) {
        estH += t.estimatedHours;
        actH += t.actualHours;
      }
    }
    const efficiencyScore = actH > 0 ? estH / actH : 0;

    // Utilization rate
    const utilizationRate =
      availableHoursPerTech > 0 ? (hoursLogged / availableHoursPerTech) * 100 : 0;

    // Rework rate: tasks on jobs created in range
    const tasksInRange = techTasks.filter(
      (t) => t.jobOrder.createdAt >= from && t.jobOrder.createdAt <= to
    );
    const totalTasks = tasksInRange.length;
    const reworkTasks = tasksInRange.filter(
      (t) => t.isRework || t.name.toLowerCase().includes("rework")
    ).length;
    const reworkRate = totalTasks > 0 ? (reworkTasks / totalTasks) * 100 : 0;

    // On-time rate from pre-fetched released jobs
    const techJobs = jobsByTech.get(tech.id) ?? [];
    const completedCount = techJobs.length;
    const onTimeCount = techJobs.filter(
      (j) =>
        j.targetCompletionDate &&
        j.actualCompletionDate &&
        j.actualCompletionDate <= j.targetCompletionDate
    ).length;
    const onTimeRate = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0;

    results.push({
      id: tech.id,
      name: `${tech.firstName} ${tech.lastName}`,
      role: tech.role,
      jobsWorked,
      hoursLogged,
      efficiencyScore,
      utilizationRate,
      reworkRate,
      revenueGenerated,
      onTimeRate,
      overtimeHours,
    });
  }

  // Sort by efficiency descending
  results.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  return results;
}

// ============================================================================
// 6. Technician Detail
// ============================================================================

export async function getTechnicianDetail(
  techId: string,
  dateRange: DateRange
): Promise<TechDetail> {
  const { from, to } = dateRange;

  // Get performance data first
  const allPerf = await getTechnicianPerformance(dateRange);
  const techPerf = allPerf.find((t) => t.id === techId);

  // If tech not found in performance list, build a default
  const tech = await prisma.user.findUnique({
    where: { id: techId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  const basePerf: TechPerformance = techPerf ?? {
    id: techId,
    name: tech ? `${tech.firstName} ${tech.lastName}` : "Unknown",
    role: tech?.role ?? "TECHNICIAN",
    jobsWorked: 0,
    hoursLogged: 0,
    efficiencyScore: 0,
    utilizationRate: 0,
    reworkRate: 0,
    revenueGenerated: 0,
    onTimeRate: 0,
    overtimeHours: 0,
  };

  // Task-by-task breakdown
  const tasks = await prisma.task.findMany({
    where: {
      assignedTechnicianId: techId,
      jobOrder: {
        createdAt: { gte: from, lte: to },
      },
    },
    select: {
      name: true,
      estimatedHours: true,
      actualHours: true,
      jobOrder: { select: { jobOrderNumber: true } },
    },
  });
  const taskBreakdown = tasks.map((t) => ({
    taskName: t.name,
    jobOrderNumber: t.jobOrder.jobOrderNumber,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    efficiency: t.actualHours > 0 ? t.estimatedHours / t.actualHours : 0,
  }));

  // Daily hours log
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      technicianId: techId,
      clockIn: { gte: from, lte: to },
    },
    select: { clockIn: true, netMinutes: true },
    orderBy: { clockIn: "asc" },
  });
  const dailyMap: Record<string, number> = {};
  for (const te of timeEntries) {
    const dateKey = te.clockIn.toISOString().slice(0, 10);
    dailyMap[dateKey] = (dailyMap[dateKey] ?? 0) + te.netMinutes / 60;
  }
  const dailyHours = Object.entries(dailyMap).map(([date, hours]) => ({
    date,
    hours,
  }));

  return {
    ...basePerf,
    taskBreakdown,
    dailyHours,
  };
}

// ============================================================================
// 7. Financial Summary
// ============================================================================

export async function getFinancialSummary(dateRange: DateRange): Promise<FinancialSummary> {
  const { from, to } = dateRange;
  const now = new Date();

  // Total invoiced (grandTotal of latest invoices in range)
  const invoicedAgg = await prisma.invoice.aggregate({
    _sum: { grandTotal: true, discountValue: true },
    where: {
      isLatest: true,
      createdAt: { gte: from, lte: to },
    },
  });
  const totalInvoiced = invoicedAgg._sum.grandTotal ?? 0;
  const totalDiscountGiven = invoicedAgg._sum.discountValue ?? 0;

  // Total collected (payments in range)
  const collectedAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: { gte: from, lte: to },
    },
  });
  const totalCollected = collectedAgg._sum.amount ?? 0;

  // Outstanding receivables (balanceDue on unpaid/partial latest invoices)
  const outstandingAgg = await prisma.invoice.aggregate({
    _sum: { balanceDue: true },
    where: {
      isLatest: true,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
    },
  });
  const outstandingReceivables = outstandingAgg._sum.balanceDue ?? 0;

  // Receivables aging
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      isLatest: true,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
    },
    select: {
      balanceDue: true,
      createdAt: true,
      jobOrder: { select: { isInsuranceJob: true } },
    },
  });

  const receivablesAging = {
    current: { total: 0, insurance: 0, customer: 0 },
    over30: { total: 0, insurance: 0, customer: 0 },
    over60: { total: 0, insurance: 0, customer: 0 },
    over90: { total: 0, insurance: 0, customer: 0 },
  };

  for (const inv of unpaidInvoices) {
    const ageDays = Math.floor(
      (now.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isInsurance = inv.jobOrder.isInsuranceJob;
    let bucket: keyof typeof receivablesAging;
    if (ageDays > 90) bucket = "over90";
    else if (ageDays > 60) bucket = "over60";
    else if (ageDays > 30) bucket = "over30";
    else bucket = "current";

    receivablesAging[bucket].total += inv.balanceDue;
    if (isInsurance) {
      receivablesAging[bucket].insurance += inv.balanceDue;
    } else {
      receivablesAging[bucket].customer += inv.balanceDue;
    }
  }

  // Average days to payment (for paid invoices in range)
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      isLatest: true,
      paymentStatus: "PAID",
      paidInFullAt: { not: null },
      createdAt: { gte: from, lte: to },
    },
    select: { createdAt: true, paidInFullAt: true },
  });
  let totalDaysToPayment = 0;
  for (const inv of paidInvoices) {
    if (inv.paidInFullAt) {
      totalDaysToPayment += Math.floor(
        (inv.paidInFullAt.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }
  const avgDaysToPayment =
    paidInvoices.length > 0 ? totalDaysToPayment / paidInvoices.length : 0;

  // Parts margin and labor margin from invoices
  // Margin = (invoice subtotal - actual cost) / invoice subtotal
  // For labor: compare subtotalLabor to sum of laborCost from time entries
  const invoicesForMargin = await prisma.invoice.findMany({
    where: {
      isLatest: true,
      createdAt: { gte: from, lte: to },
    },
    select: {
      subtotalLabor: true,
      subtotalParts: true,
      jobOrderId: true,
    },
  });

  let totalLaborRevenue = 0;
  let totalLaborCost = 0;
  let totalPartsRevenue = 0;
  let totalPartsCost = 0;

  for (const inv of invoicesForMargin) {
    totalLaborRevenue += inv.subtotalLabor;
    totalPartsRevenue += inv.subtotalParts;

    // Get labor cost from time entries for this job
    const laborCostAgg = await prisma.timeEntry.aggregate({
      _sum: { laborCost: true },
      where: { jobOrderId: inv.jobOrderId },
    });
    totalLaborCost += laborCostAgg._sum.laborCost ?? 0;

    // Get materials cost for this job
    const matCostAgg = await prisma.materialUsage.aggregate({
      _sum: { actualCost: true },
      where: { jobOrderId: inv.jobOrderId },
    });
    totalPartsCost += matCostAgg._sum.actualCost ?? 0;
  }

  const laborMargin =
    totalLaborRevenue > 0
      ? ((totalLaborRevenue - totalLaborCost) / totalLaborRevenue) * 100
      : 0;
  const partsMargin =
    totalPartsRevenue > 0
      ? ((totalPartsRevenue - totalPartsCost) / totalPartsRevenue) * 100
      : 0;

  return {
    totalInvoiced,
    totalCollected,
    outstandingReceivables,
    receivablesAging,
    avgDaysToPayment,
    totalDiscountGiven,
    partsMargin,
    laborMargin,
  };
}

// ============================================================================
// 8. Job Profitability
// ============================================================================

export async function getJobProfitability(jobOrderId: string): Promise<JobProfitability> {
  // Revenue from latest invoice
  const invoice = await prisma.invoice.findFirst({
    where: {
      jobOrderId,
      isLatest: true,
    },
    select: {
      grandTotal: true,
      estimatedTotal: true,
      subtotalSublet: true,
    },
  });
  const revenue = invoice?.grandTotal ?? 0;

  // Labor cost from time entries
  const laborCostAgg = await prisma.timeEntry.aggregate({
    _sum: { laborCost: true },
    where: { jobOrderId },
  });
  const laborCost = laborCostAgg._sum.laborCost ?? 0;

  // Materials cost
  const materialsCostAgg = await prisma.materialUsage.aggregate({
    _sum: { actualCost: true },
    where: { jobOrderId },
  });
  const materialsCost = materialsCostAgg._sum.actualCost ?? 0;

  // Sublet cost
  const subletCost = invoice?.subtotalSublet ?? 0;

  const totalCost = laborCost + materialsCost + subletCost;
  const grossProfit = revenue - totalCost;
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const estimateTotal = invoice?.estimatedTotal ?? 0;
  const varianceFromEstimate = revenue - estimateTotal;
  const varianceAmount = varianceFromEstimate;
  const variancePercent = estimateTotal > 0 ? (varianceAmount / estimateTotal) * 100 : 0;

  return {
    revenue,
    laborCost,
    materialsCost,
    subletCost,
    totalCost,
    grossProfit,
    marginPercent,
    estimateTotal,
    varianceAmount,
    variancePercent,
    varianceFromEstimate,
  };
}

// ============================================================================
// 9. Dashboard Metrics
// ============================================================================

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    activeJobs,
    pendingEstimates,
    clockedIn,
    overdueCount,
    unpaidInvoices,
    todayRevenueAgg,
    checkedInToday,
    releasedToday,
    recentActivities,
  ] = await Promise.all([
    // Active jobs (not RELEASED or CANCELLED)
    prisma.jobOrder.count({
      where: { status: { notIn: ["RELEASED", "CANCELLED"] } },
    }),

    // Pending estimates
    prisma.estimateRequest.count({
      where: {
        status: { in: ["INQUIRY_RECEIVED", "PENDING_ESTIMATE"] },
      },
    }),

    // Clocked in (timeEntries with no clockOut)
    prisma.timeEntry.count({
      where: { clockOut: null },
    }),

    // Overdue jobs
    prisma.jobOrder.count({
      where: {
        status: { notIn: ["RELEASED", "CANCELLED"] },
        targetCompletionDate: { lt: now },
      },
    }),

    // Unpaid invoices
    prisma.invoice.count({
      where: {
        isLatest: true,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      },
    }),

    // Today's revenue
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),

    // Checked in today (jobs that transitioned to CHECKED_IN today via intakeRecord)
    prisma.intakeRecord.count({
      where: {
        checkedInAt: { gte: todayStart, lte: todayEnd },
      },
    }),

    // Released today
    prisma.jobOrder.count({
      where: {
        status: "RELEASED",
        actualCompletionDate: { gte: todayStart, lte: todayEnd },
      },
    }),

    // Recent activities (last 10)
    prisma.jobActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
        jobOrder: { select: { jobOrderNumber: true } },
      },
    }),
  ]);

  return {
    activeJobs,
    pendingEstimates,
    clockedIn,
    overdueCount,
    unpaidInvoices,
    todayRevenue: todayRevenueAgg._sum.amount ?? 0,
    checkedInToday,
    releasedToday,
    recentActivities,
  };
}

// ============================================================================
// 10. My Dashboard (role-specific)
// ============================================================================

export async function getMyDashboard(
  userId: string,
  role: string
): Promise<MyDashboardTechnician | MyDashboardAdvisor | null> {
  if (role === "TECHNICIAN") {
    return getTechnicianDashboard(userId);
  }
  if (role === "ADVISOR") {
    return getAdvisorDashboard(userId);
  }
  return null;
}

async function getTechnicianDashboard(
  userId: string
): Promise<MyDashboardTechnician> {
  const now = new Date();
  const weekStart = getMonday(now);
  const monthStart = startOfMonth(now);

  // My tasks: assigned to me, not completed, on active jobs
  const myTasks = await prisma.task.findMany({
    where: {
      assignedTechnicianId: userId,
      status: { notIn: ["DONE"] },
      jobOrder: {
        status: { notIn: ["RELEASED", "CANCELLED"] },
      },
    },
    select: {
      id: true,
      name: true,
      status: true,
      estimatedHours: true,
      jobOrder: { select: { jobOrderNumber: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Clock status: check for open time entry
  const openEntry = await prisma.timeEntry.findFirst({
    where: {
      technicianId: userId,
      clockOut: null,
    },
    select: {
      clockIn: true,
      task: { select: { name: true } },
      jobOrder: { select: { jobOrderNumber: true } },
    },
  });

  // Week hours (since Monday)
  const weekEntriesAgg = await prisma.timeEntry.aggregate({
    _sum: { netMinutes: true },
    where: {
      technicianId: userId,
      clockIn: { gte: weekStart },
    },
  });
  const weekHours = (weekEntriesAgg._sum.netMinutes ?? 0) / 60;

  // Month efficiency (estimated / actual for tasks completed this month)
  const monthTasks = await prisma.task.findMany({
    where: {
      assignedTechnicianId: userId,
      status: "DONE",
      completedAt: { gte: monthStart },
      actualHours: { gt: 0 },
    },
    select: { estimatedHours: true, actualHours: true },
  });
  let mEstH = 0;
  let mActH = 0;
  for (const t of monthTasks) {
    mEstH += t.estimatedHours;
    mActH += t.actualHours;
  }
  const monthEfficiency = mActH > 0 ? mEstH / mActH : 0;

  return {
    myTasks: myTasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      estimatedHours: t.estimatedHours,
      jobOrderNumber: t.jobOrder.jobOrderNumber,
    })),
    clockStatus: {
      isClockedIn: !!openEntry,
      currentEntry: openEntry
        ? {
            clockIn: openEntry.clockIn,
            taskName: openEntry.task.name,
            jobOrderNumber: openEntry.jobOrder.jobOrderNumber,
          }
        : null,
    },
    weekHours,
    monthEfficiency,
  };
}

// ============================================================================
// 11. Today's Appointments (for dashboard widget)
// ============================================================================

export async function getTodaysAppointments() {
  const { getAppointmentsByDate } = await import("@/lib/services/scheduler");
  const today = new Date();
  const appointments = await getAppointmentsByDate(today);
  return appointments.filter((a: any) => a.status !== "CANCELLED");
}

async function getAdvisorDashboard(
  userId: string
): Promise<MyDashboardAdvisor> {
  // My jobs: active jobs (createdBy this advisor or could be broader — using all active)
  const myJobs = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
      createdBy: userId,
    },
    select: {
      id: true,
      jobOrderNumber: true,
      status: true,
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { plateNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Pending approvals: estimate requests with status ESTIMATE_SENT
  const pendingApprovals = await prisma.estimateRequest.count({
    where: {
      status: "ESTIMATE_SENT",
    },
  });

  // Ready for release: FULLY_PAID jobs
  const readyForRelease = await prisma.jobOrder.count({
    where: {
      status: "FULLY_PAID",
    },
  });

  return {
    myJobs: myJobs.map((j) => ({
      id: j.id,
      jobOrderNumber: j.jobOrderNumber,
      status: j.status,
      customerName: `${j.customer.firstName} ${j.customer.lastName}`,
      vehiclePlate: j.vehicle.plateNumber,
    })),
    pendingApprovals,
    readyForRelease,
  };
}

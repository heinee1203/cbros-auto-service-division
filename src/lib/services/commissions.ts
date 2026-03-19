import { prisma } from "@/lib/prisma";
import { getSettingValue } from "@/lib/services/settings";

// ============================================================================
// Commission Rate Management
// ============================================================================

export async function getCommissionRate(userId: string) {
  const rate = await prisma.commissionRate.findFirst({
    where: { userId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) return null;
  return { rate: rate.rate, effectiveFrom: rate.effectiveFrom };
}

export async function getRateAtDate(userId: string, date: Date) {
  const rate = await prisma.commissionRate.findFirst({
    where: {
      userId,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return rate?.rate ?? null;
}

export async function getAllCommissionRates() {
  const users = await prisma.user.findMany({
    where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      commissionRates: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  return users.map((u) => ({
    user: { id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username },
    rate: u.commissionRates[0]?.rate ?? 0,
    effectiveFrom: u.commissionRates[0]?.effectiveFrom ?? null,
  }));
}

export async function setCommissionRate(
  userId: string,
  rate: number,
  createdBy: string,
  notes?: string | null
) {
  // Close the current active rate
  const current = await prisma.commissionRate.findFirst({
    where: { userId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });

  const now = new Date();

  if (current) {
    await prisma.commissionRate.update({
      where: { id: current.id },
      data: { effectiveTo: now },
    });
  }

  return prisma.commissionRate.create({
    data: {
      userId,
      rate,
      effectiveFrom: now,
      notes: notes ?? null,
      createdBy,
    },
  });
}

export async function getCommissionRateHistory(userId: string) {
  return prisma.commissionRate.findMany({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
    include: {
      createdByUser: { select: { firstName: true, lastName: true } },
    },
  });
}

// ============================================================================
// Commission Calculation
// ============================================================================

interface TechJobEntry {
  jobOrderId: string;
  jobNumber: string;
  vehicle: string;
  customerName: string;
  laborBilled: number; // centavos
  commissionRate: number; // %
  commissionAmount: number; // centavos
  completedDate: Date;
  taskId?: string;
}

interface TechCommission {
  user: { id: string; name: string; nickname: string };
  jobs: TechJobEntry[];
  totalLaborBilled: number;
  commissionRate: number;
  totalCommission: number;
}

export interface CommissionPreview {
  entries: TechCommission[];
  unassignedLabor: number;
  grandTotalLabor: number;
  grandTotalCommission: number;
  periodStart: Date;
  periodEnd: Date;
}

export async function calculateCommission(
  periodStart: Date,
  periodEnd: Date
): Promise<CommissionPreview> {
  // Get commission settings
  const includeOnlyPaid = await getSettingValue("commission_include_only_paid", true);
  const includeOnlyReleased = await getSettingValue("commission_include_only_released", false);

  // Build status filter
  const statusFilter: string[] = [];
  if (includeOnlyPaid) statusFilter.push("FULLY_PAID");
  if (includeOnlyReleased) statusFilter.push("RELEASED");
  if (statusFilter.length === 0) {
    // Default: both released and fully paid
    statusFilter.push("FULLY_PAID", "RELEASED");
  }

  // Find all qualifying jobs in the period
  // Use actualCompletionDate for accuracy; fallback to updatedAt only if not set
  const jobs = await prisma.jobOrder.findMany({
    where: {
      status: { in: statusFilter },
      deletedAt: null,
      OR: [
        { actualCompletionDate: { gte: periodStart, lte: periodEnd } },
        {
          actualCompletionDate: null,
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
      ],
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { plateNumber: true, make: true, model: true } },
      tasks: {
        where: { deletedAt: null },
        include: {
          timeEntries: {
            where: { deletedAt: null },
            select: { technicianId: true, netMinutes: true },
          },
        },
      },
      invoices: {
        where: { deletedAt: null, isLatest: true },
        include: {
          lineItems: {
            where: { group: "LABOR", deletedAt: null },
          },
        },
      },
      estimates: {
        where: { deletedAt: null },
        include: {
          versions: {
            where: { isApproved: true, deletedAt: null },
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              lineItems: {
                where: { group: "LABOR", deletedAt: null },
              },
            },
          },
        },
      },
    },
  });

  // Build tech → jobs map
  const techMap = new Map<string, TechJobEntry[]>();
  let unassignedLabor = 0;

  for (const job of jobs) {
    // Determine total labor billed: invoice first, then estimate fallback
    let totalLaborBilled = 0;
    const latestInvoice = job.invoices[0];
    if (latestInvoice && latestInvoice.lineItems.length > 0) {
      totalLaborBilled = latestInvoice.lineItems.reduce(
        (sum, li) => sum + li.subtotal,
        0
      );
    } else {
      // Fallback to approved estimate
      for (const est of job.estimates) {
        const version = est.versions[0];
        if (version) {
          totalLaborBilled = version.lineItems.reduce(
            (sum, li) => sum + li.subtotal,
            0
          );
          break;
        }
      }
    }

    if (totalLaborBilled === 0) continue;

    // Attribute labor to technicians
    const techHours = new Map<string, number>();
    let totalHoursLogged = 0;

    // Priority 1: Time entries on tasks
    for (const task of job.tasks) {
      for (const te of task.timeEntries) {
        const hours = te.netMinutes / 60;
        techHours.set(
          te.technicianId,
          (techHours.get(te.technicianId) ?? 0) + hours
        );
        totalHoursLogged += hours;
      }
    }

    // Priority 2: If no time entries, use assigned techs on tasks
    if (totalHoursLogged === 0) {
      const assignedTechs = new Set<string>();
      for (const task of job.tasks) {
        if (task.assignedTechnicianId) {
          assignedTechs.add(task.assignedTechnicianId);
        }
      }

      // Priority 3: Estimate line item assignments
      if (assignedTechs.size === 0) {
        for (const est of job.estimates) {
          const version = est.versions[0];
          if (version) {
            for (const li of version.lineItems) {
              if (li.assignedTechnicianId) {
                assignedTechs.add(li.assignedTechnicianId);
              }
            }
          }
        }
      }

      if (assignedTechs.size > 0) {
        // Split evenly
        const shareHours = 1 / assignedTechs.size;
        Array.from(assignedTechs).forEach((techId) => {
          techHours.set(techId, shareHours);
        });
        totalHoursLogged = 1;
      }
    }

    // If still no tech attribution, mark as unassigned
    if (techHours.size === 0) {
      unassignedLabor += totalLaborBilled;
      continue;
    }

    const completedDate = job.actualCompletionDate ?? job.updatedAt;
    const vehicleStr = `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.plateNumber})`;
    const customerStr = `${job.customer.firstName} ${job.customer.lastName}`;

    // Distribute labor proportionally
    const techEntries = Array.from(techHours.entries());
    for (let i = 0; i < techEntries.length; i++) {
      const [techId, hours] = techEntries[i];
      const proportion = hours / totalHoursLogged;
      const techLaborBilled = Math.round(totalLaborBilled * proportion);
      const rate = (await getRateAtDate(techId, completedDate)) ?? 0;
      const commissionAmount = Math.round(techLaborBilled * rate / 100);

      const entry: TechJobEntry = {
        jobOrderId: job.id,
        jobNumber: job.jobOrderNumber,
        vehicle: vehicleStr,
        customerName: customerStr,
        laborBilled: techLaborBilled,
        commissionRate: rate,
        commissionAmount,
        completedDate,
      };

      const existing = techMap.get(techId) ?? [];
      existing.push(entry);
      techMap.set(techId, existing);
    }
  }

  // Build result entries with tech info
  const techIds = Array.from(techMap.keys());
  const techUsers = await prisma.user.findMany({
    where: { id: { in: techIds } },
    select: { id: true, firstName: true, lastName: true, username: true },
  });
  const techUserMap = new Map(techUsers.map((u) => [u.id, u]));

  const entries: TechCommission[] = [];
  let grandTotalLabor = 0;
  let grandTotalCommission = 0;

  const techMapEntries = Array.from(techMap.entries());
  for (let i = 0; i < techMapEntries.length; i++) {
    const [techId, jobEntries] = techMapEntries[i];
    const user = techUserMap.get(techId);
    const totalLabor = jobEntries.reduce((s, j) => s + j.laborBilled, 0);
    const totalComm = jobEntries.reduce((s, j) => s + j.commissionAmount, 0);
    // Show rate if consistent across all jobs, -1 signals "mixed"
    const rates = new Set(jobEntries.map((j) => j.commissionRate));
    const avgRate = rates.size === 1 ? jobEntries[0].commissionRate : -1;

    entries.push({
      user: {
        id: techId,
        name: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        nickname: user?.firstName ?? "Unknown",
      },
      jobs: jobEntries,
      totalLaborBilled: totalLabor,
      commissionRate: avgRate,
      totalCommission: totalComm,
    });

    grandTotalLabor += totalLabor;
    grandTotalCommission += totalComm;
  }

  // Sort by total commission descending
  entries.sort((a, b) => b.totalCommission - a.totalCommission);

  return {
    entries,
    unassignedLabor,
    grandTotalLabor,
    grandTotalCommission,
    periodStart,
    periodEnd,
  };
}

// ============================================================================
// Commission Period Management
// ============================================================================

export async function createCommissionPeriod(
  periodStart: Date,
  periodEnd: Date,
  createdBy: string
) {
  // Prevent duplicate periods for the same date range
  const existing = await prisma.commissionPeriod.findFirst({
    where: {
      periodStart: { gte: periodStart, lte: periodStart },
      periodEnd: { gte: periodEnd, lte: periodEnd },
    },
  });
  if (existing) {
    throw new Error(
      `A commission period already exists for this date range (status: ${existing.status})`
    );
  }

  const preview = await calculateCommission(periodStart, periodEnd);

  const period = await prisma.commissionPeriod.create({
    data: {
      periodStart,
      periodEnd,
      status: "DRAFT",
      totalCommission: preview.grandTotalCommission,
      createdBy,
      entries: {
        create: preview.entries.flatMap((tech) =>
          tech.jobs.map((job) => ({
            userId: tech.user.id,
            jobOrderId: job.jobOrderId,
            taskId: job.taskId ?? null,
            laborBilled: job.laborBilled,
            commissionRate: job.commissionRate,
            commissionAmount: job.commissionAmount,
          }))
        ),
      },
    },
    include: {
      entries: true,
    },
  });

  return period;
}

export async function finalizeCommissionPeriod(
  periodId: string,
  userId: string
) {
  const period = await prisma.commissionPeriod.findUnique({
    where: { id: periodId },
  });

  if (!period) throw new Error("Commission period not found");
  if (period.status !== "DRAFT") throw new Error("Can only finalize DRAFT periods");

  return prisma.commissionPeriod.update({
    where: { id: periodId },
    data: {
      status: "FINALIZED",
      finalizedBy: userId,
      finalizedAt: new Date(),
    },
  });
}

export async function markCommissionPaid(
  periodId: string,
  userId: string
) {
  const period = await prisma.commissionPeriod.findUnique({
    where: { id: periodId },
  });

  if (!period) throw new Error("Commission period not found");
  if (period.status !== "FINALIZED") throw new Error("Can only mark FINALIZED periods as paid");

  return prisma.commissionPeriod.update({
    where: { id: periodId },
    data: { status: "PAID", paidBy: userId, paidAt: new Date() },
  });
}

export async function getCommissionPeriods(options?: {
  status?: string;
  limit?: number;
}) {
  return prisma.commissionPeriod.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { periodStart: "desc" },
    take: options?.limit ?? 50,
    include: {
      _count: { select: { entries: true } },
    },
  });
}

export async function getCommissionPeriodDetail(periodId: string) {
  const period = await prisma.commissionPeriod.findUnique({
    where: { id: periodId },
    include: {
      entries: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true } },
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              customer: { select: { firstName: true, lastName: true } },
              vehicle: { select: { plateNumber: true, make: true, model: true } },
            },
          },
        },
      },
    },
  });

  if (!period) return null;

  // Group entries by technician
  const techMap = new Map<
    string,
    {
      user: { id: string; firstName: string; lastName: string };
      entries: typeof period.entries;
      totalLaborBilled: number;
      totalCommission: number;
      commissionRate: number;
    }
  >();

  for (const entry of period.entries) {
    const existing = techMap.get(entry.userId);
    if (existing) {
      existing.entries.push(entry);
      existing.totalLaborBilled += entry.laborBilled;
      existing.totalCommission += entry.commissionAmount;
    } else {
      techMap.set(entry.userId, {
        user: entry.user,
        entries: [entry],
        totalLaborBilled: entry.laborBilled,
        totalCommission: entry.commissionAmount,
        commissionRate: entry.commissionRate,
      });
    }
  }

  return {
    ...period,
    techBreakdown: Array.from(techMap.values()).sort(
      (a, b) => b.totalCommission - a.totalCommission
    ),
  };
}

// Get commission data for a specific technician (frontliner view)
export async function getTechnicianCommission(userId: string) {
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(startOfWeek);
  lastWeekEnd.setMilliseconds(-1);

  // This week: calculate live
  const thisWeekPreview = await calculateCommission(startOfWeek, endOfWeek);
  const thisWeekEntry = thisWeekPreview.entries.find(
    (e) => e.user.id === userId
  );

  // Last week: check for saved period first, then calculate
  let lastWeekAmount = 0;
  let lastWeekJobs = 0;
  let lastWeekStatus: string | null = null;

  const lastWeekPeriod = await prisma.commissionPeriod.findFirst({
    where: {
      periodStart: { lte: lastWeekEnd },
      periodEnd: { gte: lastWeekStart },
    },
    include: {
      entries: {
        where: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (lastWeekPeriod) {
    lastWeekAmount = lastWeekPeriod.entries.reduce(
      (s, e) => s + e.commissionAmount,
      0
    );
    lastWeekJobs = lastWeekPeriod.entries.length;
    lastWeekStatus = lastWeekPeriod.status;
  } else {
    const lastWeekPreview = await calculateCommission(lastWeekStart, lastWeekEnd);
    const entry = lastWeekPreview.entries.find((e) => e.user.id === userId);
    lastWeekAmount = entry?.totalCommission ?? 0;
    lastWeekJobs = entry?.jobs.length ?? 0;
  }

  return {
    thisWeek: {
      amount: thisWeekEntry?.totalCommission ?? 0,
      jobs: thisWeekEntry?.jobs.length ?? 0,
      breakdown: thisWeekEntry?.jobs ?? [],
    },
    lastWeek: {
      amount: lastWeekAmount,
      jobs: lastWeekJobs,
      status: lastWeekStatus,
    },
  };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 1, so shift: Sun=0 -> offset 6, Mon=1 -> offset 0, etc.
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

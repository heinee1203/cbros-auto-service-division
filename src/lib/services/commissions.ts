import { prisma } from "@/lib/prisma";
import { getSettingValue } from "@/lib/services/settings";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ELIGIBLE_CATEGORIES = [
  "Preventive Maintenance Service (PMS)",
  "Brake System",
  "Suspension & Steering",
  "Engine & Drivetrain",
  "Electrical & Diagnostics",
  "Tires & Wheels",
  "Air Conditioning",
  "Diagnostics & Inspection",
];

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
// Commission Calculation — Types
// ============================================================================

interface TechJobEntry {
  jobOrderId: string;
  jobNumber: string;
  vehicle: string;
  customerName: string;
  laborBilled: number;
  commissionRate: number;
  grossCommission: number;
  smDeduction: number;
  netCommission: number;
  completedDate: Date;
  taskId?: string;
}

interface TechCommission {
  user: { id: string; name: string; nickname: string };
  isChiefMechanic: boolean;
  jobs: TechJobEntry[];
  totalLaborBilled: number;
  commissionRate: number;
  totalGrossCommission: number;
  totalSmDeduction: number;
  totalNetCommission: number;
  cmOptionA?: number;
  cmOptionB?: number;
  cmSelectedOption?: string;
}

export interface CommissionPreview {
  entries: TechCommission[];
  unassignedLabor: number;
  totalMechanicalLabor: number;
  grandTotalGross: number;
  grandTotalSmDeduction: number;
  grandTotalNet: number;
  smPayout: number;
  periodStart: Date;
  periodEnd: Date;
}

// ============================================================================
// Commission Calculation — Engine
// ============================================================================

export async function calculateCommission(
  periodStart: Date,
  periodEnd: Date
): Promise<CommissionPreview> {
  // Load settings
  const includeOnlyPaid = await getSettingValue("commission_include_only_paid", true);
  const includeOnlyReleased = await getSettingValue("commission_include_only_released", false);
  const chiefMechanicId = await getSettingValue<string>("commission_chief_mechanic_id", "");
  const cmShopRate = await getSettingValue<number>("commission_cm_shop_rate", 5);
  const cmOwnRate = await getSettingValue<number>("commission_cm_own_rate", 10);
  const smDeductionRate = await getSettingValue<number>("commission_sm_deduction_rate", 5);
  const eligibleCategoriesStr = await getSettingValue<string>(
    "commission_eligible_categories",
    DEFAULT_ELIGIBLE_CATEGORIES.join(",")
  );
  const eligibleCategories = eligibleCategoriesStr.split(",").map((c) => c.trim());

  // Build status filter
  const statusFilter: string[] = [];
  if (includeOnlyPaid) statusFilter.push("FULLY_PAID");
  if (includeOnlyReleased) statusFilter.push("RELEASED");
  if (statusFilter.length === 0) statusFilter.push("FULLY_PAID", "RELEASED");

  // Find qualifying jobs
  const jobs = await prisma.jobOrder.findMany({
    where: {
      status: { in: statusFilter },
      deletedAt: null,
      OR: [
        { actualCompletionDate: { gte: periodStart, lte: periodEnd } },
        { actualCompletionDate: null, updatedAt: { gte: periodStart, lte: periodEnd } },
      ],
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { plateNumber: true, make: true, model: true } },
      tasks: {
        where: { deletedAt: null },
        include: {
          serviceCatalog: { select: { category: true } },
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
                include: {
                  serviceCatalog: { select: { category: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Build tech → jobs map (mechanical labor only)
  const techMap = new Map<string, TechJobEntry[]>();
  let unassignedLabor = 0;
  let totalMechanicalLabor = 0;

  for (const job of jobs) {
    // Determine mechanical labor billed
    let mechLaborBilled = 0;

    const latestInvoice = job.invoices[0];
    if (latestInvoice && latestInvoice.lineItems.length > 0) {
      // Invoice exists — we need to determine which labor line items are mechanical
      // Use tasks' service catalog to check if the job has mechanical services
      const hasMechanicalTasks = job.tasks.some(
        (t) => t.serviceCatalog && eligibleCategories.includes(t.serviceCatalog.category)
      );
      const hasNonMechanicalTasks = job.tasks.some(
        (t) => t.serviceCatalog && !eligibleCategories.includes(t.serviceCatalog.category)
      );

      if (hasMechanicalTasks && !hasNonMechanicalTasks) {
        // Pure mechanical job — all labor counts
        mechLaborBilled = latestInvoice.lineItems.reduce((sum, li) => sum + li.subtotal, 0);
      } else if (hasMechanicalTasks && hasNonMechanicalTasks) {
        // Mixed job — proportion by mechanical task hours vs total
        const mechHours = job.tasks
          .filter((t) => t.serviceCatalog && eligibleCategories.includes(t.serviceCatalog.category))
          .reduce((sum, t) => sum + t.estimatedHours, 0);
        const totalHours = job.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
        const proportion = totalHours > 0 ? mechHours / totalHours : 0;
        const totalLabor = latestInvoice.lineItems.reduce((sum, li) => sum + li.subtotal, 0);
        mechLaborBilled = Math.round(totalLabor * proportion);
      } else if (!hasMechanicalTasks && job.tasks.length === 0) {
        // No tasks — check estimate line items for category
        for (const est of job.estimates) {
          const version = est.versions[0];
          if (version) {
            mechLaborBilled = version.lineItems
              .filter((li) => li.serviceCatalog && eligibleCategories.includes(li.serviceCatalog.category))
              .reduce((sum, li) => sum + li.subtotal, 0);
            break;
          }
        }
      }
      // else: purely non-mechanical job, mechLaborBilled stays 0
    } else {
      // Fallback to estimate
      for (const est of job.estimates) {
        const version = est.versions[0];
        if (version) {
          mechLaborBilled = version.lineItems
            .filter((li) => li.serviceCatalog && eligibleCategories.includes(li.serviceCatalog.category))
            .reduce((sum, li) => sum + li.subtotal, 0);
          break;
        }
      }
    }

    if (mechLaborBilled === 0) continue;
    totalMechanicalLabor += mechLaborBilled;

    // Attribute labor to technicians (same priority chain as before)
    const techHours = new Map<string, number>();
    let totalHoursLogged = 0;

    // Priority 1: Time entries
    for (const task of job.tasks) {
      // Only count mechanical tasks for attribution
      if (task.serviceCatalog && !eligibleCategories.includes(task.serviceCatalog.category)) continue;
      for (const te of task.timeEntries) {
        const hours = te.netMinutes / 60;
        techHours.set(te.technicianId, (techHours.get(te.technicianId) ?? 0) + hours);
        totalHoursLogged += hours;
      }
    }

    // Priority 2: Assigned techs on mechanical tasks
    if (totalHoursLogged === 0) {
      const assignedTechs = new Set<string>();
      for (const task of job.tasks) {
        if (task.serviceCatalog && !eligibleCategories.includes(task.serviceCatalog.category)) continue;
        if (task.assignedTechnicianId) assignedTechs.add(task.assignedTechnicianId);
      }

      // Priority 3: Estimate line items
      if (assignedTechs.size === 0) {
        for (const est of job.estimates) {
          const version = est.versions[0];
          if (version) {
            for (const li of version.lineItems) {
              if (li.assignedTechnicianId && li.serviceCatalog &&
                  eligibleCategories.includes(li.serviceCatalog.category)) {
                assignedTechs.add(li.assignedTechnicianId);
              }
            }
          }
        }
      }

      if (assignedTechs.size > 0) {
        const shareHours = 1 / assignedTechs.size;
        Array.from(assignedTechs).forEach((techId) => {
          techHours.set(techId, shareHours);
        });
        totalHoursLogged = 1;
      }
    }

    if (techHours.size === 0) {
      unassignedLabor += mechLaborBilled;
      continue;
    }

    const completedDate = job.actualCompletionDate ?? job.updatedAt;
    const vehicleStr = `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.plateNumber})`;
    const customerStr = `${job.customer.firstName} ${job.customer.lastName}`;

    // Distribute mechanical labor proportionally — gross commission only (SM deduction applied later)
    const techEntries = Array.from(techHours.entries());
    for (let i = 0; i < techEntries.length; i++) {
      const [techId, hours] = techEntries[i];
      const proportion = hours / totalHoursLogged;
      const techLaborBilled = Math.round(mechLaborBilled * proportion);
      const rate = (await getRateAtDate(techId, completedDate)) ?? 0;
      const grossCommission = Math.round(techLaborBilled * rate / 100);

      const entry: TechJobEntry = {
        jobOrderId: job.id,
        jobNumber: job.jobOrderNumber,
        vehicle: vehicleStr,
        customerName: customerStr,
        laborBilled: techLaborBilled,
        commissionRate: rate,
        grossCommission,
        smDeduction: 0, // calculated per-tech after CM formula
        netCommission: 0,
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
  let grandTotalGross = 0;
  let grandTotalSmDeduction = 0;
  let grandTotalNet = 0;

  const techMapEntries = Array.from(techMap.entries());
  for (let i = 0; i < techMapEntries.length; i++) {
    const [techId, jobEntries] = techMapEntries[i];
    const user = techUserMap.get(techId);
    const isCM = !!(chiefMechanicId && techId === chiefMechanicId);
    const totalLabor = jobEntries.reduce((s, j) => s + j.laborBilled, 0);

    let techGrossCommission: number;
    let cmOptionA: number | undefined;
    let cmOptionB: number | undefined;
    let cmSelectedOption: string | undefined;

    if (isCM) {
      // CM Option A: cmShopRate% of TOTAL mechanical labor
      cmOptionA = Math.round(totalMechanicalLabor * cmShopRate / 100);
      // CM Option B: cmOwnRate% of CM's OWN labor
      cmOptionB = Math.round(totalLabor * cmOwnRate / 100);
      // Select the higher
      if (cmOptionA >= cmOptionB) {
        techGrossCommission = cmOptionA;
        cmSelectedOption = "A";
      } else {
        techGrossCommission = cmOptionB;
        cmSelectedOption = "B";
      }
    } else {
      techGrossCommission = jobEntries.reduce((s, j) => s + j.grossCommission, 0);
    }

    // Apply SM deduction
    const techSmDeduction = Math.round(techGrossCommission * smDeductionRate / 100);
    const techNetCommission = techGrossCommission - techSmDeduction;

    // Update job entries with SM deduction (distributed proportionally)
    const jobGrossTotal = jobEntries.reduce((s, j) => s + j.grossCommission, 0);
    for (const job of jobEntries) {
      if (isCM) {
        // For CM, recalculate per-job gross based on selected option
        const jobProportion = jobGrossTotal > 0 ? job.grossCommission / jobGrossTotal : 0;
        job.grossCommission = Math.round(techGrossCommission * jobProportion);
      }
      const jobSmProportion = techGrossCommission > 0 ? job.grossCommission / techGrossCommission : 0;
      job.smDeduction = Math.round(techSmDeduction * jobSmProportion);
      job.netCommission = job.grossCommission - job.smDeduction;
    }

    const rates = new Set(jobEntries.map((j) => j.commissionRate));
    const displayRate = isCM ? -1 : (rates.size === 1 ? jobEntries[0].commissionRate : -1);

    entries.push({
      user: {
        id: techId,
        name: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        nickname: user?.firstName ?? "Unknown",
      },
      isChiefMechanic: isCM,
      jobs: jobEntries,
      totalLaborBilled: totalLabor,
      commissionRate: displayRate,
      totalGrossCommission: techGrossCommission,
      totalSmDeduction: techSmDeduction,
      totalNetCommission: techNetCommission,
      cmOptionA,
      cmOptionB,
      cmSelectedOption,
    });

    grandTotalGross += techGrossCommission;
    grandTotalSmDeduction += techSmDeduction;
    grandTotalNet += techNetCommission;
  }

  // Sort: CM first, then by net commission descending
  entries.sort((a, b) => {
    if (a.isChiefMechanic && !b.isChiefMechanic) return -1;
    if (!a.isChiefMechanic && b.isChiefMechanic) return 1;
    return b.totalNetCommission - a.totalNetCommission;
  });

  return {
    entries,
    unassignedLabor,
    totalMechanicalLabor,
    grandTotalGross,
    grandTotalSmDeduction,
    grandTotalNet,
    smPayout: grandTotalSmDeduction,
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
  // Prevent duplicate periods
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
  const serviceManagerId = await getSettingValue<string>("commission_service_manager_id", "");

  const period = await prisma.commissionPeriod.create({
    data: {
      periodStart,
      periodEnd,
      status: "DRAFT",
      totalMechanicalLabor: preview.totalMechanicalLabor,
      totalGrossCommission: preview.grandTotalGross,
      totalSmDeduction: preview.grandTotalSmDeduction,
      totalNetCommission: preview.grandTotalNet,
      smPayout: preview.smPayout,
      serviceManagerId: serviceManagerId || null,
      createdBy,
      entries: {
        create: preview.entries.flatMap((tech) =>
          tech.jobs.map((job) => ({
            userId: tech.user.id,
            jobOrderId: job.jobOrderId,
            taskId: job.taskId ?? null,
            laborBilled: job.laborBilled,
            commissionRate: job.commissionRate,
            grossCommission: job.grossCommission,
            smDeduction: job.smDeduction,
            netCommission: job.netCommission,
            cmOptionA: tech.cmOptionA ?? null,
            cmOptionB: tech.cmOptionB ?? null,
            cmSelectedOption: tech.cmSelectedOption ?? null,
          }))
        ),
      },
    },
    include: { entries: true },
  });

  return period;
}

export async function finalizeCommissionPeriod(periodId: string, userId: string) {
  const period = await prisma.commissionPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error("Commission period not found");
  if (period.status !== "DRAFT") throw new Error("Can only finalize DRAFT periods");

  return prisma.commissionPeriod.update({
    where: { id: periodId },
    data: { status: "FINALIZED", finalizedBy: userId, finalizedAt: new Date() },
  });
}

export async function markCommissionPaid(periodId: string, userId: string) {
  const period = await prisma.commissionPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error("Commission period not found");
  if (period.status !== "FINALIZED") throw new Error("Can only mark FINALIZED periods as paid");

  return prisma.commissionPeriod.update({
    where: { id: periodId },
    data: { status: "PAID", paidBy: userId, paidAt: new Date() },
  });
}

export async function getCommissionPeriods(options?: { status?: string; limit?: number }) {
  return prisma.commissionPeriod.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { periodStart: "desc" },
    take: options?.limit ?? 50,
    include: { _count: { select: { entries: true } } },
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
      totalGrossCommission: number;
      totalSmDeduction: number;
      totalNetCommission: number;
      commissionRate: number;
      cmOptionA: number | null;
      cmOptionB: number | null;
      cmSelectedOption: string | null;
    }
  >();

  for (const entry of period.entries) {
    const existing = techMap.get(entry.userId);
    if (existing) {
      existing.entries.push(entry);
      existing.totalLaborBilled += entry.laborBilled;
      existing.totalGrossCommission += entry.grossCommission;
      existing.totalSmDeduction += entry.smDeduction;
      existing.totalNetCommission += entry.netCommission;
    } else {
      techMap.set(entry.userId, {
        user: entry.user,
        entries: [entry],
        totalLaborBilled: entry.laborBilled,
        totalGrossCommission: entry.grossCommission,
        totalSmDeduction: entry.smDeduction,
        totalNetCommission: entry.netCommission,
        commissionRate: entry.commissionRate,
        cmOptionA: entry.cmOptionA,
        cmOptionB: entry.cmOptionB,
        cmSelectedOption: entry.cmSelectedOption,
      });
    }
  }

  return {
    ...period,
    techBreakdown: Array.from(techMap.values()).sort(
      (a, b) => b.totalNetCommission - a.totalNetCommission
    ),
  };
}

// ============================================================================
// Frontliner — Technician Commission View
// ============================================================================

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
  const thisWeekEntry = thisWeekPreview.entries.find((e) => e.user.id === userId);

  // Last week: check for saved period first
  let lastWeekAmount = 0;
  let lastWeekJobs = 0;
  let lastWeekStatus: string | null = null;

  const lastWeekPeriod = await prisma.commissionPeriod.findFirst({
    where: {
      periodStart: { lte: lastWeekEnd },
      periodEnd: { gte: lastWeekStart },
    },
    include: { entries: { where: { userId } } },
    orderBy: { createdAt: "desc" },
  });

  if (lastWeekPeriod) {
    lastWeekAmount = lastWeekPeriod.entries.reduce((s, e) => s + e.netCommission, 0);
    lastWeekJobs = lastWeekPeriod.entries.length;
    lastWeekStatus = lastWeekPeriod.status;
  } else {
    const lastWeekPreview = await calculateCommission(lastWeekStart, lastWeekEnd);
    const entry = lastWeekPreview.entries.find((e) => e.user.id === userId);
    lastWeekAmount = entry?.totalNetCommission ?? 0;
    lastWeekJobs = entry?.jobs.length ?? 0;
  }

  return {
    thisWeek: {
      amount: thisWeekEntry?.totalNetCommission ?? 0,
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
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

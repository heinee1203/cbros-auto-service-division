import { prisma } from "@/lib/prisma";

// ============================================================================
// BAY FUNCTIONS
// ============================================================================

export async function getBays() {
  return prisma.bay.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      assignments: {
        where: { endDate: null },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              vehicle: { select: { plateNumber: true, make: true, model: true } },
            },
          },
        },
      },
    },
  });
}

export async function createBay(data: {
  name: string;
  type: string;
  capacity?: number;
  color?: string | null;
  notes?: string | null;
  sortOrder?: number;
}) {
  return prisma.bay.create({ data });
}

export async function updateBay(id: string, data: {
  name?: string;
  type?: string;
  capacity?: number;
  color?: string | null;
  notes?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  return prisma.bay.update({ where: { id }, data });
}

export async function deleteBay(id: string) {
  const activeAssignments = await prisma.bayAssignment.count({
    where: { bayId: id, endDate: null },
  });
  if (activeAssignments > 0) {
    throw new Error("Cannot delete bay with active vehicle assignments");
  }
  return prisma.bay.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function assignJobToBay(data: {
  jobOrderId: string;
  bayId: string;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
  createdBy: string;
}) {
  const conflicts = await getConflicts(data.bayId, data.startDate, data.endDate ?? null);
  if (conflicts.length > 0) {
    throw new Error("Bay is already occupied during this time period");
  }

  await prisma.jobOrder.update({
    where: { id: data.jobOrderId },
    data: { assignedBayId: data.bayId },
  });

  return prisma.bayAssignment.create({ data });
}

export async function releaseFromBay(assignmentId: string) {
  const assignment = await prisma.bayAssignment.update({
    where: { id: assignmentId },
    data: { endDate: new Date() },
  });

  await prisma.jobOrder.update({
    where: { id: assignment.jobOrderId },
    data: { assignedBayId: null },
  });

  return assignment;
}

export async function getBayTimeline(startDate: Date, endDate: Date) {
  const bays = await prisma.bay.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      assignments: {
        where: {
          OR: [
            { startDate: { lte: endDate }, endDate: { gte: startDate } },
            { startDate: { lte: endDate }, endDate: null },
          ],
        },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              priority: true,
              customer: { select: { firstName: true, lastName: true } },
              vehicle: { select: { plateNumber: true, make: true, model: true, color: true } },
              primaryTechnician: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });
  return bays;
}

export async function getBayAvailability(bayId: string, startDate: Date, endDate: Date) {
  const assignments = await prisma.bayAssignment.findMany({
    where: {
      bayId,
      OR: [
        { startDate: { lte: endDate }, endDate: { gte: startDate } },
        { startDate: { lte: endDate }, endDate: null },
      ],
    },
    orderBy: { startDate: "asc" },
  });
  return assignments;
}

export async function getConflicts(bayId: string, startDate: Date, endDate: Date | null) {
  const effectiveEnd = endDate ?? new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  return prisma.bayAssignment.findMany({
    where: {
      bayId,
      OR: [
        { startDate: { lt: effectiveEnd }, endDate: { gt: startDate } },
        { startDate: { lt: effectiveEnd }, endDate: null },
      ],
    },
  });
}

// ============================================================================
// APPOINTMENT FUNCTIONS
// ============================================================================

export async function createAppointment(data: {
  customerId: string;
  vehicleId?: string | null;
  estimateId?: string | null;
  type: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration?: number;
  notes?: string | null;
  createdBy: string;
}) {
  return prisma.appointment.create({
    data: {
      ...data,
      status: "SCHEDULED",
    },
  });
}

export async function getAppointments(
  startDate: Date,
  endDate: Date,
  filters?: { status?: string; type?: string }
) {
  const where: { scheduledDate: { gte: Date; lte: Date }; deletedAt: null; status?: string; type?: string } = {
    scheduledDate: { gte: startDate, lte: endDate },
    deletedAt: null,
  };
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  return prisma.appointment.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, company: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true } },
      estimate: { select: { id: true, requestNumber: true, status: true } },
      createdByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
  });
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, company: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true } },
      estimate: { select: { id: true, requestNumber: true, status: true } },
    },
  });
}

export async function updateAppointment(id: string, data: {
  customerId?: string;
  vehicleId?: string | null;
  estimateId?: string | null;
  type?: string;
  scheduledDate?: Date;
  scheduledTime?: string;
  duration?: number;
  notes?: string | null;
}) {
  return prisma.appointment.update({ where: { id }, data });
}

export async function updateAppointmentStatus(id: string, status: string, notes?: string | null) {
  const updateData: { status: string; notes?: string | null } = { status };
  if (notes !== undefined) updateData.notes = notes;
  return prisma.appointment.update({ where: { id }, data: updateData });
}

export async function cancelAppointment(id: string, reason?: string) {
  return prisma.appointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      notes: reason ? `Cancelled: ${reason}` : undefined,
    },
  });
}

export async function getAppointmentsByDate(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return getAppointments(startOfDay, endOfDay);
}

// ============================================================================
// TECHNICIAN SCHEDULING FUNCTIONS
// ============================================================================

export async function getTechnicianSchedule(techId: string, startDate: Date, endDate: Date) {
  const tasks = await prisma.task.findMany({
    where: {
      assignedTechnicianId: techId,
      deletedAt: null,
      jobOrder: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "RELEASED"] },
      },
    },
    include: {
      jobOrder: {
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
          priority: true,
          scheduledStartDate: true,
          scheduledEndDate: true,
          vehicle: { select: { plateNumber: true, make: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      technicianId: techId,
      clockIn: { gte: startDate, lte: endDate },
    },
    orderBy: { clockIn: "asc" },
  });

  return { tasks, timeEntries };
}

export async function getAllTechSchedules(startDate: Date, endDate: Date) {
  const techs = await prisma.user.findMany({
    where: {
      role: { in: ["TECHNICIAN", "QC_INSPECTOR"] },
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workSchedule: true,
      maxConcurrentJobs: true,
      assignedTasks: {
        where: {
          deletedAt: null,
          jobOrder: {
            deletedAt: null,
            status: { notIn: ["CANCELLED", "RELEASED"] },
          },
        },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              priority: true,
              scheduledStartDate: true,
              scheduledEndDate: true,
              vehicle: { select: { plateNumber: true, make: true, model: true } },
            },
          },
        },
      },
      timeEntries: {
        where: {
          clockIn: { gte: startDate, lte: endDate },
        },
        orderBy: { clockIn: "asc" },
      },
    },
    orderBy: [{ firstName: "asc" }],
  });
  return techs;
}

export async function getUpcomingPickUpsByCustomerIds(customerIds: string[]) {
  if (customerIds.length === 0) return [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return prisma.appointment.findMany({
    where: {
      customerId: { in: customerIds },
      type: "PICK_UP",
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      scheduledDate: { gte: now },
      deletedAt: null,
    },
    select: {
      id: true,
      customerId: true,
      scheduledDate: true,
      scheduledTime: true,
    },
    orderBy: { scheduledDate: "asc" },
  });
}

export async function getShopCapacity(startDate: Date, endDate: Date) {
  const bays = await prisma.bay.count({ where: { isActive: true, deletedAt: null } });
  const techs = await prisma.user.count({
    where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
  });

  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const hoursPerDay = 8;

  return {
    totalBays: bays,
    totalTechs: techs,
    bayHoursAvailable: bays * dayCount * hoursPerDay,
    techHoursAvailable: techs * dayCount * hoursPerDay,
  };
}

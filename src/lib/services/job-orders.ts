import { prisma } from "@/lib/prisma";

export interface JobOrderListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// 1. getJobOrders — paginated list
// ---------------------------------------------------------------------------
export async function getJobOrders({
  page = 1,
  pageSize = 25,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: JobOrderListParams = {}) {
  const where: Record<string, unknown> = {};

  if (search) {
    const normalizedPlate = search.replace(/[\s-]/g, "").toUpperCase();
    where.OR = [
      { jobOrderNumber: { contains: search } },
      {
        customer: {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
        },
      },
      { vehicle: { plateNumber: { contains: normalizedPlate } } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  const orderByMap: Record<string, Record<string, string>> = {
    jobOrderNumber: { jobOrderNumber: sortOrder },
    status: { status: sortOrder },
    createdAt: { createdAt: sortOrder },
    targetCompletionDate: { targetCompletionDate: sortOrder },
  };
  const orderBy = orderByMap[sortBy] || { createdAt: "desc" };

  const [jobOrders, total] = await Promise.all([
    prisma.jobOrder.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
          },
        },
        primaryTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { tasks: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: {
            estimatedHours: true,
            actualHours: true,
          },
        },
      },
    }),
    prisma.jobOrder.count({ where }),
  ]);

  const enriched = jobOrders.map((jo) => {
    const totalEstimatedHours = jo.tasks.reduce(
      (sum, t) => sum + t.estimatedHours,
      0
    );
    const totalActualHours = jo.tasks.reduce(
      (sum, t) => sum + t.actualHours,
      0
    );
    const efficiency =
      totalEstimatedHours > 0 && totalActualHours > 0
        ? Math.round((totalEstimatedHours / totalActualHours) * 100)
        : null;
    const daysInShop = Math.ceil(
      (Date.now() - new Date(jo.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const isOverdue =
      jo.targetCompletionDate &&
      new Date(jo.targetCompletionDate) < new Date() &&
      jo.status !== "RELEASED" &&
      jo.status !== "CANCELLED";

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tasks, ...rest } = jo;
    return {
      ...rest,
      totalEstimatedHours,
      totalActualHours,
      efficiency,
      daysInShop,
      isOverdue: !!isOverdue,
    };
  });

  return {
    jobOrders: enriched,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// 2. getJobOrderDetail — full detail with all relations
// ---------------------------------------------------------------------------
export async function getJobOrderDetail(id: string) {
  const jobOrder = await prisma.jobOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      primaryTechnician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      intakeRecord: {
        include: {
          damageMarks: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          belongings: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      estimates: {
        where: { deletedAt: null },
        include: {
          versions: {
            where: { deletedAt: null },
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              lineItems: {
                where: { deletedAt: null },
                orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
              },
            },
          },
          estimateRequest: {
            select: {
              id: true,
              requestNumber: true,
              requestedCategories: true,
              customerConcern: true,
            },
          },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          assignedTechnician: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!jobOrder) return null;

  // Fetch intake photos separately (polymorphic)
  let photos: unknown[] = [];
  if (jobOrder.intakeRecord) {
    photos = await prisma.photo.findMany({
      where: {
        entityType: "INTAKE",
        entityId: jobOrder.intakeRecord.id,
        deletedAt: null,
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  return { ...jobOrder, photos };
}

// ---------------------------------------------------------------------------
// 3. updateJobOrderStatus
// ---------------------------------------------------------------------------
export async function updateJobOrderStatus(
  id: string,
  newStatus: string,
  userId?: string
) {
  return prisma.jobOrder.update({
    where: { id },
    data: {
      status: newStatus,
      updatedBy: userId,
      ...(newStatus === "RELEASED" && { actualCompletionDate: new Date() }),
    },
  });
}

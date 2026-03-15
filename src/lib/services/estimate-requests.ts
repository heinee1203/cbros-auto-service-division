import { prisma } from "@/lib/prisma";
import type { EstimateRequestInput } from "@/lib/validators";

export interface EstimateRequestListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getEstimateRequests({
  page = 1,
  pageSize = 25,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: EstimateRequestListParams = {}) {
  const where: Record<string, unknown> = {};

  if (search) {
    const normalizedPlate = search.replace(/[\s-]/g, "").toUpperCase();
    where.OR = [
      { requestNumber: { contains: search } },
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

  const orderBy: Record<string, string> = {};
  const validSortFields = [
    "requestNumber",
    "status",
    "createdAt",
    "updatedAt",
  ];
  if (validSortFields.includes(sortBy)) {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.createdAt = "desc";
  }

  const [requests, total] = await Promise.all([
    prisma.estimateRequest.findMany({
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
            color: true,
          },
        },
        _count: { select: { estimates: true } },
        estimates: {
          where: { deletedAt: null },
          take: 1,
          include: {
            versions: {
              where: { deletedAt: null },
              orderBy: { versionNumber: "desc" as const },
              take: 1,
              select: { grandTotal: true, versionNumber: true, approvalToken: true },
            },
          },
        },
      },
    }),
    prisma.estimateRequest.count({ where }),
  ]);

  return {
    requests,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getEstimateRequestById(id: string) {
  return prisma.estimateRequest.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: {
        include: {
          jobOrders: {
            where: { deletedAt: null },
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      estimates: {
        where: { deletedAt: null },
        include: {
          versions: {
            where: { deletedAt: null },
            orderBy: { versionNumber: "desc" },
            include: {
              lineItems: {
                where: { deletedAt: null },
                orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
              },
            },
          },
        },
      },
    },
  });
}

export async function createEstimateRequest(
  data: EstimateRequestInput,
  requestNumber: string,
  userId?: string
) {
  return prisma.estimateRequest.create({
    data: {
      requestNumber,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      customerConcern: data.customerConcern,
      requestedCategories: JSON.stringify(data.requestedCategories),
      isInsuranceClaim: data.isInsuranceClaim,
      claimNumber: data.claimNumber || null,
      adjusterName: data.adjusterName || null,
      adjusterContact: data.adjusterContact || null,
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

export async function updateEstimateRequestStatus(
  id: string,
  status: string,
  userId?: string
) {
  return prisma.estimateRequest.update({
    where: { id },
    data: {
      status,
      updatedBy: userId,
    },
  });
}

export async function getNextEstimateSequence(): Promise<number> {
  const key = "next_est_sequence";

  const setting = await prisma.setting.findUnique({
    where: { key },
  });

  const current = setting ? parseInt(setting.value, 10) || 1 : 1;
  const next = current + 1;

  await prisma.setting.upsert({
    where: { key },
    update: { value: String(next) },
    create: {
      key,
      value: String(next),
      category: "sequences",
      description: "Next estimate request sequence number",
    },
  });

  return current;
}

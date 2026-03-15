import { prisma } from "@/lib/prisma";
import type { VehicleInput } from "@/lib/validators";

export interface VehicleListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  make?: string;
  bodyType?: string;
  hasActiveJob?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getVehicles({
  page = 1,
  pageSize = 25,
  search,
  make,
  bodyType,
  sortBy = "updatedAt",
  sortOrder = "desc",
}: VehicleListParams = {}) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { plateNumber: { contains: search.toUpperCase().replace(/[\s-]/g, "") } },
      { make: { contains: search } },
      { model: { contains: search } },
      {
        customer: {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
        },
      },
    ];
  }

  if (make) where.make = make;
  if (bodyType) where.bodyType = bodyType;

  const orderBy: Record<string, string> = {};
  const validSortFields = [
    "plateNumber",
    "make",
    "model",
    "year",
    "updatedAt",
    "createdAt",
  ];
  if (validSortFields.includes(sortBy)) {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.updatedAt = "desc";
  }

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { jobOrders: true } },
        jobOrders: {
          where: {
            deletedAt: null,
            status: {
              notIn: ["RELEASED", "CANCELLED"],
            },
          },
          select: { id: true, jobOrderNumber: true, status: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    vehicles,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getVehicleById(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      customer: true,
      jobOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          tasks: {
            where: { deletedAt: null },
            select: { name: true },
          },
        },
      },
    },
  });
}

export async function createVehicle(data: VehicleInput, userId?: string) {
  return prisma.vehicle.create({
    data: {
      customerId: data.customerId,
      plateNumber: data.plateNumber,
      make: data.make,
      model: data.model,
      year: data.year || null,
      color: data.color,
      colorCode: data.colorCode || null,
      vin: data.vin || null,
      engineType: data.engineType || null,
      bodyType: data.bodyType,
      insuranceCompany: data.insuranceCompany || null,
      policyNumber: data.policyNumber || null,
      notes: data.notes || null,
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

export async function updateVehicle(
  id: string,
  data: Partial<VehicleInput>,
  userId?: string
) {
  return prisma.vehicle.update({
    where: { id },
    data: {
      ...(data.customerId !== undefined && { customerId: data.customerId }),
      ...(data.plateNumber !== undefined && { plateNumber: data.plateNumber }),
      ...(data.make !== undefined && { make: data.make }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.year !== undefined && { year: data.year || null }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.colorCode !== undefined && { colorCode: data.colorCode || null }),
      ...(data.vin !== undefined && { vin: data.vin || null }),
      ...(data.engineType !== undefined && {
        engineType: data.engineType || null,
      }),
      ...(data.bodyType !== undefined && { bodyType: data.bodyType }),
      ...(data.insuranceCompany !== undefined && {
        insuranceCompany: data.insuranceCompany || null,
      }),
      ...(data.policyNumber !== undefined && {
        policyNumber: data.policyNumber || null,
      }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      updatedBy: userId,
    },
  });
}

export async function softDeleteVehicle(id: string, userId?: string) {
  return prisma.vehicle.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
}

export async function findVehicleByPlate(
  plateNumber: string,
  excludeId?: string
) {
  const cleaned = plateNumber.replace(/[\s-]/g, "").toUpperCase();
  const where: Record<string, unknown> = { plateNumber: cleaned };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return prisma.vehicle.findFirst({
    where,
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function getDistinctMakes() {
  const results = await prisma.vehicle.findMany({
    where: { deletedAt: null },
    select: { make: true },
    distinct: ["make"],
    orderBy: { make: "asc" },
  });
  return results.map((r) => r.make);
}

export async function getModelsForMake(make: string) {
  const results = await prisma.vehicle.findMany({
    where: { make, deletedAt: null },
    select: { model: true },
    distinct: ["model"],
    orderBy: { model: "asc" },
  });
  return results.map((r) => r.model);
}

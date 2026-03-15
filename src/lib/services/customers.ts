import { prisma } from "@/lib/prisma";
import type { CustomerInput } from "@/lib/validators";

export interface CustomerListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  tags?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getCustomers({
  page = 1,
  pageSize = 25,
  search,
  tags,
  sortBy = "lastVisit",
  sortOrder = "desc",
}: CustomerListParams = {}) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }

  if (tags && tags.length > 0) {
    // SQLite: tags stored as JSON string, filter using contains for each tag
    where.AND = tags.map((tag) => ({
      tags: { contains: tag },
    }));
  }

  const orderBy: Record<string, string> = {};
  const validSortFields = [
    "firstName",
    "lastName",
    "phone",
    "totalSpend",
    "jobCount",
    "lastVisit",
    "createdAt",
  ];
  if (validSortFields.includes(sortBy)) {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.lastVisit = "desc";
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { vehicles: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
      },
      jobOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          vehicle: { select: { plateNumber: true, make: true, model: true } },
        },
      },
      estimateRequests: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          vehicle: { select: { plateNumber: true } },
        },
      },
    },
  });
}

export async function createCustomer(data: CustomerInput, userId?: string) {
  return prisma.customer.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone.replace(/\D/g, ""),
      phoneAlt: data.phoneAlt || null,
      email: data.email || null,
      address: data.address || null,
      company: data.company || null,
      referredBy: data.referredBy || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      firstVisit: new Date(),
      lastVisit: new Date(),
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

export async function updateCustomer(
  id: string,
  data: Partial<CustomerInput>,
  userId?: string
) {
  return prisma.customer.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone.replace(/\D/g, "") }),
      ...(data.phoneAlt !== undefined && { phoneAlt: data.phoneAlt || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.company !== undefined && { company: data.company || null }),
      ...(data.referredBy !== undefined && {
        referredBy: data.referredBy || null,
      }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      updatedBy: userId,
    },
  });
}

export async function softDeleteCustomer(id: string, userId?: string) {
  return prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
}

export async function findCustomerByPhone(phone: string, excludeId?: string) {
  const digits = phone.replace(/\D/g, "");
  const where: Record<string, unknown> = { phone: digits };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return prisma.customer.findFirst({ where });
}

export async function searchCustomersForSelect(query: string) {
  if (!query || query.length < 2) return [];
  return prisma.customer.findMany({
    where: {
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { phone: { contains: query } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
    take: 10,
  });
}

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export interface UserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  division?: string;
  phone?: string;
  email?: string;
  pin?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: string;
  division?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export async function getUsers({
  page = 1,
  pageSize = 25,
  search,
}: UserListParams = {}) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { username: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { firstName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        division: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      division: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createUser(input: CreateUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const pinHash =
    input.pin && input.pin.length > 0
      ? await bcrypt.hash(input.pin, 10)
      : null;

  return prisma.user.create({
    data: {
      username: input.username,
      passwordHash,
      pinHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      division: input.division || "ALL",
      phone: input.phone || null,
      email: input.email || null,
    },
  });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.division !== undefined && { division: input.division }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
}

export async function deactivateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function resetPassword(id: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
}

export async function resetPin(id: string, newPin: string) {
  const pinHash = await bcrypt.hash(newPin, 10);
  return prisma.user.update({
    where: { id },
    data: { pinHash },
  });
}

export async function findUserByUsername(
  username: string,
  excludeId?: string
) {
  const where: Record<string, unknown> = { username };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return prisma.user.findFirst({ where });
}

"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { userCreateSchema, userUpdateSchema } from "@/lib/validators";
import {
  createUser,
  updateUser,
  deactivateUser,
  resetPassword,
  resetPin,
  findUserByUsername,
} from "@/lib/services/users";
import type { UserRole } from "@/types/enums";
import { z } from "zod";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

export async function createUserAction(
  input: z.infer<typeof userCreateSchema>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "users:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check username uniqueness
  const existing = await findUserByUsername(parsed.data.username);
  if (existing) {
    return {
      success: false,
      error: `Username "${parsed.data.username}" is already taken`,
    };
  }

  const user = await createUser({
    username: parsed.data.username,
    password: parsed.data.password,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    role: parsed.data.role,
    phone: parsed.data.phone || undefined,
    email: parsed.data.email || undefined,
    pin: parsed.data.pin || undefined,
  });

  revalidatePath("/settings/users");
  return { success: true, data: { id: user.id } };
}

export async function updateUserAction(
  id: string,
  input: z.infer<typeof userUpdateSchema>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "users:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await updateUser(id, {
    ...(parsed.data.firstName !== undefined && {
      firstName: parsed.data.firstName,
    }),
    ...(parsed.data.lastName !== undefined && {
      lastName: parsed.data.lastName,
    }),
    ...(parsed.data.role !== undefined && { role: parsed.data.role }),
    ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
    ...(parsed.data.email !== undefined && {
      email: parsed.data.email || undefined,
    }),
    ...(parsed.data.isActive !== undefined && {
      isActive: parsed.data.isActive,
    }),
  });

  revalidatePath("/settings/users");
  return { success: true };
}

export async function deactivateUserAction(
  id: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "users:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  // Prevent self-deactivation
  if (session.user.id === id) {
    return { success: false, error: "You cannot deactivate your own account" };
  }

  await deactivateUser(id);
  revalidatePath("/settings/users");
  return { success: true };
}

export async function resetPasswordAction(
  id: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "users:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  if (!newPassword || newPassword.length < 6) {
    return {
      success: false,
      error: "Password must be at least 6 characters",
    };
  }

  await resetPassword(id, newPassword);
  revalidatePath("/settings/users");
  return { success: true };
}

export async function resetPinAction(
  id: string,
  newPin: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "users:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    return {
      success: false,
      error: "PIN must be 4-6 digits",
    };
  }

  await resetPin(id, newPin);
  revalidatePath("/settings/users");
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { customerSchema, type CustomerInput } from "@/lib/validators";
import {
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  findCustomerByPhone,
} from "@/lib/services/customers";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  warning?: string;
};

export async function createCustomerAction(
  input: CustomerInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check for duplicate phone
  const existing = await findCustomerByPhone(parsed.data.phone);
  if (existing) {
    return {
      success: false,
      error: `A customer with this phone number already exists: ${existing.firstName} ${existing.lastName}`,
      data: { existingId: existing.id },
    };
  }

  const customer = await createCustomer(parsed.data, session.user.id);
  revalidatePath("/customers");
  return { success: true, data: { id: customer.id } };
}

export async function updateCustomerAction(
  id: string,
  input: Partial<CustomerInput>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const partialSchema = customerSchema.partial();
  const parsed = partialSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check for duplicate phone if phone is being changed
  if (parsed.data.phone) {
    const existing = await findCustomerByPhone(parsed.data.phone, id);
    if (existing) {
      return {
        success: false,
        error: `A customer with this phone number already exists: ${existing.firstName} ${existing.lastName}`,
        data: { existingId: existing.id },
      };
    }
  }

  await updateCustomer(id, parsed.data, session.user.id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

export async function toggleSmsOptOutAction(
  customerId: string,
  smsOptOut: boolean
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await updateCustomer(customerId, { smsOptOut } as any, session.user.id);
  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await softDeleteCustomer(id, session.user.id);
  revalidatePath("/customers");
  return { success: true };
}

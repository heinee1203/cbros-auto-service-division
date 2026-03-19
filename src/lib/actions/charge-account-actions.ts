"use server";

import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createChargeAccount,
  updateChargeAccount,
  recalculateAccountBalance,
} from "@/lib/services/charge-accounts";

export async function createChargeAccountAction(input: {
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  tinNumber?: string;
  creditLimit?: number;
  creditTerms?: string;
  notes?: string;
}) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const account = await createChargeAccount({
      ...input,
      createdBy: session.user.id,
    });
    revalidatePath("/charge-accounts");
    revalidatePath("/invoices");
    return { success: true, data: account };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create account",
    };
  }
}

export async function updateChargeAccountAction(
  id: string,
  input: {
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    tinNumber?: string;
    creditLimit?: number;
    creditTerms?: string;
    notes?: string;
    isActive?: boolean;
  }
) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const account = await updateChargeAccount(id, input);
    revalidatePath("/charge-accounts");
    return { success: true, data: account };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update account",
    };
  }
}

export async function recalculateBalanceAction(accountId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const balance = await recalculateAccountBalance(accountId);
    return { success: true, data: { balance } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to recalculate",
    };
  }
}

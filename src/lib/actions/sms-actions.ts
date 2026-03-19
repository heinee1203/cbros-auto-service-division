"use server";

import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { sendTestSms } from "@/lib/services/sms";
import { getBalance } from "@/lib/services/sms-provider";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

export async function sendTestSmsAction(
  phone: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "settings:manage")) {
    return { success: false, error: "Permission denied" };
  }

  const result = await sendTestSms(phone);
  if (result.sent) {
    return { success: true };
  }
  return { success: false, error: result.error || "Send failed" };
}

export async function getSmsBalanceAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "settings:manage")) {
    return { success: false, error: "Permission denied" };
  }

  const result = await getBalance();
  if (result.error) {
    return { success: false, error: result.error };
  }
  return { success: true, data: { balance: result.balance } };
}

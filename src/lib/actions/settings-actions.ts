"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { settingUpdateSchema, settingsBatchSchema } from "@/lib/validators";
import { updateSetting, updateSettings } from "@/lib/services/settings";
import type { UserRole } from "@/types/enums";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

export async function updateSettingAction(
  key: string,
  value: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "settings:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = settingUpdateSchema.safeParse({ key, value });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await updateSetting(parsed.data.key, parsed.data.value, session.user.id);
  revalidatePath("/settings");
  return { success: true };
}

export async function updateSettingsBatchAction(
  updates: Array<{ key: string; value: string }>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!can(session.user.role as UserRole, "settings:manage")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = settingsBatchSchema.safeParse({ updates });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await updateSettings(parsed.data.updates, session.user.id);
  revalidatePath("/settings");
  return { success: true };
}

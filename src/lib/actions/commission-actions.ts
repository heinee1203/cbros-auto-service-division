"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import {
  commissionRateSchema,
  commissionPeriodSchema,
} from "@/lib/validators";
import {
  setCommissionRate,
  calculateCommission,
  createCommissionPeriod,
  finalizeCommissionPeriod,
  markCommissionPaid,
} from "@/lib/services/commissions";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

export async function setCommissionRateAction(
  input: { userId: string; rate: number; notes?: string | null }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "commissions:manage")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = commissionRateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await setCommissionRate(
    parsed.data.userId,
    parsed.data.rate,
    session.user.id,
    parsed.data.notes
  );

  revalidatePath("/commissions");
  revalidatePath("/settings");
  return { success: true };
}

export async function previewCommissionAction(
  input: { periodStart: string; periodEnd: string }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "commissions:view")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = commissionPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const preview = await calculateCommission(
    new Date(parsed.data.periodStart),
    new Date(parsed.data.periodEnd)
  );

  // Serialize dates for client
  return {
    success: true,
    data: {
      entries: preview.entries.map((e) => ({
        ...e,
        jobs: e.jobs.map((j) => ({
          ...j,
          completedDate: j.completedDate.toISOString(),
        })),
      })),
      unassignedLabor: preview.unassignedLabor,
      totalMechanicalLabor: preview.totalMechanicalLabor,
      grandTotalGross: preview.grandTotalGross,
      grandTotalSmDeduction: preview.grandTotalSmDeduction,
      grandTotalNet: preview.grandTotalNet,
      smPayout: preview.smPayout,
      periodStart: preview.periodStart.toISOString(),
      periodEnd: preview.periodEnd.toISOString(),
    },
  };
}

export async function createCommissionPeriodAction(
  input: { periodStart: string; periodEnd: string }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "commissions:manage")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = commissionPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const period = await createCommissionPeriod(
      new Date(parsed.data.periodStart),
      new Date(parsed.data.periodEnd),
      session.user.id
    );
    revalidatePath("/commissions");
    return { success: true, data: { id: period.id } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function finalizeCommissionPeriodAction(
  periodId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "commissions:manage")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await finalizeCommissionPeriod(periodId, session.user.id);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  revalidatePath("/commissions");
  return { success: true };
}

export async function markCommissionPaidAction(
  periodId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "commissions:manage")) {
    return { success: false, error: "Permission denied" };
  }

  try {
    await markCommissionPaid(periodId, session.user.id);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  revalidatePath("/commissions");
  return { success: true };
}

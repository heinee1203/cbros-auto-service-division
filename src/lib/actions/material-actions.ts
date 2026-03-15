"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { materialUsageSchema } from "@/lib/validators";
import {
  logMaterial,
  updateMaterial,
  deleteMaterial,
} from "@/lib/services/materials";
import type { ActionResult } from "@/lib/actions/estimate-actions";

// ---------------------------------------------------------------------------
// logMaterialAction
// ---------------------------------------------------------------------------
export async function logMaterialAction(
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = materialUsageSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const material = await logMaterial(jobOrderId, parsed.data, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true, data: { id: material.id } };
  } catch (err) {
    console.error("logMaterialAction error:", err);
    return { success: false, error: "Failed to log material" };
  }
}

// ---------------------------------------------------------------------------
// updateMaterialAction
// ---------------------------------------------------------------------------
export async function updateMaterialAction(
  id: string,
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = materialUsageSchema.partial().safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await updateMaterial(id, parsed.data, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    console.error("updateMaterialAction error:", err);
    return { success: false, error: "Failed to update material" };
  }
}

// ---------------------------------------------------------------------------
// deleteMaterialAction
// ---------------------------------------------------------------------------
export async function deleteMaterialAction(
  id: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await deleteMaterial(id, session.user.id);
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    console.error("deleteMaterialAction error:", err);
    return { success: false, error: "Failed to delete material" };
  }
}

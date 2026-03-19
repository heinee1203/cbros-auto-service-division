"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createEstimateFromServices,
  type CreateEstimateFromServicesResult,
} from "@/lib/services/estimate-from-services";
import {
  generateApprovalToken,
  getEstimateVersionById,
} from "@/lib/services/estimates";

// ---------------------------------------------------------------------------
// 1. createEstimateFromServicesAction
// ---------------------------------------------------------------------------
export async function createEstimateFromServicesAction(input: {
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  jobOrderId?: string;
  customerConcern?: string;
  vehiclePresent?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  data?: { estimateRequestId: string; estimateId: string; estimateVersionId: string };
}> {
  const session = await getSession();
  if (!session?.user)
    return { success: false, error: "Not authenticated" };

  try {
    const result: CreateEstimateFromServicesResult =
      await createEstimateFromServices({
        ...input,
        userId: session.user.id,
      });

    revalidatePath("/frontliner/jobs");
    revalidatePath("/frontliner/estimate");
    revalidatePath("/estimates");

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create estimate from services",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. generateApprovalTokenAction
// ---------------------------------------------------------------------------
export async function generateApprovalTokenAction(
  versionId: string
): Promise<{ success: boolean; error?: string; data?: { token: string } }> {
  const session = await getSession();
  if (!session?.user)
    return { success: false, error: "Not authenticated" };

  try {
    const token = await generateApprovalToken(versionId, session.user.id);

    return { success: true, data: { token } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate approval token",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. getEstimateVersionAction
// ---------------------------------------------------------------------------
export async function getEstimateVersionAction(
  versionId: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  const session = await getSession();
  if (!session?.user)
    return { success: false, error: "Not authenticated" };

  try {
    const version = await getEstimateVersionById(versionId);

    if (!version) {
      return { success: false, error: "Estimate version not found" };
    }

    return { success: true, data: version };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch estimate version",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. markVehiclePresentAction
// ---------------------------------------------------------------------------
export async function markVehiclePresentAction(estimateRequestId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    await prisma.estimateRequest.update({
      where: { id: estimateRequestId },
      data: { vehiclePresent: true },
    });
    revalidatePath("/schedule/registry");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { vehicleSchema, type VehicleInput } from "@/lib/validators";
import {
  createVehicle,
  updateVehicle,
  softDeleteVehicle,
  findVehicleByPlate,
} from "@/lib/services/vehicles";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

export async function createVehicleAction(
  input: VehicleInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check for duplicate plate number
  const existing = await findVehicleByPlate(parsed.data.plateNumber);
  if (existing) {
    return {
      success: false,
      error: `This plate number is already registered to ${existing.customer.firstName} ${existing.customer.lastName}'s ${existing.make} ${existing.model}.`,
      data: { existingId: existing.id },
    };
  }

  const vehicle = await createVehicle(parsed.data, session.user.id);
  revalidatePath("/vehicles");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true, data: { id: vehicle.id } };
}

export async function updateVehicleAction(
  id: string,
  input: Partial<VehicleInput>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const partialSchema = vehicleSchema.partial();
  const parsed = partialSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check for duplicate plate number if plate is being changed
  if (parsed.data.plateNumber) {
    const existing = await findVehicleByPlate(parsed.data.plateNumber, id);
    if (existing) {
      return {
        success: false,
        error: `This plate number is already registered to ${existing.customer.firstName} ${existing.customer.lastName}'s ${existing.make} ${existing.model}.`,
        data: { existingId: existing.id },
      };
    }
  }

  await updateVehicle(id, parsed.data, session.user.id);
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  return { success: true };
}

export async function deleteVehicleAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await softDeleteVehicle(id, session.user.id);
  revalidatePath("/vehicles");
  return { success: true };
}

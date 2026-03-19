import { prisma } from "@/lib/prisma";
import { getNextEstimateSequence } from "@/lib/services/estimate-requests";
import { recalculateVersionTotals } from "@/lib/services/estimates";

// ---------------------------------------------------------------------------
// createEstimateFromServices
// ---------------------------------------------------------------------------
// Creates the full estimate chain in one transaction:
// EstimateRequest → Estimate → EstimateVersion → pre-filled LABOR LineItems
// ---------------------------------------------------------------------------

export interface CreateEstimateFromServicesInput {
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  userId: string;
  jobOrderId?: string;
  customerConcern?: string;
}

export interface CreateEstimateFromServicesResult {
  estimateRequestId: string;
  estimateId: string;
  estimateVersionId: string;
}

export async function createEstimateFromServices(
  input: CreateEstimateFromServicesInput
): Promise<CreateEstimateFromServicesResult> {
  const {
    customerId,
    vehicleId,
    serviceIds,
    userId,
    jobOrderId,
    customerConcern,
  } = input;

  // 1. Fetch selected services
  const services = await prisma.serviceCatalog.findMany({
    where: {
      id: { in: serviceIds },
      isActive: true,
      deletedAt: null,
    },
  });

  if (services.length === 0) {
    throw new Error("No valid active services found for the provided IDs.");
  }

  // 2. Derive categories
  const categories = Array.from(new Set(services.map((s) => s.category)));

  // 3. Get next sequence number (must be outside transaction — does its own upsert)
  const sequence = await getNextEstimateSequence();
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("");
  const requestNumber = `EST-${dateStr}-${String(sequence).padStart(4, "0")}`;

  // 4. Build concern text
  const concern =
    customerConcern ||
    `Estimate for: ${services.map((s) => s.name).join(", ")}`;

  // 5–8. Create the full chain in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 5. Create EstimateRequest
    const estimateRequest = await tx.estimateRequest.create({
      data: {
        requestNumber,
        customerId,
        vehicleId,
        status: "PENDING_ESTIMATE",
        customerConcern: concern,
        requestedCategories: JSON.stringify(categories),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 6. Create Estimate
    const estimate = await tx.estimate.create({
      data: {
        estimateRequestId: estimateRequest.id,
        ...(jobOrderId ? { jobOrderId } : {}),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 7. Create EstimateVersion
    const estimateVersion = await tx.estimateVersion.create({
      data: {
        estimateId: estimate.id,
        versionNumber: 1,
        versionLabel: `${requestNumber}-v1`,
        vatRate: 12,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 8. Create LABOR line items for each service (flat fee pricing)
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const hours = service.defaultEstimatedHours || 1;
      const rate = service.defaultLaborRate || 0;
      // Flat fee = hourly rate × estimated hours (customer sees one price)
      const flatFee = Math.round(hours * rate);

      await tx.estimateLineItem.create({
        data: {
          estimateVersionId: estimateVersion.id,
          group: "LABOR",
          description: service.name,
          serviceCatalogId: service.id,
          quantity: 1,
          unit: "job",
          unitCost: flatFee,
          markup: 0,
          subtotal: flatFee,
          estimatedHours: hours, // preserved for internal tracking
          sortOrder: i * 10,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    return {
      estimateRequestId: estimateRequest.id,
      estimateId: estimate.id,
      estimateVersionId: estimateVersion.id,
    };
  });

  // 9. Recalculate totals outside transaction (uses prisma extensions)
  await recalculateVersionTotals(result.estimateVersionId);

  return result;
}

import { prisma } from "@/lib/prisma";
import { generateDocNumber } from "@/lib/utils";
import type { WalkInIntakeInput, QuickJobInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Helper: get next sequence number for a given key
// ---------------------------------------------------------------------------
async function getNextSequence(
  key: string,
  category = "numbering",
  description = ""
): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  const current = setting ? parseInt(setting.value, 10) || 1 : 1;

  await prisma.setting.upsert({
    where: { key },
    update: { value: String(current + 1) },
    create: {
      key,
      value: String(current + 1),
      category,
      description,
    },
  });

  return current;
}

// ---------------------------------------------------------------------------
// 1. createWalkInJob — Full walk-in intake pipeline
// ---------------------------------------------------------------------------
export async function createWalkInJob(
  input: WalkInIntakeInput,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    // -----------------------------------------------------------------------
    // Resolve or create Customer
    // -----------------------------------------------------------------------
    let customerId = input.customerId;
    if (!customerId && input.newCustomer) {
      const customer = await tx.customer.create({
        data: {
          firstName: input.newCustomer.firstName,
          lastName: input.newCustomer.lastName || "",
          phone: input.newCustomer.phone,
          email: input.newCustomer.email ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      customerId = customer.id;
    }
    if (!customerId) {
      throw new Error("Either customerId or newCustomer is required");
    }

    // -----------------------------------------------------------------------
    // Resolve or create Vehicle
    // -----------------------------------------------------------------------
    let vehicleId = input.vehicleId;
    if (!vehicleId && input.newVehicle) {
      const vehicle = await tx.vehicle.create({
        data: {
          customerId,
          plateNumber: input.newVehicle.plateNumber
            .replace(/[\s-]/g, "")
            .toUpperCase(),
          make: input.newVehicle.make,
          model: input.newVehicle.model,
          year: input.newVehicle.year ?? null,
          color: input.newVehicle.color || "TBD",
          vin: input.newVehicle.vin ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      vehicleId = vehicle.id;
    }
    if (!vehicleId) {
      throw new Error("Either vehicleId or newVehicle is required");
    }

    // -----------------------------------------------------------------------
    // Get selected services from ServiceCatalog
    // -----------------------------------------------------------------------
    const services = await tx.serviceCatalog.findMany({
      where: { id: { in: input.serviceIds }, isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });
    if (services.length === 0) {
      throw new Error("No valid services selected");
    }

    // -----------------------------------------------------------------------
    // Generate EST number + create EstimateRequest
    // -----------------------------------------------------------------------
    const estSequence = await getNextSequence(
      "next_est_sequence",
      "sequences",
      "Next estimate request sequence number"
    );
    const requestNumber = generateDocNumber("EST", estSequence);

    const categories = Array.from(
      new Set(services.map((s) => s.category))
    );

    const estimateRequest = await tx.estimateRequest.create({
      data: {
        requestNumber,
        customerId,
        vehicleId,
        status: "ESTIMATE_APPROVED",
        customerConcern: services.map((s) => s.name).join(", "),
        requestedCategories: JSON.stringify(categories),
        isInsuranceClaim: false,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // -----------------------------------------------------------------------
    // Create Estimate + EstimateVersion with line items
    // -----------------------------------------------------------------------
    const estimate = await tx.estimate.create({
      data: {
        estimateRequestId: estimateRequest.id,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Calculate totals from services
    let subtotalLabor = 0;
    const lineItemsData = services.map((svc, idx) => {
      const hours = svc.defaultEstimatedHours || 1;
      const rate = svc.defaultLaborRate || 0; // centavos per hour
      const amount = Math.round(hours * rate);
      subtotalLabor += amount;
      return {
        group: "LABOR" as const,
        description: svc.name,
        serviceCatalogId: svc.id,
        quantity: 1,
        unit: "job",
        unitCost: rate,
        markup: 0,
        subtotal: amount,
        estimatedHours: hours,
        sortOrder: idx,
        createdBy: userId,
        updatedBy: userId,
      };
    });

    const vatRate = 12.0;
    const vatAmount = Math.round(subtotalLabor * (vatRate / 100));
    const grandTotal = subtotalLabor + vatAmount;

    const versionLabel = `${requestNumber}-v1`;

    const estimateVersion = await tx.estimateVersion.create({
      data: {
        estimateId: estimate.id,
        versionNumber: 1,
        versionLabel,
        subtotalLabor,
        vatRate,
        vatAmount,
        grandTotal,
        isApproved: true,
        approvedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
        lineItems: {
          create: lineItemsData.map((item) => ({
            ...item,
            estimatedHours: item.estimatedHours ?? null,
          })),
        },
      },
    });

    // -----------------------------------------------------------------------
    // Generate JO number + create JobOrder
    // -----------------------------------------------------------------------
    const joSequence = await getNextSequence(
      "next_jo_sequence",
      "numbering",
      "Next job order sequence number"
    );
    const jobOrderNumber = generateDocNumber("JO", joSequence);

    const jobOrder = await tx.jobOrder.create({
      data: {
        jobOrderNumber,
        customerId,
        vehicleId,
        status: "CHECKED_IN",
        priority: input.priority || "NORMAL",
        primaryTechnicianId: input.primaryTechnicianId ?? null,
        assignedBayId: input.assignedBayId ?? null,
        notes: input.internalNotes ?? null,
        isInsuranceJob: false,
        incompleteIntake: input.intakeLevel < 3,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Link estimate to job order
    await tx.estimate.update({
      where: { id: estimate.id },
      data: { jobOrderId: jobOrder.id },
    });

    // -----------------------------------------------------------------------
    // Create IntakeRecord
    // -----------------------------------------------------------------------
    const intakeRecord = await tx.intakeRecord.create({
      data: {
        jobOrderId: jobOrder.id,
        odometerReading: input.odometerReading ?? null,
        fuelLevel: input.fuelLevel || "HALF",
        hasWarningLights: input.hasWarningLights || false,
        warningLightsNote: input.warningLightsNote ?? null,
        keysCount: input.keysCount ?? 1,
        customerSignature: input.customerSignature ?? null,
        customerSignedAt: input.customerSignature ? new Date() : null,
        advisorSignature: input.advisorSignature ?? null,
        advisorSignedAt: input.advisorSignature ? new Date() : null,
        advisorId: userId,
        checkedInAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // -----------------------------------------------------------------------
    // Create Tasks from services
    // -----------------------------------------------------------------------
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      await tx.task.create({
        data: {
          jobOrderId: jobOrder.id,
          serviceCatalogId: svc.id,
          name: svc.name,
          description: svc.description ?? null,
          status: "QUEUED",
          estimatedHours: svc.defaultEstimatedHours || 0,
          hourlyRate: svc.defaultLaborRate || 0,
          sortOrder: i,
          assignedTechnicianId: input.primaryTechnicianId ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    // -----------------------------------------------------------------------
    // Create BayAssignment if bay selected
    // -----------------------------------------------------------------------
    if (input.assignedBayId) {
      await tx.bayAssignment.create({
        data: {
          bayId: input.assignedBayId,
          jobOrderId: jobOrder.id,
          startDate: new Date(),
          createdBy: userId,
        },
      });
    }

    // -----------------------------------------------------------------------
    // Update Appointment status if linked
    // -----------------------------------------------------------------------
    if (input.appointmentId) {
      await tx.appointment.update({
        where: { id: input.appointmentId },
        data: { status: "COMPLETED" },
      });
    }

    // -----------------------------------------------------------------------
    // Log JobActivity
    // -----------------------------------------------------------------------
    await tx.jobActivity.create({
      data: {
        jobOrderId: jobOrder.id,
        type: "status_change",
        title: "Walk-in intake completed",
        description: `Vehicle checked in via walk-in intake (Level ${input.intakeLevel})`,
        userId,
        metadata: JSON.stringify({
          intakeLevel: input.intakeLevel,
          serviceCount: services.length,
          estimateRequestNumber: requestNumber,
        }),
      },
    });

    return { jobOrder, intakeRecord, estimateRequest, estimateVersion };
  });
}

// ---------------------------------------------------------------------------
// 2. createQuickJob — Minimal quick job creation
// ---------------------------------------------------------------------------
export async function createQuickJob(
  input: QuickJobInput,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    // -----------------------------------------------------------------------
    // Resolve or create Customer (split name on spaces)
    // -----------------------------------------------------------------------
    let customerId = input.customerId;
    if (!customerId) {
      const nameParts = input.customerName.trim().split(/\s+/);
      const firstName = nameParts[0] || input.customerName;
      const lastName = nameParts.slice(1).join(" ") || "";

      const customer = await tx.customer.create({
        data: {
          firstName,
          lastName,
          phone: input.customerPhone,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      customerId = customer.id;
    }

    // -----------------------------------------------------------------------
    // Resolve or create Vehicle (make: "TBD", model: "TBD")
    // -----------------------------------------------------------------------
    let vehicleId = input.vehicleId;
    if (!vehicleId) {
      const plateNumber = input.plateNumber
        .replace(/[\s-]/g, "")
        .toUpperCase();

      const vehicle = await tx.vehicle.create({
        data: {
          customerId,
          plateNumber,
          make: "TBD",
          model: "TBD",
          color: "TBD",
          createdBy: userId,
          updatedBy: userId,
        },
      });
      vehicleId = vehicle.id;
    }

    // -----------------------------------------------------------------------
    // Generate JO number
    // -----------------------------------------------------------------------
    const joSequence = await getNextSequence(
      "next_jo_sequence",
      "numbering",
      "Next job order sequence number"
    );
    const jobOrderNumber = generateDocNumber("JO", joSequence);

    // -----------------------------------------------------------------------
    // Create JobOrder (status: CHECKED_IN, incompleteIntake: true)
    // -----------------------------------------------------------------------
    const jobOrder = await tx.jobOrder.create({
      data: {
        jobOrderNumber,
        customerId,
        vehicleId,
        status: "CHECKED_IN",
        priority: "NORMAL",
        isInsuranceJob: false,
        incompleteIntake: true,
        notes: input.reason,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // -----------------------------------------------------------------------
    // Create minimal IntakeRecord
    // -----------------------------------------------------------------------
    await tx.intakeRecord.create({
      data: {
        jobOrderId: jobOrder.id,
        checkedInAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // -----------------------------------------------------------------------
    // Log JobActivity
    // -----------------------------------------------------------------------
    await tx.jobActivity.create({
      data: {
        jobOrderId: jobOrder.id,
        type: "status_change",
        title: "Quick job created",
        description: `Quick job: ${input.reason}`,
        userId,
        metadata: JSON.stringify({
          quickJob: true,
          reason: input.reason,
        }),
      },
    });

    return jobOrder;
  });
}

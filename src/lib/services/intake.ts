import { prisma } from "@/lib/prisma";
import { generateDocNumber } from "@/lib/utils";
import type { DamageEntryInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// 1. createJobOrderFromEstimate
// ---------------------------------------------------------------------------
export async function createJobOrderFromEstimate(
  estimateRequestId: string,
  userId?: string
) {
  // Fetch estimate request with full estimate data
  const request = await prisma.estimateRequest.findUniqueOrThrow({
    where: { id: estimateRequestId },
    include: {
      customer: { select: { id: true } },
      vehicle: { select: { id: true } },
      estimates: {
        where: { deletedAt: null },
        include: {
          versions: {
            where: { deletedAt: null },
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  // Get next JO sequence
  const sequence = await getNextJOSequence();
  const jobOrderNumber = generateDocNumber("JO", sequence);

  // Create JobOrder + IntakeRecord in transaction
  const result = await prisma.$transaction(async (tx) => {
    const jobOrder = await tx.jobOrder.create({
      data: {
        jobOrderNumber,
        customerId: request.customerId,
        vehicleId: request.vehicleId,
        status: "PENDING",
        priority: request.isInsuranceClaim ? "INSURANCE" : "NORMAL",
        isInsuranceJob: request.isInsuranceClaim,
        claimNumber: request.claimNumber || null,
        adjusterName: request.adjusterName || null,
        adjusterPhone: request.adjusterContact || null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    const intakeRecord = await tx.intakeRecord.create({
      data: {
        jobOrderId: jobOrder.id,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Link estimate to job order if exists
    if (request.estimates.length > 0) {
      await tx.estimate.update({
        where: { id: request.estimates[0].id },
        data: { jobOrderId: jobOrder.id },
      });
    }

    return { jobOrder, intakeRecord };
  });

  return result;
}

// ---------------------------------------------------------------------------
// 2. getIntakeRecord
// ---------------------------------------------------------------------------
export async function getIntakeRecord(jobOrderId: string) {
  const intakeRecord = await prisma.intakeRecord.findUnique({
    where: { jobOrderId },
    include: {
      damageMarks: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      belongings: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
          estimates: {
            where: { deletedAt: null },
            include: {
              versions: {
                where: { deletedAt: null },
                orderBy: { versionNumber: "desc" },
                take: 1,
                include: {
                  lineItems: {
                    where: { deletedAt: null },
                    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!intakeRecord) return null;

  // Fetch photos for this intake
  const photos = await prisma.photo.findMany({
    where: {
      entityType: "INTAKE",
      entityId: intakeRecord.id,
      deletedAt: null,
    },
    orderBy: { sortOrder: "asc" },
  });

  return { ...intakeRecord, photos };
}

// ---------------------------------------------------------------------------
// 3. addDamageEntry
// ---------------------------------------------------------------------------
export async function addDamageEntry(
  intakeRecordId: string,
  data: DamageEntryInput,
  userId?: string
) {
  return prisma.intakeDamageMap.create({
    data: {
      intakeRecordId,
      zone: data.zone,
      positionX: data.positionX ?? null,
      positionY: data.positionY ?? null,
      damageType: data.damageType,
      severity: data.severity,
      notes: data.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// 4. updateDamageEntry
// ---------------------------------------------------------------------------
export async function updateDamageEntry(
  id: string,
  data: Partial<DamageEntryInput>,
  userId?: string
) {
  return prisma.intakeDamageMap.update({
    where: { id },
    data: {
      ...(data.zone !== undefined && { zone: data.zone }),
      ...(data.positionX !== undefined && {
        positionX: data.positionX ?? null,
      }),
      ...(data.positionY !== undefined && {
        positionY: data.positionY ?? null,
      }),
      ...(data.damageType !== undefined && { damageType: data.damageType }),
      ...(data.severity !== undefined && { severity: data.severity }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      updatedBy: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// 5. deleteDamageEntry
// ---------------------------------------------------------------------------
export async function deleteDamageEntry(id: string, userId?: string) {
  return prisma.intakeDamageMap.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
}

// ---------------------------------------------------------------------------
// 6. addBelonging
// ---------------------------------------------------------------------------
export async function addBelonging(
  intakeRecordId: string,
  data: { description: string; condition?: string | null },
  userId?: string
) {
  return prisma.intakeBelonging.create({
    data: {
      intakeRecordId,
      description: data.description,
      condition: data.condition ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// 7. deleteBelonging
// ---------------------------------------------------------------------------
export async function deleteBelonging(id: string, userId?: string) {
  return prisma.intakeBelonging.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
}

// ---------------------------------------------------------------------------
// 8. updateIntakeRecord
// ---------------------------------------------------------------------------
export async function updateIntakeRecord(
  intakeRecordId: string,
  data: Record<string, unknown>,
  userId?: string
) {
  return prisma.intakeRecord.update({
    where: { id: intakeRecordId },
    data: {
      ...data,
      updatedBy: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// 9. completeIntake
// ---------------------------------------------------------------------------
export async function completeIntake(
  intakeRecordId: string,
  config: {
    primaryTechnicianId: string;
    targetCompletionDate?: string | null;
    priority?: string;
    bayAssignment?: string | null;
    notes?: string | null;
  },
  signatures: {
    customerSignature?: string | null;
    customerSignedAt?: Date | null;
    advisorSignature: string;
    advisorSignedAt: Date;
    advisorId: string;
    authorizationTerms?: string | null;
  },
  userId?: string
) {
  const intake = await prisma.intakeRecord.findUniqueOrThrow({
    where: { id: intakeRecordId },
    include: {
      jobOrder: {
        include: {
          estimates: {
            where: { deletedAt: null },
            include: {
              versions: {
                where: { deletedAt: null },
                orderBy: { versionNumber: "desc" },
                take: 1,
                include: {
                  lineItems: {
                    where: { deletedAt: null, group: "LABOR" },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return prisma.$transaction(async (tx) => {
    // Update IntakeRecord with signatures
    await tx.intakeRecord.update({
      where: { id: intakeRecordId },
      data: {
        customerSignature: signatures.customerSignature ?? null,
        customerSignedAt: signatures.customerSignedAt ?? null,
        advisorSignature: signatures.advisorSignature,
        advisorSignedAt: signatures.advisorSignedAt,
        advisorId: signatures.advisorId,
        authorizationTerms: signatures.authorizationTerms ?? null,
        checkedInAt: new Date(),
        updatedBy: userId,
      },
    });

    // Update JobOrder
    await tx.jobOrder.update({
      where: { id: intake.jobOrderId },
      data: {
        status: "CHECKED_IN",
        primaryTechnicianId: config.primaryTechnicianId,
        targetCompletionDate: config.targetCompletionDate
          ? new Date(config.targetCompletionDate)
          : null,
        priority: config.priority || "NORMAL",
        notes: config.notes ?? null,
        updatedBy: userId,
      },
    });

    // Create Task records from LABOR line items
    const estimate = intake.jobOrder.estimates[0];
    if (estimate?.versions?.[0]?.lineItems) {
      const laborItems = estimate.versions[0].lineItems;
      for (let i = 0; i < laborItems.length; i++) {
        const item = laborItems[i];
        await tx.task.create({
          data: {
            jobOrderId: intake.jobOrderId,
            serviceCatalogId: item.serviceCatalogId,
            name: item.description,
            status: "QUEUED",
            sortOrder: i,
            estimatedHours: item.estimatedHours || 0,
            hourlyRate: item.unitCost, // unitCost is in centavos for labor items
            assignedTechnicianId:
              item.assignedTechnicianId || config.primaryTechnicianId,
            createdBy: userId,
            updatedBy: userId,
          },
        });
      }
    }

    return intake.jobOrder;
  });
}

// ---------------------------------------------------------------------------
// 10. getRequiredPhotos
// ---------------------------------------------------------------------------
export function getRequiredPhotos(serviceCategories: string[]) {
  // Use require to avoid circular import issues with constants
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WALKAROUND_SHOTS, CONDITIONAL_SHOTS } = require("@/lib/constants");

  const allShots = [...WALKAROUND_SHOTS];

  for (const cat of serviceCategories) {
    const extra = CONDITIONAL_SHOTS[cat];
    if (extra) {
      allShots.push(
        ...extra.map(
          (s: { id: string; label: string; category: string }) => ({
            ...s,
            required: true,
          })
        )
      );
    }
  }

  return allShots;
}

// ---------------------------------------------------------------------------
// Helper: getNextJOSequence
// ---------------------------------------------------------------------------
async function getNextJOSequence(): Promise<number> {
  const key = "next_jo_sequence";
  const setting = await prisma.setting.findUnique({ where: { key } });
  const current = setting ? parseInt(setting.value, 10) || 1 : 1;

  await prisma.setting.upsert({
    where: { key },
    update: { value: String(current + 1) },
    create: {
      key,
      value: String(current + 1),
      category: "numbering",
      description: "Next job order sequence number",
    },
  });

  return current;
}

import { prisma } from "@/lib/prisma";
import { sendCustomerSms } from "@/lib/services/sms";
import { logActivity } from "@/lib/services/job-activities";
import {
  SERVICE_WARRANTY_MAP,
  MIN_RELEASE_PHOTOS,
  WALKAROUND_SHOTS,
} from "@/lib/constants";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Helper: Add days to a date
// ---------------------------------------------------------------------------
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Helper: Add months to a date
// ---------------------------------------------------------------------------
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ---------------------------------------------------------------------------
// Helper: Extract service categories from job order estimates
// ---------------------------------------------------------------------------
function getServiceCategories(jobOrder: {
  estimates?: Array<{
    estimateRequest?: { requestedCategories?: string } | null;
  }>;
}): string[] {
  const categories = new Set<string>();
  for (const estimate of jobOrder.estimates || []) {
    if (estimate.estimateRequest?.requestedCategories) {
      const cats =
        typeof estimate.estimateRequest.requestedCategories === "string"
          ? JSON.parse(estimate.estimateRequest.requestedCategories)
          : estimate.estimateRequest.requestedCategories;
      if (Array.isArray(cats)) {
        cats.forEach((c: string) => categories.add(c));
      }
    }
  }
  return Array.from(categories);
}

// ---------------------------------------------------------------------------
// Helper: Check if a follow-up setting is enabled
// ---------------------------------------------------------------------------
async function isFollowUpEnabled(key: string): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value === "true";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PhotoData {
  id: string;
  category: string | null;
  thumbnailPath: string;
  fullSizePath: string;
}

interface PhotoPair {
  angle: string;
  label: string;
  intake: PhotoData | null;
  release: PhotoData | null;
}

// ---------------------------------------------------------------------------
// 1. validatePreRelease
// ---------------------------------------------------------------------------
export async function validatePreRelease(
  jobOrderId: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Check all tasks are DONE
  const incompleteTasks = await prisma.task.count({
    where: { jobOrderId, status: { not: "DONE" }, deletedAt: null },
  });
  if (incompleteTasks > 0)
    issues.push(`${incompleteTasks} task(s) not completed`);

  // Check QC passed
  const qcPassed = await prisma.qCInspection.findFirst({
    where: { jobOrderId, overallResult: "PASSED", deletedAt: null },
  });
  if (!qcPassed) issues.push("QC inspection has not passed");

  // Check invoice fully paid (charge invoices bypass payment requirement)
  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      jobOrderId,
      isLatest: true,
      deletedAt: null,
    },
  });
  if (!latestInvoice) {
    issues.push("No invoice found");
  } else if (latestInvoice.invoiceType === "CHARGE") {
    // Charge invoices: allow release without payment — billed to company account
  } else if (latestInvoice.paymentStatus !== "PAID") {
    issues.push("Invoice not fully paid");
  }

  // Check release photos
  const releasePhotoCount = await prisma.photo.count({
    where: {
      entityType: "JOB_ORDER",
      entityId: jobOrderId,
      stage: "RELEASE",
      deletedAt: null,
    },
  });
  if (releasePhotoCount < MIN_RELEASE_PHOTOS) {
    issues.push(
      `Only ${releasePhotoCount} of ${MIN_RELEASE_PHOTOS} required release photos captured`
    );
  }

  // Check belongings returned
  const job = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    include: {
      intakeRecord: {
        include: { belongings: { where: { deletedAt: null } } },
      },
    },
  });
  if (job?.intakeRecord) {
    const unreturned = job.intakeRecord.belongings.filter(
      (b) => !b.isReturned
    );
    if (unreturned.length > 0)
      issues.push(`${unreturned.length} belonging(s) not returned`);
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// 2. createReleaseRecord
// ---------------------------------------------------------------------------
export async function createReleaseRecord(
  jobOrderId: string,
  userId: string
) {
  // Check if one already exists
  const existing = await prisma.releaseRecord.findUnique({
    where: { jobOrderId },
  });

  if (existing && !existing.deletedAt) {
    return existing;
  }

  const completionReportToken = crypto.randomUUID();

  const record = await prisma.releaseRecord.create({
    data: {
      jobOrderId,
      completionReportToken,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await logActivity({
    jobOrderId,
    type: "release_initiated",
    title: "Release process initiated",
    userId,
  });

  return record;
}

// ---------------------------------------------------------------------------
// 3. updateReleaseRecord
// ---------------------------------------------------------------------------
export async function updateReleaseRecord(
  releaseId: string,
  data: {
    odometerReading?: number | null;
    fuelLevel?: string | null;
    belongingsReturned?: boolean;
    fuelLevelMatches?: boolean;
    keysReturned?: boolean;
    customerSatisfied?: boolean;
    warrantyExplained?: boolean;
    careInstructionsGiven?: boolean;
    careInstructions?: string | null;
    customerSignature?: string | null;
    advisorSignature?: string | null;
    belongingsNotes?: string | null;
  },
  userId: string
) {
  const updateData: Record<string, unknown> = { updatedBy: userId };

  if (data.odometerReading !== undefined)
    updateData.odometerReading = data.odometerReading;
  if (data.fuelLevel !== undefined) updateData.fuelLevel = data.fuelLevel;
  if (data.belongingsReturned !== undefined)
    updateData.belongingsReturned = data.belongingsReturned;
  if (data.fuelLevelMatches !== undefined)
    updateData.fuelLevelMatches = data.fuelLevelMatches;
  if (data.keysReturned !== undefined)
    updateData.keysReturned = data.keysReturned;
  if (data.customerSatisfied !== undefined)
    updateData.customerSatisfied = data.customerSatisfied;
  if (data.warrantyExplained !== undefined)
    updateData.warrantyExplained = data.warrantyExplained;
  if (data.careInstructionsGiven !== undefined)
    updateData.careInstructionsGiven = data.careInstructionsGiven;
  if (data.careInstructions !== undefined)
    updateData.careInstructions = data.careInstructions;
  if (data.belongingsNotes !== undefined)
    updateData.belongingsNotes = data.belongingsNotes;

  if (data.customerSignature !== undefined) {
    updateData.customerSignature = data.customerSignature;
    updateData.customerSignedAt = new Date();
  }

  if (data.advisorSignature !== undefined) {
    updateData.advisorSignature = data.advisorSignature;
    updateData.advisorSignedAt = new Date();
    updateData.advisorId = userId;
  }

  return prisma.releaseRecord.update({
    where: { id: releaseId },
    data: updateData,
  });
}

// ---------------------------------------------------------------------------
// 4. completeRelease
// ---------------------------------------------------------------------------
export async function completeRelease(releaseId: string, userId: string) {
  // Fetch release record with full job data
  const release = await prisma.releaseRecord.findUniqueOrThrow({
    where: { id: releaseId },
    include: {
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
          estimates: {
            include: {
              estimateRequest: { select: { requestedCategories: true } },
            },
          },
        },
      },
    },
  });

  // Validate completeness
  if (!release.customerSignature)
    throw new Error("Customer signature required");
  if (!release.advisorSignature)
    throw new Error("Advisor signature required");
  if (!release.customerSatisfied)
    throw new Error("Customer satisfaction not confirmed");
  if (!release.warrantyExplained)
    throw new Error("Warranty explanation not confirmed");
  if (!release.careInstructionsGiven)
    throw new Error("Care instructions not confirmed");

  const { jobOrder } = release;
  const releaseDate = new Date();

  // Transaction: update job status + release record dates + auto-release bay
  let releasedBayAssignment = false;
  await prisma.$transaction(async (tx) => {
    // Auto-release bay assignment
    const activeBayAssignment = await tx.bayAssignment.findFirst({
      where: { jobOrderId: jobOrder.id, endDate: null },
    });
    if (activeBayAssignment) {
      await tx.bayAssignment.update({
        where: { id: activeBayAssignment.id },
        data: { endDate: new Date() },
      });
      releasedBayAssignment = true;
    }

    await tx.jobOrder.update({
      where: { id: jobOrder.id },
      data: { status: "RELEASED", assignedBayId: null, updatedBy: userId },
    });

    await tx.releaseRecord.update({
      where: { id: releaseId },
      data: {
        releaseDate,
        followUp7DayDate: addDays(releaseDate, 7),
        followUp30DayDate: addDays(releaseDate, 30),
        followUp6MonthDate: addDays(releaseDate, 180),
        followUp1YearDate: addDays(releaseDate, 365),
        updatedBy: userId,
      },
    });
  });

  // Log bay release activity (outside transaction — non-critical)
  if (releasedBayAssignment) {
    await logActivity({
      jobOrderId: jobOrder.id,
      type: "BAY_RELEASED",
      title: "Bay released",
      description: "Bay automatically released on vehicle release",
      userId,
    });
  }

  // Create Warranty records
  const serviceCategories = getServiceCategories(jobOrder);
  for (const category of serviceCategories) {
    const warrantyConfig =
      SERVICE_WARRANTY_MAP[category as keyof typeof SERVICE_WARRANTY_MAP];
    if (!warrantyConfig) continue;

    const durationSetting = await prisma.setting.findUnique({
      where: { key: warrantyConfig.durationKey },
    });
    const durationMonths = durationSetting
      ? parseInt(durationSetting.value, 10)
      : 12;

    const termsSetting = await prisma.setting.findUnique({
      where: { key: "warranty_terms_template" },
    });

    await prisma.warranty.create({
      data: {
        jobOrderId: jobOrder.id,
        vehicleId: jobOrder.vehicleId,
        customerId: jobOrder.customerId,
        serviceCategory: category,
        description: warrantyConfig.label,
        startDate: releaseDate,
        endDate: addMonths(releaseDate, durationMonths),
        terms: termsSetting?.value ?? null,
        status: "ACTIVE",
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  // Schedule follow-up Notifications
  const advisors = await prisma.user.findMany({
    where: {
      role: { in: ["ADVISOR", "MANAGER"] },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  const customerName = `${jobOrder.customer.firstName} ${jobOrder.customer.lastName}`;
  const vehicleDesc = `${jobOrder.vehicle.make} ${jobOrder.vehicle.model}`;

  if (await isFollowUpEnabled("followup_7day_enabled")) {
    await prisma.notification.createMany({
      data: advisors.map((a) => ({
        recipientId: a.id,
        type: "FOLLOW_UP_SATISFACTION",
        title: "7-Day Follow-Up Due",
        message: `Follow up with ${customerName} about their ${vehicleDesc}. Any concerns with the work?`,
        scheduledAt: addDays(releaseDate, 7),
        entityType: "JOB_ORDER",
        entityId: jobOrder.id,
      })),
    });
  }

  if (await isFollowUpEnabled("followup_30day_enabled")) {
    await prisma.notification.createMany({
      data: advisors.map((a) => ({
        recipientId: a.id,
        type: "FOLLOW_UP_SURVEY",
        title: "30-Day Satisfaction Survey",
        message: `Send satisfaction survey to ${customerName} for their ${vehicleDesc} service.`,
        scheduledAt: addDays(releaseDate, 30),
        entityType: "JOB_ORDER",
        entityId: jobOrder.id,
      })),
    });
  }

  // 6-month maintenance only for coating/detailing/PPF services
  const hasCoatingService = serviceCategories.some((c) =>
    ["Buffing & Paint Correction", "Car Detailing"].includes(c)
  );
  if (
    hasCoatingService &&
    (await isFollowUpEnabled("followup_6month_enabled"))
  ) {
    await prisma.notification.createMany({
      data: advisors.map((a) => ({
        recipientId: a.id,
        type: "FOLLOW_UP_MAINTENANCE",
        title: "6-Month Maintenance Reminder",
        message: `${customerName}'s ${vehicleDesc} is due for coating maintenance.`,
        scheduledAt: addDays(releaseDate, 180),
        entityType: "JOB_ORDER",
        entityId: jobOrder.id,
      })),
    });
  }

  // SMS — vehicle ready for pickup
  sendCustomerSms(
    jobOrder.customerId,
    "VEHICLE_READY",
    { vehiclePlate: jobOrder.vehicle.plateNumber },
    jobOrder.id
  ).catch((err) => console.error("[SMS] VEHICLE_READY failed:", err));

  // Log activity
  await logActivity({
    jobOrderId: jobOrder.id,
    type: "release_completed",
    title: `Vehicle released to ${customerName}`,
    metadata: { releaseId, releaseDate: releaseDate.toISOString() },
    userId,
  });

  return release;
}

// ---------------------------------------------------------------------------
// 5. getReleaseRecord
// ---------------------------------------------------------------------------
export async function getReleaseRecord(jobOrderId: string) {
  return prisma.releaseRecord.findUnique({
    where: { jobOrderId },
    include: {
      jobOrder: {
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          vehicle: {
            select: {
              make: true,
              model: true,
              year: true,
              plateNumber: true,
              color: true,
            },
          },
          intakeRecord: {
            select: { fuelLevel: true, odometerReading: true },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 6. getBeforeAfterPhotos
// ---------------------------------------------------------------------------
export async function getBeforeAfterPhotos(jobOrderId: string) {
  // Fetch the job's intake record ID
  const intakeRecord = await prisma.intakeRecord.findUnique({
    where: { jobOrderId },
    select: { id: true },
  });

  // Fetch intake photos
  const intakePhotos: PhotoData[] = intakeRecord
    ? (
        await prisma.photo.findMany({
          where: {
            entityType: "INTAKE",
            entityId: intakeRecord.id,
            stage: "INTAKE",
            deletedAt: null,
          },
          select: {
            id: true,
            category: true,
            thumbnailPath: true,
            fullSizePath: true,
          },
        })
      )
    : [];

  // Fetch release photos
  const releasePhotos: PhotoData[] = await prisma.photo.findMany({
    where: {
      entityType: "JOB_ORDER",
      entityId: jobOrderId,
      stage: "RELEASE",
      deletedAt: null,
    },
    select: {
      id: true,
      category: true,
      thumbnailPath: true,
      fullSizePath: true,
    },
  });

  // Build a lookup from category to label using WALKAROUND_SHOTS
  const shotLabelMap = new Map<string, string>();
  for (const shot of WALKAROUND_SHOTS) {
    shotLabelMap.set(shot.id, shot.label);
  }

  // Index photos by category
  const intakeByCategory = new Map<string, PhotoData>();
  for (const photo of intakePhotos) {
    if (photo.category) {
      intakeByCategory.set(photo.category, photo);
    }
  }

  const releaseByCategory = new Map<string, PhotoData>();
  for (const photo of releasePhotos) {
    if (photo.category) {
      releaseByCategory.set(photo.category, photo);
    }
  }

  // Build matched pairs
  const matchedCategories = new Set<string>();
  const pairs: PhotoPair[] = [];

  // Start with all walkaround shots as the base ordering
  for (const shot of WALKAROUND_SHOTS) {
    const intake = intakeByCategory.get(shot.id) ?? null;
    const release = releaseByCategory.get(shot.id) ?? null;

    if (intake || release) {
      pairs.push({
        angle: shot.id,
        label: shot.label,
        intake,
        release,
      });
      matchedCategories.add(shot.id);
    }
  }

  // Add any extra categories not in WALKAROUND_SHOTS
  const allCategories = new Set([
    ...Array.from(intakeByCategory.keys()),
    ...Array.from(releaseByCategory.keys()),
  ]);
  for (const cat of Array.from(allCategories)) {
    if (!matchedCategories.has(cat)) {
      pairs.push({
        angle: cat,
        label: shotLabelMap.get(cat) ?? cat,
        intake: intakeByCategory.get(cat) ?? null,
        release: releaseByCategory.get(cat) ?? null,
      });
      matchedCategories.add(cat);
    }
  }

  // Collect unmatched photos (those without a category)
  const unmatchedIntake = intakePhotos.filter((p) => !p.category);
  const unmatchedRelease = releasePhotos.filter((p) => !p.category);

  return { pairs, unmatchedIntake, unmatchedRelease };
}

// ---------------------------------------------------------------------------
// 7. getCompletionReportData
// ---------------------------------------------------------------------------
export async function getCompletionReportData(token: string) {
  // Find release record by completionReportToken
  const release = await prisma.releaseRecord.findFirst({
    where: { completionReportToken: token, deletedAt: null },
    include: {
      jobOrder: {
        include: {
          customer: true,
          vehicle: true,
          estimates: {
            include: {
              estimateRequest: { select: { requestedCategories: true } },
              versions: {
                orderBy: { versionNumber: "desc" as const },
                take: 1,
                include: {
                  lineItems: {
                    where: { deletedAt: null },
                    orderBy: { sortOrder: "asc" as const },
                  },
                },
              },
            },
          },
          invoices: {
            where: { isLatest: true, deletedAt: null },
            take: 1,
          },
        },
      },
    },
  });

  if (!release) return null;

  const { jobOrder } = release;

  // Fetch before/after photos
  const beforeAfterPhotos = await getBeforeAfterPhotos(jobOrder.id);

  // Fetch warranties
  const warranties = await prisma.warranty.findMany({
    where: { jobOrderId: jobOrder.id, deletedAt: null },
    orderBy: { serviceCategory: "asc" },
  });

  // Fetch shop settings
  const shopSettings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "shop_name",
          "shop_address",
          "shop_phone",
          "shop_email",
          "shop_logo_url",
          "shop_website",
        ],
      },
    },
  });

  const shopInfo: Record<string, string> = {};
  for (const s of shopSettings) {
    shopInfo[s.key] = s.value;
  }

  // Fetch care instructions for each service category
  const serviceCategories = getServiceCategories(jobOrder);
  const careInstructions: Record<string, string> = {};

  for (const category of serviceCategories) {
    const config =
      SERVICE_WARRANTY_MAP[category as keyof typeof SERVICE_WARRANTY_MAP];
    if (!config) continue;

    const setting = await prisma.setting.findUnique({
      where: { key: config.careKey },
    });
    if (setting?.value) {
      careInstructions[category] = setting.value;
    }
  }

  return {
    release,
    jobOrder,
    customer: jobOrder.customer,
    vehicle: jobOrder.vehicle,
    beforeAfterPhotos,
    warranties,
    shopInfo,
    careInstructions,
    serviceCategories,
    invoice: jobOrder.invoices[0] ?? null,
  };
}

import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getReleaseRecord,
  getBeforeAfterPhotos,
  validatePreRelease,
} from "@/lib/services/release";
import { SERVICE_WARRANTY_MAP } from "@/lib/constants";
import ReleaseWizardClient from "./release-wizard-client";

export default async function JobReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) return notFound();

  const canRelease = can(session.user.role, "release:create");

  // Fetch job with related data
  const job = await prisma.jobOrder.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      jobOrderNumber: true,
      status: true,
      customerId: true,
      vehicleId: true,
      customer: {
        select: { firstName: true, lastName: true, phone: true },
      },
      vehicle: {
        select: {
          plateNumber: true,
          make: true,
          model: true,
          year: true,
          color: true,
        },
      },
      intakeRecord: {
        select: {
          id: true,
          fuelLevel: true,
          odometerReading: true,
          belongings: {
            where: { deletedAt: null },
            select: {
              id: true,
              description: true,
              condition: true,
              isReturned: true,
            },
          },
        },
      },
      estimates: {
        include: {
          estimateRequest: { select: { requestedCategories: true } },
        },
      },
    },
  });

  if (!job) return notFound();

  // Extract service categories
  const serviceCategories: string[] = [];
  for (const est of job.estimates) {
    if (est.estimateRequest?.requestedCategories) {
      const cats =
        typeof est.estimateRequest.requestedCategories === "string"
          ? JSON.parse(est.estimateRequest.requestedCategories)
          : est.estimateRequest.requestedCategories;
      if (Array.isArray(cats))
        cats.forEach((c: string) => {
          if (!serviceCategories.includes(c)) serviceCategories.push(c);
        });
    }
  }

  // Fetch release record
  const releaseRecord = await getReleaseRecord(id);

  // Fetch before/after photos
  const beforeAfterData = await getBeforeAfterPhotos(id);

  // Fetch existing release photos
  const releasePhotos = await prisma.photo.findMany({
    where: {
      entityType: "JOB_ORDER",
      entityId: id,
      stage: "RELEASE",
      deletedAt: null,
    },
    select: {
      id: true,
      category: true,
      thumbnailPath: true,
      fullSizePath: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch latest invoice (for charge invoice detection)
  const latestInvoice = await prisma.invoice.findFirst({
    where: { jobOrderId: id, isLatest: true, deletedAt: null },
    select: {
      id: true,
      invoiceType: true,
      paymentStatus: true,
      balanceDue: true,
      creditTerms: true,
      dueDate: true,
      chargeAccount: {
        select: { id: true, companyName: true },
      },
    },
  });

  // Pre-release validation
  const validation = await validatePreRelease(id);

  // Build warranty info from service categories + settings
  const warrantyInfo: Array<{
    category: string;
    label: string;
    durationMonths: number;
    careInstructions: string;
    terms: string;
  }> = [];
  for (const cat of serviceCategories) {
    const config = SERVICE_WARRANTY_MAP[cat];
    if (!config) continue;
    const [durationSetting, careSetting, termsSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: config.durationKey } }),
      prisma.setting.findUnique({ where: { key: config.careKey } }),
      prisma.setting.findUnique({ where: { key: "warranty_terms_template" } }),
    ]);
    warrantyInfo.push({
      category: cat,
      label: config.label,
      durationMonths: durationSetting
        ? parseInt(durationSetting.value, 10)
        : 12,
      careInstructions:
        careSetting?.value ?? "Follow manufacturer guidelines.",
      terms: termsSetting?.value ?? "Standard warranty terms apply.",
    });
  }

  // Fetch intake photos for reference
  const intakePhotos = job.intakeRecord
    ? await prisma.photo.findMany({
        where: {
          entityType: "INTAKE",
          entityId: job.intakeRecord.id,
          stage: "INTAKE",
          deletedAt: null,
        },
        select: { id: true, category: true, thumbnailPath: true },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  return (
    <ReleaseWizardClient
      jobOrderId={id}
      jobOrderNumber={job.jobOrderNumber}
      jobStatus={job.status}
      releaseRecord={
        releaseRecord ? JSON.parse(JSON.stringify(releaseRecord)) : null
      }
      vehicle={job.vehicle}
      customer={job.customer}
      intakeRecord={
        job.intakeRecord
          ? {
              id: job.intakeRecord.id,
              fuelLevel: job.intakeRecord.fuelLevel,
              odometerReading: job.intakeRecord.odometerReading,
            }
          : null
      }
      belongings={job.intakeRecord?.belongings ?? []}
      serviceCategories={serviceCategories}
      beforeAfterPairs={JSON.parse(JSON.stringify(beforeAfterData.pairs))}
      unmatchedIntake={JSON.parse(
        JSON.stringify(beforeAfterData.unmatchedIntake)
      )}
      unmatchedRelease={JSON.parse(
        JSON.stringify(beforeAfterData.unmatchedRelease)
      )}
      existingReleasePhotos={JSON.parse(JSON.stringify(releasePhotos))}
      intakePhotos={JSON.parse(JSON.stringify(intakePhotos))}
      preReleaseValidation={validation}
      warrantyInfo={warrantyInfo}
      canRelease={canRelease}
      invoice={latestInvoice ? JSON.parse(JSON.stringify(latestInvoice)) : null}
    />
  );
}

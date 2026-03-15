import { notFound } from "next/navigation";
import { getJobOrderDetail } from "@/lib/services/job-orders";
import { prisma } from "@/lib/prisma";
import { IntakeWizardClient } from "./intake-wizard-client";

interface Props {
  params: { id: string };
}

export default async function IntakeWizardPage({ params }: Props) {
  const jobOrder = await getJobOrderDetail(params.id);

  if (!jobOrder) {
    notFound();
  }

  if (!jobOrder.intakeRecord) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-danger-100 p-4 mb-4">
          <svg
            className="w-8 h-8 text-danger-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-primary mb-2">
          No Intake Record Found
        </h2>
        <p className="text-surface-500 max-w-md">
          This job order does not have an intake record yet. Please initiate the
          intake process from the estimates page first.
        </p>
      </div>
    );
  }

  // Fetch technicians for Step 5 (Job Configuration)
  const technicians = await prisma.user.findMany({
    where: {
      role: "TECHNICIAN",
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  // Fetch authorization terms from settings
  const termsRow = await prisma.setting.findFirst({
    where: { key: "intake_authorization_terms" },
  });
  const authorizationTerms =
    termsRow?.value ??
    "I authorize the above services to be performed. I understand that the final amount may vary based on additional findings during the repair process. I acknowledge that my vehicle and belongings have been inspected and documented as described above.";

  // Derive service categories from the approved estimate line items
  const serviceCategories: string[] = [];
  for (const estimate of jobOrder.estimates) {
    if (estimate.estimateRequest?.requestedCategories) {
      try {
        const cats =
          typeof estimate.estimateRequest.requestedCategories === "string"
            ? JSON.parse(estimate.estimateRequest.requestedCategories)
            : estimate.estimateRequest.requestedCategories;
        if (Array.isArray(cats)) {
          for (const c of cats) {
            if (!serviceCategories.includes(c)) serviceCategories.push(c);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Compute estimate total and services list for authorization
  let estimateTotal = 0;
  let estimatedDays: number | null = null;
  const services: string[] = [];
  for (const estimate of jobOrder.estimates) {
    const latestVersion = estimate.versions[0];
    if (latestVersion) {
      estimatedDays = latestVersion.estimatedDays ?? estimatedDays;
      for (const item of latestVersion.lineItems) {
        estimateTotal += item.subtotal;
        if (!services.includes(item.description)) {
          services.push(item.description);
        }
      }
    }
  }

  // Compute damage severity counts
  const damageSeverityCounts: Record<string, number> = {};
  for (const entry of jobOrder.intakeRecord.damageMarks) {
    damageSeverityCounts[entry.severity] =
      (damageSeverityCounts[entry.severity] || 0) + 1;
  }

  // Serialize data for client component
  const clientData = {
    jobOrderId: jobOrder.id,
    jobOrderNumber: jobOrder.jobOrderNumber,
    intakeRecordId: jobOrder.intakeRecord.id,
    vehicle: {
      plateNumber: jobOrder.vehicle.plateNumber,
      make: jobOrder.vehicle.make,
      model: jobOrder.vehicle.model,
      year: jobOrder.vehicle.year,
      color: jobOrder.vehicle.color,
    },
    customer: {
      firstName: jobOrder.customer.firstName,
      lastName: jobOrder.customer.lastName,
      phone: jobOrder.customer.phone,
    },
    serviceCategories,
    existingPhotos: (jobOrder.photos as { id: string; category: string | null; thumbnailPath: string }[]).map((p) => ({
      id: p.id,
      category: p.category,
      thumbnailPath: p.thumbnailPath,
    })),
    damageEntries: jobOrder.intakeRecord.damageMarks.map((d) => ({
      id: d.id,
      zone: d.zone,
      damageType: d.damageType,
      severity: d.severity,
      notes: d.notes,
    })),
    belongings: jobOrder.intakeRecord.belongings.map((b) => ({
      id: b.id,
      description: b.description,
      condition: b.condition,
    })),
    intakeRecord: {
      fuelLevel: jobOrder.intakeRecord.fuelLevel,
      odometerReading: jobOrder.intakeRecord.odometerReading,
      hasWarningLights: jobOrder.intakeRecord.hasWarningLights,
      warningLightsNote: jobOrder.intakeRecord.warningLightsNote,
      keysCount: jobOrder.intakeRecord.keysCount,
    },
    estimateTotal,
    estimatedDays,
    services,
    damageCount: jobOrder.intakeRecord.damageMarks.length,
    damageSeverityCounts,
    belongingsCount: jobOrder.intakeRecord.belongings.length,
    technicians: technicians.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
    })),
    authorizationTerms,
    // Pre-fill job config from existing job order data
    existingJobConfig: {
      primaryTechnicianId: jobOrder.primaryTechnicianId ?? "",
      targetCompletionDate: jobOrder.targetCompletionDate
        ? jobOrder.targetCompletionDate.toISOString().split("T")[0]
        : null,
      priority: jobOrder.priority ?? "NORMAL",
      bayAssignment: null as string | null,
      notes: jobOrder.notes ?? null,
    },
  };

  return <IntakeWizardClient {...clientData} />;
}

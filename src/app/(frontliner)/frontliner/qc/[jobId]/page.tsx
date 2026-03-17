import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getJobQCInspections,
  getQCInspection,
  createQCInspection,
} from "@/lib/services/qc";
import { QCChecklistClient } from "@/components/frontliner/qc-checklist-client";

interface PageProps {
  params: { jobId: string };
}

export default async function FrontlinerQCChecklistPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "qc:inspect")) redirect("/frontliner");

  const { jobId } = params;

  // Fetch basic job info
  const jobOrder = await prisma.jobOrder.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobOrderNumber: true,
      vehicle: {
        select: { plateNumber: true, make: true, model: true },
      },
    },
  });

  if (!jobOrder || !jobOrder.vehicle) {
    redirect("/frontliner/qc");
  }

  // Fetch existing QC inspections for this job
  const inspections = await getJobQCInspections(jobId);

  let inspectionId: string;

  // Find an in-progress inspection (overallResult === "PENDING")
  const inProgress = inspections.find((i) => i.overallResult === "PENDING");

  if (inProgress) {
    inspectionId = inProgress.id;
  } else {
    // No in-progress inspection — create a new one
    const newInspection = await createQCInspection(jobId, session.user.id);
    inspectionId = newInspection.id;
  }

  // Fetch the full inspection with checklist items
  const inspection = await getQCInspection(inspectionId);

  if (!inspection) {
    redirect("/frontliner/qc");
  }

  // Count attempt number
  const attemptNumber = inspections.length + (inProgress ? 0 : 1);

  // Serialize for client
  const serializedInspection = {
    id: inspection.id,
    attemptNumber,
    items: inspection.checklistItems.map((item) => ({
      id: item.id,
      description: item.description,
      category: item.category,
      status: item.status,
      notes: item.notes,
      sortOrder: item.sortOrder,
    })),
  };

  const serializedJob = {
    id: jobOrder.id,
    jobOrderNumber: jobOrder.jobOrderNumber,
    vehicle: {
      plateNumber: jobOrder.vehicle.plateNumber,
      make: jobOrder.vehicle.make,
      model: jobOrder.vehicle.model,
    },
  };

  return (
    <QCChecklistClient
      inspection={serializedInspection}
      job={serializedJob}
    />
  );
}

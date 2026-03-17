import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getQCInspection, getJobQCInspections } from "@/lib/services/qc";
import QCClient from "./qc-client";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle } from "lucide-react";

export default async function QCPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;

  // Get all QC inspections for this job
  const inspections = await getJobQCInspections(id);

  // Get the active (PENDING) inspection detail if one exists
  const activeInspection = inspections.find(i => i.overallResult === "PENDING");
  let activeDetail = null;
  if (activeInspection) {
    activeDetail = await getQCInspection(activeInspection.id);
  }

  // Get job info for status check
  const job = await prisma.jobOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      jobOrderNumber: true,
      intakeRecord: { select: { id: true } },
    },
  });

  // Fetch intake photos for angle reference
  let intakePhotos: Array<{ id: string; thumbnailPath: string | null; fullSizePath: string; category: string | null }> = [];
  if (job?.intakeRecord) {
    intakePhotos = await prisma.photo.findMany({
      where: { entityType: "INTAKE", entityId: job.intakeRecord.id, deletedAt: null },
      select: { id: true, thumbnailPath: true, fullSizePath: true, category: true },
      orderBy: { sortOrder: "asc" },
      take: 10,
    });
  }

  // Fetch QC photos
  const qcPhotos = await prisma.photo.findMany({
    where: { entityType: "QC_INSPECTION", entityId: id, stage: "QC", deletedAt: null },
    select: { id: true, thumbnailPath: true, fullSizePath: true, category: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (!job) return (
    <EmptyState
      icon={AlertTriangle}
      title="Job not found"
      description="The job order you're looking for doesn't exist or has been removed."
    />
  );

  return (
    <QCClient
      jobOrderId={id}
      jobStatus={job.status}
      inspections={JSON.parse(JSON.stringify(inspections))}
      activeInspection={activeDetail ? JSON.parse(JSON.stringify(activeDetail)) : null}
      intakePhotos={JSON.parse(JSON.stringify(intakePhotos))}
      qcPhotos={JSON.parse(JSON.stringify(qcPhotos))}
      canStartQC={job.status === "QC_PENDING" || job.status === "QC_FAILED_REWORK"}
      userRole={session?.user?.role || "TECHNICIAN"}
    />
  );
}

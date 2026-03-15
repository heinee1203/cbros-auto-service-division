import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import PhotoGalleryClient from "./photo-gallery-client";

export default async function JobPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;

  // Get job with intake record and tasks for photo entity mapping
  const job = await prisma.jobOrder.findUnique({
    where: { id },
    select: {
      id: true,
      jobOrderNumber: true,
      intakeRecord: { select: { id: true } },
      tasks: {
        where: { deletedAt: null },
        select: { id: true, name: true },
      },
    },
  });

  if (!job) return <div>Job not found</div>;

  // Collect all entity IDs for photo queries
  const entityFilters: Array<{ entityType: string; entityId: string }> = [];

  // Intake photos
  if (job.intakeRecord) {
    entityFilters.push({
      entityType: "INTAKE",
      entityId: job.intakeRecord.id,
    });
  }

  // Task/progress photos
  for (const task of job.tasks) {
    entityFilters.push({ entityType: "TASK", entityId: task.id });
  }

  // QC and release photos (use job ID as entityId)
  entityFilters.push({ entityType: "QC_INSPECTION", entityId: id });
  entityFilters.push({ entityType: "RELEASE", entityId: id });

  const photos =
    entityFilters.length > 0
      ? await prisma.photo.findMany({
          where: {
            OR: entityFilters,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // Look up uploader names for all photos
  const uploaderIds = Array.from(
    new Set(photos.map((p) => p.uploadedBy).filter(Boolean) as string[])
  );

  const uploaders =
    uploaderIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const uploaderMap = Object.fromEntries(
    uploaders.map((u) => [u.id, { firstName: u.firstName, lastName: u.lastName }])
  );

  // Map photos to client-friendly shape
  const clientPhotos = photos.map((p) => ({
    id: p.id,
    entityType: p.entityType,
    entityId: p.entityId,
    stage: p.stage,
    category: p.category,
    url: p.fullSizePath,
    thumbnailUrl: p.thumbnailPath,
    caption: p.caption,
    createdAt: p.createdAt.toISOString(),
    uploadedBy: p.uploadedBy ? uploaderMap[p.uploadedBy] ?? null : null,
  }));

  // Map task IDs to names for display
  const taskMap = Object.fromEntries(
    job.tasks.map((t) => [t.id, t.name])
  );

  return (
    <PhotoGalleryClient
      photos={clientPhotos}
      taskMap={taskMap}
      jobOrderNumber={job.jobOrderNumber}
    />
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTasksForTechnician } from "@/lib/services/tasks";
import { getJobsAwaitingQC } from "@/lib/services/job-orders";
import { prisma } from "@/lib/prisma";
import { PhotosClient } from "@/components/frontliner/photos-client";

const DEFAULT_TECHNICIAN_MILESTONES = ["before", "during", "after"];
const DEFAULT_QC_MILESTONES = [
  "exterior_front",
  "exterior_rear",
  "exterior_left",
  "exterior_right",
  "interior",
  "engine_bay",
];

function parseMilestones(json: string | null, defaults: string[]): string[] {
  if (!json) return defaults;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch {
    return defaults;
  }
}

export default async function FrontlinerPhotosPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  // ---------------------------------------------------------------------------
  // TECHNICIAN mode
  // ---------------------------------------------------------------------------
  if (role === "TECHNICIAN") {
    const allTasks = await getTasksForTechnician(session.user.id);

    // Only active tasks (IN_PROGRESS or PAUSED)
    const activeTasks = allTasks.filter(
      (t) => t.status === "IN_PROGRESS" || t.status === "PAUSED"
    );

    const taskIds = activeTasks.map((t) => t.id);

    // Fetch existing progress photos for these tasks
    const photos =
      taskIds.length > 0
        ? await prisma.photo.findMany({
            where: {
              entityType: "TASK",
              entityId: { in: taskIds },
              stage: "PROGRESS",
              deletedAt: null,
            },
            select: {
              id: true,
              entityId: true,
              category: true,
              thumbnailPath: true,
            },
          })
        : [];

    // Group photos by task id
    const photosByTask: Record<string, typeof photos> = {};
    for (const p of photos) {
      if (!photosByTask[p.entityId]) photosByTask[p.entityId] = [];
      photosByTask[p.entityId].push(p);
    }

    const tasksProp = activeTasks.map((t) => ({
      id: t.id,
      name: t.name,
      jobOrderNumber: t.jobOrder.jobOrderNumber,
      plateNumber: t.jobOrder.vehicle.plateNumber,
      milestones: parseMilestones(
        t.serviceCatalog?.requiredMilestonePhotos ?? null,
        DEFAULT_TECHNICIAN_MILESTONES
      ),
      photos: (photosByTask[t.id] || []).map((p) => ({
        id: p.id,
        category: p.category,
        thumbnailPath: p.thumbnailPath,
      })),
    }));

    return <PhotosClient tasks={tasksProp} mode="technician" />;
  }

  // ---------------------------------------------------------------------------
  // QC_INSPECTOR mode
  // ---------------------------------------------------------------------------
  if (role === "QC_INSPECTOR") {
    const jobs = await getJobsAwaitingQC();
    const jobIds = jobs.map((j) => j.id);

    // Fetch existing QC photos for these jobs
    const photos =
      jobIds.length > 0
        ? await prisma.photo.findMany({
            where: {
              entityType: "JOB_ORDER",
              entityId: { in: jobIds },
              stage: "QC",
              deletedAt: null,
            },
            select: {
              id: true,
              entityId: true,
              category: true,
              thumbnailPath: true,
            },
          })
        : [];

    const photosByJob: Record<string, typeof photos> = {};
    for (const p of photos) {
      if (!photosByJob[p.entityId]) photosByJob[p.entityId] = [];
      photosByJob[p.entityId].push(p);
    }

    const tasksProp = jobs.map((j) => ({
      id: j.id,
      name: `QC - ${j.vehicle.make} ${j.vehicle.model}`,
      jobOrderNumber: j.jobOrderNumber,
      plateNumber: j.vehicle.plateNumber,
      milestones: DEFAULT_QC_MILESTONES,
      photos: (photosByJob[j.id] || []).map((p) => ({
        id: p.id,
        category: p.category,
        thumbnailPath: p.thumbnailPath,
      })),
    }));

    return <PhotosClient tasks={tasksProp} mode="qc" />;
  }

  // ---------------------------------------------------------------------------
  // Other roles — redirect back
  // ---------------------------------------------------------------------------
  redirect("/frontliner");
}

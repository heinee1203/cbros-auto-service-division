import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTaskDetail } from "@/lib/services/tasks";
import { TaskDetailView } from "@/components/frontliner/task-detail-view";

interface Props {
  params: { taskId: string };
}

export default async function FrontlinerTaskDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const task = await getTaskDetail(params.taskId);
  if (!task) redirect("/frontliner/my-tasks");

  // Serialize all dates to ISO strings for the client component
  const serialized = {
    id: task.id,
    name: task.name,
    status: task.status,
    description: task.description,
    estimatedHours: task.estimatedHours,
    actualHours: task.actualHours,
    jobOrderId: task.jobOrderId,
    jobOrder: {
      id: task.jobOrder.id,
      jobOrderNumber: task.jobOrder.jobOrderNumber,
      vehicle: {
        plateNumber: task.jobOrder.vehicle.plateNumber,
        make: task.jobOrder.vehicle.make,
        model: task.jobOrder.vehicle.model,
      },
    },
    serviceCatalog: task.serviceCatalog
      ? {
          id: task.serviceCatalog.id,
          name: task.serviceCatalog.name,
          category: task.serviceCatalog.category,
          requiredMilestonePhotos:
            task.serviceCatalog.requiredMilestonePhotos,
        }
      : null,
    timeEntries: task.timeEntries.map((te) => ({
      id: te.id,
      clockIn: te.clockIn.toISOString(),
      clockOut: te.clockOut?.toISOString() ?? null,
      breakMinutes: te.breakMinutes,
      netMinutes: te.netMinutes,
      technician: te.technician,
    })),
    materialUsages: task.materialUsages.map((mu) => ({
      id: mu.id,
      itemDescription: mu.itemDescription,
      quantity: mu.quantity,
      unit: mu.unit,
      actualCost: mu.actualCost,
    })),
    photos: task.photos.map((p) => ({
      id: p.id,
      category: p.category,
      thumbnailPath: p.thumbnailPath,
      fullSizePath: p.fullSizePath,
      stage: p.stage,
    })),
  };

  return <TaskDetailView task={serialized} />;
}

import { prisma } from "@/lib/prisma";
import { MILESTONE_LABELS } from "@/lib/constants";
import { TASK_STATUS_LABELS } from "@/types/enums";
import type { TaskInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Helper: get a setting value with fallback
// ---------------------------------------------------------------------------
async function getSettingValue(
  key: string,
  defaultValue: string
): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? defaultValue;
}

// ---------------------------------------------------------------------------
// 1. getTasksByJobOrder — all tasks for a job with photos grouped by task
// ---------------------------------------------------------------------------
export async function getTasksByJobOrder(jobOrderId: string) {
  const tasks = await prisma.task.findMany({
    where: { jobOrderId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      assignedTechnician: {
        select: { id: true, firstName: true, lastName: true },
      },
      serviceCatalog: {
        select: {
          id: true,
          name: true,
          category: true,
          requiredMilestonePhotos: true,
        },
      },
      dependsOnTask: {
        select: { id: true, name: true, status: true },
      },
      _count: {
        select: { timeEntries: true },
      },
    },
  });

  const taskIds = tasks.map((t) => t.id);

  // Fetch progress photos for all tasks in one query
  const photos =
    taskIds.length > 0
      ? await prisma.photo.findMany({
          where: {
            entityType: "TASK",
            entityId: { in: taskIds },
            stage: "PROGRESS",
            deletedAt: null,
          },
        })
      : [];

  // Group photos by taskId
  const photosByTaskId: Record<string, typeof photos> = {};
  for (const photo of photos) {
    if (!photosByTaskId[photo.entityId]) {
      photosByTaskId[photo.entityId] = [];
    }
    photosByTaskId[photo.entityId].push(photo);
  }

  return { tasks, photosByTaskId };
}

// ---------------------------------------------------------------------------
// 2. getTaskDetail — single task with full relations and photos
// ---------------------------------------------------------------------------
export async function getTaskDetail(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTechnician: {
        select: { id: true, firstName: true, lastName: true },
      },
      serviceCatalog: {
        select: {
          id: true,
          name: true,
          category: true,
          requiredMilestonePhotos: true,
        },
      },
      timeEntries: {
        where: { deletedAt: null },
        orderBy: { clockIn: "desc" },
        include: {
          technician: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      materialUsages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      dependsOnTask: {
        select: { id: true, name: true, status: true },
      },
      dependentTasks: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  if (!task) return null;

  const photos = await prisma.photo.findMany({
    where: {
      entityType: "TASK",
      entityId: taskId,
      deletedAt: null,
    },
    orderBy: { sortOrder: "asc" },
  });

  return { ...task, photos };
}

// ---------------------------------------------------------------------------
// 3. createTask — add a new task to a job order
// ---------------------------------------------------------------------------
export async function createTask(
  jobOrderId: string,
  data: TaskInput,
  userId?: string
) {
  const task = await prisma.task.create({
    data: {
      jobOrderId,
      name: data.name,
      description: data.description ?? null,
      serviceCatalogId: data.serviceCatalogId ?? null,
      status: "QUEUED",
      sortOrder: data.sortOrder ?? 0,
      estimatedHours: data.estimatedHours ?? 0,
      hourlyRate: data.hourlyRate ?? 0,
      assignedTechnicianId: data.assignedTechnicianId ?? null,
      dependsOnTaskId: data.dependsOnTaskId ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // Write activity log
  if (userId) {
    await prisma.jobActivity.create({
      data: {
        jobOrderId,
        type: "task_status_change",
        title: `${task.name} added to job`,
        userId,
      },
    });
  }

  return task;
}

// ---------------------------------------------------------------------------
// 4. updateTask — update task fields
// ---------------------------------------------------------------------------
export async function updateTask(
  taskId: string,
  data: Partial<TaskInput>,
  userId?: string
) {
  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
  });

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description ?? null,
      }),
      ...(data.serviceCatalogId !== undefined && {
        serviceCatalogId: data.serviceCatalogId ?? null,
      }),
      ...(data.estimatedHours !== undefined && {
        estimatedHours: data.estimatedHours,
      }),
      ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
      ...(data.assignedTechnicianId !== undefined && {
        assignedTechnicianId: data.assignedTechnicianId ?? null,
      }),
      ...(data.dependsOnTaskId !== undefined && {
        dependsOnTaskId: data.dependsOnTaskId ?? null,
      }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedBy: userId,
    },
  });

  // Log assignment change
  if (
    data.assignedTechnicianId !== undefined &&
    data.assignedTechnicianId !== existing.assignedTechnicianId &&
    userId
  ) {
    await prisma.jobActivity.create({
      data: {
        jobOrderId: existing.jobOrderId,
        type: "assignment_change",
        title: `${task.name} reassigned`,
        metadata: JSON.stringify({
          taskId: task.id,
          previousTechnicianId: existing.assignedTechnicianId,
          newTechnicianId: data.assignedTechnicianId,
        }),
        userId,
      },
    });
  }

  return task;
}

// ---------------------------------------------------------------------------
// 5. reorderTasks — update sort order for all tasks
// ---------------------------------------------------------------------------
export async function reorderTasks(jobOrderId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.task.update({
      where: { id },
      data: { sortOrder: index },
    })
  );
  await prisma.$transaction(updates);
}

// ---------------------------------------------------------------------------
// 6. transitionTaskStatus — validated status transition with side effects
// ---------------------------------------------------------------------------
export async function transitionTaskStatus(
  taskId: string,
  newStatus: string,
  userId?: string
) {
  // a) Fetch task with relations
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      serviceCatalog: {
        select: {
          id: true,
          name: true,
          requiredMilestonePhotos: true,
        },
      },
      dependsOnTask: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  // b) IN_PROGRESS validation: check dependency
  if (newStatus === "IN_PROGRESS") {
    if (task.dependsOnTaskId && task.dependsOnTask) {
      if (task.dependsOnTask.status !== "DONE") {
        throw new Error(
          `Blocked: waiting on "${task.dependsOnTask.name}" to be completed`
        );
      }
    }
  }

  // c) QC_REVIEW validation: photo gate
  if (newStatus === "QC_REVIEW") {
    if (task.serviceCatalog?.requiredMilestonePhotos) {
      let requiredMilestones: string[] = [];
      try {
        requiredMilestones = JSON.parse(
          task.serviceCatalog.requiredMilestonePhotos
        );
      } catch {
        // If parse fails, treat as no milestones required
      }

      if (requiredMilestones.length > 0) {
        // Get distinct categories from progress photos for this task
        const photos = await prisma.photo.findMany({
          where: {
            entityType: "TASK",
            entityId: taskId,
            stage: "PROGRESS",
            deletedAt: null,
          },
          select: { category: true },
        });

        const uploadedCategories = new Set(
          photos.map((p) => p.category).filter(Boolean)
        );

        const missingMilestones = requiredMilestones.filter(
          (m) => !uploadedCategories.has(m)
        );

        if (missingMilestones.length > 0) {
          const missingLabels = missingMilestones
            .map((m) => MILESTONE_LABELS[m] || m)
            .join(", ");
          throw new Error(
            `Missing required milestone photos: ${missingLabels}`
          );
        }
      }
    }
  }

  // e) REWORK: create a new rework task instead of changing status
  if (newStatus === "REWORK") {
    const reworkTask = await prisma.task.create({
      data: {
        jobOrderId: task.jobOrderId,
        serviceCatalogId: task.serviceCatalogId,
        name: `${task.name} (Rework)`,
        description: task.description,
        status: "QUEUED",
        sortOrder: task.sortOrder + 1,
        estimatedHours: task.estimatedHours,
        hourlyRate: task.hourlyRate,
        assignedTechnicianId: task.assignedTechnicianId,
        isRework: true,
        reworkOfTaskId: task.id,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Log rework creation
    if (userId) {
      await prisma.jobActivity.create({
        data: {
          jobOrderId: task.jobOrderId,
          type: "task_status_change",
          title: `${reworkTask.name} created for rework`,
          metadata: JSON.stringify({
            taskId: reworkTask.id,
            originalTaskId: task.id,
          }),
          userId,
        },
      });
    }

    return reworkTask;
  }

  // d) DONE: set completedAt and recalculate actualHours from TimeEntries
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedBy: userId,
  };

  if (newStatus === "IN_PROGRESS" && !task.startedAt) {
    updateData.startedAt = new Date();
  }

  if (newStatus === "DONE") {
    updateData.completedAt = new Date();

    // Recalculate actualHours from time entries
    const timeEntries = await prisma.timeEntry.findMany({
      where: { taskId, deletedAt: null },
      select: { netMinutes: true },
    });
    const totalMinutes = timeEntries.reduce(
      (sum, te) => sum + te.netMinutes,
      0
    );
    updateData.actualHours = parseFloat((totalMinutes / 60).toFixed(2));
  }

  // f) Update task status and log activity
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  if (userId) {
    const statusLabel =
      TASK_STATUS_LABELS[newStatus as keyof typeof TASK_STATUS_LABELS] ||
      newStatus;
    await prisma.jobActivity.create({
      data: {
        jobOrderId: task.jobOrderId,
        type: "task_status_change",
        title: `${task.name} moved to ${statusLabel}`,
        metadata: JSON.stringify({
          taskId: task.id,
          previousStatus: task.status,
          newStatus,
        }),
        userId,
      },
    });
  }

  // g) Check if all tasks are DONE — auto-advance job order to QC_PENDING
  const allTasks = await prisma.task.findMany({
    where: { jobOrderId: task.jobOrderId, deletedAt: null },
    select: { status: true },
  });

  if (allTasks.length > 0 && allTasks.every((t) => t.status === "DONE")) {
    await prisma.jobOrder.update({
      where: { id: task.jobOrderId },
      data: {
        status: "QC_PENDING",
        updatedBy: userId,
      },
    });
  }

  return updatedTask;
}

// ---------------------------------------------------------------------------
// 7. bulkTransitionStatus — transition multiple tasks, collecting results
// ---------------------------------------------------------------------------
export async function bulkTransitionStatus(
  taskIds: string[],
  newStatus: string,
  userId?: string
) {
  const succeeded: string[] = [];
  const failed: { taskId: string; error: string }[] = [];

  for (const taskId of taskIds) {
    try {
      await transitionTaskStatus(taskId, newStatus, userId);
      succeeded.push(taskId);
    } catch (err) {
      failed.push({
        taskId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { succeeded, failed };
}

// ---------------------------------------------------------------------------
// 8. checkHourOverrun — check if task exceeds estimated hours thresholds
// ---------------------------------------------------------------------------
export async function checkHourOverrun(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      id: true,
      name: true,
      estimatedHours: true,
      actualHours: true,
      jobOrderId: true,
    },
  });

  const jobOrder = await prisma.jobOrder.findUniqueOrThrow({
    where: { id: task.jobOrderId },
    select: { jobOrderNumber: true },
  });

  // Guard against zero/no estimated hours
  if (!task.estimatedHours || task.estimatedHours <= 0) {
    return { level: null as string | null, percentage: 0 };
  }

  const percentage = (task.actualHours / task.estimatedHours) * 100;

  const warningPctStr = await getSettingValue(
    "hour_overrun_warning_pct",
    "80"
  );
  const criticalPctStr = await getSettingValue(
    "hour_overrun_critical_pct",
    "100"
  );
  const warningPct = parseFloat(warningPctStr) || 80;
  const criticalPct = parseFloat(criticalPctStr) || 100;

  if (percentage >= criticalPct) {
    // Notify all MANAGER and OWNER users
    const managers = await prisma.user.findMany({
      where: {
        role: { in: ["MANAGER", "OWNER"] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    const actualDisplay = task.actualHours.toFixed(1);
    const estimatedDisplay = task.estimatedHours.toFixed(1);

    if (managers.length > 0) {
      await prisma.notification.createMany({
        data: managers.map((m) => ({
          recipientId: m.id,
          type: "TASK_OVERRUN",
          title: `Hour overrun on ${task.name}`,
          message: `${actualDisplay}h / ${estimatedDisplay}h on ${jobOrder.jobOrderNumber}`,
          entityType: "TASK",
          entityId: task.id,
        })),
      });
    }

    return { level: "critical" as const, percentage };
  }

  if (percentage >= warningPct) {
    return { level: "warning" as const, percentage };
  }

  return { level: null as string | null, percentage };
}

// ---------------------------------------------------------------------------
// 9. getTasksForTechnician — all tasks for a technician on active jobs
// ---------------------------------------------------------------------------
export async function getTasksForTechnician(technicianId: string) {
  return prisma.task.findMany({
    where: {
      assignedTechnicianId: technicianId,
      deletedAt: null,
      jobOrder: {
        status: { notIn: ["RELEASED", "CANCELLED"] },
      },
    },
    include: {
      jobOrder: {
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
          vehicle: {
            select: { id: true, plateNumber: true, make: true, model: true },
          },
        },
      },
      serviceCatalog: {
        select: { id: true, name: true, requiredMilestonePhotos: true },
      },
      timeEntries: {
        where: { technicianId, deletedAt: null },
        select: { clockIn: true, clockOut: true, breakMinutes: true },
      },
    },
    orderBy: [{ status: "desc" }, { sortOrder: "asc" }],
  });
}

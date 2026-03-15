import { prisma } from "@/lib/prisma";
import { checkHourOverrun } from "@/lib/services/tasks";
import type { ManualTimeEntryInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Helper: calculate net minutes from clock in/out and break
// ---------------------------------------------------------------------------
function calcNetMinutes(
  clockIn: Date,
  clockOut: Date,
  breakMinutes: number
): number {
  const totalMinutes = Math.round(
    (clockOut.getTime() - clockIn.getTime()) / 60000
  );
  return Math.max(0, totalMinutes - breakMinutes);
}

// ---------------------------------------------------------------------------
// 1. getActiveEntry - find the currently active (not clocked out) entry
// ---------------------------------------------------------------------------
export async function getActiveEntry(technicianId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: {
      technicianId,
      clockOut: null,
      deletedAt: null,
    },
    include: {
      task: {
        select: {
          id: true,
          name: true,
          jobOrderId: true,
          status: true,
        },
      },
      jobOrder: {
        select: {
          id: true,
          jobOrderNumber: true,
        },
      },
    },
    orderBy: { clockIn: "desc" },
  });

  return entry;
}

// ---------------------------------------------------------------------------
// 2. clockIn - start a new time entry (returns conflict if already clocked in)
// ---------------------------------------------------------------------------
export async function clockIn(
  technicianId: string,
  taskId: string,
  jobOrderId: string,
  source?: string
) {
  const existing = await getActiveEntry(technicianId);

  if (existing) {
    return {
      conflict: true,
      existingEntry: existing,
    };
  }

  const entry = await prisma.timeEntry.create({
    data: {
      technicianId,
      taskId,
      jobOrderId,
      clockIn: new Date(),
      source: source || "TABLET_CLOCK",
      createdBy: technicianId,
      updatedBy: technicianId,
    },
  });

  return entry;
}

// ---------------------------------------------------------------------------
// 3. forceClockOutAndIn - clock out existing entry and start new one
// ---------------------------------------------------------------------------
export async function forceClockOutAndIn(
  technicianId: string,
  newTaskId: string,
  newJobOrderId: string,
  source?: string
) {
  const existing = await getActiveEntry(technicianId);

  if (existing) {
    const now = new Date();
    const netMinutes = calcNetMinutes(
      existing.clockIn,
      now,
      existing.breakMinutes
    );

    await prisma.timeEntry.update({
      where: { id: existing.id },
      data: {
        clockOut: now,
        netMinutes,
        updatedBy: technicianId,
      },
    });

    await recalcActualHours(existing.taskId);

    // Non-critical, do not block clock in
    await checkHourOverrun(existing.taskId).catch(() => {});
  }

  const entry = await prisma.timeEntry.create({
    data: {
      technicianId,
      taskId: newTaskId,
      jobOrderId: newJobOrderId,
      clockIn: new Date(),
      source: source || "TABLET_CLOCK",
      createdBy: technicianId,
      updatedBy: technicianId,
    },
  });

  return entry;
}

// ---------------------------------------------------------------------------
// 4. clockOut - end a time entry
// ---------------------------------------------------------------------------
export async function clockOut(timeEntryId: string, userId?: string) {
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id: timeEntryId },
  });

  if (entry.clockOut) {
    throw new Error("Already clocked out");
  }

  const now = new Date();
  const netMinutes = calcNetMinutes(entry.clockIn, now, entry.breakMinutes);

  const updated = await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      clockOut: now,
      netMinutes,
      updatedBy: userId,
    },
  });

  await recalcActualHours(entry.taskId);

  // Non-critical
  await checkHourOverrun(entry.taskId).catch(() => {});

  return {
    ...updated,
    durationMinutes: netMinutes,
  };
}

// ---------------------------------------------------------------------------
// 5. startBreak - mark break start (stored as metadata in notes)
// ---------------------------------------------------------------------------
export async function startBreak(timeEntryId: string) {
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id: timeEntryId },
  });

  if (entry.clockOut) {
    throw new Error("Cannot start break on a clocked-out entry");
  }

  return prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      notes: JSON.stringify({
        ...(entry.notes ? JSON.parse(entry.notes) : {}),
        breakStartedAt: new Date().toISOString(),
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// 6. endBreak - calculate break duration and add to breakMinutes
// ---------------------------------------------------------------------------
export async function endBreak(timeEntryId: string) {
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id: timeEntryId },
  });

  if (entry.clockOut) {
    throw new Error("Cannot end break on a clocked-out entry");
  }

  let breakStartedAt: string | null = null;
  if (entry.notes) {
    try {
      const parsed = JSON.parse(entry.notes);
      breakStartedAt = parsed.breakStartedAt ?? null;
    } catch {
      // notes was not JSON
    }
  }

  if (!breakStartedAt) {
    throw new Error("No active break found");
  }

  const breakDuration = Math.round(
    (Date.now() - new Date(breakStartedAt).getTime()) / 60000
  );

  let notesObj: Record<string, unknown> = {};
  if (entry.notes) {
    try {
      notesObj = JSON.parse(entry.notes);
    } catch {
      notesObj = {};
    }
  }
  delete notesObj.breakStartedAt;

  return prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      breakMinutes: entry.breakMinutes + breakDuration,
      notes:
        Object.keys(notesObj).length > 0 ? JSON.stringify(notesObj) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// 7. getDailyEntries - all entries for a technician on a given date
// ---------------------------------------------------------------------------
export async function getDailyEntries(technicianId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return prisma.timeEntry.findMany({
    where: {
      technicianId,
      clockIn: {
        gte: startOfDay,
        lte: endOfDay,
      },
      deletedAt: null,
    },
    include: {
      task: {
        select: { id: true, name: true },
      },
      jobOrder: {
        select: { id: true, jobOrderNumber: true },
      },
    },
    orderBy: { clockIn: "asc" },
  });
}

// ---------------------------------------------------------------------------
// 8. getAssignedTasksForTech - tasks assigned to a technician (active)
// ---------------------------------------------------------------------------
export async function getAssignedTasksForTech(technicianId: string) {
  return prisma.task.findMany({
    where: {
      assignedTechnicianId: technicianId,
      status: { in: ["QUEUED", "IN_PROGRESS"] },
      deletedAt: null,
    },
    include: {
      jobOrder: {
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
        },
      },
    },
    orderBy: [{ status: "desc" }, { sortOrder: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// 9. createManualEntry - manager creates a manual time entry
// ---------------------------------------------------------------------------
export async function createManualEntry(
  data: ManualTimeEntryInput,
  userId: string
) {
  const clockInDate = new Date(data.clockIn);
  const clockOutDate = new Date(data.clockOut);

  if (clockOutDate <= clockInDate) {
    throw new Error("Clock out must be after clock in");
  }

  const netMinutes = calcNetMinutes(
    clockInDate,
    clockOutDate,
    data.breakMinutes ?? 0
  );

  const entry = await prisma.timeEntry.create({
    data: {
      taskId: data.taskId,
      jobOrderId: data.jobOrderId,
      technicianId: data.technicianId,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      breakMinutes: data.breakMinutes ?? 0,
      netMinutes,
      notes: data.notes ?? null,
      source: "MANUAL",
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalcActualHours(data.taskId);

  return entry;
}

// ---------------------------------------------------------------------------
// 10. updateEntry - update a time entry
// ---------------------------------------------------------------------------
export async function updateEntry(
  timeEntryId: string,
  data: unknown,
  userId: string
) {
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id: timeEntryId },
  });

  const updateData = data as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedBy: userId };

  if (updateData.clockIn !== undefined) {
    updates.clockIn = new Date(updateData.clockIn as string);
  }
  if (updateData.clockOut !== undefined) {
    updates.clockOut = new Date(updateData.clockOut as string);
  }
  if (updateData.breakMinutes !== undefined) {
    updates.breakMinutes = updateData.breakMinutes;
  }
  if (updateData.notes !== undefined) {
    updates.notes = updateData.notes;
  }

  const finalClockIn = (updates.clockIn as Date) ?? entry.clockIn;
  const finalClockOut = (updates.clockOut as Date) ?? entry.clockOut;
  const finalBreakMinutes =
    (updates.breakMinutes as number) ?? entry.breakMinutes;

  if (finalClockOut) {
    updates.netMinutes = calcNetMinutes(
      finalClockIn,
      finalClockOut,
      finalBreakMinutes
    );
  }

  const updated = await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: updates,
  });

  await recalcActualHours(entry.taskId);

  return updated;
}

// ---------------------------------------------------------------------------
// 11. deleteEntry - soft delete a time entry
// ---------------------------------------------------------------------------
export async function deleteEntry(timeEntryId: string, userId: string) {
  const entry = await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      deletedAt: new Date(),
      updatedBy: userId,
    },
  });

  await recalcActualHours(entry.taskId);

  return entry;
}

// ---------------------------------------------------------------------------
// Helper: recalculate actual hours on a task from its time entries
// ---------------------------------------------------------------------------
async function recalcActualHours(taskId: string) {
  const timeEntries = await prisma.timeEntry.findMany({
    where: { taskId, deletedAt: null },
    select: { netMinutes: true },
  });

  const totalMinutes = timeEntries.reduce(
    (sum, te) => sum + te.netMinutes,
    0
  );

  await prisma.task.update({
    where: { id: taskId },
    data: { actualHours: parseFloat((totalMinutes / 60).toFixed(2)) },
  });
}

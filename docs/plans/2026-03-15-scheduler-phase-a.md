# Shop Scheduler — Phase A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add schema (3 new models + extensions), enums, permissions, seed data, service layer, bay CRUD in settings, and sidebar navigation for the scheduler module.

**Architecture:** Prisma schema additions pushed via `db push`, service functions in `src/lib/services/scheduler.ts`, server actions in `src/lib/actions/scheduler-actions.ts`, Zod validators in `src/lib/validators.ts`. Bay management added to existing Settings page.

**Tech Stack:** Prisma/SQLite, Next.js server actions, Zod, TypeScript

---

### Task 1: Add Scheduler Enums

**Files:**
- Modify: `src/types/enums.ts`

**Step 1: Add enums to enums.ts**

Append after the last enum block (before any exports at bottom). Follow existing pattern (`as const` + type extraction + labels):

```typescript
// Bay types
export const BayType = {
  GENERAL: "GENERAL",
  PAINT_BOOTH: "PAINT_BOOTH",
  DETAIL: "DETAIL",
  PDR: "PDR",
  MECHANICAL: "MECHANICAL",
  WASH: "WASH",
} as const;
export type BayType = (typeof BayType)[keyof typeof BayType];

export const BAY_TYPE_LABELS: Record<BayType, string> = {
  GENERAL: "General",
  PAINT_BOOTH: "Paint Booth",
  DETAIL: "Detail",
  PDR: "PDR",
  MECHANICAL: "Mechanical",
  WASH: "Wash",
};

// Appointment types
export const AppointmentType = {
  ESTIMATE_INSPECTION: "ESTIMATE_INSPECTION",
  DROP_OFF: "DROP_OFF",
  PICK_UP: "PICK_UP",
  FOLLOW_UP: "FOLLOW_UP",
  CONSULTATION: "CONSULTATION",
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  ESTIMATE_INSPECTION: "Estimate Inspection",
  DROP_OFF: "Drop-Off",
  PICK_UP: "Pick-Up",
  FOLLOW_UP: "Follow-Up",
  CONSULTATION: "Consultation",
};

export const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, string> = {
  ESTIMATE_INSPECTION: "blue",
  DROP_OFF: "green",
  PICK_UP: "amber",
  FOLLOW_UP: "purple",
  CONSULTATION: "surface",
};

// Appointment status
export const AppointmentStatus = {
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  ARRIVED: "ARRIVED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "surface",
  CONFIRMED: "blue",
  ARRIVED: "green",
  NO_SHOW: "red",
  CANCELLED: "surface",
  COMPLETED: "green",
};
```

**Step 2: Commit**

```bash
git add src/types/enums.ts
git commit -m "feat(scheduler): add BayType, AppointmentType, AppointmentStatus enums"
```

---

### Task 2: Add Scheduler Permissions

**Files:**
- Modify: `src/lib/permissions.ts`

**Step 1: Add schedule permissions**

In the `PERMISSIONS` object (before the closing `} as const`), add after the "Warranty" section:

```typescript
  // Schedule
  "schedule:view": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "schedule:appointments": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "schedule:bays_manage": [UserRole.OWNER, UserRole.MANAGER],
  "schedule:bays_assign": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "schedule:tech_view": [UserRole.OWNER, UserRole.MANAGER],
  "schedule:tech_manage": [UserRole.OWNER, UserRole.MANAGER],
```

In the `ROUTE_PERMISSIONS` object, add:

```typescript
  "/schedule": "schedule:view",
```

**Step 2: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(scheduler): add schedule permissions"
```

---

### Task 3: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add 3 new models and extend existing models**

At the end of `schema.prisma`, before any closing comments, add a new section:

```prisma
// ============================================================================
// SCHEDULING
// ============================================================================

model Bay {
  id          String    @id @default(cuid())
  name        String
  type        String    @default("GENERAL") // BayType
  capacity    Int       @default(1)
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  notes       String?
  color       String?   // Hex color for calendar display

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  // Relations
  assignments BayAssignment[]

  @@index([isActive])
  @@index([deletedAt])
}

model BayAssignment {
  id          String    @id @default(cuid())
  bayId       String
  jobOrderId  String
  startDate   DateTime
  endDate     DateTime?
  notes       String?
  createdBy   String

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  bay           Bay       @relation(fields: [bayId], references: [id])
  jobOrder      JobOrder  @relation(fields: [jobOrderId], references: [id])
  createdByUser User      @relation("BayAssignmentCreator", fields: [createdBy], references: [id])

  @@index([bayId, startDate])
  @@index([jobOrderId])
}

model Appointment {
  id              String    @id @default(cuid())
  customerId      String
  vehicleId       String?
  estimateId      String?
  type            String    @default("DROP_OFF") // AppointmentType
  scheduledDate   DateTime
  scheduledTime   String    // "09:00", "14:30"
  duration        Int       @default(60) // minutes
  status          String    @default("SCHEDULED") // AppointmentStatus
  notes           String?
  reminderSent    Boolean   @default(false)
  createdBy       String

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  // Relations
  customer        Customer  @relation(fields: [customerId], references: [id])
  vehicle         Vehicle?  @relation(fields: [vehicleId], references: [id])
  estimate        EstimateRequest? @relation(fields: [estimateId], references: [id])
  createdByUser   User      @relation("AppointmentCreator", fields: [createdBy], references: [id])

  @@index([scheduledDate])
  @@index([customerId])
  @@index([status])
  @@index([deletedAt])
}
```

**Step 2: Extend the User model**

In the `model User` block, add these fields after `avatarUrl`:

```prisma
  // Scheduling
  workSchedule      String?   // JSON: {"mon":{"start":"08:00","end":"17:00"}, ...}
  maxConcurrentJobs Int       @default(2)
```

Add these relations after the existing relations list:

```prisma
  bayAssignmentsCreated BayAssignment[] @relation("BayAssignmentCreator")
  appointmentsCreated   Appointment[]   @relation("AppointmentCreator")
```

**Step 3: Extend the JobOrder model**

In the `model JobOrder` block, add after `notes`:

```prisma
  // Scheduling
  scheduledStartDate  DateTime?
  scheduledEndDate    DateTime?
  assignedBayId       String?
```

Add this relation after the existing relations:

```prisma
  bayAssignments      BayAssignment[]
```

**Step 4: Add relations to Customer model**

Add to the relations section of `model Customer`:

```prisma
  appointments      Appointment[]
```

**Step 5: Add relations to Vehicle model**

Add to the relations section of `model Vehicle`:

```prisma
  appointments      Appointment[]
```

**Step 6: Add relation to EstimateRequest model**

Add to the relations section of `model EstimateRequest`:

```prisma
  appointments      Appointment[]
```

**Step 7: Push schema changes**

```bash
npx prisma db push
```

Expected: Schema synced, no data loss (additive changes only).

**Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(scheduler): add Bay, BayAssignment, Appointment models + extend User/JobOrder"
```

---

### Task 4: Add Seed Data for Bays

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Add bay seed data**

At the end of the `main()` function, before the closing brace, add:

```typescript
  // ========================================================================
  // Default Bays
  // ========================================================================
  const defaultBays = [
    { name: "Bay 1", type: "GENERAL", color: "#3B82F6", sortOrder: 0 },
    { name: "Bay 2", type: "GENERAL", color: "#10B981", sortOrder: 1 },
    { name: "Bay 3", type: "GENERAL", color: "#F59E0B", sortOrder: 2 },
    { name: "Paint Booth", type: "PAINT_BOOTH", color: "#EF4444", sortOrder: 3 },
    { name: "Detail Bay", type: "DETAIL", color: "#8B5CF6", sortOrder: 4 },
    { name: "PDR Station", type: "PDR", color: "#EC4899", sortOrder: 5 },
  ];

  for (const bay of defaultBays) {
    const existing = await prisma.bay.findFirst({
      where: { name: bay.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.bay.create({ data: bay });
    }
  }
  console.log(`  Created ${defaultBays.length} default bays`);
```

**Step 2: Run seed**

```bash
npx prisma db seed
```

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(scheduler): add default bay seed data"
```

---

### Task 5: Add Zod Validators for Scheduler

**Files:**
- Modify: `src/lib/validators.ts`

**Step 1: Add scheduler validators**

Append to `validators.ts`:

```typescript
// ============================================================================
// SCHEDULER VALIDATORS
// ============================================================================

export const createBaySchema = z.object({
  name: z.string().min(1, "Bay name is required").max(100),
  type: z.enum(["GENERAL", "PAINT_BOOTH", "DETAIL", "PDR", "MECHANICAL", "WASH"]),
  capacity: z.number().int().min(1).max(5).default(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateBaySchema = createBaySchema.partial();

export const createAppointmentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  vehicleId: z.string().optional().nullable(),
  estimateId: z.string().optional().nullable(),
  type: z.enum(["ESTIMATE_INSPECTION", "DROP_OFF", "PICK_UP", "FOLLOW_UP", "CONSULTATION"]),
  scheduledDate: z.string().min(1, "Date is required"), // ISO date string
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
  duration: z.number().int().min(15).max(480).default(60),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "CONFIRMED", "ARRIVED", "NO_SHOW", "CANCELLED", "COMPLETED"]),
  notes: z.string().max(1000).optional().nullable(),
});

export const assignBaySchema = z.object({
  jobOrderId: z.string().min(1),
  bayId: z.string().min(1),
  startDate: z.string().min(1), // ISO date string
  endDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
```

**Step 2: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat(scheduler): add Zod validators for bays, appointments, assignments"
```

---

### Task 6: Create Scheduler Service Layer

**Files:**
- Create: `src/lib/services/scheduler.ts`

**Step 1: Create the service file**

```typescript
import { prisma } from "@/lib/prisma";

// ============================================================================
// BAY FUNCTIONS
// ============================================================================

export async function getBays() {
  return prisma.bay.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      assignments: {
        where: { endDate: null },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              vehicle: { select: { plateNumber: true, make: true, model: true } },
            },
          },
        },
      },
    },
  });
}

export async function createBay(data: {
  name: string;
  type: string;
  capacity?: number;
  color?: string | null;
  notes?: string | null;
  sortOrder?: number;
}) {
  return prisma.bay.create({ data });
}

export async function updateBay(id: string, data: {
  name?: string;
  type?: string;
  capacity?: number;
  color?: string | null;
  notes?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  return prisma.bay.update({ where: { id }, data });
}

export async function deleteBay(id: string) {
  // Soft delete — check no active assignments
  const activeAssignments = await prisma.bayAssignment.count({
    where: { bayId: id, endDate: null },
  });
  if (activeAssignments > 0) {
    throw new Error("Cannot delete bay with active vehicle assignments");
  }
  return prisma.bay.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function assignJobToBay(data: {
  jobOrderId: string;
  bayId: string;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
  createdBy: string;
}) {
  // Check for conflicts
  const conflicts = await getConflicts(data.bayId, data.startDate, data.endDate ?? null);
  if (conflicts.length > 0) {
    throw new Error("Bay is already occupied during this time period");
  }

  // Also update JobOrder.assignedBayId
  await prisma.jobOrder.update({
    where: { id: data.jobOrderId },
    data: { assignedBayId: data.bayId },
  });

  return prisma.bayAssignment.create({ data });
}

export async function releaseFromBay(assignmentId: string) {
  const assignment = await prisma.bayAssignment.update({
    where: { id: assignmentId },
    data: { endDate: new Date() },
  });

  // Clear JobOrder.assignedBayId
  await prisma.jobOrder.update({
    where: { id: assignment.jobOrderId },
    data: { assignedBayId: null },
  });

  return assignment;
}

export async function getBayTimeline(startDate: Date, endDate: Date) {
  const bays = await prisma.bay.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      assignments: {
        where: {
          OR: [
            { startDate: { lte: endDate }, endDate: { gte: startDate } },
            { startDate: { lte: endDate }, endDate: null },
          ],
        },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              priority: true,
              customer: { select: { firstName: true, lastName: true } },
              vehicle: { select: { plateNumber: true, make: true, model: true, color: true } },
              primaryTechnician: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });
  return bays;
}

export async function getBayAvailability(bayId: string, startDate: Date, endDate: Date) {
  const assignments = await prisma.bayAssignment.findMany({
    where: {
      bayId,
      OR: [
        { startDate: { lte: endDate }, endDate: { gte: startDate } },
        { startDate: { lte: endDate }, endDate: null },
      ],
    },
    orderBy: { startDate: "asc" },
  });
  return assignments;
}

export async function getConflicts(bayId: string, startDate: Date, endDate: Date | null) {
  const effectiveEnd = endDate ?? new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  return prisma.bayAssignment.findMany({
    where: {
      bayId,
      OR: [
        { startDate: { lt: effectiveEnd }, endDate: { gt: startDate } },
        { startDate: { lt: effectiveEnd }, endDate: null },
      ],
    },
  });
}

// ============================================================================
// APPOINTMENT FUNCTIONS
// ============================================================================

export async function createAppointment(data: {
  customerId: string;
  vehicleId?: string | null;
  estimateId?: string | null;
  type: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration?: number;
  notes?: string | null;
  createdBy: string;
}) {
  return prisma.appointment.create({
    data: {
      ...data,
      status: "SCHEDULED",
    },
  });
}

export async function getAppointments(
  startDate: Date,
  endDate: Date,
  filters?: { status?: string; type?: string }
) {
  const where: any = {
    scheduledDate: { gte: startDate, lte: endDate },
    deletedAt: null,
  };
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  return prisma.appointment.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, company: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true } },
      estimate: { select: { id: true, requestNumber: true, status: true } },
      createdByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
  });
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, company: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true } },
      estimate: { select: { id: true, requestNumber: true, status: true } },
    },
  });
}

export async function updateAppointment(id: string, data: {
  customerId?: string;
  vehicleId?: string | null;
  estimateId?: string | null;
  type?: string;
  scheduledDate?: Date;
  scheduledTime?: string;
  duration?: number;
  notes?: string | null;
}) {
  return prisma.appointment.update({ where: { id }, data });
}

export async function updateAppointmentStatus(id: string, status: string, notes?: string | null) {
  const updateData: any = { status };
  if (notes !== undefined) updateData.notes = notes;
  return prisma.appointment.update({ where: { id }, data: updateData });
}

export async function cancelAppointment(id: string, reason?: string) {
  return prisma.appointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      notes: reason ? `Cancelled: ${reason}` : undefined,
    },
  });
}

export async function getAppointmentsByDate(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return getAppointments(startOfDay, endOfDay);
}

// ============================================================================
// TECHNICIAN SCHEDULING FUNCTIONS
// ============================================================================

export async function getTechnicianSchedule(techId: string, startDate: Date, endDate: Date) {
  const tasks = await prisma.task.findMany({
    where: {
      assignedTechnicianId: techId,
      deletedAt: null,
      jobOrder: {
        deletedAt: null,
        status: { notIn: ["CANCELLED", "RELEASED"] },
      },
    },
    include: {
      jobOrder: {
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
          priority: true,
          scheduledStartDate: true,
          scheduledEndDate: true,
          vehicle: { select: { plateNumber: true, make: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      userId: techId,
      clockIn: { gte: startDate, lte: endDate },
    },
    orderBy: { clockIn: "asc" },
  });

  return { tasks, timeEntries };
}

export async function getAllTechSchedules(startDate: Date, endDate: Date) {
  const techs = await prisma.user.findMany({
    where: {
      role: { in: ["TECHNICIAN", "QC_INSPECTOR"] },
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workSchedule: true,
      maxConcurrentJobs: true,
      assignedTasks: {
        where: {
          deletedAt: null,
          jobOrder: {
            deletedAt: null,
            status: { notIn: ["CANCELLED", "RELEASED"] },
          },
        },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              priority: true,
              scheduledStartDate: true,
              scheduledEndDate: true,
              vehicle: { select: { plateNumber: true, make: true, model: true } },
            },
          },
        },
      },
      timeEntries: {
        where: {
          clockIn: { gte: startDate, lte: endDate },
        },
        orderBy: { clockIn: "asc" },
      },
    },
    orderBy: [{ firstName: "asc" }],
  });
  return techs;
}

export async function getShopCapacity(startDate: Date, endDate: Date) {
  const bays = await prisma.bay.count({ where: { isActive: true, deletedAt: null } });
  const techs = await prisma.user.count({
    where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
  });

  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const hoursPerDay = 8; // default, could be from settings

  return {
    totalBays: bays,
    totalTechs: techs,
    bayHoursAvailable: bays * dayCount * hoursPerDay,
    techHoursAvailable: techs * dayCount * hoursPerDay,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/services/scheduler.ts
git commit -m "feat(scheduler): add service layer with bay, appointment, tech scheduling functions"
```

---

### Task 7: Create Scheduler Server Actions

**Files:**
- Create: `src/lib/actions/scheduler-actions.ts`

**Step 1: Create the actions file**

```typescript
"use server";

import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import * as scheduler from "@/lib/services/scheduler";
import {
  createBaySchema,
  updateBaySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  assignBaySchema,
} from "@/lib/validators";

type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

// ============================================================================
// BAY ACTIONS
// ============================================================================

export async function getBaysAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:view"))
    return { success: false, error: "Permission denied" };

  try {
    const bays = await scheduler.getBays();
    return { success: true, data: bays };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch bays" };
  }
}

export async function createBayAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_manage"))
    return { success: false, error: "Permission denied" };

  const parsed = createBaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const bay = await scheduler.createBay(parsed.data);
    revalidatePath("/settings");
    revalidatePath("/schedule/bays");
    return { success: true, data: bay };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create bay" };
  }
}

export async function updateBayAction(id: string, input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_manage"))
    return { success: false, error: "Permission denied" };

  const parsed = updateBaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const bay = await scheduler.updateBay(id, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/schedule/bays");
    return { success: true, data: bay };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update bay" };
  }
}

export async function deleteBayAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_manage"))
    return { success: false, error: "Permission denied" };

  try {
    await scheduler.deleteBay(id);
    revalidatePath("/settings");
    revalidatePath("/schedule/bays");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete bay" };
  }
}

// ============================================================================
// APPOINTMENT ACTIONS
// ============================================================================

export async function createAppointmentAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const appointment = await scheduler.createAppointment({
      ...parsed.data,
      scheduledDate: new Date(parsed.data.scheduledDate),
      createdBy: session.user.id,
    });
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true, data: appointment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create appointment" };
  }
}

export async function updateAppointmentAction(id: string, input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  const parsed = updateAppointmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const data: any = { ...parsed.data };
    if (data.scheduledDate) data.scheduledDate = new Date(data.scheduledDate);
    const appointment = await scheduler.updateAppointment(id, data);
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true, data: appointment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update appointment" };
  }
}

export async function updateAppointmentStatusAction(id: string, input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  const parsed = updateAppointmentStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const appointment = await scheduler.updateAppointmentStatus(id, parsed.data.status, parsed.data.notes);
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true, data: appointment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

export async function cancelAppointmentAction(id: string, reason?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:appointments"))
    return { success: false, error: "Permission denied" };

  try {
    await scheduler.cancelAppointment(id, reason);
    revalidatePath("/schedule/appointments");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel appointment" };
  }
}

// ============================================================================
// BAY ASSIGNMENT ACTIONS
// ============================================================================

export async function assignJobToBayAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_assign"))
    return { success: false, error: "Permission denied" };

  const parsed = assignBaySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const assignment = await scheduler.assignJobToBay({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      createdBy: session.user.id,
    });
    revalidatePath("/schedule/bays");
    revalidatePath("/jobs");
    return { success: true, data: assignment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to assign bay" };
  }
}

export async function releaseFromBayAction(assignmentId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "schedule:bays_assign"))
    return { success: false, error: "Permission denied" };

  try {
    await scheduler.releaseFromBay(assignmentId);
    revalidatePath("/schedule/bays");
    revalidatePath("/jobs");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to release from bay" };
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/scheduler-actions.ts
git commit -m "feat(scheduler): add server actions for bays, appointments, assignments"
```

---

### Task 8: Add Schedule to Sidebar & Bottom Nav

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/bottom-nav.tsx`

**Step 1: Add Calendar icon import to sidebar.tsx**

In the import block, add `Calendar` to the lucide-react imports:

```typescript
import {
  LayoutDashboard,
  Wrench,
  Calendar,
  ClipboardList,
  // ...rest
} from "lucide-react";
```

Add to the ICONS object:

```typescript
const ICONS = {
  LayoutDashboard,
  Wrench,
  Calendar,
  ClipboardList,
  // ...rest
} as const;
```

**Step 2: Add Schedule nav item to sidebar NAV_ITEMS**

Insert after the "Job Orders" item and before "Estimates":

```typescript
  {
    label: "Schedule",
    href: "/schedule",
    icon: "Calendar",
    permission: "schedule:view",
  },
```

**Step 3: Add Schedule to bottom-nav.tsx**

Add `Calendar` to lucide-react imports. Add to `MORE_ITEMS` array (insert at beginning, before Vehicles):

```typescript
  { label: "Schedule", href: "/schedule", icon: Calendar, permission: "schedule:view" },
```

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/bottom-nav.tsx
git commit -m "feat(scheduler): add Schedule to sidebar and bottom navigation"
```

---

### Task 9: Create Schedule Route Placeholder Pages

**Files:**
- Create: `src/app/(dashboard)/schedule/page.tsx`
- Create: `src/app/(dashboard)/schedule/appointments/page.tsx`
- Create: `src/app/(dashboard)/schedule/bays/page.tsx`
- Create: `src/app/(dashboard)/schedule/technicians/page.tsx`

**Step 1: Create schedule landing page (redirects to appointments)**

`src/app/(dashboard)/schedule/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function SchedulePage() {
  redirect("/schedule/appointments");
}
```

**Step 2: Create appointments placeholder**

`src/app/(dashboard)/schedule/appointments/page.tsx`:

```tsx
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary">Appointments</h1>
      <p className="text-surface-500 mt-1">Appointment calendar coming in Phase B.</p>
    </div>
  );
}
```

**Step 3: Create bays placeholder**

`src/app/(dashboard)/schedule/bays/page.tsx`:

```tsx
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";

export default async function BaySchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary">Bay Schedule</h1>
      <p className="text-surface-500 mt-1">Bay timeline coming in Phase C.</p>
    </div>
  );
}
```

**Step 4: Create technicians placeholder**

`src/app/(dashboard)/schedule/technicians/page.tsx`:

```tsx
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";

export default async function TechSchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary">Technician Schedule</h1>
      <p className="text-surface-500 mt-1">Technician timeline coming in Phase D.</p>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/app/(dashboard)/schedule/
git commit -m "feat(scheduler): add schedule route placeholder pages"
```

---

### Task 10: Add Bay Management to Settings Page

**Files:**
- Create: `src/components/schedule/bay-management.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (add Bay Management section)

**Step 1: Create BayManagement component**

`src/components/schedule/bay-management.tsx`:

Build a client component that:
- Fetches bays via the `getBaysAction()` server action on mount
- Displays a list of bays with: name, type badge, color swatch, active toggle, edit/delete buttons
- "Add Bay" button opens inline form with: name input, type select, color picker (hex input), capacity number, notes textarea
- Edit mode: inline editing of existing bay fields
- Delete: confirmation dialog then `deleteBayAction()`
- Sort order: display order number, editable
- Uses existing project patterns: same card/section styling as other settings sections

Read the existing Settings page first to match its section pattern (expandable cards, headings, form layouts).

**Step 2: Add BayManagement section to settings/page.tsx**

Import and render `<BayManagement />` as a new section in the settings page, after existing sections. Guard with `can(session.user.role, "schedule:bays_manage")`.

**Step 3: Commit**

```bash
git add src/components/schedule/bay-management.tsx src/app/(dashboard)/settings/page.tsx
git commit -m "feat(scheduler): add bay management UI to settings page"
```

---

### Task 11: Build Verification

**Step 1: Run build**

```bash
npx prisma generate && npx next build
```

Expected: 0 errors. New routes visible:
- `/schedule`
- `/schedule/appointments`
- `/schedule/bays`
- `/schedule/technicians`

**Step 2: Verify sidebar**

Log in → sidebar shows "Schedule" between "Job Orders" and "Estimates" with calendar icon. Click → redirects to `/schedule/appointments`.

**Step 3: Verify settings**

Go to Settings → "Bay Management" section visible → shows 6 default bays → can add/edit/delete bays.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(scheduler): Phase A complete — foundation, schema, service layer, bay management"
```

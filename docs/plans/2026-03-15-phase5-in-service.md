# Phase 5: In-Service / Work In Progress — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Kanban task board, man-hour time tracking with PIN clock, progress photo milestone gates, materials consumption, supplemental estimates, job timeline, and enriched job overview — the core operational engine of the shop.

**Architecture:** Server actions + service layer (established pattern). New `JobActivity` model for purpose-built timeline. `@hello-pangea/dnd` for Kanban drag-and-drop. Live timers use `Date.now() - clockIn` pattern (not `setInterval` counter) with `visibilitychange` listener for tab-backgrounding resilience. All money in centavos (Int). Philippine locale (₱, Asia/Manila).

**Tech Stack:** Next.js 14, React 18, Prisma/SQLite, @hello-pangea/dnd, Sharp (photos), HTML5 Canvas (signatures), Zod, Sonner, Lucide, Tailwind CSS.

---

## Execution Order & Parallelization

**Batch 1 (Tasks 1-5):** Constants, validators, task service, task actions, task API routes
**Batch 2 (Tasks 6-9):** Time entry service, time entry actions, time entry API routes, job activity service
**Batch 3 (Tasks 10-14):** Task board UI (Kanban + list + detail slide-over), PIN clock page, quick clock
**Batch 4 (Tasks 15-17):** Milestone photo config, progress photo UI, job photos gallery
**Batch 5 (Tasks 18-20):** Materials service + UI, job timeline component, daily notes
**Batch 6 (Tasks 21-24):** Supplemental estimate service + actions + API + UI
**Batch 7 (Tasks 25-27):** Job overview enrichment, jobs list enhancements, final integration

**Parallel opportunities within batches:**
- Batch 1: Tasks 1-2 first, then 3-5 in parallel
- Batch 2: Tasks 6-9 can be parallelized (independent services)
- Batch 3: Tasks 10-12 depend on Batch 1-2, Task 13 (PIN clock) independent
- Batch 4: Tasks 15-17 can be parallelized
- Batch 5: Tasks 18-20 can be parallelized
- Batch 6: Tasks 21-22 first, then 23-24 in parallel
- Batch 7: Tasks 25-27 can be parallelized

---

## Task 1: Install Dependencies & Add Phase 5 Constants

**Files:**
- Modify: `package.json` (add `@hello-pangea/dnd`)
- Modify: `src/lib/constants.ts` (add task board constants, milestone labels, dependency chains)
- Modify: `src/types/enums.ts` (add task status labels/colors, supplement status labels/colors)

**What to do:**

1. `npm install @hello-pangea/dnd`

2. Add to `src/types/enums.ts`:
```typescript
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  QUEUED: "Queued",
  IN_PROGRESS: "In Progress",
  PAUSED: "Paused",
  QC_REVIEW: "QC Review",
  DONE: "Done",
  REWORK: "Rework",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  QUEUED: "bg-surface-200 text-surface-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  QC_REVIEW: "bg-purple-100 text-purple-700",
  DONE: "bg-success-100 text-success-600",
  REWORK: "bg-danger-100 text-danger-600",
};

export const SUPPLEMENT_STATUS_LABELS: Record<SupplementStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  DENIED: "Denied",
  APPEAL: "Appeal",
};

export const SUPPLEMENT_STATUS_COLORS: Record<SupplementStatus, string> = {
  DRAFT: "bg-surface-200 text-surface-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  APPROVED: "bg-success-100 text-success-600",
  DENIED: "bg-danger-100 text-danger-600",
  APPEAL: "bg-warning-100 text-warning-600",
};

export const TIME_ENTRY_SOURCE_LABELS: Record<TimeEntrySource, string> = {
  MANUAL: "Manual",
  PIN_CLOCK: "PIN Clock",
  TABLET_CLOCK: "Task Board",
};
```

3. Add to `src/lib/constants.ts`:
```typescript
// Kanban board columns
export const TASK_BOARD_COLUMNS = [
  { id: "QUEUED", label: "Queued" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "PAUSED", label: "Paused" },
  { id: "QC_REVIEW", label: "QC Review" },
  { id: "DONE", label: "Done" },
] as const;

// Milestone photo label mapping
export const MILESTONE_LABELS: Record<string, string> = {
  before: "Before",
  after: "After",
  in_progress: "In Progress",
  before_disassembly: "Before Disassembly",
  after_disassembly: "After Disassembly",
  after_metalwork: "After Metalwork",
  after_filler: "After Body Filler",
  after_primer: "After Primer",
  after_paint: "After Paint",
  after_reassembly: "After Reassembly",
  after_install: "After Install",
  during_straightening: "During Straightening",
  during_welding: "During Welding",
  after_sanding: "After Sanding",
  after_masking: "After Masking",
  after_base_coat: "After Base Coat",
  after_clear_coat: "After Clear Coat",
  after_cut_buff: "After Cut & Buff",
  after_clear: "After Clear",
  design_layout: "Design Layout",
  fifty_fifty: "50/50 Comparison",
  after_wet_sand: "After Wet Sand",
  after_compound: "After Compound",
  after_polish: "After Polish",
  after_decontamination: "After Decontamination",
  after_correction: "After Correction",
  during_application: "During Application",
  after_curing: "After Curing",
  after_prep: "After Prep",
  before_cleaning: "Before Cleaning",
  after_degreasing: "After Degreasing",
  before_detail: "Before Detail",
  after_detail: "After Detail",
};

// Suggested dependency chains by service category
export const DEPENDENCY_CHAINS: Record<string, string[]> = {
  "Collision Repair": [
    "Disassembly",
    "Metalwork",
    "Body Filler",
    "Primer",
    "Paint",
    "Clear Coat",
    "Reassembly",
  ],
  "Painting & Refinishing": [
    "Sanding/Prep",
    "Masking",
    "Primer/Sealer",
    "Base Coat",
    "Clear Coat",
    "Cut/Buff",
    "Reassembly",
  ],
  "Buffing & Paint Correction": [
    "Wash/Decon",
    "Paint Correction",
    "Final Polish",
  ],
  "Car Detailing": [
    "Wash/Decon",
    "Paint Correction",
    "Coating Application",
    "Final Inspection",
  ],
  "Undercoating & Rust Protection": [
    "Cleaning",
    "Degreasing",
    "Application",
    "Curing/Drying",
  ],
};

// Job activity type icons (for timeline rendering)
export const JOB_ACTIVITY_TYPES = [
  "status_change",
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
  "photo_upload",
  "note",
  "material_logged",
  "supplement_created",
  "supplement_approved",
  "task_status_change",
  "assignment_change",
  "qc_result",
] as const;
```

**Build checkpoint:** `npx next build` — should pass.

---

## Task 2: Zod Validators for Phase 5

**Files:**
- Modify: `src/lib/validators.ts` (add task, time entry, material, supplement schemas)

**What to add:**

```typescript
// ---------------------------------------------------------------------------
// Task — create/update
// ---------------------------------------------------------------------------
export const taskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional().nullable(),
  serviceCatalogId: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).default(0),
  hourlyRate: z.coerce.number().min(0).default(0),
  assignedTechnicianId: z.string().optional().nullable(),
  dependsOnTaskId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type TaskInput = z.infer<typeof taskSchema>;

// ---------------------------------------------------------------------------
// Time Entry — manual creation/edit
// ---------------------------------------------------------------------------
export const manualTimeEntrySchema = z.object({
  taskId: z.string().min(1, "Task is required"),
  jobOrderId: z.string().min(1, "Job order is required"),
  technicianId: z.string().min(1, "Technician is required"),
  clockIn: z.string().min(1, "Clock in time is required"),
  clockOut: z.string().min(1, "Clock out time is required"),
  breakMinutes: z.coerce.number().int().min(0).default(0),
  notes: z.string().min(1, "Notes are required for manual entries"),
});
export type ManualTimeEntryInput = z.infer<typeof manualTimeEntrySchema>;

// ---------------------------------------------------------------------------
// Material Usage — log
// ---------------------------------------------------------------------------
export const materialUsageSchema = z.object({
  taskId: z.string().optional().nullable(),
  itemDescription: z.string().min(1, "Item description is required"),
  partNumber: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be positive").default(1),
  unit: z.string().default("pcs"),
  actualCost: z.coerce.number().min(0, "Cost cannot be negative"),
  estimatedLineItemId: z.string().optional().nullable(),
});
export type MaterialUsageInput = z.infer<typeof materialUsageSchema>;

// ---------------------------------------------------------------------------
// Supplemental Estimate
// ---------------------------------------------------------------------------
export const supplementSchema = z.object({
  description: z.string().min(1, "Description is required"),
  reason: z.string().optional().nullable(),
});
export type SupplementInput = z.infer<typeof supplementSchema>;

export const supplementLineItemSchema = z.object({
  group: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().default("pcs"),
  unitCost: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type SupplementLineItemInput = z.infer<typeof supplementLineItemSchema>;

// ---------------------------------------------------------------------------
// Job Note
// ---------------------------------------------------------------------------
export const jobNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  mentions: z.array(z.string()).optional().default([]),
});
export type JobNoteInput = z.infer<typeof jobNoteSchema>;
```

**Build checkpoint:** `npx next build` — should pass.

---

## Task 3: Task Service (`lib/services/tasks.ts`)

**Files:**
- Create: `src/lib/services/tasks.ts`

**Functions to implement:**

1. **`getTasksByJobOrder(jobOrderId)`** — All tasks for a job with:
   - `assignedTechnician` (firstName, lastName)
   - `serviceCatalog` (name, category, requiredMilestonePhotos)
   - `_count: { timeEntries: true }`
   - `dependsOnTask` (id, name, status)
   - Ordered by `sortOrder asc`
   - Also fetch related photos: `prisma.photo.findMany({ where: { entityType: 'TASK', entityId: { in: taskIds }, stage: 'PROGRESS', deletedAt: null } })` — return separately grouped by taskId

2. **`getTaskDetail(taskId)`** — Single task with ALL relations:
   - assignedTechnician, serviceCatalog
   - timeEntries (with technician name, ordered by clockIn desc)
   - materialUsages (ordered by createdAt desc)
   - dependsOnTask (id, name, status)
   - dependentTasks (tasks that depend on this one)
   - Photos where entityType='TASK' and entityId=taskId

3. **`createTask(jobOrderId, data: TaskInput, userId)`** — Manual task addition. Set status QUEUED.

4. **`updateTask(taskId, data: Partial<TaskInput>, userId)`** — Update fields. If assignedTechnicianId changed, write JobActivity (assignment_change).

5. **`reorderTasks(jobOrderId, orderedIds: string[])`** — Loop through orderedIds, update sortOrder = index.

6. **`transitionTaskStatus(taskId, newStatus, userId)`** — The critical function:
   - Fetch the task with serviceCatalog (for milestones), dependsOnTask (for dependency check)
   - **→ IN_PROGRESS:** If `dependsOnTaskId` is set, check that dependency task status is DONE. If not, throw error "Waiting on: [dep task name]". If first time starting, set `startedAt = new Date()`.
   - **→ QC_REVIEW:** Parse `serviceCatalog.requiredMilestonePhotos` (JSON array). Count distinct `category` values from Photos where `entityType='TASK'` and `entityId=taskId` and `stage='PROGRESS'`. If not all milestones have ≥1 photo, throw error with "X of Y milestones documented. Required: [missing milestone labels]".
   - **→ DONE:** Set `completedAt = new Date()`. Recalculate `actualHours` = sum(netMinutes) from TimeEntries / 60. Write JobActivity.
   - **→ REWORK:** Create new Task with `isRework: true`, `reworkOfTaskId: taskId`, copy name + service catalog + tech assignment. Write JobActivity.
   - For all transitions: update task status, write JobActivity (task_status_change).
   - After transition: check if ALL tasks for this job are DONE → if so, auto-transition JobOrder status to QC_PENDING.

7. **`bulkTransitionStatus(taskIds, newStatus, userId)`** — Loop through tasks, call `transitionTaskStatus` for each. Collect successes and failures, return results.

8. **`getSuggestedDependencyChain(serviceCategory)`** — Return the chain from `DEPENDENCY_CHAINS` constant, or empty array if no match.

9. **`checkHourOverrun(taskId)`** — Fetch task with estimatedHours and actualHours. Fetch settings for thresholds. Return `{ warningLevel: null | 'warning' | 'critical', percentage: number }`. If critical (100%+), create Notification for MANAGER/OWNER users: "Task [name] on [JO number] has exceeded estimated hours ([actual]h / [estimated]h)".

**Build checkpoint:** `npx next build` — should pass.

---

## Task 4: Task Server Actions (`lib/actions/task-actions.ts`)

**Files:**
- Create: `src/lib/actions/task-actions.ts`

**Actions to implement (follow ActionResult pattern from `estimate-actions.ts`):**

1. `createTaskAction(jobOrderId, data: TaskInput)` — Zod validate, check `tasks:manage` permission, call service, revalidate `/jobs/[id]`
2. `updateTaskAction(taskId, data: Partial<TaskInput>)` — Zod validate partial, check permission, call service, revalidate
3. `reorderTasksAction(jobOrderId, orderedIds: string[])` — Check permission, call service, revalidate
4. `transitionTaskStatusAction(taskId, newStatus)` — Check `tasks:update_status` permission, call service, revalidate. Return error message on validation failure (dependency/photo gate).
5. `bulkTransitionStatusAction(taskIds: string[], newStatus)` — Check permission, call service, revalidate
6. `deleteTaskAction(taskId)` — Soft delete, check `tasks:manage` permission, revalidate

**Build checkpoint:** `npx next build` — should pass.

---

## Task 5: Task API Routes

**Files:**
- Create: `src/app/api/jobs/[id]/tasks/route.ts` — GET handler for task list by job order

**GET handler:**
- Auth check
- Call `getTasksByJobOrder(id)`
- Return tasks + photos grouped by task

**Build checkpoint:** `npx next build` — should pass.

---

## Task 6: Time Entry Service (`lib/services/time-entries.ts`)

**Files:**
- Create: `src/lib/services/time-entries.ts`

**Functions to implement:**

1. **`clockIn(technicianId, taskId, jobOrderId, source, userId)`**
   - Check for existing open entry: `prisma.timeEntry.findFirst({ where: { technicianId, clockOut: null, deletedAt: null } })`
   - If found, return `{ conflict: true, existingEntry }` (UI handles confirmation)
   - Fetch task to get hourlyRate
   - Create TimeEntry with `clockIn: new Date()`, `hourlyRate` from task
   - Write JobActivity (clock_in): `"${techName} clocked in on ${taskName}"`
   - Return the new entry

2. **`forceClockOutAndIn(technicianId, newTaskId, newJobOrderId, source, userId)`**
   - Find open entry, call `clockOut` on it
   - Then call `clockIn` for the new task
   - Return both entries

3. **`clockOut(timeEntryId, userId)`**
   - Fetch entry with task name
   - Set `clockOut = new Date()`
   - Calculate `netMinutes = Math.floor((clockOut - clockIn) / 60000) - breakMinutes`
   - Calculate `laborCost = Math.round((netMinutes / 60) * hourlyRate)`
   - Update entry
   - Check overtime: call `checkOvertime(technicianId, clockOutDate)`
   - Recalculate task actualHours
   - Write JobActivity (clock_out): `"${techName} clocked out of ${taskName} (${formatDuration(netMinutes)})"`
   - Check hour overrun on the task
   - Return updated entry

4. **`startBreak(timeEntryId)`**
   - Store break start in metadata JSON: `{ breakStart: Date.now() }`
   - Write JobActivity (break_start)

5. **`endBreak(timeEntryId)`**
   - Read `breakStart` from metadata
   - Calculate break duration in minutes
   - Add to `breakMinutes`
   - Clear breakStart from metadata
   - Write JobActivity (break_end)

6. **`createManualEntry(data: ManualTimeEntryInput, userId)`**
   - Source: MANUAL
   - Calculate netMinutes and laborCost
   - Create entry
   - Recalculate task actualHours
   - Write JobActivity
   - Check hour overrun

7. **`updateEntry(timeEntryId, data, userId)`**
   - Require `notes` field (audit trail)
   - Recalculate netMinutes, laborCost
   - Recalculate task actualHours
   - Permission check: `time:edit_others`

8. **`deleteEntry(timeEntryId, userId)`** — Soft delete, recalculate task actualHours

9. **`getActiveEntry(technicianId)`** — `findFirst({ where: { technicianId, clockOut: null, deletedAt: null } })` with task + jobOrder includes

10. **`getDailyEntries(technicianId, date)`** — All entries for a tech on a specific date

11. **`getTaskTimeEntries(taskId)`** — All entries for a task with technician name

12. **`checkOvertime(technicianId, date)`**
    - Sum all `netMinutes` for tech on this calendar day (Asia/Manila timezone)
    - Fetch `overtime_threshold_hours` from Settings
    - If exceeded, mark remaining entries as `isOvertime: true`

13. **`recalculateTaskActualHours(taskId)`**
    - Sum `netMinutes` from all TimeEntries for this task (non-deleted)
    - Update `Task.actualHours = sum / 60` (as Float)

14. **`getAssignedTasksForTech(technicianId)`**
    - Fetch all tasks assigned to this tech across active jobs (status not RELEASED/CANCELLED)
    - Include job order number, task name, status
    - Used by PIN clock to show available tasks

**Helper functions:**
- `formatDuration(minutes: number)` — "2h 15m" format
- `getSettingValue(key: string)` — Fetch from Settings table, parse value

**Build checkpoint:** `npx next build` — should pass.

---

## Task 7: Time Entry Server Actions (`lib/actions/time-entry-actions.ts`)

**Files:**
- Create: `src/lib/actions/time-entry-actions.ts`

**Actions:**
1. `clockInAction(taskId, jobOrderId, source)` — Auth check, call clockIn
2. `forceClockOutAndInAction(newTaskId, newJobOrderId, source)` — Auto-close + open
3. `clockOutAction(timeEntryId)` — Auth check, call clockOut
4. `startBreakAction(timeEntryId)` — Auth check, call startBreak
5. `endBreakAction(timeEntryId)` — Auth check, call endBreak
6. `createManualEntryAction(data)` — Zod validate, `time:edit_others` permission, call service
7. `updateEntryAction(timeEntryId, data)` — `time:edit_others` permission, call service
8. `deleteEntryAction(timeEntryId)` — `time:edit_others` permission, call service

**Build checkpoint:** `npx next build` — should pass.

---

## Task 8: Time Entry & Clock API Routes

**Files:**
- Create: `src/app/api/clock/route.ts` — GET (active entry for tech), POST (clock in), PATCH (clock out/break)
- Create: `src/app/api/clock/status/route.ts` — GET current clock status for authenticated tech
- Create: `src/app/api/jobs/[id]/time-entries/route.ts` — GET time entries for a job

**`/api/clock` GET:**
- Auth check, get technicianId from session
- Call `getActiveEntry(technicianId)`
- Return active entry or null

**`/api/clock` POST:**
- Body: `{ taskId, jobOrderId, source }`
- Call `clockIn` or `forceClockOutAndIn` based on conflict

**`/api/clock/status` GET:**
- Return: active entry, daily hours total, assigned tasks list

**Build checkpoint:** `npx next build` — should pass.

---

## Task 9: Job Activity Service (`lib/services/job-activities.ts`)

**Files:**
- Create: `src/lib/services/job-activities.ts`

**Functions:**

1. **`logActivity(data: { jobOrderId, type, title, description?, metadata?, userId })`**
   - Simple `prisma.jobActivity.create({ data })` wrapper
   - Called as side-effect from other services

2. **`getJobActivities(jobOrderId, { limit?, cursor?, type? })`**
   - Paginated (cursor-based) activity feed
   - Include `user` (firstName, lastName)
   - Ordered by `createdAt DESC`
   - Optional filter by type

3. **`addJobNote(jobOrderId, content, mentions, userId)`**
   - Create JobActivity with type 'note'
   - If mentions array has user IDs, create Notification for each mentioned user
   - Title: `"${userName} added a note"`
   - Description: the note content

**Build checkpoint:** `npx next build` — should pass.

---

## Task 10: Task Board — Kanban View (`components/jobs/task-board.tsx`)

**Files:**
- Create: `src/components/jobs/task-board.tsx` — Main Kanban board with DnD
- Create: `src/components/jobs/task-card.tsx` — Individual task card
- Modify: `src/app/(dashboard)/jobs/[id]/tasks/page.tsx` — Replace placeholder

**Task Board spec:**
- Import `DragDropContext, Droppable, Draggable` from `@hello-pangea/dnd`
- 5 columns from `TASK_BOARD_COLUMNS`
- Each column: header with count, `Droppable` area, list of `Draggable` TaskCards
- `onDragEnd`: extract taskId and destination column → call `transitionTaskStatusAction(taskId, newStatus)`. On error (dependency/photo gate), show toast error and revert.
- Filter bar: technician select, status checkboxes, service category select
- Toggle button: Kanban ↔ List view
- Refresh button to re-fetch data

**Task Card spec:**
- Task name (bold), assigned tech (avatar initials circle + name)
- Estimated hours vs actual hours: "2.5h / 4h est."
- Hour overrun borders: fetch `hour_overrun_warning_pct` and `hour_overrun_critical_pct` from settings (pass as props). If `actualHours / estimatedHours >= critical/100` → red border. Elif >= warning/100 → yellow border.
- Dependency lock: if `dependsOnTask` exists and its status !== 'DONE', show Lock icon + tooltip "Waiting on: [dep name]"
- isRework: show "REWORK" badge in red
- Click → open task detail slide-over

**Server component wrapper (`page.tsx`):**
- Fetch tasks via `getTasksByJobOrder(jobOrderId)`
- Fetch technicians for filter: `prisma.user.findMany({ where: { role: 'TECHNICIAN', isActive: true, deletedAt: null } })`
- Fetch overrun settings
- Pass to client component

**Build checkpoint:** `npx next build` — should pass.

---

## Task 11: Task Board — List View (`components/jobs/task-list-view.tsx`)

**Files:**
- Create: `src/components/jobs/task-list-view.tsx`

**Spec:**
- DataTable with sortable columns: Name, Technician, Status (badge), Est Hours, Actual Hours, Progress %, Dependency
- Row click → open task detail slide-over
- Same filter bar as Kanban (shared state)
- Overrun indicators (yellow/red cell background)

**Build checkpoint:** `npx next build` — should pass.

---

## Task 12: Task Detail Slide-Over (`components/jobs/task-detail-slide-over.tsx`)

**Files:**
- Create: `src/components/jobs/task-detail-slide-over.tsx`

**Spec:**
- Uses `SlideOver` component from `src/components/ui/slide-over.tsx`
- Fetches task detail via `getTaskDetail(taskId)` on open (or passed as prop)
- **Header:** Task name, status badge, assigned tech, edit button
- **Tabs or sections:**
  1. **Details:** Name, description, service, estimated hours, hourly rate, dependency, edit form
  2. **Time Entries:** List of entries (tech, date, in/out, break, net hrs, cost). Running total vs estimate. Manual entry form for supervisors. Edit/delete buttons with required notes.
  3. **Milestone Photos:** Checklist of required milestones from ServiceCatalog. Upload button per milestone. Thumbnails of uploaded photos. Progress: "5/7 milestones".
  4. **Materials:** List of materials used. Add material form. Variance display.
- **Quick Clock button:** "Start Timer" / "Stop Timer" toggle (if user is assigned tech or supervisor)
- **Live timer:** If clocked in to this task, show running timer using `Date.now() - clockIn` pattern with `visibilitychange` listener

**Build checkpoint:** `npx next build` — should pass.

---

## Task 13: PIN Clock Page (`(auth)/clock/page.tsx`)

**Files:**
- Create: `src/app/(auth)/clock/page.tsx` — Server component wrapper
- Create: `src/components/time-clock/pin-clock.tsx` — Full-screen PIN clock client component

**PIN Clock spec:**
- Standalone route — uses `(auth)` layout (no sidebar)
- **State machine:** `idle` → `authenticated` → `clocked_in` or `task_select`

**Idle state (PIN entry):**
- Large numeric keypad (like phone dialer, 48px+ buttons)
- PIN dots display (4-6 digits)
- Auto-clear after 5 seconds inactivity
- On submit: call `signIn('pin', { pin, redirect: false })` from next-auth/react
- On success → transition to `authenticated`

**Authenticated state (task select):**
- Show tech name large at top
- Fetch assigned tasks: `GET /api/clock/status`
- If already clocked in → show `clocked_in` state
- If not → show list of assigned tasks across active jobs. Each row: JO number, task name, status. Tap → clock in via `POST /api/clock`

**Clocked-in state:**
- Large timer display (HH:MM:SS) — calculated from `clockIn` timestamp:
  ```typescript
  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - new Date(clockInTime).getTime();
      setDisplay(formatElapsed(elapsed));
      frameRef.current = requestAnimationFrame(update);
    };
    frameRef.current = requestAnimationFrame(update);
    // visibilitychange listener
    const onVisChange = () => {
      if (!document.hidden) {
        const elapsed = Date.now() - new Date(clockInTime).getTime();
        setDisplay(formatElapsed(elapsed));
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      cancelAnimationFrame(frameRef.current);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [clockInTime]);
  ```
- Task name and JO number shown
- "Take Break" button → `startBreakAction` → show break timer
- "Clock Out" button → `clockOutAction` → show summary
- "Switch Task" → if another task tapped, confirm auto-clock-out

**After clock out:**
- Brief summary: task name, duration, running daily total
- "Clock In Again" or "Log Out" buttons
- Auto-return to idle after 10 seconds

**Design:** Full black/dark background, large white/amber text, oversized touch targets. Minimal chrome. Should work as a permanent browser tab on the shop tablet.

**Build checkpoint:** `npx next build` — should pass.

---

## Task 14: Quick Clock on Task Cards

**Files:**
- Modify: `src/components/jobs/task-card.tsx` — Add clock toggle button
- Modify: `src/components/jobs/task-detail-slide-over.tsx` — Add live timer section

**What to add:**
- On each task card: if user is the assigned tech or has supervisor role, show "▶ Start" / "⏹ Stop" button
- When clocked in: show live elapsed time on the card (same `Date.now() - clockIn` pattern)
- Clock in: `clockInAction(taskId, jobOrderId, 'TABLET_CLOCK')`
- Clock out: `clockOutAction(timeEntryId)`
- If conflict (already clocked into different task): show confirmation dialog, then `forceClockOutAndInAction`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 15: Milestone Photo Configuration Constants

**Files:**
- Already done in Task 1 (`MILESTONE_LABELS` constant)
- No additional work needed — ServiceCatalog already has `requiredMilestonePhotos` seeded

**This task is a no-op.** The milestone photo data is ready from the schema + seed.

---

## Task 16: Progress Photo Upload UI (`components/jobs/milestone-photos.tsx`)

**Files:**
- Create: `src/components/jobs/milestone-photos.tsx`

**Spec:**
- Props: `taskId`, `serviceCatalogId` (to fetch milestones), `existingPhotos`, `onUpdate()`
- Fetch milestones: query ServiceCatalog by ID, parse `requiredMilestonePhotos` JSON
- Display checklist: each milestone label (from `MILESTONE_LABELS`), status icon (pending/captured), thumbnail(s), upload button
- Upload uses `POST /api/photos/upload` with `entityType: 'TASK'`, `entityId: taskId`, `stage: 'PROGRESS'`, `category: milestoneId`
- Multiple photos per milestone supported
- Progress bar: "5 of 7 milestones documented"
- Write JobActivity on each upload: `"${techName} uploaded ${milestoneName} photo for ${taskName}"`
- Camera button (with `capture="environment"`) + Gallery upload button per milestone

**Build checkpoint:** `npx next build` — should pass.

---

## Task 17: Job Photos Gallery (`jobs/[id]/photos/page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/photos/page.tsx` — Replace placeholder

**Spec:**
- Server component fetches ALL photos for this job:
  - Intake photos: `entityType='INTAKE'`
  - Progress photos: `entityType='TASK'` (across all tasks)
  - QC photos: `entityType='QC_INSPECTION'` (future, show empty)
  - Release photos: `entityType='RELEASE'` (future, show empty)
- Client component `PhotoGalleryClient`:
  - Filter bar: stage dropdown, task dropdown, milestone dropdown, technician dropdown
  - Summary counts: "87 photos — Intake: 22, Progress: 48, QC: 12, Release: 5"
  - **Grid view** (default): thumbnails in responsive grid, click → lightbox modal (full-size image, prev/next navigation, photo metadata)
  - **Timeline view** toggle: photos on a chronological timeline with date separators
  - Lightbox: modal overlay, full-size image, photo info (stage, category, uploaded by, timestamp), close button, keyboard navigation (← →, Esc)

**Build checkpoint:** `npx next build` — should pass.

---

## Task 18: Materials Service + UI

**Files:**
- Create: `src/lib/services/materials.ts`
- Create: `src/lib/actions/material-actions.ts`
- Create: `src/components/jobs/material-log.tsx`

**Service functions:**
1. `logMaterial(jobOrderId, data: MaterialUsageInput, userId)` — Create MaterialUsage. Write JobActivity.
2. `updateMaterial(id, data, userId)` — Update
3. `deleteMaterial(id, userId)` — Soft delete
4. `getTaskMaterials(taskId)` — All materials for a task
5. `getJobMaterials(jobOrderId)` — All materials for a job, with estimated line item comparison
6. `getVarianceReport(jobOrderId)` — Sum actual costs by estimated line item, calculate variance %. Flag if > threshold from Settings.

**Actions:** `logMaterialAction`, `updateMaterialAction`, `deleteMaterialAction`

**UI component (`material-log.tsx`):**
- Props: `jobOrderId`, `taskId?`, `materials`, `estimateLineItems`, `onUpdate()`
- "Add Material" form: description (auto-suggest from estimate PARTS/MATERIALS items), part number, quantity, unit, actual cost (in pesos, convert to centavos)
- List of logged materials with edit/delete
- Variance column: "Est: ₱500 | Act: ₱650 | +₱150 (30%)" — red if over threshold

**Build checkpoint:** `npx next build` — should pass.

---

## Task 19: Job Timeline Component (`components/jobs/job-timeline.tsx`)

**Files:**
- Create: `src/components/jobs/job-timeline.tsx`
- Create: `src/app/api/jobs/[id]/timeline/route.ts` — GET endpoint for activities

**Timeline component spec:**
- Fetches activities from `/api/jobs/[id]/timeline?limit=50&cursor=...`
- Each entry: left icon (type-specific, from lucide-react), timestamp (relative: "2 hours ago"), user name, title text, optional description/metadata
- **Activity type → icon mapping:**
  - status_change → ArrowRight
  - clock_in → PlayCircle (green)
  - clock_out → StopCircle (red)
  - break_start → Coffee
  - break_end → PlayCircle
  - photo_upload → Camera (show thumbnail if in metadata)
  - note → MessageSquare
  - material_logged → Package
  - supplement_created → FileText
  - task_status_change → CheckCircle2
  - assignment_change → UserCheck
  - qc_result → ClipboardCheck
- "Load more" button at bottom for pagination
- Auto-refresh: poll every 30 seconds for new entries (or use router.refresh on user action)

**Build checkpoint:** `npx next build` — should pass.

---

## Task 20: Daily Job Notes

**Files:**
- Create: `src/lib/actions/job-activity-actions.ts`
- Modify: `src/components/jobs/job-timeline.tsx` — Add note input at top

**What to build:**
- **Note input** at top of timeline: textarea + "Add Note" button
- On submit: call `addJobNoteAction(jobOrderId, content, mentions)`
- Server action calls `addJobNote` from job-activities service
- **@mentions:** When user types `@`, show dropdown of team members (fetch `/api/technicians`). On select, insert `@FirstName LastName` into text. On submit, extract mention user IDs and pass to service. Service creates Notification for each mentioned user.
- Notes are append-only — no edit/delete (audit trail integrity)
- Notes show in timeline with MessageSquare icon

**Build checkpoint:** `npx next build` — should pass.

---

## Task 21: Supplemental Estimate Service (`lib/services/supplements.ts`)

**Files:**
- Create: `src/lib/services/supplements.ts`

**Functions:**

1. **`createSupplement(jobOrderId, data: SupplementInput, userId)`**
   - Generate `supplementNumber`: fetch job order number, count existing supplements → `SUP-{joNumber}-S{n+1}`
   - Create SupplementalEstimate with status DRAFT
   - Write JobActivity

2. **`getJobSupplements(jobOrderId)`** — All supplements with line items

3. **`getSupplementDetail(supplementId)`** — Single supplement with line items

4. **`addSupplementLineItem(supplementId, data: SupplementLineItemInput)`**
5. **`updateSupplementLineItem(lineItemId, data)`**
6. **`deleteSupplementLineItem(lineItemId)`** — Soft delete

7. **`recalculateSupplementTotals(supplementId)`**
   - Sum line items by group (labor, parts, materials, other)
   - Calculate VAT (12% from settings)
   - Update grandTotal

8. **`submitForApproval(supplementId, userId)`**
   - Generate `approvalToken` (random UUID)
   - Set `approvalTokenExpiry` (72 hours from now)
   - Status → SUBMITTED
   - Write JobActivity

9. **`getSupplementByToken(token)`** — Fetch by approval token, check expiry

10. **`approveWithSignature(token, signature, comments)`**
    - Status → APPROVED
    - Set `customerSignature`, `approvedAt`
    - Auto-create Task records from LABOR line items (same pattern as `completeIntake`)
    - Write JobActivity (supplement_approved)
    - Create Notification for MANAGER/OWNER

11. **`denySupplement(token, comments)`** — Status → DENIED

**Build checkpoint:** `npx next build` — should pass.

---

## Task 22: Supplement Server Actions + API Routes

**Files:**
- Create: `src/lib/actions/supplement-actions.ts`
- Create: `src/app/api/jobs/[id]/supplements/route.ts` — GET list, POST create
- Create: `src/app/api/supplements/[id]/route.ts` — GET detail
- Create: `src/app/api/supplements/approve/[token]/route.ts` — GET approval page data, POST approve/deny

**Actions:**
1. `createSupplementAction(jobOrderId, data, photoIds[])`
2. `addSupplementLineItemAction(supplementId, data)`
3. `updateSupplementLineItemAction(lineItemId, data)`
4. `deleteSupplementLineItemAction(lineItemId)`
5. `submitSupplementForApprovalAction(supplementId)`

**Approval route** (public, token-based):
- GET: fetch supplement by token, return data for approval page
- POST: `{ action: 'approve' | 'deny', signature?, comments? }`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 23: Supplement UI — Form + List

**Files:**
- Create: `src/components/jobs/supplement-form.tsx` — Create/edit supplement with line items
- Create: `src/components/jobs/supplement-list.tsx` — List of supplements on estimate tab

**Supplement Form spec:**
- "Flag Additional Work" button triggers slide-over
- Form: description textarea, reason textarea
- Discovery photos: upload minimum 1 photo (required)
- Line items: same pattern as estimate builder (group, description, qty, unit, unitCost, estimatedHours for labor)
- Cost summary: "Original: ₱XX | This Supplement: ₱XX | New Total: ₱XX"
- Submit → creates draft, then "Submit for Approval" button

**Supplement List spec:**
- Show on job's Estimate tab (below or alongside original estimate)
- Each supplement: number, status badge, grand total, line item count, approval status
- Click → expand/view details

**Build checkpoint:** `npx next build` — should pass.

---

## Task 24: Supplement Approval Page

**Files:**
- Create: `src/app/approve/supplement/[token]/page.tsx` — Public approval page (like estimate approval)

**Spec:**
- Public route (no auth required — token-based access)
- Fetch supplement data by token
- Show: shop info, job details, supplement description + reason, discovery photos, line items, totals
- Signature pad for customer
- Approve / Deny buttons with optional comments
- On approve: signature captured, tasks auto-generated, redirect to success page
- Token expiry check: if expired, show "This link has expired" message

**Build checkpoint:** `npx next build` — should pass.

---

## Task 25: Job Overview Enrichment

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx` — Enhance data fetching
- Modify: `src/app/(dashboard)/jobs/[id]/overview-client.tsx` — Add rich metrics + timeline

**What to enhance:**

**Server component:**
- Fetch additional data: time entries summary (total actual hours, total labor cost), materials summary (total actual cost), active timers (open TimeEntries for this job), supplement count + totals
- Fetch latest activities from JobActivity

**Client component enhancements:**
- **Metrics cards (enhanced):**
  - Estimated Hours vs Actual Hours with efficiency ratio (green if ratio > 1.0, red if < 1.0)
  - Estimated Cost vs Actual Cost (labor + parts, variance in ₱ and %)
  - Tasks progress: "X of Y complete" with progress bar
  - Days in shop
- **Assigned technicians row:** Each tech with individual hours logged (small avatar + hours)
- **Active timer indicator:** If any tech is clocked in, show pulsing green dot + "In progress: [tech] on [task]"
- **Job timeline** (from Task 19 component) below metrics
- **Supplement status:** If supplements exist, show summary card

**Build checkpoint:** `npx next build` — should pass.

---

## Task 26: Jobs List Page Enhancements

**Files:**
- Modify: `src/app/(dashboard)/jobs/page.tsx` — Add columns and filters
- Modify: `src/app/api/jobs/route.ts` — Return additional data (hours, efficiency)

**API enhancement:**
- Include aggregated data: `_count: { tasks: true }`, sum of task estimatedHours, sum of task actualHours
- Include time entry data for efficiency calculation

**Page enhancements:**
- Add columns: Est Hours, Actual Hours, Efficiency % (actual/estimated, green/red), Days in Shop
- Add filters: by technician dropdown, by efficiency (ahead/behind), by overdue toggle
- Status tab counts from DB (accurate counts per status)
- Overdue rows: red background tint when past target date and not released/cancelled

**Build checkpoint:** `npx next build` — should pass.

---

## Task 27: Final Integration & Build Verification

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/estimate/page.tsx` — Show supplements list (if not already)
- Any remaining wiring between components

**Final verification checklist:**
- [ ] `npx next build` — MUST pass with 0 errors
- [ ] Task board renders with 5 Kanban columns
- [ ] Task cards show correct data and overrun indicators
- [ ] Drag-and-drop changes task status
- [ ] Dependency check blocks invalid transitions
- [ ] Photo gate blocks QC_REVIEW without milestone photos
- [ ] PIN clock page at `/clock` works standalone
- [ ] Live timer uses `Date.now() - clockIn` pattern
- [ ] Time entries CRUD with overtime detection
- [ ] Materials logging with variance display
- [ ] Job timeline shows all activity types
- [ ] Notes with @mentions create notifications
- [ ] Supplement creation, approval flow, auto-task generation
- [ ] Job overview shows enriched metrics + active timer + timeline
- [ ] Jobs list shows efficiency and overdue indicators

**Build checkpoint:** `npx next build` — MUST pass with 0 errors.

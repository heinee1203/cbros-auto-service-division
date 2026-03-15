# Phase 5: In-Service / Work In Progress — Design Document

> **Status:** Approved
> **Date:** 2026-03-15
> **Scope:** Kanban task board, man-hour time tracking, progress photos with milestone gates, materials consumption, supplemental estimates, job timeline, job overview enrichment

---

## Schema Changes

**New model: `JobActivity`** — Append-only, purpose-built timeline feed for job detail UI. Written as side-effect in each service function (clock in/out, photo upload, status change, note, material log, supplement). NOT from AuditLog (too noisy/slow for real-time UI).

Fields: `id`, `jobOrderId`, `type` (status_change, clock_in, clock_out, photo_upload, note, material_logged, supplement_created, qc_result, task_status_change, assignment_change), `title` (human-readable), `description`, `metadata` (JSON), `userId`, `createdAt`.

**New dependency:** `@hello-pangea/dnd` for Kanban drag-and-drop.

All other models already exist: Task, TimeEntry, MaterialUsage, SupplementalEstimate, SupplementLineItem, Notification, ServiceCatalog (with `requiredMilestonePhotos`).

---

## Batch 1: Task Management Core

### 1A. Task Service (`lib/services/tasks.ts`)

Task auto-generation already handled by `completeIntake()` in `lib/services/intake.ts`. No duplication needed.

**New functions:**
- `getTasksByJobOrder(jobOrderId)` — All tasks with technician, time entries, material usages, dependency info
- `getTaskDetail(taskId)` — Single task with all relations
- `createTask(jobOrderId, data)` — Manual task addition
- `updateTask(taskId, data)` — Update name, description, estimatedHours, assignedTechnicianId, dependsOnTaskId, sortOrder
- `reorderTasks(jobOrderId, orderedIds[])` — Bulk sort order update
- `transitionTaskStatus(taskId, newStatus, userId)` — Status change with validation:
  - → `IN_PROGRESS`: check `dependsOnTaskId` task is DONE (if set). Set `startedAt` if first time.
  - → `QC_REVIEW`: check milestone photo gate (count photos vs. `requiredMilestonePhotos` from ServiceCatalog)
  - → `DONE`: set `completedAt`, recalculate `actualHours` from TimeEntries
  - → `REWORK`: create new Task with `isRework: true`, `reworkOfTaskId` pointing to original
- `bulkTransitionStatus(taskIds[], newStatus, userId)` — Batch status change
- `getSuggestedDependencyChain(serviceCategory)` — Returns ordered task name suggestions

**Dependency chain constants** (in `lib/constants.ts`):
```
Collision: Disassembly → Metalwork → Body Filler → Primer → Paint → Clear Coat → Reassembly
Repaint: Sanding/Prep → Masking → Primer/Sealer → Base Coat → Clear Coat → Cut/Buff → Reassembly
Detailing: Wash/Decon → Paint Correction → Coating Application → Final Inspection
```

### 1B. Task Board UI (`jobs/[id]/tasks/page.tsx`)

**Kanban view** (default): 5 columns using `@hello-pangea/dnd`
- Columns: Queued | In Progress | Paused | QC Review | Done
- Cards: task name, tech avatar/initials, estimated vs actual hours, status color
- Hour overrun: yellow border at 80%, red border at 100% (thresholds from Settings)
- Dependency blocked: lock icon + tooltip
- Drop between columns triggers `transitionTaskStatus` with validation; show toast on failure

**List view** (toggle): DataTable with sortable columns (name, tech, status, estimated hrs, actual hrs, progress)

**Task detail slide-over** on card click: full task info, time entries list, milestone photos, materials used, notes, edit form

**Filter bar**: technician dropdown, status filter, service category filter

### 1C. Task Dependencies

- "Depends on" dropdown in task create/edit (lists other tasks in same job)
- Lock icon on blocked cards with tooltip showing dependency name
- Auto-suggest: when creating tasks for a service category, offer to apply the standard chain

---

## Batch 2: Man-Hour Time Tracking

### 2A. Time Entry Service (`lib/services/time-entries.ts`)

- `clockIn(technicianId, taskId, jobOrderId, source)` — Create TimeEntry. Enforce single active clock: query `findFirst({ where: { technicianId, clockOut: null, deletedAt: null } })`. If found, return conflict info for UI confirmation.
- `clockOut(timeEntryId, userId)` — Set `clockOut`, calculate `netMinutes = (clockOut - clockIn) - breakMinutes`, calculate `laborCost = (netMinutes / 60) * hourlyRate`. Check overtime.
- `forceClockOutAndIn(technicianId, newTaskId, newJobOrderId, source)` — Auto-close existing, open new.
- `startBreak(timeEntryId)` — Record break start in metadata JSON.
- `endBreak(timeEntryId)` — Calculate break duration, add to `breakMinutes`.
- `createManualEntry(data, userId)` — Source: MANUAL, requires `notes`.
- `updateEntry(timeEntryId, data, userId)` — Supervisor only, requires `notes`.
- `deleteEntry(timeEntryId, userId)` — Soft delete, supervisor only.
- `getActiveEntry(technicianId)` — Current open time entry.
- `getDailyEntries(technicianId, date)` — All entries for a tech on a date.
- `checkOvertime(technicianId, date)` — Sum netMinutes for day, compare to Settings threshold.
- `getTaskTimeEntries(taskId)` — All entries for a task.
- `recalculateTaskActualHours(taskId)` — Sum netMinutes from all entries, update Task.actualHours.

**Overtime detection:** On clock-out, sum daily `netMinutes`. If exceeds `overtime_threshold_hours` * 60, mark entry `isOvertime: true`.

**Hour overrun notifications:** After recalculating task hours, check against `estimatedHours`. At 80%/100% thresholds (from Settings), create Notification for MANAGER/OWNER roles.

### 2B. PIN Clock UI (`(auth)/clock/page.tsx`)

Standalone full-screen route — no sidebar, no dashboard layout. Designed for mounted shop tablet.

Flow:
1. PIN entry (reuse existing `pin` NextAuth provider) — large numeric keypad
2. After auth: show tech name, current status
3. If clocked in: live timer (calculated from `clockIn` timestamp, NOT incremented counter), "Take Break" / "Clock Out" buttons
4. If not clocked in: list of assigned tasks across active jobs → tap to clock in
5. After clock out: summary (task, duration, daily total)

**Timer pattern (per user adjustment):**
```typescript
const elapsed = Date.now() - clockInTimestamp.getTime();
// visibilitychange listener to recalculate on tab re-focus
```

Auto-clear PIN after 5 seconds inactivity. Large 48px+ touch targets throughout.

### 2C. Quick Clock on Task Board

On task cards (when user is the assigned tech or a supervisor): "Start Timer" / "Stop Timer" toggle.
Live elapsed time display on card. Same backend as PIN clock.

### 2D. Time Entries Panel (in task detail slide-over)

List: tech name, date, in/out times, break, net hours, cost. Running total at bottom vs. estimate. Edit/delete for supervisors (with required notes).

### 2E. Hour Overrun Alerts

Per-task: yellow badge at 80%, red at 100% of estimatedHours.
Per-job: same on total hours.
Notification record created for MANAGER/OWNER when 100% threshold hit.
Indicators on: task cards, job overview, jobs list.

---

## Batch 3: Progress Photos & Milestone Gates

### 3A. Milestone Photo Configuration

`ServiceCatalog.requiredMilestonePhotos` — JSON array of milestone IDs. Already seeded with defaults.

Add milestone label mapping constant to `lib/constants.ts`:
```typescript
MILESTONE_LABELS: Record<string, string> = {
  "before": "Before",
  "before_disassembly": "Before Disassembly",
  "after_disassembly": "After Disassembly",
  // ... all milestone IDs → display labels
}
```

### 3B. Progress Photo Upload UI

Within task detail slide-over → "Milestone Photos" tab:
- Checklist of required milestones from ServiceCatalog
- Each: status (pending/captured), thumbnail(s), upload button
- Upload uses existing `POST /api/photos/upload` with `entityType: 'TASK'`, `entityId: taskId`, `stage: 'PROGRESS'`, `category: milestoneId`
- Support multiple photos per milestone
- Progress bar: "5 of 7 milestones documented"
- Photo gate: can't transition to QC_REVIEW until all milestones have ≥1 photo

### 3C. Job Photos Gallery (`jobs/[id]/photos/page.tsx`)

- Unified gallery of ALL photos for the job
- Filter by: stage (Intake/Progress/QC/Release), task, milestone, technician
- Grid view with thumbnails, lightbox on click (modal with full-size image)
- Timeline view option (chronological)
- Summary counts at top

---

## Batch 4: Materials & Job Timeline

### 4A. Materials Consumption (`lib/services/materials.ts`)

- `logMaterial(jobOrderId, taskId, data, userId)` — Create MaterialUsage
- `updateMaterial(id, data, userId)` — Update
- `deleteMaterial(id, userId)` — Soft delete
- `getTaskMaterials(taskId)` — All materials for a task
- `getJobMaterials(jobOrderId)` — All materials for a job with variance vs. estimate
- Auto-suggest: match estimate PARTS/MATERIALS line items by description

**Variance:** Compare sum of `actualCost` against estimated `subtotal` for matching line items. Alert at 15% over (configurable from Settings).

UI: "Materials Used" section in task detail with add form, list with edit/delete, variance display.

### 4B. Job Timeline (`components/jobs/job-timeline.tsx`)

Query `JobActivity` for the job, ordered by `createdAt DESC`. Each entry: icon (type-specific), timestamp, user name, title, optional description/metadata.

**Activity types and icons:**
- `status_change` → ArrowRight
- `clock_in` → PlayCircle
- `clock_out` → StopCircle
- `photo_upload` → Camera (show thumbnail from metadata)
- `note` → MessageSquare
- `material_logged` → Package
- `supplement_created` → FileText
- `task_status_change` → CheckCircle2
- `assignment_change` → UserCheck

**Manual notes:** Input at top of timeline, submit creates `JobActivity` with `type: 'note'`. Append-only (no edit/delete). @mentions: type `@` → dropdown of team members → on submit, create Notification for mentioned users.

### 4C. Side-effect pattern

Each service function writes to JobActivity as a side effect:
```typescript
// Inside clockIn:
await prisma.jobActivity.create({
  data: {
    jobOrderId,
    type: 'clock_in',
    title: `${techName} clocked in on ${taskName}`,
    metadata: JSON.stringify({ taskId, taskName }),
    userId: technicianId,
  }
});
```

---

## Batch 5: Supplemental Estimates

### 5A. Supplemental Estimate Service (`lib/services/supplements.ts`)

- `createSupplement(jobOrderId, data, discoveryPhotoIds, userId)` — Create with line items, generate `supplementNumber` (SUP-[JO]-S1, S2...), link discovery photos
- `updateSupplement(id, data, userId)` — Update draft
- `addSupplementLineItem(supplementId, data)` / `updateSupplementLineItem` / `deleteSupplementLineItem`
- `recalculateSupplementTotals(supplementId)` — Sum line items, VAT, grand total
- `submitForApproval(supplementId)` — Generate `approvalToken`, status → SUBMITTED
- `approveWithSignature(token, signature, comments)` — Status → APPROVED, auto-create tasks from LABOR items
- `denySupplement(token, comments)` — Status → DENIED
- `getJobSupplements(jobOrderId)` — All supplements for a job

### 5B. Supplemental Estimate UI

- "Flag Additional Work" button on job detail (Advisor/Manager/Owner)
- Form: description, discovery photos (min 1), line items (same pattern as estimate builder)
- Cost breakdown: Original ₱XX | Supplement ₱XX | New Total ₱XX
- Approval status on job overview
- Supplements listed on job Estimate tab

---

## Batch 6: Dashboard Enrichment

### 6A. Job Overview Enhancements

- Status pipeline (existing)
- Enhanced metrics: Estimated vs Actual Hours (efficiency ratio, color-coded), Estimated vs Actual Cost (variance), Days in shop, Tasks X/Y complete
- Assigned technicians with individual hours
- Active timer indicator (pulsing dot if any tech clocked in)
- Job timeline component from Batch 4

### 6B. Jobs List Enhancements

- Additional columns: Assigned Tech(s), Est Hours, Actual Hours, Efficiency %, Days in Shop
- Filters: by technician, by efficiency, by overdue
- Status tab counts (accurate from DB)
- Overdue rows highlighted red

---

## New Files Summary

**Services:** `tasks.ts`, `time-entries.ts`, `materials.ts`, `supplements.ts`, `job-activities.ts`
**Actions:** `task-actions.ts`, `time-entry-actions.ts`, `material-actions.ts`, `supplement-actions.ts`
**API routes:** `/api/jobs/[id]/tasks`, `/api/jobs/[id]/timeline`, `/api/jobs/[id]/materials`, `/api/jobs/[id]/supplements`, `/api/clock`
**Components:** `task-board.tsx`, `task-card.tsx`, `task-detail-slide-over.tsx`, `pin-clock.tsx`, `milestone-photos.tsx`, `job-timeline.tsx`, `material-log.tsx`, `supplement-form.tsx`, `photo-gallery.tsx`
**Pages:** `(auth)/clock/page.tsx`, `jobs/[id]/tasks/page.tsx` (replace placeholder), `jobs/[id]/photos/page.tsx` (replace placeholder)

# Phase D: Technician Schedule + Integration Points

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build a Gantt-style technician scheduling view showing task assignments per tech over time, with actual work overlay from TimeEntry, capacity indicators, drag-and-drop reassignment, work schedule management in Settings, and integration point verification.

**Architecture:** CSS Grid timeline (same pattern as bay-timeline) with Y-axis = technicians, X-axis = days. Data fetched via new API route calling existing `getAllTechSchedules()`. Task blocks show planned work; TimeEntry data overlays actual hours. Work schedule stored as JSON in `User.workSchedule`. Drag-and-drop reuses `useGanttDrag` pattern adapted for tech rows.

**Tech Stack:** Next.js App Router, React client components, CSS Grid, native Pointer Events, Tailwind CSS, existing SlideOver/Badge/ConfirmDialog components, existing Task/TimeEntry services.

---

## Context

Phase C built the bay scheduling Gantt view. Phase D builds an analogous technician scheduling view on top of existing data:
- **Task model** — has `assignedTechnicianId`, `estimatedHours`, `actualHours`, `status`, `startedAt`, `completedAt`, JO relations
- **TimeEntry model** — has `technicianId`, `clockIn`, `clockOut`, `netMinutes`, `breakMinutes`
- **User model** — has `workSchedule` (JSON string), `maxConcurrentJobs`
- **Existing services** — `getAllTechSchedules(start, end)`, `getTechnicianSchedule(techId, start, end)`, `getDailyEntries(techId, date)`, `getActiveEntry(techId)`
- **Existing permissions** — `schedule:tech_view` (OWNER, MANAGER), `schedule:tech_manage` (OWNER, MANAGER)

**Key existing patterns to reuse:**
- `bay-timeline-header.tsx` — date navigation (←/→, Today, 7/14/30 pills)
- `bay-timeline-grid.tsx` — CSS Grid layout pattern
- `use-gantt-drag.ts` — pointer event drag hook
- `bay-timeline-types.ts` — utility functions (getTimelineDays, addDaysToDate, formatShortDate, getDateKey, hexToRgba)

---

## Task 1: Tech Timeline Types, API Route, and Service Enhancements

**Files to create:**
- `src/components/schedule/tech-timeline-types.ts`
- `src/app/api/technicians/timeline/route.ts`

**Files to modify:**
- `src/lib/services/scheduler.ts` — enhance `getAllTechSchedules` return shape
- `src/lib/actions/scheduler-actions.ts` — add `reassignTaskAction`, `updateWorkScheduleAction`
- `src/lib/validators.ts` — add `reassignTaskSchema`, `updateWorkScheduleSchema`

### tech-timeline-types.ts

```typescript
import { addDaysToDate, getDateKey, getTimelineDays } from "./bay-timeline-types";

export interface TechTimelineTech {
  id: string;
  firstName: string;
  lastName: string;
  workSchedule: WorkSchedule | null;
  maxConcurrentJobs: number;
  tasks: TechTask[];
  timeEntries: TechTimeEntry[];
}

export interface TechTask {
  id: string;
  name: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  assignedTechnicianId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    status: string;
    priority: string;
    scheduledStartDate: string | null;
    scheduledEndDate: string | null;
    vehicle: { plateNumber: string; make: string; model: string } | null;
  };
}

export interface TechTimeEntry {
  id: string;
  taskId: string;
  clockIn: string;
  clockOut: string | null;
  netMinutes: number;
  breakMinutes: number;
  isOvertime: boolean;
}

export interface WorkSchedule {
  mon?: DaySchedule;
  tue?: DaySchedule;
  wed?: DaySchedule;
  thu?: DaySchedule;
  fri?: DaySchedule;
  sat?: DaySchedule;
  sun?: DaySchedule;
}

export interface DaySchedule {
  start: string; // "08:00"
  end: string;   // "17:00"
  off?: boolean;
}

// Default 8-5 Mon-Fri schedule
export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  mon: { start: "08:00", end: "17:00" },
  tue: { start: "08:00", end: "17:00" },
  wed: { start: "08:00", end: "17:00" },
  thu: { start: "08:00", end: "17:00" },
  fri: { start: "08:00", end: "17:00" },
  sat: { start: "08:00", end: "12:00", off: true },
  sun: { start: "08:00", end: "17:00", off: true },
};

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = typeof DAY_KEYS[number];

export const TECH_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

/** Get working hours for a technician on a specific date */
export function getWorkingHours(schedule: WorkSchedule | null, date: Date): number {
  if (!schedule) return 8; // Default 8 hours
  const dayKey = DAY_KEYS[date.getDay()];
  const day = schedule[dayKey];
  if (!day || day.off) return 0;
  const [sh, sm] = day.start.split(":").map(Number);
  const [eh, em] = day.end.split(":").map(Number);
  return Math.max(0, (eh + em / 60) - (sh + sm / 60));
}

/** Check if a day is a day off */
export function isDayOff(schedule: WorkSchedule | null, date: Date): boolean {
  if (!schedule) return date.getDay() === 0 || date.getDay() === 6; // Default: weekends off
  const dayKey = DAY_KEYS[date.getDay()];
  const day = schedule[dayKey];
  return !day || !!day.off;
}

/** Parse workSchedule JSON string safely */
export function parseWorkSchedule(raw: string | null): WorkSchedule | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkSchedule;
  } catch {
    return null;
  }
}

/** Get task date range for timeline positioning */
export function getTaskDateRange(task: TechTask): { start: Date; end: Date } {
  // Use JO scheduled dates if available, otherwise use task startedAt/createdAt
  const startStr = task.jobOrder.scheduledStartDate || task.startedAt || task.createdAt;
  const endStr = task.completedAt || task.jobOrder.scheduledEndDate;

  const start = new Date(startStr);
  // If no end date, estimate from estimatedHours (1 day per 8 hours, min 1 day)
  const end = endStr
    ? new Date(endStr)
    : addDaysToDate(start, Math.max(0, Math.ceil(task.estimatedHours / 8) - 1));

  return { start, end };
}

/** Calculate capacity metrics for a tech over a date range */
export function calcTechCapacity(
  tech: TechTimelineTech,
  rangeStart: Date,
  rangeDays: number
) {
  const schedule = parseWorkSchedule(tech.workSchedule as unknown as string | null);
  let availableHours = 0;
  let scheduledHours = 0;
  let actualMinutes = 0;

  const days = getTimelineDays(rangeStart, rangeDays);

  for (const day of days) {
    availableHours += getWorkingHours(schedule, day);
  }

  for (const task of tech.tasks) {
    if (task.status !== "DONE") {
      scheduledHours += task.estimatedHours;
    }
  }

  for (const entry of tech.timeEntries) {
    actualMinutes += entry.netMinutes;
  }

  const actualHours = actualMinutes / 60;
  const loadPercent = availableHours > 0
    ? Math.round((scheduledHours / availableHours) * 100)
    : 0;

  return { availableHours, scheduledHours, actualHours, loadPercent };
}

// Re-export bay timeline utilities for convenience
export { addDaysToDate, getDateKey, getTimelineDays, formatShortDate, hexToRgba } from "./bay-timeline-types";
```

### `/api/technicians/timeline` (GET)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAllTechSchedules } from "@/lib/services/scheduler";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:tech_view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end params required" }, { status: 400 });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const techs = await getAllTechSchedules(startDate, endDate);
    return NextResponse.json(techs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch tech schedules" }, { status: 500 });
  }
}
```

### New validators

```typescript
export const reassignTaskSchema = z.object({
  taskId: z.string().min(1),
  newTechnicianId: z.string().min(1),
});

export const updateWorkScheduleSchema = z.object({
  technicianId: z.string().min(1),
  workSchedule: z.string(), // JSON string
});
```

### New actions in scheduler-actions.ts

- `reassignTaskAction(input)` — permission: `schedule:tech_manage`, validates with `reassignTaskSchema`, calls `updateTask(taskId, { assignedTechnicianId })` from tasks service, revalidates `/schedule/technicians`
- `updateWorkScheduleAction(input)` — permission: `schedule:tech_manage`, validates with `updateWorkScheduleSchema`, updates `User.workSchedule` via Prisma, revalidates `/schedule/technicians` and `/settings`

**Verification:** TypeScript compiles. `GET /api/technicians/timeline?start=...&end=...` returns tech array.

---

## Task 2: Schedule Nav Update (D7)

**Files to modify:**
- `src/components/schedule/schedule-nav.tsx`

Add "Tech Schedule" tab pointing to `/schedule/technicians`.

```typescript
const TABS = [
  { label: "Appointments", href: "/schedule/appointments" },
  { label: "Bay Schedule", href: "/schedule/bays" },
  { label: "Tech Schedule", href: "/schedule/technicians" },
] as const;
```

**Verification:** All three tabs render. Active state highlights correctly on each page.

---

## Task 3: Tech Timeline Header and Grid Shell

**Files to create:**
- `src/components/schedule/tech-timeline-header.tsx`
- `src/components/schedule/tech-timeline-grid.tsx`

### tech-timeline-header.tsx

Reuse same pattern as `bay-timeline-header.tsx`:
- Navigation: ← / → arrows (shift by 7 days), "Today" button
- Range toggle: 7 / 14 / 30 day pill buttons
- Date range display: "Mar 1 – Mar 14, 2026"
- Props: `{ startDate, onStartDateChange, days, onDaysChange }`

Can be a thin wrapper or exact copy of BayTimelineHeader — they share the same API.

### tech-timeline-grid.tsx

CSS Grid layout following bay-timeline-grid pattern:
- First column: tech labels (fixed 200px)
- Remaining columns: one per day, `minmax(60px, 1fr)`
- Container: `overflow-x: auto`

Row per technician:
- Label area: initials avatar circle (color from TECH_COLORS[index % 10]), name (bold), clock status indicator (green dot if active TimeEntry with clockOut=null), load % badge
- Grid cells: positioned container for task blocks

Day header row:
- "Mon 15" format
- Today's column: `bg-amber-50/50` highlight
- Day-off columns for each tech: `bg-surface-50` with diagonal stripe pattern (via CSS)

Empty cells: click fires `onEmptyCellClick(techId, date)` (for future use).

Props:
```typescript
interface TechTimelineGridProps {
  techs: TechTimelineTech[];
  startDate: Date;
  days: number;
  onTaskClick: (task: TechTask, techId: string) => void;
  onEmptyCellClick?: (techId: string, date: Date) => void;
  dragState: DragState | null;
  onBlockPointerDown: (e: React.PointerEvent, taskId: string, techId: string, startCol: number, colSpan: number, mode: "move" | "resize") => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  ghostStyle: React.CSSProperties | null;
}
```

Expose `scrollToTech(techId)` via `useImperativeHandle` + `forwardRef`.

**Verification:** Grid renders with techs as rows, days as columns. Day-off columns are striped. Today highlighted.

---

## Task 4: Tech Task Block Component

**Files to create:**
- `src/components/schedule/tech-task-block.tsx`

Positioned via `grid-column: startCol / span colSpan` (same as bay-assignment-block).

Content:
- JO number (bold, text-xs, truncated)
- Vehicle plate (text-xs, truncated)
- Task name (text-xs, muted)
- Estimated hours badge (right side)

Styling:
- Background: color based on task status:
  - QUEUED: `bg-surface-100 border-l-surface-400`
  - IN_PROGRESS: `bg-blue-50 border-l-blue-500`
  - PAUSED: `bg-amber-50 border-l-amber-500`
  - QC_REVIEW: `bg-purple-50 border-l-purple-500`
  - DONE: `bg-green-50 border-l-green-500`
  - REWORK: `bg-red-50 border-l-red-500`
- Left border: 3px solid (status color)
- Ongoing tasks (IN_PROGRESS, no completedAt): subtle pulse animation on left border

**Actual work overlay:**
If the task has TimeEntries within the visible range, render a thin (4px) bar at the bottom of the block:
- Green bar: actual hours <= estimated hours
- Red bar: actual hours > estimated hours (overflow indicator)
- Bar width = `min(100, (actualHours / estimatedHours) * 100)%`

Resize handle: 6px right-edge div with `cursor: col-resize` (for future duration estimation).

Click: fires `onTaskClick(task, techId)`.

Pointer events for drag: same pattern as bay-assignment-block.

**Verification:** Task blocks render with correct colors per status. Actual work overlay shows green/red bar.

---

## Task 5: Tech Capacity Indicators (D3)

**Files to create:**
- `src/components/schedule/tech-capacity-bar.tsx`

### Shop Capacity Summary (above grid)

Horizontal bar above the Gantt showing aggregate metrics:
- Total tech-hours available (sum of all techs' working hours in range)
- Total committed hours (sum of estimated hours on active tasks)
- Total logged hours (sum of netMinutes from time entries)
- Shop utilization % (committed / available)
- Overloaded tech count (techs with loadPercent > 100)

Styling: `bg-white border border-surface-200 rounded-lg px-4 py-3` with metrics in a flex row.

### Per-Tech Load Indicator (in tech label column)

Already embedded in tech-timeline-grid's label area:
- Small progress bar (40px wide, 4px tall) below tech name
- Color: green (<80%), amber (80-99%), red (≥100%)
- Text: "85%" next to progress bar

Uses `calcTechCapacity()` from tech-timeline-types.

**Verification:** Shop capacity summary shows correct aggregate numbers. Per-tech load bars match manual calculation.

---

## Task 6: Tech Daily Detail Slide-Over (D2)

**Files to create:**
- `src/components/schedule/tech-daily-detail.tsx`

Uses `<SlideOver>`. Triggered by clicking a day cell or a task block.

### Content

**Header:** Tech name, date, day of week

**Hourly breakdown (7 AM – 6 PM):**
- Vertical list of hour slots
- Each slot shows: time label (7:00 AM), scheduled task (if any), actual TimeEntry (if overlapping)
- Scheduled task: task name + JO number in blue chip
- Actual entry: green bar with clock in/out times
- Gaps between entries: "Idle" label in gray
- Break periods: "Break" label in amber

**Summary section at bottom:**
- Available hours (from work schedule)
- Scheduled hours (sum of estimated hours for tasks on this day)
- Actual hours (sum of netMinutes from time entries on this day)
- Overtime flag: red badge if actual > available

**Footer actions:**
- "View Tasks" → navigate to tech's task list (future)
- "Add Time Entry" → placeholder for manual time entry

Props:
```typescript
interface TechDailyDetailProps {
  open: boolean;
  onClose: () => void;
  techId: string;
  techName: string;
  date: Date;
  tasks: TechTask[];
  timeEntries: TechTimeEntry[];
  workSchedule: WorkSchedule | null;
}
```

**Verification:** Hourly slots display correctly. Actual entries overlay on correct hours. Summary shows correct totals.

---

## Task 7: Task Reassignment Drag-and-Drop (D4)

**Files to create:**
- `src/components/schedule/use-tech-drag.ts`
- `src/components/schedule/unassigned-tasks-banner.tsx`

### use-tech-drag.ts

Adapts `use-gantt-drag.ts` for tech reassignment:
- Move mode: drag task block from one tech row to another
- On drop: call `reassignTaskAction({ taskId, newTechnicianId })`
- No resize mode needed (task duration is estimated, not manually set)
- Ghost: semi-transparent clone translated by dx/dy
- Touch: skip drag on touch devices (same isTouchDevice pattern)
- Capacity validation: show warning toast if target tech is >100% loaded after reassignment

```typescript
interface UseTechDragOptions {
  columnWidth: number;
  rowHeight: number;
  techIds: string[];
  onDragEnd: (result: { taskId: string; newTechId: string }) => void;
}
```

### unassigned-tasks-banner.tsx

Banner above grid showing count of tasks with `assignedTechnicianId === null` and status IN_PROGRESS or QUEUED.

Fetches unassigned tasks from `/api/tasks/unassigned` (new API route to create).

Content: "**{count} unassigned tasks** waiting for technician assignment" + "View & Assign" button.

"View & Assign" button: opens a slide-over listing unassigned tasks with dropdown to assign each to a technician.

**Files to create additionally:**
- `src/app/api/tasks/unassigned/route.ts` — GET endpoint returning unassigned active tasks

```typescript
// GET /api/tasks/unassigned
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:tech_manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = await prisma.task.findMany({
      where: {
        assignedTechnicianId: null,
        status: { in: ["QUEUED", "IN_PROGRESS"] },
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
            vehicle: { select: { plateNumber: true, make: true, model: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch unassigned tasks" }, { status: 500 });
  }
}
```

**Verification:** Drag task from Tech A to Tech B → `reassignTaskAction` called → task appears in new row. Unassigned banner shows correct count. "View & Assign" slide-over works.

---

## Task 8: Technician Work Schedule Management (D5)

**Files to create:**
- `src/components/schedule/tech-work-schedule.tsx`

**Files to modify:**
- `src/app/(dashboard)/settings/page.tsx` — add TechWorkSchedule section

### tech-work-schedule.tsx

Settings component for managing per-technician weekly schedules.

**Layout:** Section within Settings page (similar to BayManagement section).

**Per-technician row:**
- Tech name + avatar
- 7-column grid (Mon-Sun):
  - Each cell: start time dropdown (6:00 AM - 12:00 PM in 30min increments) + end time dropdown (12:00 PM - 10:00 PM in 30min increments)
  - "Day Off" toggle checkbox — when checked, grays out time dropdowns
- Default values from `DEFAULT_WORK_SCHEDULE`

**Bulk actions:**
- "Apply to All" button — copies current tech's schedule to all technicians
- "Reset to Default" button — resets selected tech to DEFAULT_WORK_SCHEDULE

**Save:** Auto-save on change (debounced 500ms) via `updateWorkScheduleAction`.

**Data flow:**
1. Fetch techs via `GET /api/users?role=TECHNICIAN` (or use existing users endpoint)
2. Parse `workSchedule` JSON for each tech
3. On change: serialize to JSON, call `updateWorkScheduleAction`

Props: none (self-contained, fetches own data)

**Verification:** Schedule changes save correctly. Day-off toggle works. Bulk actions apply to all techs. Days off show as striped in tech timeline.

---

## Task 9: Tech Timeline Orchestrator Page

**Files to create:**
- `src/components/schedule/tech-timeline.tsx`

**Files to modify:**
- `src/app/(dashboard)/schedule/technicians/page.tsx` — replace placeholder

### tech-timeline.tsx

Main `"use client"` orchestrator (same pattern as bay-timeline.tsx):

**State:**
- `startDate`, `days`, `techs`, `loading`
- `selectedTask`, `selectedTechId`, `dailyDetailOpen`, `dailyDetailDate`
- `unassignedCount`

**Data fetching:**
- Fetch `/api/technicians/timeline?start=...&end=...` on mount and date changes
- Fetch `/api/tasks/unassigned` for banner count

**Renders:**
- `<ScheduleNav />`
- `<TechTimelineHeader />`
- `<TechCapacityBar />`
- `<UnassignedTasksBanner />`
- `<TechTimelineGrid />` (with drag wiring)
- `<TechDailyDetail />` (slide-over)

**Handlers:**
- Task click → open daily detail
- Empty cell click → open daily detail for that tech + date
- Drag end → call `reassignTaskAction`, refresh data
- Tech capacity chip click → scroll to tech row

### technicians/page.tsx update

```typescript
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import TechTimeline from "@/components/schedule/tech-timeline";
import { ScheduleNav } from "@/components/schedule/schedule-nav";

export default async function TechSchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:tech_view")) return notFound();

  return (
    <div className="space-y-4">
      <ScheduleNav />
      <TechTimeline />
    </div>
  );
}
```

**Verification:** Full page renders. Navigate dates, click tasks, view daily detail, drag between techs.

---

## Task 10: Integration Points Verification (D6)

**No new files.** This task verifies existing integrations work end-to-end:

1. **Approved Estimate → "Schedule Drop-Off"** — Verify that when an estimate is approved, user can schedule a drop-off appointment from the estimate detail page.

2. **Appointment ARRIVED → Begin Intake** — Verify the appointment status flow: ARRIVED triggers intake workflow availability.

3. **Intake → Bay Assignment Suggestion** — Already implemented in Phase C. Verify "Start Work" on job triggers bay suggestion modal.

4. **Task Assignment → Tech Schedule** — Verify that tasks assigned to technicians in the kanban/task management appear correctly on the tech timeline.

5. **Release → Bay Release** — Already implemented in Phase C (auto bay release in completeRelease). Verify bay assignment endDate is set on release.

6. **Dashboard → Today's Appointments** — Verify the todays-appointments-widget shows current day's appointments correctly.

7. **Analytics → Capacity Planning** — Verify `getShopCapacity()` uses real workSchedule data instead of hardcoded 8 hours. Update if needed.

**Files to potentially modify:**
- `src/lib/services/scheduler.ts` — Update `getShopCapacity()` to use actual workSchedule data:

```typescript
export async function getShopCapacity(startDate: Date, endDate: Date) {
  const bays = await prisma.bay.count({ where: { isActive: true, deletedAt: null } });
  const techs = await prisma.user.findMany({
    where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
    select: { workSchedule: true },
  });

  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const hoursPerDay = 8; // Bay hours still use 8

  // Calculate tech hours from actual work schedules
  let techHoursAvailable = 0;
  for (const tech of techs) {
    const schedule = tech.workSchedule ? JSON.parse(tech.workSchedule) : null;
    for (let d = 0; d < dayCount; d++) {
      const day = new Date(startDate.getTime() + d * 86400000);
      techHoursAvailable += getWorkingHoursFromSchedule(schedule, day);
    }
  }

  return {
    totalBays: bays,
    totalTechs: techs.length,
    bayHoursAvailable: bays * dayCount * hoursPerDay,
    techHoursAvailable,
  };
}
```

**Verification:** Run through the full lifecycle: create estimate → approve → schedule appointment → arrive → intake → start work → bay suggestion → assign task → tech schedule shows task → release → bay freed.

---

## Execution Order

**Phase 1 (parallel — no dependencies):**
- Task 1: Types, API route, service enhancements
- Task 2: Schedule nav update (D7)

**Phase 2 (depends on Phase 1):**
- Task 3: Tech timeline header and grid shell (needs Task 1 types)
- Task 4: Tech task block component (needs Task 1 types)
- Task 5: Tech capacity indicators (needs Task 1 types)

**Phase 3 (depends on Phase 2):**
- Task 6: Tech daily detail slide-over (needs Tasks 3, 4)
- Task 7: Task reassignment drag-and-drop (needs Tasks 3, 4)
- Task 8: Technician work schedule management (needs Task 1 actions)

**Phase 4 (depends on Phase 3):**
- Task 9: Tech timeline orchestrator page (needs Tasks 3-7)
- Task 10: Integration points verification (needs Task 9)

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `src/lib/services/scheduler.ts` | `getAllTechSchedules`, `getTechnicianSchedule`, `getShopCapacity` |
| `src/lib/services/tasks.ts` | `updateTask` (for reassignment) |
| `src/lib/services/time-entries.ts` | `getDailyEntries`, `getActiveEntry` |
| `src/lib/actions/scheduler-actions.ts` | Add `reassignTaskAction`, `updateWorkScheduleAction` |
| `src/lib/validators.ts` | Add `reassignTaskSchema`, `updateWorkScheduleSchema` |
| `src/lib/permissions.ts` | `schedule:tech_view`, `schedule:tech_manage` |
| `src/components/schedule/bay-timeline-types.ts` | Reusable utilities |
| `src/components/schedule/bay-timeline-header.tsx` | Pattern reference for header |
| `src/components/schedule/bay-timeline-grid.tsx` | Pattern reference for grid |
| `src/components/schedule/use-gantt-drag.ts` | Pattern reference for drag |
| `src/components/ui/slide-over.tsx` | `{open, onClose, title, description?, children, footer?, wide?}` |
| `src/components/ui/badge.tsx` | `{children, variant}` |
| `src/components/ui/confirm-dialog.tsx` | Confirmation dialogs |
| `prisma/schema.prisma` | Task, TimeEntry, User models |

---

## Verification Checklist

1. `npx tsc --noEmit` — 0 errors
2. Navigate to `/schedule/technicians` — timeline renders with tech rows
3. Three tabs in ScheduleNav all work
4. Navigate timeline with ← / → arrows, "Today" resets
5. Toggle 7 / 14 / 30 day range
6. Task blocks render with correct status colors
7. Actual work overlay shows green/red bars
8. Day-off columns show striped pattern per tech
9. Per-tech load % displays correctly
10. Shop capacity summary shows correct totals
11. Click task → daily detail slide-over opens
12. Hourly breakdown shows scheduled + actual correctly
13. Desktop: drag task from Tech A to Tech B → reassignment
14. Capacity warning when target tech overloaded
15. Unassigned tasks banner shows correct count
16. "View & Assign" works from unassigned banner
17. Settings: work schedule grid shows per-tech schedules
18. Day Off toggle works
19. Bulk "Apply to All" and "Reset to Default" work
20. Integration: task assigned in kanban appears on tech timeline
21. Integration: release job frees bay assignment
22. `getShopCapacity` uses real workSchedule data

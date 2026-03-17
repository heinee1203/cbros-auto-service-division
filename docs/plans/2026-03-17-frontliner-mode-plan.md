# Frontliner Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a simplified mobile experience for shop floor workers (technicians, advisors, QC inspectors) as a new `(frontliner)` route group reusing all existing business logic.

**Architecture:** New route group `src/app/(frontliner)/` with its own layout (dark theme via ScheduleThemeProvider, bottom nav, no sidebar). Role-based redirect in middleware. All mutations use existing server actions. Only 2 new service functions needed.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, `--sch-*` CSS variables (dark theme), existing Prisma services/actions, existing PinClock + IntakeWizard components.

**Verification:** `npx next build` must pass with 0 errors after each task. No test framework in this project.

---

## Phase 1: Layout + Middleware + Home Screens

### Task 1: Frontliner Layout Shell

**Files:**
- Create: `src/app/(frontliner)/layout.tsx`
- Create: `src/components/frontliner/frontliner-shell.tsx`
- Create: `src/components/frontliner/frontliner-topbar.tsx`
- Create: `src/components/frontliner/frontliner-bottom-nav.tsx`

**Step 1: Create the layout server component**

`src/app/(frontliner)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ScheduleThemeProvider } from "@/components/schedule/schedule-theme-provider";
import { FrontlinerShell } from "@/components/frontliner/frontliner-shell";
import type { UserRole } from "@/types/enums";

export default async function FrontlinerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <ScheduleThemeProvider>
      <FrontlinerShell
        user={{
          id: session.user.id,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          role: session.user.role as UserRole,
        }}
      >
        {children}
      </FrontlinerShell>
    </ScheduleThemeProvider>
  );
}
```

**Step 2: Create the FrontlinerShell client component**

`src/components/frontliner/frontliner-shell.tsx`:
```tsx
"use client";

import { FrontlinerTopbar } from "./frontliner-topbar";
import { FrontlinerBottomNav } from "./frontliner-bottom-nav";
import type { UserRole } from "@/types/enums";

interface FrontlinerShellProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  children: React.ReactNode;
}

export function FrontlinerShell({ user, children }: FrontlinerShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <FrontlinerTopbar user={user} />
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {children}
      </main>
      <FrontlinerBottomNav userRole={user.role} />
    </div>
  );
}
```

**Step 3: Create the FrontlinerTopbar**

`src/components/frontliner/frontliner-topbar.tsx`:
- Height: 56px
- Left: app logo/name "AutoServ" (small)
- Right: user avatar circle with initials + first name, notification bell
- "Switch to Admin" link visible only for ADVISOR, MANAGER, OWNER roles
- All styled with `--sch-*` variables: `bg-[var(--sch-card)]`, `text-[var(--sch-text)]`, `border-[var(--sch-border)]`

**Step 4: Create the FrontlinerBottomNav**

`src/components/frontliner/frontliner-bottom-nav.tsx`:
- Height: 64px + safe-area-inset-bottom
- Role-dependent nav items:
  - TECHNICIAN: Home(/frontliner), Clock(/frontliner/clock), Photos(/frontliner/photos), Tasks(/frontliner/my-tasks)
  - ADVISOR: Home(/frontliner), Intake(/frontliner/intake), Jobs(/frontliner/jobs), Release(/frontliner/release)
  - QC_INSPECTOR: Home(/frontliner), QC Queue(/frontliner/qc), Photos(/frontliner/photos)
  - OWNER/MANAGER: same as ADVISOR (they can access frontliner too)
- Icons from lucide-react: Home, Timer, Camera, CheckSquare, Plus, Car, ClipboardList, ClipboardCheck
- Active state: amber accent `text-[var(--sch-accent)]`
- Inactive: `text-[var(--sch-text-dim)]`
- Each tab: min 64px wide, centered icon + label (12px), `min-h-[64px]` tap target

**Step 5: Build and verify**

Run: `npx next build`
Expected: 0 errors (the route group exists but no page.tsx yet, so no new routes compiled — that's fine)

**Step 6: Commit**
```bash
git add src/app/\(frontliner\)/layout.tsx src/components/frontliner/
git commit -m "feat: add frontliner layout shell with topbar and role-based bottom nav"
```

---

### Task 2: Middleware Role-Based Redirect

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/lib/permissions.ts`

**Step 1: Add frontliner route permission**

In `src/lib/permissions.ts`, add to `ROUTE_PERMISSIONS`:
```typescript
// No route-level restriction for /frontliner — all authenticated roles can access it
// (redirect logic is in middleware, not permission blocking)
```

Actually, NO change to permissions needed. The frontliner routes should be accessible to all authenticated users. The middleware just handles the post-login redirect.

**Step 2: Update middleware for role-based redirect**

In `src/middleware.ts`, add redirect logic after the login check. When the user navigates to `/` (root), check their role and redirect shop floor roles to `/frontliner`:

```typescript
// After existing permission checks, before NextResponse.next():
// Role-based home redirect: shop floor roles go to frontliner
const FRONTLINER_ROLES = ["TECHNICIAN", "QC_INSPECTOR", "ADVISOR"];
if (pathname === "/" && FRONTLINER_ROLES.includes(token.role as string)) {
  return NextResponse.redirect(new URL("/frontliner", req.url));
}
```

This means:
- TECHNICIAN/QC_INSPECTOR/ADVISOR navigating to `/` get redirected to `/frontliner`
- They can still manually navigate to any admin page they have permissions for
- OWNER/MANAGER/CASHIER/ESTIMATOR stay on `/` (dashboard)
- Direct navigation to `/frontliner` by any role works fine

**Step 3: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 4: Commit**
```bash
git add src/middleware.ts
git commit -m "feat: add role-based redirect — shop floor roles go to /frontliner"
```

---

### Task 3: Frontliner Home Page with Role Dispatch

**Files:**
- Create: `src/app/(frontliner)/page.tsx`
- Create: `src/components/frontliner/technician-home.tsx`
- Create: `src/components/frontliner/advisor-home.tsx`
- Create: `src/components/frontliner/qc-inspector-home.tsx`

**Step 1: Create the home page server component**

`src/app/(frontliner)/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TechnicianHome } from "@/components/frontliner/technician-home";
import { AdvisorHome } from "@/components/frontliner/advisor-home";
import { QCInspectorHome } from "@/components/frontliner/qc-inspector-home";
// Data fetching imports...

export default async function FrontlinerHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const userId = session.user.id;
  const firstName = session.user.firstName;

  if (role === "TECHNICIAN") {
    // Fetch: active entry, daily entries, assigned tasks
    // Pass as props to TechnicianHome
    return <TechnicianHome firstName={firstName} userId={userId} /* ...data */ />;
  }

  if (role === "QC_INSPECTOR") {
    // Fetch: jobs with QC_PENDING status
    return <QCInspectorHome firstName={firstName} /* ...data */ />;
  }

  // ADVISOR, MANAGER, OWNER, ESTIMATOR, CASHIER -> advisor view
  // Fetch: today's appointments, active jobs, ready-for-pickup jobs
  return <AdvisorHome firstName={firstName} /* ...data */ />;
}
```

**Step 2: Create TechnicianHome**

`src/components/frontliner/technician-home.tsx` — client component:
- Greeting: "Good morning, {firstName} 👋" (24px, `text-[var(--sch-text)]`)
- Clock Status Card: full-width, `bg-[var(--sch-card)]` with `border-l-4 border-[var(--sch-accent)]`
  - If clocked in: task name + JO number, live timer (font-mono), "Take Break" / "Clock Out" buttons
  - If on break: break timer, "End Break" button
  - If not clocked in: "Not clocked in" message + big "Clock In →" button linking to `/frontliner/clock`
  - Bottom: "Today: {dailyHours}" in font-mono
- My Tasks section: max 3 task cards, "View all →" link to `/frontliner/my-tasks`
- Each task card: `bg-[var(--sch-card)]` rounded-xl, colored left border by status, plate + make/model, task name (18px), status badge, hours

**Step 3: Create AdvisorHome**

`src/components/frontliner/advisor-home.tsx` — client component:
- Greeting
- Quick Actions bar: two buttons — "New Intake" (amber bg) links to `/frontliner/intake`, "Quick Job" (outlined) links to `/frontliner/intake?level=L1`
- Today's Appointments section: cards from `getTodaysAppointments()`
  - Each card: time (font-mono), customer name, vehicle plate (font-mono), "Begin Intake →" button
- Active Jobs section: horizontal scroll, max 6 cards
  - Each card: plate (large), make/model, status badge, bay, tech
- Ready for Pickup section: FULLY_PAID jobs with "Release →" button

**Step 4: Create QCInspectorHome**

`src/components/frontliner/qc-inspector-home.tsx` — client component:
- Greeting
- Queue count: "N jobs awaiting QC"
- QC queue cards: plate, JO number, customer, service categories, assigned tech, "Start QC →" button linking to `/frontliner/qc/[jobId]`
- Empty state: "No jobs awaiting QC. All clear!"

**Step 5: Add new service functions for home screen data**

Add to `src/lib/services/tasks.ts`:
```typescript
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
```

Add to `src/lib/services/job-orders.ts`:
```typescript
export async function getActiveJobsForFloor() {
  return prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
      primaryTechnician: { select: { id: true, firstName: true, lastName: true } },
      bayAssignments: {
        where: { isActive: true },
        include: { bay: { select: { id: true, name: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJobsAwaitingQC() {
  return prisma.jobOrder.findMany({
    where: { status: "QC_PENDING" },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { plateNumber: true, make: true, model: true } },
      primaryTechnician: { select: { firstName: true, lastName: true } },
      estimates: {
        where: { deletedAt: null },
        include: {
          estimateRequest: { select: { requestedCategories: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

**Step 6: Build and verify**

Run: `npx next build`
Expected: 0 errors, new route `/frontliner` appears

**Step 7: Commit**
```bash
git add src/app/\(frontliner\)/page.tsx src/components/frontliner/ src/lib/services/tasks.ts src/lib/services/job-orders.ts
git commit -m "feat: add frontliner home screens for technician, advisor, and QC inspector"
```

---

### Task 4: Admin "Switch to Floor View" Link

**Files:**
- Modify: `src/components/layout/topbar.tsx`

**Step 1: Add "Floor View" link to admin topbar**

In the topbar's user dropdown area (near the sign-out button), add a link to `/frontliner`:
```tsx
<Link
  href="/frontliner"
  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-100 text-surface-600 text-sm transition-colors"
>
  <Smartphone className="w-4 h-4" />
  <span>Floor View</span>
</Link>
```

Only show for roles that would benefit: all roles can see it (useful for testing/demo).

**Step 2: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 3: Commit**
```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: add 'Floor View' link in admin topbar for quick switching"
```

---

## Phase 2: Technician Views

### Task 5: My Tasks Page

**Files:**
- Create: `src/app/(frontliner)/my-tasks/page.tsx`
- Create: `src/components/frontliner/task-card.tsx`

**Step 1: Create the my-tasks page**

`src/app/(frontliner)/my-tasks/page.tsx` — server component:
- Fetches `getTasksForTechnician(userId)` from task service
- Passes tasks to a client component with filter state (Active/Completed)

**Step 2: Create TaskCard component**

`src/components/frontliner/task-card.tsx` — client component:
- Props: task data (name, status, JO number, plate, make/model, est hours, actual hours)
- Layout: `bg-[var(--sch-card)]` rounded-xl p-4, colored left border by status
  - Status border colors: QUEUED=amber, IN_PROGRESS=emerald, PAUSED=amber, QC_REVIEW=blue, DONE=gray, REWORK=red
- Top line: JO number (font-mono, text-sm, muted) + vehicle plate (font-mono)
- Second line: make/model (text-sm, muted)
- Task name: 18px font-semibold
- Status badge: large, using TASK_STATUS_COLORS from enums.ts
- Hours: progress bar (est vs actual), font-mono numbers
- Action button (full width, 48px height):
  - QUEUED → "Start" (green bg) — calls `transitionTaskStatusAction("IN_PROGRESS")` + `clockInAction(taskId, jobOrderId, "TABLET_CLOCK")`
  - IN_PROGRESS → "Pause" (amber bg) — calls `clockOutAction(activeEntryId)` + `transitionTaskStatusAction("PAUSED")`
  - PAUSED → "Resume" (green bg) — calls `transitionTaskStatusAction("IN_PROGRESS")` + `clockInAction(...)`
  - QC_REVIEW → "Awaiting QC" (blue bg, disabled)
  - DONE → "✓ Completed" (gray, disabled)
  - REWORK → "Start Rework" (red bg) — calls `transitionTaskStatusAction("IN_PROGRESS")` + `clockInAction(...)`

**Step 3: Create combined clock+status action**

Create `src/lib/actions/frontliner-actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { transitionTaskStatus } from "@/lib/services/tasks";
import { clockIn, clockOut, getActiveEntry } from "@/lib/services/time-entries";
import type { ActionResult } from "@/lib/actions/estimate-actions";

export async function startTaskAction(
  taskId: string,
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    // Clock out of any current task first
    const active = await getActiveEntry(session.user.id);
    if (active) {
      await clockOut(active.id, session.user.id);
    }

    // Transition task to IN_PROGRESS
    await transitionTaskStatus(taskId, "IN_PROGRESS", session.user.id);

    // Clock in to new task
    await clockIn(session.user.id, taskId, jobOrderId, "TABLET_CLOCK");

    revalidatePath("/frontliner");
    revalidatePath("/frontliner/my-tasks");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function pauseTaskAction(
  taskId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    // Clock out
    const active = await getActiveEntry(session.user.id);
    if (active) {
      await clockOut(active.id, session.user.id);
    }

    // Transition to PAUSED
    await transitionTaskStatus(taskId, "PAUSED", session.user.id);

    revalidatePath("/frontliner");
    revalidatePath("/frontliner/my-tasks");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function completeTaskAction(
  taskId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const active = await getActiveEntry(session.user.id);
    if (active && active.taskId === taskId) {
      await clockOut(active.id, session.user.id);
    }

    await transitionTaskStatus(taskId, "DONE", session.user.id);

    revalidatePath("/frontliner");
    revalidatePath("/frontliner/my-tasks");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
```

**Step 4: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 5: Commit**
```bash
git add src/app/\(frontliner\)/my-tasks/ src/components/frontliner/task-card.tsx src/lib/actions/frontliner-actions.ts
git commit -m "feat: add frontliner my-tasks page with combined clock+status actions"
```

---

### Task 6: Task Detail Page

**Files:**
- Create: `src/app/(frontliner)/my-tasks/[taskId]/page.tsx`
- Create: `src/components/frontliner/task-detail-view.tsx`

**Step 1: Create task detail page**

Server component that fetches `getTaskDetail(taskId)` from existing task service and renders `TaskDetailView`.

**Step 2: Create TaskDetailView**

Client component with scrollable sections:
1. **Header card**: task name, JO number, vehicle plate, status badge, action button (same as TaskCard)
2. **Time entries section**: list of clock in/out entries from `task.timeEntries`, each showing date, clock in/out times (font-mono), duration
3. **Milestone photos section**: grid from `serviceCatalog.requiredMilestonePhotos` (JSON array of milestone strings), checkmarks for captured, camera button for missing — camera button opens file input with `accept="image/*" capture="environment"`, uploads via POST to `/api/photos/upload` with `entityType: "TASK"`, `entityId: taskId`, `stage: "PROGRESS"`, `category: milestone`
4. **Materials section**: read-only list from `task.materialUsages` — name, quantity, unit cost
5. **Notes input**: textarea + submit button calling `createJobActivityAction` with `type: "note"`

**Step 3: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 4: Commit**
```bash
git add src/app/\(frontliner\)/my-tasks/\[taskId\]/ src/components/frontliner/task-detail-view.tsx
git commit -m "feat: add frontliner task detail with time entries, photos, materials"
```

---

### Task 7: Clock Page (PinClock Reuse)

**Files:**
- Create: `src/app/(frontliner)/clock/page.tsx`
- Modify: `src/components/time-clock/pin-clock.tsx` (add `preAuthUser` prop)

**Step 1: Add preAuthUser prop to PinClock**

In `src/components/time-clock/pin-clock.tsx`:
- Add optional prop: `preAuthUser?: { id: string; firstName: string; lastName: string }`
- When `preAuthUser` is provided, skip the PIN entry (`idle` state) entirely
- On mount, if `preAuthUser` exists: set `techName` to the user's name, call `fetchClockStatus()`, set `clockState` to `"authenticated"` or `"clocked_in"` based on status
- This avoids re-authentication when the user is already logged in via the frontliner session

Change the component signature from:
```tsx
export default function PinClock() {
```
to:
```tsx
interface PinClockProps {
  preAuthUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function PinClock({ preAuthUser }: PinClockProps = {}) {
```

Add early effect:
```tsx
useEffect(() => {
  if (preAuthUser) {
    setTechName(`${preAuthUser.firstName} ${preAuthUser.lastName}`);
    fetchClockStatus().then(() => {
      // State will be set by fetchClockStatus based on activeEntry
    });
  }
}, [preAuthUser]);
```

And skip rendering the PIN keypad when `preAuthUser` is set and `clockState === "idle"` — instead show a loading spinner while fetching status.

**Step 2: Create frontliner clock page**

`src/app/(frontliner)/clock/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PinClock from "@/components/time-clock/pin-clock";

export default async function FrontlinerClockPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-md mx-auto">
      <PinClock
        preAuthUser={{
          id: session.user.id,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
        }}
      />
    </div>
  );
}
```

**Step 3: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 4: Commit**
```bash
git add src/app/\(frontliner\)/clock/ src/components/time-clock/pin-clock.tsx
git commit -m "feat: add frontliner clock page with pre-authenticated PinClock"
```

---

### Task 8: Photos Page (Milestone Grid)

**Files:**
- Create: `src/app/(frontliner)/photos/page.tsx`
- Create: `src/components/frontliner/milestone-grid.tsx`

**Step 1: Create photos page**

`src/app/(frontliner)/photos/page.tsx` — server component:
- Fetches user's active tasks via `getTasksForTechnician(userId)` (for TECHNICIAN) or QC jobs via `getJobsAwaitingQC()` (for QC_INSPECTOR)
- For each task/job, includes the `serviceCatalog.requiredMilestonePhotos` and existing photos
- Passes to client component

**Step 2: Create MilestoneGrid component**

`src/components/frontliner/milestone-grid.tsx` — client component:
- Props: task info (id, name, JO number), milestones (string[]), existing photos
- Task selector at top: if multiple tasks, show pills/dropdown to select which task
- Grid of milestone cards (2 columns on mobile):
  - Each card: milestone label, thumbnail if photo exists, camera icon if missing
  - Tap missing → `<input type="file" accept="image/*" capture="environment" ref={fileInputRef}>` triggered programmatically
  - On file selected: FormData with file, entityType="TASK", entityId=taskId, stage="PROGRESS", category=milestone name → POST `/api/photos/upload`
  - Show loading spinner during upload, then thumbnail on success
  - Auto-advance: after successful upload, focus next empty milestone
- Progress indicator: "N of M milestones documented" with progress bar
- For QC_INSPECTOR role: entityType="JOB_ORDER", stage="QC"

**Step 3: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 4: Commit**
```bash
git add src/app/\(frontliner\)/photos/ src/components/frontliner/milestone-grid.tsx
git commit -m "feat: add frontliner photos page with camera-first milestone grid"
```

---

## Phase 3: Advisor Views

### Task 9: Intake Page (IntakeWizard Reuse)

**Files:**
- Create: `src/app/(frontliner)/intake/page.tsx`
- Modify: `src/components/schedule/intake-wizard.tsx` (add `variant` + `onComplete` props)

**Step 1: Add variant and onComplete props to IntakeWizard**

In `src/components/schedule/intake-wizard.tsx`:
- Add props: `variant?: "schedule" | "frontliner"` (default "schedule"), `onComplete?: (jobId: string) => void`
- When `variant === "frontliner"` and wizard completes: call `onComplete(jobId)` instead of the existing schedule-context redirect
- When `variant === "frontliner"`: hide the close/X button (wizard is the full page, not a modal)

**Step 2: Create frontliner intake page**

`src/app/(frontliner)/intake/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrontlinerIntakeClient } from "@/components/frontliner/frontliner-intake-client";

export default async function FrontlinerIntakePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "intake:create")) redirect("/frontliner");

  return <FrontlinerIntakeClient />;
}
```

Create `src/components/frontliner/frontliner-intake-client.tsx`:
```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { IntakeWizard } from "@/components/schedule/intake-wizard";

export function FrontlinerIntakeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <IntakeWizard
      variant="frontliner"
      initialLevel={searchParams.get("level") as any}
      appointmentId={searchParams.get("appointmentId") || undefined}
      onComplete={(jobId) => router.push("/frontliner/jobs")}
    />
  );
}
```

**Step 3: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 4: Commit**
```bash
git add src/app/\(frontliner\)/intake/ src/components/frontliner/frontliner-intake-client.tsx src/components/schedule/intake-wizard.tsx
git commit -m "feat: add frontliner intake page reusing IntakeWizard with variant prop"
```

---

### Task 10: Jobs Page (Card View with Bottom Sheet)

**Files:**
- Create: `src/app/(frontliner)/jobs/page.tsx`
- Create: `src/components/frontliner/job-card.tsx`
- Create: `src/components/frontliner/bottom-sheet.tsx`
- Create: `src/components/frontliner/jobs-client.tsx`

**Step 1: Create BottomSheet component**

`src/components/frontliner/bottom-sheet.tsx` — reusable bottom sheet:
- Props: `open`, `onClose`, `title`, `children`
- Overlay: `fixed inset-0 z-50`, bg-black/50
- Sheet: slides up from bottom, `bg-[var(--sch-card)]` rounded-t-2xl, handle bar at top, title, content
- Transition: CSS transform translateY

**Step 2: Create JobCard component**

`src/components/frontliner/job-card.tsx`:
- Props: job data (id, JO number, status, vehicle, customer, bay, tech)
- Layout: `bg-[var(--sch-card)]` rounded-xl p-4, colored left border by status group
  - amber = PENDING/CHECKED_IN
  - emerald = IN_PROGRESS
  - blue = QC_PENDING/QC_PASSED/QC_FAILED_REWORK
  - orange = AWAITING_PAYMENT/PARTIAL_PAYMENT
  - gray = FULLY_PAID
- Plate number: large 20px font-mono
- Make/model + customer name
- Status badge (large)
- Bay + tech name (muted)
- Tap → opens BottomSheet with quick actions

**Step 3: Create jobs client component**

`src/components/frontliner/jobs-client.tsx`:
- Filter pills at top: All, Waitlist, In-Service, QC, Pickup — with counts
- Pill styling: 48px height, bg-[var(--sch-surface)] default, bg-[var(--sch-accent)] active, horizontal scroll
- JobCard list below
- Bottom sheet for selected job: Change Status, Reassign Bay, Reassign Tech, View Full Details

**Step 4: Create jobs page**

`src/app/(frontliner)/jobs/page.tsx` — server component fetching `getActiveJobsForFloor()`:

**Step 5: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 6: Commit**
```bash
git add src/app/\(frontliner\)/jobs/ src/components/frontliner/job-card.tsx src/components/frontliner/bottom-sheet.tsx src/components/frontliner/jobs-client.tsx
git commit -m "feat: add frontliner jobs page with card view and bottom sheet actions"
```

---

### Task 11: Release Queue and Release Wizard

**Files:**
- Create: `src/app/(frontliner)/release/page.tsx`
- Create: `src/app/(frontliner)/release/[jobId]/page.tsx`
- Create: `src/components/frontliner/release-wizard.tsx`

**Step 1: Create release queue page**

`src/app/(frontliner)/release/page.tsx` — server component:
- Fetch jobs with status `FULLY_PAID` (or also `QC_PASSED` + `AWAITING_PAYMENT` as "almost ready")
- Render cards: plate, customer name+phone, "Begin Release →" button → `/frontliner/release/[jobId]`

**Step 2: Create release wizard component**

`src/components/frontliner/release-wizard.tsx` — client component with 4 steps:

Step 1 — Release Photos:
- Camera capture inputs for minimum angles (use same pattern as milestone-grid)
- Upload to `/api/photos/upload` with `entityType: "JOB_ORDER"`, `entityId: jobOrderId`, `stage: "RELEASE"`
- Progress: "N of M photos taken"
- "Next" button enabled when minimum met

Step 2 — Belongings Return:
- Import and render existing `BelongingsReturn` component from `src/components/release/belongings-return.tsx`
- Pass belongings from intake record
- "Next" when all returned (or skip if none)

Step 3 — Customer Signature:
- Canvas-based signature pad (reuse pattern from `IntakeQuickSignoff`)
- "Customer confirms vehicle received"
- "Next" when signed

Step 4 — Complete:
- Call `completeReleaseAction(jobOrderId)` — which calls `completeRelease` service
- Success card: "Vehicle released — JO-XXXX-XX"
- "Back to Queue" button → `/frontliner/release`

**Step 3: Create release detail page**

`src/app/(frontliner)/release/[jobId]/page.tsx` — server component:
- Fetch job detail, intake record (for belongings), existing release record
- If no release record, call `createReleaseAction` to initialize one
- Render `ReleaseWizard` with data

**Step 4: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 5: Commit**
```bash
git add src/app/\(frontliner\)/release/ src/components/frontliner/release-wizard.tsx
git commit -m "feat: add frontliner release queue and 4-step release wizard"
```

---

## Phase 4: QC Inspector Views

### Task 12: QC Queue Page

**Files:**
- Create: `src/app/(frontliner)/qc/page.tsx`

**Step 1: Create QC queue page**

`src/app/(frontliner)/qc/page.tsx` — server component:
- Fetch `getJobsAwaitingQC()` from job-orders service
- Render cards: plate (large, font-mono), JO number, customer, service categories as badges, assigned tech, "Start QC →" button → `/frontliner/qc/[jobId]`
- Empty state: "No jobs awaiting QC. All clear!"

**Step 2: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 3: Commit**
```bash
git add src/app/\(frontliner\)/qc/page.tsx
git commit -m "feat: add frontliner QC queue page"
```

---

### Task 13: QC Checklist Page

**Files:**
- Create: `src/app/(frontliner)/qc/[jobId]/page.tsx`
- Create: `src/components/frontliner/qc-checklist-card.tsx`
- Create: `src/components/frontliner/qc-checklist-client.tsx`

**Step 1: Create QCChecklistCard component**

`src/components/frontliner/qc-checklist-card.tsx`:
- Props: checklist item (id, description, category, status, notes), onUpdate callback
- Card layout: `bg-[var(--sch-card)]` rounded-xl p-4
- Description text: 18px
- Three 64px square buttons side by side:
  - ✅ Pass (green): `bg-emerald-600` when selected, `bg-[var(--sch-surface)]` when not
  - ❌ Fail (red): `bg-red-600` when selected
  - ➖ N/A (gray): `bg-gray-600` when selected
- On Fail: expand notes textarea + optional camera button for photo
- Calls `updateChecklistItemAction` on button tap

**Step 2: Create QC checklist client component**

`src/components/frontliner/qc-checklist-client.tsx`:
- Props: inspection data with checklist items, job info
- Header: vehicle plate + JO number + progress bar ("N of M items checked")
- Items grouped by category (collapsible sections)
- Sticky "Submit QC" button at bottom
  - Disabled until all items have a status
  - Calls `submitQCInspectionAction`
  - On pass: success message, auto-navigates to `/frontliner/qc`
  - On fail: shows summary of failed items

**Step 3: Create QC checklist page**

`src/app/(frontliner)/qc/[jobId]/page.tsx` — server component:
- Fetch job detail and QC inspections via `getJobQCInspections(jobId)`
- If no inspection exists, create one via `createQCInspection(jobId, userId)`
- Render `QCChecklistClient` with data

**Step 4: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 5: Commit**
```bash
git add src/app/\(frontliner\)/qc/\[jobId\]/ src/components/frontliner/qc-checklist-card.tsx src/components/frontliner/qc-checklist-client.tsx
git commit -m "feat: add frontliner QC checklist with card-per-item pass/fail/na"
```

---

## Phase 5: Polish

### Task 14: Visual Polish and Transitions

**Files:**
- Modify: multiple frontliner components

**Step 1: Add page transition animations**

Add CSS transitions to frontliner content area — simple fade-in on mount using Tailwind `animate-in fade-in` or a small custom animation.

**Step 2: Verify dark theme consistency**

Audit all frontliner components for:
- All backgrounds use `--sch-card`, `--sch-surface`, `--sch-bg`
- All text uses `--sch-text`, `--sch-text-muted`, `--sch-text-dim`
- All borders use `--sch-border`
- Accent color uses `--sch-accent`
- No hardcoded colors (no `bg-white`, `text-gray-900`, etc.)

**Step 3: Verify touch targets**

All interactive elements: minimum 48px height/width, 64px for primary actions. Check:
- Bottom nav tabs: 64px
- Action buttons on cards: 48px min-height
- Filter pills: 48px
- QC pass/fail buttons: 64px
- Camera/upload buttons: 48px

**Step 4: Build and verify**

Run: `npx next build`
Expected: 0 errors

**Step 5: Commit**
```bash
git add -A
git commit -m "feat: polish frontliner dark theme consistency, touch targets, transitions"
```

---

### Task 15: Offline Verification and PWA

**Files:**
- Potentially modify: `public/manifest.json`

**Step 1: Verify offline clock works in frontliner routes**

The existing `useNetworkStatus` hook and IndexedDB clock queue (`src/lib/offline/clock-queue.ts`) should work unchanged since:
- The frontliner clock reuses `PinClock` which already has offline support
- The frontliner task actions (`startTaskAction`, `pauseTaskAction`) call the same `clockIn`/`clockOut` functions

Verify: the frontliner layout doesn't break the offline detection. The `SyncStatusBadge` component should be visible somewhere in the frontliner topbar if there are queued offline actions.

**Step 2: Add SyncStatusBadge to frontliner topbar**

Import and render `SyncStatusBadge` in `frontliner-topbar.tsx` (same as admin topbar already does).

**Step 3: Build and verify**

Run: `npx next build`
Expected: 0 errors, all routes compile

**Step 4: Final verification**

Run the dev server and manually check:
1. `/frontliner` loads with dark theme
2. Bottom nav shows correct tabs for different roles
3. Home screen renders greeting + cards
4. Navigation between tabs works
5. "Switch to Admin" link works
6. "Floor View" link in admin works

**Step 5: Commit**
```bash
git add -A
git commit -m "feat: add offline sync badge to frontliner, verify PWA compatibility"
```

---

## Summary

| Phase | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| 1. Layout + Home | Tasks 1-4 | 8 | 2 |
| 2. Technician | Tasks 5-8 | 8 | 1 |
| 3. Advisor | Tasks 9-11 | 8 | 1 |
| 4. QC Inspector | Tasks 12-13 | 4 | 0 |
| 5. Polish | Tasks 14-15 | 0 | ~5 |
| **Total** | **15 tasks** | **~28 files** | **~9 files** |

New service functions: 3 (`getTasksForTechnician`, `getActiveJobsForFloor`, `getJobsAwaitingQC`)
New action file: 1 (`frontliner-actions.ts` with `startTaskAction`, `pauseTaskAction`, `completeTaskAction`)
Existing components modified: 2 (`PinClock` + `IntakeWizard` — additive prop changes only)

# Frontliner Mode — Design Document

**Date:** 2026-03-17
**Status:** Approved

## Overview

Two "faces" of the same app — Admin (desktop, full sidebar, data-focused) and Frontliner (mobile/tablet, bottom nav, task-focused). Same database, same auth, same server actions. Frontliner routes render simpler UI on top of the existing data layer.

## Architecture

New `(frontliner)` route group alongside existing `(dashboard)` and `(schedule)` groups:

```
src/app/
  (auth)/              <- existing login
  (dashboard)/         <- existing admin (UNCHANGED)
  (schedule)/          <- existing schedule (UNCHANGED)
  (frontliner)/        <- NEW: simplified views
    layout.tsx         <- FrontlinerShell: no sidebar, bottom nav, dark theme
    page.tsx           <- role-based home screen dispatch
    my-tasks/          <- technician: assigned work (cards)
    my-tasks/[taskId]/ <- technician: task detail
    clock/             <- technician: clock in/out (reuse PinClock)
    photos/            <- technician + QC: quick photo capture
    intake/            <- advisor: intake wizard (reuse IntakeWizard)
    jobs/              <- advisor: today's active jobs (cards)
    release/           <- advisor: release queue
    release/[jobId]/   <- advisor: release wizard
    qc/                <- QC inspector: QC queue
    qc/[jobId]/        <- QC inspector: QC checklist
```

Zero business logic duplication. All mutations use existing server actions. Only 2 new service functions needed.

## Key Decisions

1. **Theme:** Reuse `ScheduleThemeProvider` with `--sch-*` CSS variables, always dark (no toggle)
2. **Role redirect:** Middleware-based — TECHNICIAN/QC_INSPECTOR -> /frontliner, ADVISOR -> /frontliner, OWNER/MANAGER/CASHIER/ESTIMATOR -> /
3. **Bottom nav:** Role-dependent (TECHNICIAN 4 tabs, ADVISOR 4 tabs, QC_INSPECTOR 3 tabs)
4. **Design principles:** Cards over tables, one action per screen, 18px+ body text, 48-64px buttons, camera-first, minimal navigation

## Layout

### FrontlinerShell

- **Top bar (56px):** App logo (small), user avatar + first name, notification bell, "Switch to Admin" link (ADVISOR/MANAGER/OWNER only)
- **Content area:** Full viewport minus top bar and bottom nav, scrollable
- **Bottom nav (64px):** Role-dependent tabs with 48-64px tap targets, amber accent active state

### Bottom Nav Configs

| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 |
|------|-------|-------|-------|-------|
| TECHNICIAN | Home | Clock | Photos | Tasks |
| ADVISOR | Home | Intake | Jobs | Release |
| QC_INSPECTOR | Home | QC Queue | Photos | — |

### Admin Escape Hatch

- Frontliner top bar: "Switch to Admin" link (ADVISOR/MANAGER/OWNER)
- Admin topbar user dropdown: "Switch to Floor View" link -> /frontliner

## Technician Views

### Technician Home

- Greeting: "Good morning, [firstName]"
- Clock status card (live widget): clocked-in state with timer, or "Not clocked in" + big "Clock In" button
- My Tasks Today: max 3 task cards, "View all" link
- Data: `getAssignedTasksForTech(userId)` + `getActiveEntry(userId)` + `getDailyEntries(userId, today)`

### My Tasks (`/frontliner/my-tasks`)

- Filter pills: Active | Completed (48px height)
- Task cards with: vehicle photo thumbnail, JO number + plate + make/model, task name (18px), status badge, est vs actual hours, single context-dependent action button
- Action button behavior: QUEUED->"Start" (auto clock-in + transition), IN_PROGRESS->"Pause" (clock-out + pause), PAUSED->"Resume" (clock-in + resume), REWORK->"Start Rework"
- Tap card -> task detail page

### Task Detail (`/frontliner/my-tasks/[taskId]`)

- Task info header
- Time entries (clock history)
- Milestone photos checklist (camera button for missing)
- Materials log (read-only)
- Notes input

### Clock (`/frontliner/clock`)

- Reuses existing `PinClock` component with new `preAuthUser` prop
- Pre-authenticated user skips PIN entry, goes straight to task selection
- All offline support preserved

### Photos (`/frontliner/photos`)

- Task selector (active tasks dropdown/cards)
- Milestone grid per task with camera buttons
- `<input type="file" accept="image/*" capture="environment">` for native camera
- Auto-upload on capture, auto-advance to next empty milestone
- Progress: "4 of 7 milestones documented"
- Role-aware: TECHNICIAN sees active tasks, QC_INSPECTOR sees QC jobs

## Advisor Views

### Advisor Home

- Greeting
- Quick Actions: "New Intake" (amber) + "Quick Job" (outlined)
- Today's Appointments: cards with time, customer, vehicle, "Mark Arrived" / "Begin Intake" buttons
- Active Jobs: horizontally scrollable cards, max 6, "View all" link
- Ready for Pickup: cards for FULLY_PAID jobs with "Release" button

### Intake (`/frontliner/intake`)

- Reuses `IntakeWizard` component with `variant="frontliner"` + `onComplete` callback
- Supports query params: `?level=L1`, `?appointmentId=xxx`
- On completion: redirects to `/frontliner/jobs`

### Jobs (`/frontliner/jobs`)

- Filter pills: All | Waitlist | In-Service | QC | Pickup (with counts)
- Job cards: color-coded left border by status, plate (large), make/model, customer, status badge, bay, tech
- Tap card -> bottom sheet with quick actions: Change Status, Reassign Bay, Reassign Tech, View Full Details
- Uses existing `updateJobOrderStatus`, scheduler actions

### Release (`/frontliner/release`)

- Release queue: cards for FULLY_PAID jobs with "Begin Release" button
- Release wizard (`/frontliner/release/[jobId]`) — 4 steps:
  1. Release Photos (camera capture, min required angles)
  2. Belongings Return (reuse `BelongingsReturn` component)
  3. Customer Signature (reuse signature pad from intake)
  4. Complete (calls `completeRelease`, shows success)
- L1/L2 jobs skip warranty/care (auto-applied from defaults)

## QC Inspector Views

### QC Inspector Home

- Greeting
- Queue count: "3 jobs awaiting QC"
- QC queue cards: plate, JO number, customer, service categories, assigned tech, "Start QC" button

### QC Checklist (`/frontliner/qc/[jobId]`)

- Header: vehicle plate + JO + progress bar
- Card-per-item layout, grouped by category (collapsible)
- Three 64px buttons per item: Pass (green), Fail (red), N/A (gray)
- Fail expands notes field + optional photo upload
- Sticky "Submit QC" button at bottom (disabled until all items checked)
- Uses existing `createQCInspection`, `updateChecklistItem`, `submitQCInspection`

## New Service Functions (only 2)

1. **`getTasksForTechnician(techId: string)`** in `src/lib/services/tasks.ts`
   - Tasks where `assignedTechnicianId = techId` and parent job is active (not RELEASED/CANCELLED)
   - Includes job order info, vehicle info, time entries for that tech

2. **`getActiveJobsForFloor()`** in `src/lib/services/job-orders.ts`
   - Active jobs (not RELEASED/CANCELLED) with vehicle, customer, bay, primary tech, status
   - Lightweight query optimized for card view

## New Shared Components

- `src/components/frontliner/frontliner-shell.tsx` — layout shell
- `src/components/frontliner/frontliner-topbar.tsx` — top bar
- `src/components/frontliner/frontliner-bottom-nav.tsx` — role-dependent bottom nav
- `src/components/frontliner/technician-home.tsx` — tech home screen
- `src/components/frontliner/advisor-home.tsx` — advisor home screen
- `src/components/frontliner/qc-inspector-home.tsx` — QC home screen
- `src/components/frontliner/task-card.tsx` — task card for my-tasks
- `src/components/frontliner/job-card.tsx` — job card for advisor jobs
- `src/components/frontliner/bottom-sheet.tsx` — bottom sheet for quick actions
- `src/components/frontliner/milestone-grid.tsx` — photo milestone grid
- `src/components/frontliner/release-wizard.tsx` — 4-step release flow
- `src/components/frontliner/qc-checklist-card.tsx` — QC item card with pass/fail/na

## Existing Components Reused Directly

- `PinClock` (with new `preAuthUser` prop)
- `IntakeWizard` (with new `variant` + `onComplete` props)
- `BelongingsReturn`
- Signature pad from `IntakeQuickSignoff`
- `EmptyState`, `Badge` from shared UI

## Build Phases

1. **Layout + Middleware + Home Screens** — frontliner shell, role redirect, bottom nav, 3 home screen components
2. **Technician Views** — my tasks, task detail, clock (PinClock reuse), photos
3. **Advisor Views** — intake (wizard reuse), jobs, release wizard
4. **QC Inspector Views** — QC queue, QC checklist
5. **Polish** — transitions, offline verification, admin/floor switch links, PWA manifest for /frontliner

# Seed Data Update + Schedule UI Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace placeholder seed data with real CBROS Auto staff/bays, and redesign all `/schedule/*` pages with a dark theme + Live Floor bay map matching the CBROS Auto app look.

**Architecture:** Two-part change: (1) seed script update with upsert patterns for 17 real bays, 12 technicians, 7 advisors; (2) new Live Floor component as default bay view with dark-themed wrapper scoped to `/schedule/*` pages only. Existing Gantt timeline preserved as toggle alternative.

**Tech Stack:** Next.js 14, Prisma/SQLite, Tailwind CSS (scoped dark theme via CSS class), React server components + client components, bcryptjs for PIN hashing.

---

### Task 1: Update Seed Script — Bays + Staff

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Replace default bays section**

Replace the existing `defaultBays` array and its insertion loop (lines 280-297) with the 17 real bays using upsert pattern. Delete old placeholder bays first, then upsert new ones.

```typescript
// ========================================================================
// 4. Real Bays — 7 Lifter + 10 Non-Lifter
// ========================================================================

// Remove old placeholder bays (Bay 1, Bay 2, Bay 3, Paint Booth, Detail Bay, PDR Station)
const oldBayNames = ["Bay 1", "Bay 2", "Bay 3", "Paint Booth", "Detail Bay", "PDR Station"];
for (const name of oldBayNames) {
  const old = await prisma.bay.findFirst({ where: { name, deletedAt: null } });
  if (old) {
    // Only soft-delete if no active assignments
    const active = await prisma.bayAssignment.count({ where: { bayId: old.id, endDate: null } });
    if (active === 0) {
      await prisma.bay.update({ where: { id: old.id }, data: { deletedAt: new Date() } });
    }
  }
}

const realBays = [
  // Lifter Bays
  { name: "Lifter 1", type: "GENERAL", color: "#3B82F6", sortOrder: 1 },
  { name: "Lifter 2", type: "GENERAL", color: "#3B82F6", sortOrder: 2 },
  { name: "Lifter 3", type: "GENERAL", color: "#3B82F6", sortOrder: 3 },
  { name: "Lifter 4", type: "GENERAL", color: "#3B82F6", sortOrder: 4 },
  { name: "Lifter 5", type: "GENERAL", color: "#3B82F6", sortOrder: 5 },
  { name: "Lifter 6", type: "GENERAL", color: "#3B82F6", sortOrder: 6 },
  { name: "Lifter 7", type: "GENERAL", color: "#3B82F6", sortOrder: 7 },
  // Non-Lifter Bays
  { name: "Non-Lifter 1", type: "GENERAL", color: "#10B981", sortOrder: 8 },
  { name: "Non-Lifter 2", type: "GENERAL", color: "#10B981", sortOrder: 9 },
  { name: "Non-Lifter 3", type: "GENERAL", color: "#10B981", sortOrder: 10 },
  { name: "Non-Lifter 4", type: "GENERAL", color: "#10B981", sortOrder: 11 },
  { name: "Non-Lifter 5", type: "GENERAL", color: "#10B981", sortOrder: 12 },
  { name: "Non-Lifter 6", type: "GENERAL", color: "#10B981", sortOrder: 13 },
  { name: "Non-Lifter 7", type: "GENERAL", color: "#10B981", sortOrder: 14 },
  { name: "Non-Lifter 8", type: "GENERAL", color: "#10B981", sortOrder: 15 },
  { name: "Non-Lifter 9", type: "GENERAL", color: "#10B981", sortOrder: 16 },
  { name: "Non-Lifter 10", type: "GENERAL", color: "#10B981", sortOrder: 17 },
];

for (const bay of realBays) {
  const existing = await prisma.bay.findFirst({
    where: { name: bay.name, deletedAt: null },
  });
  if (existing) {
    await prisma.bay.update({
      where: { id: existing.id },
      data: { type: bay.type, color: bay.color, sortOrder: bay.sortOrder, isActive: true },
    });
  } else {
    await prisma.bay.create({ data: bay });
  }
}
console.log(`  Created/updated ${realBays.length} real bays (7 Lifter + 10 Non-Lifter)`);
```

**Step 2: Add technicians and advisors after bays**

```typescript
// ========================================================================
// 5. Real Technicians (12 mechanics)
// ========================================================================
const technicians = [
  { firstName: "Allan", lastName: ".", username: "allan", pin: "1001" },
  { firstName: "Inggo", lastName: ".", username: "inggo", pin: "1002" },
  { firstName: "Lino", lastName: ".", username: "lino", pin: "1003" },
  { firstName: "Toni", lastName: ".", username: "toni", pin: "1004" },
  { firstName: "Jurell", lastName: ".", username: "jurell", pin: "1005" },
  { firstName: "Sam", lastName: ".", username: "sam", pin: "1006" },
  { firstName: "Nold", lastName: ".", username: "nold", pin: "1007" },
  { firstName: "Joy", lastName: ".", username: "joy", pin: "1008" },
  { firstName: "Kevin", lastName: ".", username: "kevin", pin: "1009" },
  { firstName: "Joseph", lastName: ".", username: "joseph", pin: "1010" },
  { firstName: "Roi", lastName: ".", username: "roi", pin: "1011" },
  { firstName: "Buban", lastName: ".", username: "buban", pin: "1012" },
];

for (const tech of technicians) {
  const techPinHash = await bcrypt.hash(tech.pin, 12);
  const techPwHash = await bcrypt.hash(tech.pin, 12);
  await prisma.user.upsert({
    where: { username: tech.username },
    update: { firstName: tech.firstName, lastName: tech.lastName, isActive: true },
    create: {
      username: tech.username,
      passwordHash: techPwHash,
      pinHash: techPinHash,
      firstName: tech.firstName,
      lastName: tech.lastName,
      role: "TECHNICIAN",
      isActive: true,
    },
  });
}
console.log(`  Created/updated ${technicians.length} technicians`);

// ========================================================================
// 6. Front Desk Advisors (7)
// ========================================================================
const advisors = [
  { firstName: "Abi", lastName: ".", username: "abi", pin: "2001" },
  { firstName: "Kathleen", lastName: ".", username: "kathleen", pin: "2002" },
  { firstName: "Jelyn", lastName: ".", username: "jelyn", pin: "2003" },
  { firstName: "Arlene", lastName: ".", username: "arlene", pin: "2004" },
  { firstName: "Leslie", lastName: ".", username: "leslie", pin: "2005" },
  { firstName: "Ma Jelyn", lastName: ".", username: "majelyn", pin: "2006" },
  { firstName: "Ronna", lastName: ".", username: "ronna", pin: "2007" },
];

for (const adv of advisors) {
  const advPinHash = await bcrypt.hash(adv.pin, 12);
  const advPwHash = await bcrypt.hash(adv.pin, 12);
  await prisma.user.upsert({
    where: { username: adv.username },
    update: { firstName: adv.firstName, lastName: adv.lastName, isActive: true },
    create: {
      username: adv.username,
      passwordHash: advPwHash,
      pinHash: advPinHash,
      firstName: adv.firstName,
      lastName: adv.lastName,
      role: "ADVISOR",
      isActive: true,
    },
  });
}
console.log(`  Created/updated ${advisors.length} front desk advisors`);
```

**Step 3: Run seed and verify**

Run: `npx prisma db seed`
Expected: Output shows 17 bays, 12 technicians, 7 advisors created/updated, no errors.

**Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed with real CBROS bays (17) and staff (12 techs, 7 advisors)"
```

---

### Task 2: Schedule Dark Theme CSS + Layout Wrapper

**Files:**
- Modify: `src/app/globals.css` — add `.schedule-dark` scoped styles
- Create: `src/app/(dashboard)/schedule/layout.tsx` — wrapper that applies `.schedule-dark` class
- Modify: `src/components/schedule/schedule-nav.tsx` — update for dark theme compatibility

**Step 1: Add dark theme CSS to globals.css**

Append to `src/app/globals.css`:

```css
/* ============================================================
   Schedule Dark Theme — scoped to /schedule/* pages only
   ============================================================ */
.schedule-dark {
  --sd-bg: #0F1729;
  --sd-bg-card: rgba(255, 255, 255, 0.05);
  --sd-bg-card-hover: rgba(255, 255, 255, 0.08);
  --sd-border: rgba(255, 255, 255, 0.1);
  --sd-text: #F1F5F9;
  --sd-text-muted: #94A3B8;
  --sd-text-dim: #64748B;
  background-color: var(--sd-bg);
  color: var(--sd-text);
  min-height: 100%;
}

/* Override surface backgrounds within schedule pages */
.schedule-dark .sd-card {
  background: var(--sd-bg-card);
  border: 1px solid var(--sd-border);
  border-radius: 12px;
}

.schedule-dark .sd-card:hover {
  background: var(--sd-bg-card-hover);
}

.schedule-dark .sd-text-muted {
  color: var(--sd-text-muted);
}

.schedule-dark .sd-text-dim {
  color: var(--sd-text-dim);
}
```

**Step 2: Create schedule layout wrapper**

Create `src/app/(dashboard)/schedule/layout.tsx`:

```tsx
export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="schedule-dark -m-4 md:-m-6 p-4 md:p-6 rounded-lg">
      {children}
    </div>
  );
}
```

The negative margin + padding trick makes the dark background extend to the edges of the main content area while the rest of the app stays light.

**Step 3: Update ScheduleNav for dark theme**

Update `src/components/schedule/schedule-nav.tsx` — change the light surface classes to dark-compatible ones:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Appointments", href: "/schedule/appointments" },
  { label: "Bay Schedule", href: "/schedule/bays" },
  { label: "Tech Schedule", href: "/schedule/technicians" },
] as const;

export function ScheduleNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: "rgba(255,255,255,0.08)" }}>
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "bg-white/15 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/globals.css src/app/(dashboard)/schedule/layout.tsx src/components/schedule/schedule-nav.tsx
git commit -m "feat: add schedule dark theme wrapper scoped to /schedule/* pages"
```

---

### Task 3: Live Floor API Endpoint

**Files:**
- Create: `src/app/api/bays/live-floor/route.ts`
- Modify: `src/lib/services/scheduler.ts` — add `getLiveFloorData()` service function

**Step 1: Add service function to scheduler.ts**

Add at the end of `src/lib/services/scheduler.ts`:

```typescript
export async function getLiveFloorData() {
  // Get all active bays with current assignments
  const bays = await prisma.bay.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      assignments: {
        where: { endDate: null }, // Only current (open) assignments
        take: 1,
        orderBy: { startDate: "desc" },
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              priority: true,
              createdAt: true,
              customer: { select: { id: true, firstName: true, lastName: true } },
              vehicle: { select: { plateNumber: true, make: true, model: true, color: true } },
              primaryTechnician: { select: { id: true, firstName: true, lastName: true } },
              tasks: {
                where: { deletedAt: null },
                select: {
                  assignedTechnician: { select: { id: true, firstName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Get summary stats
  const [queueCount, activeCount, totalTechs, clockedInTechIds] = await Promise.all([
    // Queue: jobs checked in but not yet in bay (CHECKED_IN status)
    prisma.jobOrder.count({
      where: { status: "CHECKED_IN", deletedAt: null },
    }),
    // Active: jobs currently in progress
    prisma.jobOrder.count({
      where: { status: "IN_PROGRESS", deletedAt: null },
    }),
    // Total active technicians
    prisma.user.count({
      where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
    }),
    // Technicians with open time entries (clocked in)
    prisma.timeEntry.findMany({
      where: { clockOut: null },
      select: { technicianId: true },
      distinct: ["technicianId"],
    }),
  ]);

  // Active jobs for the table below the bay map
  const activeJobs = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["CANCELLED", "RELEASED"] },
      deletedAt: null,
    },
    select: {
      id: true,
      jobOrderNumber: true,
      status: true,
      priority: true,
      createdAt: true,
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { plateNumber: true, make: true, model: true } },
      primaryTechnician: { select: { id: true, firstName: true } },
      assignedBayId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    bays,
    stats: {
      queueLength: queueCount,
      activeServices: activeCount,
      availableTechs: totalTechs - clockedInTechIds.length,
      totalTechs,
    },
    activeJobs,
  };
}
```

**Step 2: Create API route**

Create `src/app/api/bays/live-floor/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLiveFloorData } from "@/lib/services/scheduler";

export async function GET() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getLiveFloorData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch live floor data" },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/app/api/bays/live-floor/route.ts src/lib/services/scheduler.ts
git commit -m "feat: add live floor API endpoint with bay status and job summary"
```

---

### Task 4: Live Floor Bay Card Grid Component

**Files:**
- Create: `src/components/schedule/live-floor-types.ts`
- Create: `src/components/schedule/live-floor-bay-card.tsx`
- Create: `src/components/schedule/live-floor-grid.tsx`

**Step 1: Create types file**

`src/components/schedule/live-floor-types.ts`:

```typescript
export interface LiveFloorBay {
  id: string;
  name: string;
  type: string;
  color: string | null;
  sortOrder: number;
  assignments: LiveFloorAssignment[];
}

export interface LiveFloorAssignment {
  id: string;
  startDate: string;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    status: string;
    priority: string;
    createdAt: string;
    customer: { id: string; firstName: string; lastName: string };
    vehicle: { plateNumber: string; make: string; model: string; color: string | null };
    primaryTechnician: { id: string; firstName: string; lastName: string } | null;
    tasks: { assignedTechnician: { id: string; firstName: string } | null }[];
  };
}

export interface LiveFloorStats {
  queueLength: number;
  activeServices: number;
  availableTechs: number;
  totalTechs: number;
}

export interface LiveFloorJob {
  id: string;
  jobOrderNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  customer: { firstName: string; lastName: string };
  vehicle: { plateNumber: string; make: string; model: string };
  primaryTechnician: { id: string; firstName: string } | null;
  assignedBayId: string | null;
}

// Status → border color for occupied bay cards
export const BAY_STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "#10B981",    // green
  CHECKED_IN: "#F59E0B",     // amber
  QC_PENDING: "#8B5CF6",     // purple
  QC_PASSED: "#3B82F6",      // blue
  AWAITING_PAYMENT: "#F97316", // orange
  DEFAULT: "#6B7280",        // gray
};

// Status pill colors for jobs table (dark theme versions)
export const DARK_STATUS_PILLS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "rgba(148,163,184,0.2)", text: "#94A3B8", label: "Pending" },
  CHECKED_IN: { bg: "rgba(245,158,11,0.2)", text: "#FBBF24", label: "Waitlist" },
  IN_PROGRESS: { bg: "rgba(16,185,129,0.2)", text: "#34D399", label: "In-Service" },
  QC_PENDING: { bg: "rgba(139,92,246,0.2)", text: "#A78BFA", label: "QC" },
  QC_PASSED: { bg: "rgba(59,130,246,0.2)", text: "#60A5FA", label: "QC Passed" },
  QC_FAILED_REWORK: { bg: "rgba(239,68,68,0.2)", text: "#F87171", label: "Rework" },
  AWAITING_PAYMENT: { bg: "rgba(249,115,22,0.2)", text: "#FB923C", label: "Pickup" },
  PARTIAL_PAYMENT: { bg: "rgba(234,179,8,0.2)", text: "#FACC15", label: "Partial Pay" },
  FULLY_PAID: { bg: "rgba(16,185,129,0.2)", text: "#34D399", label: "Paid" },
  RELEASED: { bg: "rgba(100,116,139,0.2)", text: "#94A3B8", label: "Done" },
  CANCELLED: { bg: "rgba(100,116,139,0.15)", text: "#64748B", label: "Cancelled" },
};
```

**Step 2: Create bay card component**

`src/components/schedule/live-floor-bay-card.tsx`:

```tsx
"use client";

import { Wrench } from "lucide-react";
import type { LiveFloorBay } from "./live-floor-types";
import { BAY_STATUS_COLORS } from "./live-floor-types";

interface BayCardProps {
  bay: LiveFloorBay;
  onClick: () => void;
}

export function LiveFloorBayCard({ bay, onClick }: BayCardProps) {
  const assignment = bay.assignments[0]; // Current active assignment (or undefined)
  const isOccupied = !!assignment;

  if (!isOccupied) {
    return (
      <button
        onClick={onClick}
        className="sd-card flex flex-col items-center justify-center gap-2 p-4 min-w-[160px] min-h-[120px] opacity-60 hover:opacity-80 transition-opacity cursor-pointer text-left"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
        }}
      >
        <span className="text-sm font-bold text-white/50">{bay.name}</span>
        <span className="text-xs text-white/30 uppercase tracking-wider">Available</span>
      </button>
    );
  }

  const jo = assignment.jobOrder;
  const borderColor = BAY_STATUS_COLORS[jo.status] || BAY_STATUS_COLORS.DEFAULT;

  // Collect unique tech nicknames from tasks
  const techNames = new Set<string>();
  if (jo.primaryTechnician) techNames.add(jo.primaryTechnician.firstName);
  jo.tasks.forEach((t) => {
    if (t.assignedTechnician) techNames.add(t.assignedTechnician.firstName);
  });
  const mechDisplay = techNames.size > 0 ? Array.from(techNames).join(" & ") : "Unassigned";

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 p-4 min-w-[160px] min-h-[120px] transition-all hover:brightness-110 cursor-pointer text-left"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
      }}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm font-bold text-white">{bay.name}</span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${borderColor}30`, color: borderColor }}
        >
          {jo.jobOrderNumber}
        </span>
      </div>
      <div className="text-sm font-bold text-white truncate w-full">
        {jo.vehicle.make} {jo.vehicle.model}
      </div>
      <div className="text-xs text-slate-400">{jo.vehicle.plateNumber}</div>
      <div className="flex items-center gap-1 text-xs text-slate-400 mt-auto">
        <Wrench className="h-3 w-3" />
        <span className={techNames.size === 0 ? "text-red-400" : ""}>
          {techNames.size === 0 ? "⚠ Unassigned" : mechDisplay}
        </span>
      </div>
    </button>
  );
}
```

**Step 3: Create grid component (groups Lifter vs Non-Lifter)**

`src/components/schedule/live-floor-grid.tsx`:

```tsx
"use client";

import { ArrowUp, Wrench } from "lucide-react";
import type { LiveFloorBay } from "./live-floor-types";
import { LiveFloorBayCard } from "./live-floor-bay-card";

interface LiveFloorGridProps {
  bays: LiveFloorBay[];
  onBayClick: (bay: LiveFloorBay) => void;
}

export function LiveFloorGrid({ bays, onBayClick }: LiveFloorGridProps) {
  const lifterBays = bays.filter((b) => b.name.startsWith("Lifter"));
  const nonLifterBays = bays.filter((b) => b.name.startsWith("Non-Lifter"));
  const otherBays = bays.filter(
    (b) => !b.name.startsWith("Lifter") && !b.name.startsWith("Non-Lifter")
  );

  const countOccupied = (bayList: LiveFloorBay[]) =>
    bayList.filter((b) => b.assignments.length > 0).length;

  return (
    <div className="space-y-6">
      {lifterBays.length > 0 && (
        <BaySection
          icon={<ArrowUp className="h-4 w-4" />}
          label="LIFTER BAYS"
          occupied={countOccupied(lifterBays)}
          total={lifterBays.length}
          bays={lifterBays}
          onBayClick={onBayClick}
        />
      )}
      {nonLifterBays.length > 0 && (
        <BaySection
          icon={<Wrench className="h-4 w-4" />}
          label="NON-LIFTER BAYS"
          occupied={countOccupied(nonLifterBays)}
          total={nonLifterBays.length}
          bays={nonLifterBays}
          onBayClick={onBayClick}
          gridCols="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        />
      )}
      {otherBays.length > 0 && (
        <BaySection
          icon={<Wrench className="h-4 w-4" />}
          label="OTHER BAYS"
          occupied={countOccupied(otherBays)}
          total={otherBays.length}
          bays={otherBays}
          onBayClick={onBayClick}
        />
      )}
    </div>
  );
}

function BaySection({
  icon,
  label,
  occupied,
  total,
  bays,
  onBayClick,
  gridCols,
}: {
  icon: React.ReactNode;
  label: string;
  occupied: number;
  total: number;
  bays: LiveFloorBay[];
  onBayClick: (bay: LiveFloorBay) => void;
  gridCols?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/60">{icon}</span>
        <h3 className="text-sm font-bold text-white tracking-wider uppercase">
          {label}
        </h3>
        <span className="text-sm font-semibold text-white/60">
          {occupied} / {total}
        </span>
      </div>
      <div
        className={`grid gap-3 ${
          gridCols || "grid-cols-2 sm:grid-cols-4 md:grid-cols-7"
        }`}
      >
        {bays.map((bay) => (
          <LiveFloorBayCard key={bay.id} bay={bay} onClick={() => onBayClick(bay)} />
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/components/schedule/live-floor-types.ts src/components/schedule/live-floor-bay-card.tsx src/components/schedule/live-floor-grid.tsx
git commit -m "feat: add Live Floor bay card grid with Lifter/Non-Lifter sections"
```

---

### Task 5: Summary Stats Bar + Jobs Table Components

**Files:**
- Create: `src/components/schedule/live-floor-stats.tsx`
- Create: `src/components/schedule/live-floor-jobs-table.tsx`

**Step 1: Create stats bar**

`src/components/schedule/live-floor-stats.tsx`:

```tsx
"use client";

import { Clock, Activity, Users } from "lucide-react";
import type { LiveFloorStats } from "./live-floor-types";

export function LiveFloorStatsBar({ stats }: { stats: LiveFloorStats }) {
  const metrics = [
    { label: "Queue Length", value: stats.queueLength, icon: Clock, color: "#FBBF24" },
    { label: "Active Services", value: stats.activeServices, icon: Activity, color: "#34D399" },
    {
      label: "Available Mechanics",
      value: `${stats.availableTechs} / ${stats.totalTechs}`,
      icon: Users,
      color: "#60A5FA",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="sd-card flex items-center gap-3 p-4"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
          }}
        >
          <m.icon className="h-5 w-5 shrink-0" style={{ color: m.color }} />
          <div>
            <div className="text-2xl font-bold text-white">{m.value}</div>
            <div className="text-xs text-slate-400">{m.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create jobs table**

`src/components/schedule/live-floor-jobs-table.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { LiveFloorJob } from "./live-floor-types";
import { DARK_STATUS_PILLS } from "./live-floor-types";

const FILTER_TABS = [
  { key: "all", label: "Active Jobs" },
  { key: "CHECKED_IN", label: "Waitlist" },
  { key: "IN_PROGRESS", label: "In-Service" },
  { key: "qc", label: "QC" },
  { key: "pickup", label: "Pickup" },
  { key: "done", label: "Done" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function matchesFilter(status: string, filter: FilterKey): boolean {
  if (filter === "all") return !["CANCELLED", "RELEASED"].includes(status);
  if (filter === "qc") return ["QC_PENDING", "QC_PASSED", "QC_FAILED_REWORK"].includes(status);
  if (filter === "pickup") return ["AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"].includes(status);
  if (filter === "done") return status === "RELEASED";
  return status === filter;
}

export function LiveFloorJobsTable({ jobs }: { jobs: LiveFloorJob[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const filtered = useMemo(() => jobs.filter((j) => matchesFilter(j.status, filter)), [jobs, filter]);

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 4 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              filter === tab.key
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Queue #</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Vehicle</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Mechanic</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  No jobs match this filter
                </td>
              </tr>
            ) : (
              filtered.map((job) => {
                const pill = DARK_STATUS_PILLS[job.status] || DARK_STATUS_PILLS.PENDING;
                return (
                  <tr key={job.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-mono text-xs">{job.jobOrderNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: pill.bg, color: pill.text }}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{job.vehicle.make} {job.vehicle.model}</div>
                      <div className="text-xs text-slate-500">{job.vehicle.plateNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {job.customer.firstName} {job.customer.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {job.primaryTechnician ? (
                        <span className="text-slate-300">{job.primaryTechnician.firstName}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Unassigned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/schedule/live-floor-stats.tsx src/components/schedule/live-floor-jobs-table.tsx
git commit -m "feat: add Live Floor stats bar and dark-themed jobs table with filters"
```

---

### Task 6: Live Floor Orchestrator + Bay Page Update

**Files:**
- Create: `src/components/schedule/live-floor.tsx` — main orchestrator
- Modify: `src/app/(dashboard)/schedule/bays/page.tsx` — add view toggle

**Step 1: Create Live Floor orchestrator**

`src/components/schedule/live-floor.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { LiveFloorGrid } from "./live-floor-grid";
import { LiveFloorStatsBar } from "./live-floor-stats";
import { LiveFloorJobsTable } from "./live-floor-jobs-table";
import { BayAssignmentDetail } from "./bay-assignment-detail";
import { BayAssignModal } from "./bay-assign-modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { LiveFloorBay, LiveFloorStats, LiveFloorJob } from "./live-floor-types";

export default function LiveFloor() {
  const [bays, setBays] = useState<LiveFloorBay[]>([]);
  const [stats, setStats] = useState<LiveFloorStats>({ queueLength: 0, activeServices: 0, availableTechs: 0, totalTechs: 0 });
  const [jobs, setJobs] = useState<LiveFloorJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Bay detail / assign modal state
  const [selectedBay, setSelectedBay] = useState<LiveFloorBay | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bays/live-floor");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setBays(data.bays);
      setStats(data.stats);
      setJobs(data.activeJobs);
    } catch {
      toast.error("Failed to load floor data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBayClick = (bay: LiveFloorBay) => {
    setSelectedBay(bay);
    if (bay.assignments.length > 0) {
      setDetailOpen(true);
    } else {
      setAssignOpen(true);
    }
  };

  const handleUpdated = () => {
    setDetailOpen(false);
    setAssignOpen(false);
    setSelectedBay(null);
    fetchData();
  };

  const activeAssignment = selectedBay?.assignments[0];

  return (
    <div className="space-y-6">
      <LiveFloorStatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          Loading floor status...
        </div>
      ) : bays.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Bays"
          description="Create bays in Settings to start scheduling."
        />
      ) : (
        <LiveFloorGrid bays={bays} onBayClick={handleBayClick} />
      )}

      {!loading && jobs.length > 0 && <LiveFloorJobsTable jobs={jobs} />}

      {/* Reuse existing detail slide-over for occupied bays */}
      {activeAssignment && (
        <BayAssignmentDetail
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelectedBay(null);
          }}
          assignment={{
            id: activeAssignment.id,
            bayId: selectedBay!.id,
            jobOrderId: activeAssignment.jobOrder.id,
            startDate: activeAssignment.startDate,
            endDate: null,
            jobOrder: {
              jobOrderNumber: activeAssignment.jobOrder.jobOrderNumber,
              status: activeAssignment.jobOrder.status,
              priority: activeAssignment.jobOrder.priority,
              customer: activeAssignment.jobOrder.customer,
              vehicle: activeAssignment.jobOrder.vehicle,
              primaryTechnician: activeAssignment.jobOrder.primaryTechnician,
            },
          }}
          bayName={selectedBay?.name || ""}
          bayColor={selectedBay?.color || "#6B7280"}
          allBays={bays.map((b) => ({ id: b.id, name: b.name }))}
          onUpdated={handleUpdated}
        />
      )}

      {/* Assign modal for empty bays */}
      <BayAssignModal
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false);
          setSelectedBay(null);
        }}
        prefilledBayId={selectedBay?.id}
        allBays={bays.map((b) => ({ id: b.id, name: b.name }))}
        onAssigned={handleUpdated}
      />
    </div>
  );
}
```

**Step 2: Update bay schedule page with view toggle**

Replace `src/app/(dashboard)/schedule/bays/page.tsx`:

```tsx
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { ScheduleNav } from "@/components/schedule/schedule-nav";
import { BayViewToggle } from "@/components/schedule/bay-view-toggle";

export default async function BaySchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div className="space-y-4">
      <ScheduleNav />
      <BayViewToggle />
    </div>
  );
}
```

**Step 3: Create view toggle component**

`src/components/schedule/bay-view-toggle.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Factory, BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";

const LiveFloor = dynamic(() => import("./live-floor"), { ssr: false });
const BayTimeline = dynamic(() => import("./bay-timeline"), { ssr: false });

export function BayViewToggle() {
  const [view, setView] = useState<"floor" | "timeline">("floor");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit" style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 4 }}>
        <button
          onClick={() => setView("floor")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            view === "floor"
              ? "bg-white/15 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Factory className="h-4 w-4" /> Live Floor
        </button>
        <button
          onClick={() => setView("timeline")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            view === "timeline"
              ? "bg-white/15 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Timeline
        </button>
      </div>

      {view === "floor" ? <LiveFloor /> : <BayTimeline />}
    </div>
  );
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/components/schedule/live-floor.tsx src/components/schedule/bay-view-toggle.tsx src/app/(dashboard)/schedule/bays/page.tsx
git commit -m "feat: wire Live Floor orchestrator with view toggle (Live Floor / Timeline)"
```

---

### Task 7: Dark Theme Compatibility for Existing Schedule Components

**Files:**
- Modify: `src/components/schedule/appointments-calendar.tsx` — update text colors
- Modify: `src/components/schedule/tech-timeline.tsx` — update text colors
- Modify: `src/components/schedule/tech-capacity-bar.tsx` — dark-compatible colors
- Modify: `src/components/schedule/bay-timeline.tsx` — dark-compatible colors
- Modify: `src/components/schedule/bay-timeline-header.tsx` — dark text/border
- Modify: `src/components/schedule/bay-timeline-grid.tsx` — dark cell colors
- Modify: `src/components/schedule/bay-occupancy-bar.tsx` — dark compatible
- Modify: `src/components/schedule/bay-utilization-panel.tsx` — dark compatible

**Approach:** For each component, replace `bg-surface-*`, `text-primary`, `text-surface-*`, `bg-white`, `border-surface-*` references with dark-theme compatible alternatives. Use Tailwind arbitrary values or inline styles so the dark theme is inherited from the `.schedule-dark` wrapper.

This task requires the subagent to:
1. Read each component file
2. Replace light-theme-specific classes with dark-compatible ones
3. Key replacements:
   - `bg-white` → `bg-white/5` or inline `rgba(255,255,255,0.05)`
   - `bg-surface-100` → `bg-white/5`
   - `bg-surface-50` → `bg-transparent`
   - `text-primary` → `text-white`
   - `text-surface-400/500` → `text-slate-400`
   - `border-surface-200` → `border-white/10`
4. For the appointments calendar, update month/week/day views' background and text colors
5. Run `npx tsc --noEmit` to verify no errors

**Step 1: Commit after all modifications**

```bash
git add src/components/schedule/
git commit -m "feat: apply dark theme to all schedule components (appointments, tech timeline, bay timeline)"
```

---

### Task 8: Run Seed, Build, and Verify

**Files:** None (verification only)

**Step 1: Reset and re-seed database**

```bash
npx prisma db push --force-reset
npx prisma db seed
```

Expected: All 17 bays, 12 technicians, 7 advisors created. Admin user preserved.

**Step 2: Full build**

```bash
npx next build
```

Expected: 0 errors, all routes compiled.

**Step 3: Start dev server and verify in browser**

Check:
- `/schedule/bays` → dark background, Live Floor view with 17 bay cards (7 Lifter row, 10 Non-Lifter grid)
- Toggle to Timeline → existing Gantt works on dark background
- `/schedule/technicians` → dark background, tech schedule with real technician nicknames
- `/schedule/appointments` → dark background, calendar works
- Dashboard and other pages → still light theme
- Settings → Bay management shows all 17 bays

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final adjustments for schedule dark theme and seed data"
```

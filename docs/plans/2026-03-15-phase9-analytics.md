# Phase 9: Analytics & Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the intelligence layer — dashboards, charts, reports, and job profitability views that turn all captured data (Phases 1–8) into actionable business insights for shop owners and managers.

**Architecture:** A single analytics service (`lib/services/analytics.ts`) powers all dashboard widgets and reports via Prisma aggregation queries. Charts render client-side using recharts (new dependency). Reports use server actions returning structured data with client-side CSV generation and `window.print()` for PDF. The dashboard homepage is rebuilt with role-aware content. All analytics pages restricted to OWNER/MANAGER via `can(role, "analytics:view")`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma/SQLite, Tailwind CSS, recharts (new), Server Actions, Zod for date range validation, existing `formatPeso()`/`formatDate()` utils.

---

## Batch 1: Install recharts + Analytics Service Layer (2 parallel agents)

### Task 1: Install recharts + Date Range Picker Component

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/components/ui/date-range-picker.tsx`
- Create: `src/lib/validators.ts` (add dateRangeSchema)

**Step 1: Install recharts**

```bash
cd C:\Users\Admin\Downloads\CLAUDE\cbros-auto-painting-division
npm install recharts
```

**Step 2: Add date range validation to validators.ts**

Append to the end of `src/lib/validators.ts`:

```typescript
// ---------------------------------------------------------------------------
// Phase 9: Analytics Date Range
// ---------------------------------------------------------------------------
export const dateRangeSchema = z.object({
  from: z.string().min(1, "Start date is required"),
  to: z.string().min(1, "End date is required"),
});
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
```

**Step 3: Create the DateRangePicker component**

Create `src/components/ui/date-range-picker.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

type PresetKey =
  | "today"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "last_month"
  | "last_quarter"
  | "last_year"
  | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "last_month", label: "Last Month" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

function getPresetRange(key: PresetKey): DateRange | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case "today":
      return { from: new Date(y, m, d), to: new Date(y, m, d, 23, 59, 59) };
    case "this_week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(y, m, d - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { from: monday, to: new Date(y, m, d, 23, 59, 59) };
    }
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m, d, 23, 59, 59) };
    case "this_quarter": {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { from: qStart, to: new Date(y, m, d, 23, 59, 59) };
    }
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y, m, d, 23, 59, 59) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) };
    case "last_quarter": {
      const lqStart = new Date(y, Math.floor(m / 3) * 3 - 3, 1);
      const lqEnd = new Date(y, Math.floor(m / 3) * 3, 0, 23, 59, 59);
      return { from: lqStart, to: lqEnd };
    }
    case "last_year":
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59) };
    default:
      return null;
  }
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const displayLabel = useMemo(() => {
    const preset = PRESETS.find((p) => p.key === activePreset);
    if (preset && activePreset !== "custom") return preset.label;
    const fromStr = value.from.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    const toStr = value.to.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    return `${fromStr} – ${toStr}`;
  }, [activePreset, value]);

  function handlePreset(key: PresetKey) {
    setActivePreset(key);
    if (key === "custom") return;
    const range = getPresetRange(key);
    if (range) {
      onChange(range);
      setOpen(false);
    }
  }

  function handleCustomApply() {
    if (customFrom && customTo) {
      onChange({
        from: new Date(customFrom),
        to: new Date(customTo + "T23:59:59"),
      });
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-surface-200 bg-white hover:bg-surface-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-surface-400" />
        {displayLabel}
        <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-surface-200 shadow-lg p-3 w-72">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.filter((p) => p.key !== "custom").map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset.key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-left",
                    activePreset === preset.key
                      ? "bg-accent text-white"
                      : "hover:bg-surface-50 text-surface-600"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t border-surface-100 mt-3 pt-3">
              <p className="text-xs font-medium text-surface-500 mb-2">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setActivePreset("custom"); }}
                  className="px-2 py-1.5 text-xs border border-surface-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-300"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => { setCustomTo(e.target.value); setActivePreset("custom"); }}
                  className="px-2 py-1.5 text-xs border border-surface-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-300"
                />
              </div>
              <button
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
                className="mt-2 w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: Analytics Service — Shop & Pipeline Metrics

**Files:**
- Create: `src/lib/services/analytics.ts`

Create the analytics service with all query functions. This is a large file — every function accepts `dateRange: { from: Date; to: Date }` and returns aggregated data from Prisma.

```typescript
import { prisma } from "@/lib/prisma";
import { SERVICE_CATEGORIES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DateRange {
  from: Date;
  to: Date;
}

export interface ShopOverview {
  totalRevenue: number; // centavos
  jobsCompleted: number;
  activeJobs: { total: number; byStage: Record<string, number> };
  avgTicketValue: number; // centavos
  avgCycleTimeDays: number;
  avgEfficiencyRatio: number;
  newCustomers: number;
  returningCustomers: number;
  revenuePrevPeriod: number; // centavos
  revenueChange: number; // percentage
}

export interface RevenueBreakdown {
  byCategory: { category: string; revenue: number }[];
  byPaymentMethod: { method: string; amount: number }[];
  byPeriod: { period: string; revenue: number; prevRevenue: number }[];
  topServices: { description: string; revenue: number; count: number }[];
  laborRevenue: number;
  partsRevenue: number;
}

export interface JobPipeline {
  byStage: { stage: string; count: number }[];
  avgTimePerStage: { stage: string; avgDays: number }[];
  overdueJobs: { id: string; jobOrderNumber: string; customerName: string; targetDate: string; daysOverdue: number }[];
  agingBrackets: { bracket: string; count: number }[];
}

export interface CapacityMetrics {
  totalAvailableHours: number;
  totalCommittedHours: number;
  totalLoggedHours: number;
  utilizationRate: number; // percentage
}

export interface TechPerformance {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  jobsWorked: number;
  hoursLogged: number;
  efficiencyScore: number;
  utilizationRate: number;
  reworkRate: number;
  revenueGenerated: number;
  onTimeRate: number;
  overtimeHours: number;
}

export interface TechDetail extends TechPerformance {
  tasks: {
    taskName: string;
    jobOrderNumber: string;
    estimatedHours: number;
    actualHours: number;
    efficiency: number;
  }[];
  dailyHours: { date: string; hours: number }[];
  weeklyEfficiency: { week: string; efficiency: number }[];
}

export interface FinancialSummary {
  totalInvoiced: number;
  totalCollected: number;
  outstandingReceivables: number;
  receivablesAging: { bracket: string; amount: number; insuranceAmount: number; customerAmount: number }[];
  avgDaysToPayment: number;
  totalDiscountGiven: number;
  partsMargin: { cost: number; billed: number; margin: number };
  laborMargin: { cost: number; billed: number; margin: number };
}

export interface JobProfitability {
  revenue: number;
  laborCost: number;
  materialsCost: number;
  subletCost: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  estimateTotal: number;
  varianceAmount: number;
  variancePercent: number;
}

// ---------------------------------------------------------------------------
// Helper: get previous period range for comparison
// ---------------------------------------------------------------------------
function getPreviousPeriod(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime() - 1),
  };
}

// ---------------------------------------------------------------------------
// 1. getShopOverview
// ---------------------------------------------------------------------------
export async function getShopOverview(dateRange: DateRange): Promise<ShopOverview> {
  const prevRange = getPreviousPeriod(dateRange);

  const [
    revenueAgg,
    prevRevenueAgg,
    completedJobs,
    activeJobsByStatus,
    releasedJobs,
    timeEntryAgg,
  ] = await Promise.all([
    // Current period revenue
    prisma.payment.aggregate({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    // Previous period revenue
    prisma.payment.aggregate({
      where: {
        createdAt: { gte: prevRange.from, lte: prevRange.to },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    // Completed (released) jobs in period
    prisma.jobOrder.count({
      where: {
        status: "RELEASED",
        actualCompletionDate: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
      },
    }),
    // Active jobs grouped by status
    prisma.jobOrder.groupBy({
      by: ["status"],
      where: {
        status: { notIn: ["RELEASED", "CANCELLED"] },
        deletedAt: null,
      },
      _count: true,
    }),
    // Released jobs with cycle time data
    prisma.jobOrder.findMany({
      where: {
        status: "RELEASED",
        actualCompletionDate: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
      },
      select: { createdAt: true, actualCompletionDate: true, customerId: true },
    }),
    // Time entries for efficiency
    prisma.timeEntry.aggregate({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
        clockOut: { not: null },
      },
      _sum: { netMinutes: true },
    }),
  ]);

  const totalRevenue = revenueAgg._sum.amount || 0;
  const prevRevenue = prevRevenueAgg._sum.amount || 0;
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const activeByStage: Record<string, number> = {};
  let activeTotal = 0;
  for (const g of activeJobsByStatus) {
    activeByStage[g.status] = g._count;
    activeTotal += g._count;
  }

  // Cycle time
  let totalCycleDays = 0;
  for (const job of releasedJobs) {
    if (job.actualCompletionDate) {
      const days = (new Date(job.actualCompletionDate).getTime() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      totalCycleDays += days;
    }
  }
  const avgCycleTimeDays = releasedJobs.length > 0 ? totalCycleDays / releasedJobs.length : 0;

  // Average ticket
  const avgTicketValue = completedJobs > 0 ? Math.round(totalRevenue / completedJobs) : 0;

  // Efficiency: need estimated hours too
  const taskAgg = await prisma.task.aggregate({
    where: {
      jobOrder: {
        actualCompletionDate: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
      },
      deletedAt: null,
    },
    _sum: { estimatedHours: true },
  });
  const estimatedMinutes = (taskAgg._sum.estimatedHours || 0) * 60;
  const actualMinutes = timeEntryAgg._sum.netMinutes || 0;
  const avgEfficiencyRatio = actualMinutes > 0 ? estimatedMinutes / actualMinutes : 0;

  // New vs returning customers
  const customerIds = releasedJobs.map((j) => j.customerId);
  const uniqueCustomerIds = [...new Set(customerIds)];
  let newCustomers = 0;
  let returningCustomers = 0;
  if (uniqueCustomerIds.length > 0) {
    const priorJobCounts = await prisma.jobOrder.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: uniqueCustomerIds },
        createdAt: { lt: dateRange.from },
        deletedAt: null,
      },
      _count: true,
    });
    const priorCustomerSet = new Set(priorJobCounts.map((c) => c.customerId));
    for (const cid of uniqueCustomerIds) {
      if (priorCustomerSet.has(cid)) returningCustomers++;
      else newCustomers++;
    }
  }

  return {
    totalRevenue,
    jobsCompleted: completedJobs,
    activeJobs: { total: activeTotal, byStage: activeByStage },
    avgTicketValue,
    avgCycleTimeDays: Math.round(avgCycleTimeDays * 10) / 10,
    avgEfficiencyRatio: Math.round(avgEfficiencyRatio * 100) / 100,
    newCustomers,
    returningCustomers,
    revenuePrevPeriod: prevRevenue,
    revenueChange: Math.round(revenueChange * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// 2. getRevenueBreakdown
// ---------------------------------------------------------------------------
export async function getRevenueBreakdown(dateRange: DateRange): Promise<RevenueBreakdown> {
  // Revenue by service category — via invoice line items
  const invoiceLineItems = await prisma.invoiceLineItem.findMany({
    where: {
      invoice: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
        isLatest: true,
      },
      deletedAt: null,
    },
    select: {
      group: true,
      description: true,
      quantity: true,
      unitCost: true,
      totalCost: true,
    },
  });

  // Group by category
  const categoryMap = new Map<string, number>();
  for (const cat of SERVICE_CATEGORIES) {
    categoryMap.set(cat, 0);
  }
  // Use line item group (LABOR, PARTS, MATERIALS, etc.)
  const groupMap = new Map<string, number>();
  for (const item of invoiceLineItems) {
    const existing = groupMap.get(item.group) || 0;
    groupMap.set(item.group, existing + item.totalCost);
  }
  const byCategory = Array.from(groupMap.entries()).map(([category, revenue]) => ({
    category,
    revenue,
  }));

  // Revenue by payment method
  const paymentsByMethod = await prisma.payment.groupBy({
    by: ["method"],
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
    },
    _sum: { amount: true },
  });
  const byPaymentMethod = paymentsByMethod.map((p) => ({
    method: p.method,
    amount: p._sum.amount || 0,
  }));

  // Revenue by month
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const monthMap = new Map<string, number>();
  for (const p of payments) {
    const key = new Date(p.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short" });
    monthMap.set(key, (monthMap.get(key) || 0) + p.amount);
  }
  const prevRange = getPreviousPeriod(dateRange);
  const prevPayments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: prevRange.from, lte: prevRange.to },
      deletedAt: null,
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const prevMonthMap = new Map<string, number>();
  for (const p of prevPayments) {
    const key = new Date(p.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short" });
    prevMonthMap.set(key, (prevMonthMap.get(key) || 0) + p.amount);
  }
  const byPeriod = Array.from(monthMap.entries()).map(([period, revenue]) => ({
    period,
    revenue,
    prevRevenue: prevMonthMap.get(period) || 0,
  }));

  // Top services by revenue
  const serviceMap = new Map<string, { revenue: number; count: number }>();
  for (const item of invoiceLineItems) {
    const existing = serviceMap.get(item.description) || { revenue: 0, count: 0 };
    serviceMap.set(item.description, {
      revenue: existing.revenue + item.totalCost,
      count: existing.count + item.quantity,
    });
  }
  const topServices = Array.from(serviceMap.entries())
    .map(([description, data]) => ({ description, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Labor vs parts
  let laborRevenue = 0;
  let partsRevenue = 0;
  for (const item of invoiceLineItems) {
    if (item.group === "LABOR") laborRevenue += item.totalCost;
    else if (item.group === "PARTS") partsRevenue += item.totalCost;
  }

  return { byCategory, byPaymentMethod, byPeriod, topServices, laborRevenue, partsRevenue };
}

// ---------------------------------------------------------------------------
// 3. getJobPipeline
// ---------------------------------------------------------------------------
export async function getJobPipeline(dateRange: DateRange): Promise<JobPipeline> {
  // Jobs by stage
  const jobsByStatus = await prisma.jobOrder.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: true,
  });
  const byStage = jobsByStatus.map((j) => ({ stage: j.status, count: j._count }));

  // Overdue jobs
  const now = new Date();
  const overdueJobsRaw = await prisma.jobOrder.findMany({
    where: {
      targetCompletionDate: { lt: now },
      status: { notIn: ["RELEASED", "CANCELLED"] },
      deletedAt: null,
    },
    select: {
      id: true,
      jobOrderNumber: true,
      targetCompletionDate: true,
      customer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { targetCompletionDate: "asc" },
    take: 50,
  });
  const overdueJobs = overdueJobsRaw.map((j) => ({
    id: j.id,
    jobOrderNumber: j.jobOrderNumber,
    customerName: `${j.customer.firstName} ${j.customer.lastName}`,
    targetDate: j.targetCompletionDate!.toISOString(),
    daysOverdue: Math.ceil((now.getTime() - new Date(j.targetCompletionDate!).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // Aging brackets
  const activeJobs = await prisma.jobOrder.findMany({
    where: {
      status: { notIn: ["RELEASED", "CANCELLED"] },
      deletedAt: null,
    },
    select: { createdAt: true },
  });
  const brackets = [
    { label: "0-3 days", min: 0, max: 3 },
    { label: "4-7 days", min: 4, max: 7 },
    { label: "8-14 days", min: 8, max: 14 },
    { label: "15-30 days", min: 15, max: 30 },
    { label: "30+ days", min: 31, max: Infinity },
  ];
  const agingBrackets = brackets.map((b) => ({
    bracket: b.label,
    count: activeJobs.filter((j) => {
      const days = Math.ceil((now.getTime() - new Date(j.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= b.min && days <= b.max;
    }).length,
  }));

  // Average time per stage — simplified: not easily derivable without stage transition logs.
  // Use activity log timestamps to approximate.
  const avgTimePerStage: { stage: string; avgDays: number }[] = [];

  return { byStage, avgTimePerStage, overdueJobs, agingBrackets };
}

// ---------------------------------------------------------------------------
// 4. getCapacityMetrics
// ---------------------------------------------------------------------------
export async function getCapacityMetrics(dateRange: DateRange): Promise<CapacityMetrics> {
  // Count active technicians
  const techCount = await prisma.user.count({
    where: { role: "TECHNICIAN", isActive: true, deletedAt: null },
  });

  // Assume 8 hours/day, 22 working days/month (or pro-rate to date range)
  const rangeDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const workingDays = Math.round(rangeDays * (22 / 30)); // approximate
  const totalAvailableHours = techCount * workingDays * 8;

  // Committed hours
  const committedAgg = await prisma.task.aggregate({
    where: {
      jobOrder: {
        status: { notIn: ["RELEASED", "CANCELLED"] },
        deletedAt: null,
      },
      deletedAt: null,
    },
    _sum: { estimatedHours: true },
  });
  const totalCommittedHours = committedAgg._sum.estimatedHours || 0;

  // Logged hours
  const loggedAgg = await prisma.timeEntry.aggregate({
    where: {
      clockIn: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
      clockOut: { not: null },
    },
    _sum: { netMinutes: true },
  });
  const totalLoggedHours = Math.round(((loggedAgg._sum.netMinutes || 0) / 60) * 10) / 10;

  const utilizationRate = totalAvailableHours > 0 ? Math.round((totalLoggedHours / totalAvailableHours) * 1000) / 10 : 0;

  return { totalAvailableHours, totalCommittedHours, totalLoggedHours, utilizationRate };
}

// ---------------------------------------------------------------------------
// 5. getTechnicianPerformance
// ---------------------------------------------------------------------------
export async function getTechnicianPerformance(dateRange: DateRange): Promise<TechPerformance[]> {
  const technicians = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIAN", "QC_INSPECTOR"] }, isActive: true, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  const result: TechPerformance[] = [];

  for (const tech of technicians) {
    // Time entries for this tech in range
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        technicianId: tech.id,
        clockIn: { gte: dateRange.from, lte: dateRange.to },
        clockOut: { not: null },
        deletedAt: null,
      },
      select: { netMinutes: true, laborCost: true, isOvertime: true, taskId: true },
    });

    const hoursLogged = Math.round((timeEntries.reduce((s, t) => s + t.netMinutes, 0) / 60) * 10) / 10;
    const overtimeHours = Math.round((timeEntries.filter((t) => t.isOvertime).reduce((s, t) => s + t.netMinutes, 0) / 60) * 10) / 10;
    const revenueGenerated = timeEntries.reduce((s, t) => s + t.laborCost, 0);

    // Unique jobs
    const taskIds = [...new Set(timeEntries.map((t) => t.taskId))];
    const jobIds = new Set<string>();
    if (taskIds.length > 0) {
      const tasks = await prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { jobOrderId: true },
      });
      tasks.forEach((t) => jobIds.add(t.jobOrderId));
    }

    // Efficiency: estimated vs actual for completed tasks
    const completedTasks = await prisma.task.findMany({
      where: {
        assignedTechnicianId: tech.id,
        status: "COMPLETED",
        deletedAt: null,
        updatedAt: { gte: dateRange.from, lte: dateRange.to },
      },
      select: { id: true, estimatedHours: true },
    });

    let totalEstimated = 0;
    let totalActual = 0;
    let reworkCount = 0;
    let onTimeCount = 0;

    for (const task of completedTasks) {
      const taskTimeAgg = await prisma.timeEntry.aggregate({
        where: { taskId: task.id, deletedAt: null, clockOut: { not: null } },
        _sum: { netMinutes: true },
      });
      const actualHours = (taskTimeAgg._sum.netMinutes || 0) / 60;
      totalEstimated += task.estimatedHours || 0;
      totalActual += actualHours;
      if (task.estimatedHours && actualHours <= task.estimatedHours) onTimeCount++;
    }

    // Rework: tasks with "rework" in name or linked to QC failures
    const reworkTasks = await prisma.task.count({
      where: {
        assignedTechnicianId: tech.id,
        name: { contains: "rework" },
        deletedAt: null,
        updatedAt: { gte: dateRange.from, lte: dateRange.to },
      },
    });
    reworkCount = reworkTasks;

    const efficiencyScore = totalActual > 0 ? Math.round((totalEstimated / totalActual) * 100) / 100 : 0;
    const reworkRate = completedTasks.length > 0 ? Math.round((reworkCount / completedTasks.length) * 1000) / 10 : 0;
    const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeCount / completedTasks.length) * 1000) / 10 : 0;

    // Utilization
    const rangeDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    const workingDays = Math.round(rangeDays * (22 / 30));
    const availableHours = workingDays * 8;
    const utilizationRate = availableHours > 0 ? Math.round((hoursLogged / availableHours) * 1000) / 10 : 0;

    result.push({
      id: tech.id,
      firstName: tech.firstName,
      lastName: tech.lastName,
      role: tech.role,
      jobsWorked: jobIds.size,
      hoursLogged,
      efficiencyScore,
      utilizationRate,
      reworkRate,
      revenueGenerated,
      onTimeRate,
      overtimeHours,
    });
  }

  return result.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
}

// ---------------------------------------------------------------------------
// 6. getTechnicianDetail
// ---------------------------------------------------------------------------
export async function getTechnicianDetail(techId: string, dateRange: DateRange): Promise<TechDetail | null> {
  const tech = await prisma.user.findUnique({
    where: { id: techId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  if (!tech) return null;

  // Get performance summary using same logic
  const perfArray = await getTechnicianPerformance(dateRange);
  const perf = perfArray.find((p) => p.id === techId);
  if (!perf) return null;

  // Task breakdown
  const completedTasks = await prisma.task.findMany({
    where: {
      assignedTechnicianId: techId,
      status: "COMPLETED",
      deletedAt: null,
      updatedAt: { gte: dateRange.from, lte: dateRange.to },
    },
    include: {
      jobOrder: { select: { jobOrderNumber: true } },
    },
  });

  const tasks: TechDetail["tasks"] = [];
  for (const task of completedTasks) {
    const taskTimeAgg = await prisma.timeEntry.aggregate({
      where: { taskId: task.id, deletedAt: null, clockOut: { not: null } },
      _sum: { netMinutes: true },
    });
    const actualHours = Math.round(((taskTimeAgg._sum.netMinutes || 0) / 60) * 10) / 10;
    const estimatedHours = task.estimatedHours || 0;
    tasks.push({
      taskName: task.name,
      jobOrderNumber: task.jobOrder.jobOrderNumber,
      estimatedHours,
      actualHours,
      efficiency: actualHours > 0 ? Math.round((estimatedHours / actualHours) * 100) / 100 : 0,
    });
  }

  // Daily hours
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      technicianId: techId,
      clockIn: { gte: dateRange.from, lte: dateRange.to },
      clockOut: { not: null },
      deletedAt: null,
    },
    select: { clockIn: true, netMinutes: true },
    orderBy: { clockIn: "asc" },
  });

  const dailyMap = new Map<string, number>();
  for (const entry of timeEntries) {
    const dateKey = new Date(entry.clockIn).toLocaleDateString("en-PH");
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + entry.netMinutes);
  }
  const dailyHours = Array.from(dailyMap.entries()).map(([date, mins]) => ({
    date,
    hours: Math.round((mins / 60) * 10) / 10,
  }));

  return {
    ...perf,
    tasks,
    dailyHours,
    weeklyEfficiency: [], // TODO: compute weekly rolling average
  };
}

// ---------------------------------------------------------------------------
// 7. getFinancialSummary
// ---------------------------------------------------------------------------
export async function getFinancialSummary(dateRange: DateRange): Promise<FinancialSummary> {
  // Total invoiced in period
  const invoicedAgg = await prisma.invoice.aggregate({
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
      isLatest: true,
    },
    _sum: { grandTotal: true, totalPaid: true, discountValue: true },
  });

  // Total collected
  const collectedAgg = await prisma.payment.aggregate({
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
    },
    _sum: { amount: true },
  });

  // Outstanding receivables
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      deletedAt: null,
      isLatest: true,
    },
    select: {
      balanceDue: true,
      createdAt: true,
      jobOrder: { select: { isInsuranceJob: true } },
    },
  });

  const now = new Date();
  const agingBrackets = [
    { label: "Current (0-30)", min: 0, max: 30 },
    { label: "31-60 days", min: 31, max: 60 },
    { label: "61-90 days", min: 61, max: 90 },
    { label: "90+ days", min: 91, max: Infinity },
  ];

  const receivablesAging = agingBrackets.map((b) => {
    let amount = 0;
    let insuranceAmount = 0;
    let customerAmount = 0;
    for (const inv of unpaidInvoices) {
      const age = Math.ceil((now.getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (age >= b.min && age <= b.max) {
        amount += inv.balanceDue;
        if (inv.jobOrder.isInsuranceJob) insuranceAmount += inv.balanceDue;
        else customerAmount += inv.balanceDue;
      }
    }
    return { bracket: b.label, amount, insuranceAmount, customerAmount };
  });

  const outstandingReceivables = unpaidInvoices.reduce((s, i) => s + i.balanceDue, 0);

  // Average days to payment
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      paidInFullAt: { not: null },
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
      isLatest: true,
    },
    select: { createdAt: true, paidInFullAt: true },
  });
  let totalDays = 0;
  for (const inv of paidInvoices) {
    if (inv.paidInFullAt) {
      totalDays += (new Date(inv.paidInFullAt).getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    }
  }
  const avgDaysToPayment = paidInvoices.length > 0 ? Math.round((totalDays / paidInvoices.length) * 10) / 10 : 0;

  // Parts and labor margins
  const materialsCost = await prisma.materialUsage.aggregate({
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
    },
    _sum: { actualCost: true },
  });

  const invoicePartsAgg = await prisma.invoiceLineItem.aggregate({
    where: {
      group: "PARTS",
      invoice: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
        isLatest: true,
      },
      deletedAt: null,
    },
    _sum: { totalCost: true },
  });

  const laborCost = await prisma.timeEntry.aggregate({
    where: {
      clockIn: { gte: dateRange.from, lte: dateRange.to },
      deletedAt: null,
      clockOut: { not: null },
    },
    _sum: { laborCost: true },
  });

  const invoiceLaborAgg = await prisma.invoiceLineItem.aggregate({
    where: {
      group: "LABOR",
      invoice: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        deletedAt: null,
        isLatest: true,
      },
      deletedAt: null,
    },
    _sum: { totalCost: true },
  });

  const partsBilled = invoicePartsAgg._sum.totalCost || 0;
  const partsCost = materialsCost._sum.actualCost || 0;
  const laborBilled = invoiceLaborAgg._sum.totalCost || 0;
  const laborCostTotal = laborCost._sum.laborCost || 0;

  return {
    totalInvoiced: invoicedAgg._sum.grandTotal || 0,
    totalCollected: collectedAgg._sum.amount || 0,
    outstandingReceivables,
    receivablesAging,
    avgDaysToPayment,
    totalDiscountGiven: invoicedAgg._sum.discountValue || 0,
    partsMargin: {
      cost: partsCost,
      billed: partsBilled,
      margin: partsBilled > 0 ? Math.round(((partsBilled - partsCost) / partsBilled) * 1000) / 10 : 0,
    },
    laborMargin: {
      cost: laborCostTotal,
      billed: laborBilled,
      margin: laborBilled > 0 ? Math.round(((laborBilled - laborCostTotal) / laborBilled) * 1000) / 10 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 8. getJobProfitability
// ---------------------------------------------------------------------------
export async function getJobProfitability(jobOrderId: string): Promise<JobProfitability | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { jobOrderId, deletedAt: null, isLatest: true },
    select: { grandTotal: true, estimatedTotal: true, subtotalSublet: true },
  });

  if (!invoice) return null;

  const laborCostAgg = await prisma.timeEntry.aggregate({
    where: { jobOrderId, deletedAt: null, clockOut: { not: null } },
    _sum: { laborCost: true },
  });

  const materialsCostAgg = await prisma.materialUsage.aggregate({
    where: { jobOrderId, deletedAt: null },
    _sum: { actualCost: true },
  });

  const revenue = invoice.grandTotal;
  const laborCost = laborCostAgg._sum.laborCost || 0;
  const materialsCost = materialsCostAgg._sum.actualCost || 0;
  const subletCost = invoice.subtotalSublet || 0;
  const totalCost = laborCost + materialsCost + subletCost;
  const grossProfit = revenue - totalCost;
  const marginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
  const varianceAmount = revenue - (invoice.estimatedTotal || revenue);
  const variancePercent = invoice.estimatedTotal > 0 ? Math.round((varianceAmount / invoice.estimatedTotal) * 1000) / 10 : 0;

  return {
    revenue,
    laborCost,
    materialsCost,
    subletCost,
    totalCost,
    grossProfit,
    marginPercent,
    estimateTotal: invoice.estimatedTotal || 0,
    varianceAmount,
    variancePercent,
  };
}

// ---------------------------------------------------------------------------
// 9. getDashboardMetrics — quick metrics for dashboard homepage
// ---------------------------------------------------------------------------
export async function getDashboardMetrics() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const [
    activeJobs,
    pendingEstimates,
    clockedIn,
    overdueCount,
    unpaidInvoices,
    todayRevenue,
    checkedInToday,
    releasedToday,
    recentActivities,
  ] = await Promise.all([
    prisma.jobOrder.count({
      where: { status: { notIn: ["RELEASED", "CANCELLED", "PENDING"] }, deletedAt: null },
    }),
    prisma.estimateRequest.count({
      where: { status: { in: ["INQUIRY_RECEIVED", "PENDING_ESTIMATE"] }, deletedAt: null },
    }),
    prisma.timeEntry.count({
      where: { clockOut: null, deletedAt: null },
    }),
    prisma.jobOrder.count({
      where: {
        targetCompletionDate: { lt: today },
        status: { notIn: ["RELEASED", "CANCELLED"] },
        deletedAt: null,
      },
    }),
    prisma.invoice.count({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL"] }, deletedAt: null, isLatest: true },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: startOfDay, lte: endOfDay }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.jobOrder.count({
      where: { status: "CHECKED_IN", createdAt: { gte: startOfDay }, deletedAt: null },
    }),
    prisma.jobOrder.count({
      where: { status: "RELEASED", actualCompletionDate: { gte: startOfDay }, deletedAt: null },
    }),
    prisma.jobActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { firstName: true, lastName: true } },
        jobOrder: { select: { jobOrderNumber: true } },
      },
    }),
  ]);

  return {
    activeJobs,
    pendingEstimates,
    clockedIn,
    overdueCount,
    unpaidInvoices,
    todayRevenue: todayRevenue._sum.amount || 0,
    checkedInToday,
    releasedToday,
    recentActivities: JSON.parse(JSON.stringify(recentActivities)),
  };
}

// ---------------------------------------------------------------------------
// 10. getMyDashboard — technician & advisor dashboard data
// ---------------------------------------------------------------------------
export async function getMyDashboard(userId: string, role: string) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (role === "TECHNICIAN") {
    const [myTasks, clockStatus, weekHours, monthEfficiency] = await Promise.all([
      prisma.task.findMany({
        where: {
          assignedTechnicianId: userId,
          status: { not: "COMPLETED" },
          deletedAt: null,
          jobOrder: { status: { notIn: ["RELEASED", "CANCELLED"] }, deletedAt: null },
        },
        include: { jobOrder: { select: { jobOrderNumber: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.timeEntry.findFirst({
        where: { technicianId: userId, clockOut: null, deletedAt: null },
        include: { task: { select: { name: true } }, jobOrder: { select: { jobOrderNumber: true } } },
      }),
      prisma.timeEntry.aggregate({
        where: {
          technicianId: userId,
          clockIn: { gte: startOfWeek },
          clockOut: { not: null },
          deletedAt: null,
        },
        _sum: { netMinutes: true },
      }),
      (async () => {
        const tasks = await prisma.task.findMany({
          where: {
            assignedTechnicianId: userId,
            status: "COMPLETED",
            updatedAt: { gte: startOfMonth },
            deletedAt: null,
          },
          select: { id: true, estimatedHours: true },
        });
        let estTotal = 0;
        let actTotal = 0;
        for (const t of tasks) {
          const agg = await prisma.timeEntry.aggregate({
            where: { taskId: t.id, deletedAt: null, clockOut: { not: null } },
            _sum: { netMinutes: true },
          });
          estTotal += t.estimatedHours || 0;
          actTotal += (agg._sum.netMinutes || 0) / 60;
        }
        return actTotal > 0 ? Math.round((estTotal / actTotal) * 100) / 100 : 0;
      })(),
    ]);

    return {
      role: "TECHNICIAN",
      myTasks: JSON.parse(JSON.stringify(myTasks)),
      clockStatus: clockStatus ? JSON.parse(JSON.stringify(clockStatus)) : null,
      weekHours: Math.round(((weekHours._sum.netMinutes || 0) / 60) * 10) / 10,
      monthEfficiency: monthEfficiency,
    };
  }

  if (role === "ADVISOR") {
    const [myJobs, pendingApprovals, readyForRelease] = await Promise.all([
      prisma.jobOrder.findMany({
        where: {
          status: { notIn: ["RELEASED", "CANCELLED"] },
          deletedAt: null,
        },
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
          customer: { select: { firstName: true, lastName: true } },
          vehicle: { select: { plateNumber: true, make: true, model: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.estimateRequest.count({
        where: { status: "ESTIMATE_SENT", deletedAt: null },
      }),
      prisma.jobOrder.count({
        where: { status: "FULLY_PAID", deletedAt: null },
      }),
    ]);

    return {
      role: "ADVISOR",
      myJobs: JSON.parse(JSON.stringify(myJobs)),
      pendingApprovals,
      readyForRelease,
    };
  }

  return { role };
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Batch 2: Shop Dashboard (1 agent)

### Task 3: Analytics Dashboard — Shop Overview Page

**Files:**
- Replace: `src/app/(dashboard)/analytics/page.tsx`
- Create: `src/app/(dashboard)/analytics/analytics-client.tsx`

**Server component** (`page.tsx`):
- Check session + `can(role, "analytics:view")`, redirect or notFound if unauthorized
- Fetch shop overview, revenue breakdown, job pipeline, capacity, and financial summary using default "this month" range
- Pass all data + userRole to client component

```typescript
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import * as analytics from "@/lib/services/analytics";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session?.user) return notFound();
  if (!can(session.user.role, "analytics:view")) return notFound();

  const now = new Date();
  const defaultRange = {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };

  const [overview, revenue, pipeline, capacity, financial] = await Promise.all([
    analytics.getShopOverview(defaultRange),
    analytics.getRevenueBreakdown(defaultRange),
    analytics.getJobPipeline(defaultRange),
    analytics.getCapacityMetrics(defaultRange),
    analytics.getFinancialSummary(defaultRange),
  ]);

  return (
    <AnalyticsClient
      initialOverview={overview}
      initialRevenue={revenue}
      initialPipeline={pipeline}
      initialCapacity={capacity}
      initialFinancial={financial}
    />
  );
}
```

**Client component** (`analytics-client.tsx`):
- Dense dashboard with DateRangePicker at top right
- 8 metric cards in a single row (responsive grid)
- 6 chart sections in 2-column grid
- Uses recharts for all charts: `LineChart`, `BarChart`, `PieChart`, `Cell`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`, `Legend`
- Date range changes trigger client-side fetch via `/api/analytics` API route (or server action)
- All money values displayed via `formatPeso()` from centavos

Metric cards row:
1. Total Revenue + % change badge
2. Jobs Completed + % change
3. Avg Ticket Value (₱)
4. Avg Cycle Time (days)
5. Efficiency Ratio (color-coded)
6. Utilization Rate (%)
7. Outstanding Receivables (₱)
8. Active Jobs (count)

Charts:
1. Revenue Trend — `BarChart` with `byPeriod` data, `prevRevenue` as lighter bar
2. Revenue by Category — Horizontal `BarChart` with `byCategory` data
3. Job Pipeline — Horizontal `BarChart` with `byStage` data
4. Capacity Overview — Stacked `BarChart` (available/committed/logged)
5. Receivables Aging — Stacked `BarChart` with insurance/customer split
6. Top Services — Horizontal `BarChart` with `topServices` data

The client component is large. Create it with full recharts integration. Use these recharts imports:

```typescript
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
```

Color palette for charts:
```typescript
const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16",
];
```

**Step 5: Create API route for dynamic date range fetching**

Create `src/app/api/analytics/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import * as analytics from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "analytics:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  const dateRange = { from: new Date(from), to: new Date(to) };

  const [overview, revenue, pipeline, capacity, financial] = await Promise.all([
    analytics.getShopOverview(dateRange),
    analytics.getRevenueBreakdown(dateRange),
    analytics.getJobPipeline(dateRange),
    analytics.getCapacityMetrics(dateRange),
    analytics.getFinancialSummary(dateRange),
  ]);

  return NextResponse.json({ overview, revenue, pipeline, capacity, financial });
}
```

**Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Batch 3: Technician Performance (1 agent)

### Task 4: Technician Leaderboard + Detail Pages

**Files:**
- Create: `src/app/(dashboard)/analytics/technicians/page.tsx`
- Create: `src/app/(dashboard)/analytics/technicians/technicians-client.tsx`
- Create: `src/app/(dashboard)/analytics/technicians/[id]/page.tsx`
- Create: `src/app/(dashboard)/analytics/technicians/[id]/tech-detail-client.tsx`
- Create: `src/app/api/analytics/technicians/route.ts`
- Create: `src/app/api/analytics/technicians/[id]/route.ts`

**Leaderboard page (server component):**
- Permission gate: `can(role, "analytics:view")`
- Fetch `getTechnicianPerformance(defaultRange)` with "this month" default
- Pass to client component

**Leaderboard client component:**
- DateRangePicker for period selection
- Sortable table with columns: Name, Jobs, Hours Logged, Efficiency Score, Utilization %, Rework Rate %, Revenue (₱), On-Time Rate %
- Color-coded efficiency: `text-green-600` (>1.1), `text-amber-600` (0.9–1.1), `text-red-600` (<0.9)
- Click row → `router.push(\`/analytics/technicians/${tech.id}\`)`
- Date range change → fetch from `/api/analytics/technicians?from=...&to=...`

**Detail page (server component):**
- Fetch `getTechnicianDetail(techId, defaultRange)`
- Pass to client component

**Detail client component:**
- Header with tech name + role + 4 metric cards (hours, efficiency, utilization, revenue)
- Efficiency Trend — `LineChart` with `weeklyEfficiency` data
- Daily Hours — `BarChart` with `dailyHours` data
- Task Breakdown Table — all completed tasks with JO#, task name, est hours, actual hours, efficiency, color-coded

**API routes:**
- `GET /api/analytics/technicians` → calls `getTechnicianPerformance(dateRange)` with query params
- `GET /api/analytics/technicians/[id]` → calls `getTechnicianDetail(id, dateRange)` with query params

**Verify:** `npx tsc --noEmit` — 0 errors

---

## Batch 4: Reports (2 parallel agents)

### Task 5: Reports Listing + Daily Sales & Receivables Reports

**Files:**
- Create: `src/app/(dashboard)/analytics/reports/page.tsx`
- Create: `src/app/(dashboard)/analytics/reports/reports-client.tsx`
- Create: `src/lib/services/reports.ts`
- Create: `src/lib/actions/report-actions.ts`

**Reports listing page:**
- Permission gate: `can(role, "reports:view")`
- Grid of report cards, each with title, description, icon, and "Generate" button
- Reports: Daily Sales, Receivables Aging, Job Status Summary, Technician Utilization, Service Revenue, Parts Usage, Customer Report, Warranty Claims, Insurance Receivables

**Report service** (`reports.ts`):
Implement 2 report generators (this task):

1. `getDailySalesReport(date: Date)` — All payments for that day:
   - Queries `Payment` with `createdAt` between start and end of `date`
   - Joins Invoice (number), JobOrder → Customer + Vehicle
   - Groups by payment method with subtotals
   - Returns `{ payments: [...], totalsByMethod: Record<string, number>, grandTotal: number }`

2. `getReceivablesAgingReport(includeInsurance: boolean)` — All unpaid/partial invoices:
   - Queries `Invoice` with `paymentStatus IN (UNPAID, PARTIAL)` and `isLatest = true`
   - Joins JobOrder → Customer + Vehicle
   - Calculates age in days from `createdAt`
   - Groups by aging bracket (0-30, 31-60, 61-90, 90+)
   - Optional insurance filter via `jobOrder.isInsuranceJob`
   - Returns `{ invoices: [...], subtotals: Record<string, number>, grandTotal: number }`

**Report actions** (`report-actions.ts`):
Server actions that call report service functions:
- `generateDailySalesAction(date: string)`
- `generateReceivablesAgingAction(includeInsurance: boolean)`

**Report client component:**
- Displays generated report in a table
- "Export CSV" button: converts data to CSV string, creates Blob, triggers download via `URL.createObjectURL`
- "Print / PDF" button: `window.print()` with print-friendly CSS
- CSV generation helper:
```typescript
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Verify:** `npx tsc --noEmit` — 0 errors

---

### Task 6: Remaining Reports (Job Status, Tech Utilization, Service Revenue, Parts, Customer, Warranty, Insurance)

**Files:**
- Modify: `src/lib/services/reports.ts` (add 7 more report functions)
- Modify: `src/lib/actions/report-actions.ts` (add 7 more server actions)
- Modify: `src/app/(dashboard)/analytics/reports/reports-client.tsx` (add report rendering for all types)

Add these report generators to `reports.ts`:

3. `getJobStatusReport(dateRange)` — Jobs per stage count, avg time per stage, overdue list
4. `getTechUtilizationReport(dateRange)` — Per-tech available/logged/utilization/overtime
5. `getServiceRevenueReport(dateRange)` — Revenue by service category, count, avg price
6. `getPartsUsageReport(dateRange)` — Top parts by cost/frequency, estimate vs actual variance
7. `getCustomerReport(dateRange)` — Top customers by spend, new count, returning rate
8. `getWarrantyClaimsReport(dateRange)` — All warranty claims, status, cost, linked JOs
9. `getInsuranceReceivablesReport()` — Outstanding insurance payments by company

Each function returns structured data suitable for table rendering and CSV export.

Add corresponding server actions for each report.

Update the client component to render each report type when selected (use a `reportType` state variable to switch between report views).

**Verify:** `npx tsc --noEmit` — 0 errors

---

## Batch 5: Job Profitability + Dashboard Home (2 parallel agents)

### Task 7: Job Profitability Card + Jobs List Columns

**Files:**
- Create: `src/components/jobs/job-profitability.tsx`
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx` — add profitability fetch
- Modify: `src/app/(dashboard)/jobs/[id]/overview-client.tsx` — render profitability card

**Profitability Card component** (`job-profitability.tsx`):
```tsx
"use client";

import { formatPeso } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface JobProfitabilityProps {
  data: {
    revenue: number;
    laborCost: number;
    materialsCost: number;
    subletCost: number;
    totalCost: number;
    grossProfit: number;
    marginPercent: number;
    estimateTotal: number;
    varianceAmount: number;
    variancePercent: number;
  };
}

export function JobProfitabilityCard({ data }: JobProfitabilityProps) {
  const marginColor =
    data.marginPercent >= 30 ? "text-green-600" :
    data.marginPercent >= 15 ? "text-amber-600" : "text-red-600";

  const marginBg =
    data.marginPercent >= 30 ? "bg-green-50 border-green-200" :
    data.marginPercent >= 15 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`rounded-lg border p-5 space-y-4 ${marginBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <DollarSign className="w-4 h-4" />
          Job Profitability
        </div>
        <span className={`text-2xl font-bold font-mono ${marginColor}`}>
          {data.marginPercent.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-surface-500">Revenue</p>
          <p className="font-semibold text-primary">{formatPeso(data.revenue)}</p>
        </div>
        <div>
          <p className="text-surface-500">Total Cost</p>
          <p className="font-semibold text-primary">{formatPeso(data.totalCost)}</p>
        </div>
        <div>
          <p className="text-surface-500">Labor Cost</p>
          <p className="font-mono text-sm">{formatPeso(data.laborCost)}</p>
        </div>
        <div>
          <p className="text-surface-500">Materials Cost</p>
          <p className="font-mono text-sm">{formatPeso(data.materialsCost)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-200">
        <div>
          <p className="text-sm text-surface-500">Gross Profit</p>
          <p className={`text-lg font-bold font-mono ${marginColor}`}>
            {formatPeso(data.grossProfit)}
          </p>
        </div>
        {data.varianceAmount !== 0 && (
          <div className="flex items-center gap-1 text-xs">
            {data.varianceAmount > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span className={data.varianceAmount > 0 ? "text-green-600" : "text-red-600"}>
              {formatPeso(Math.abs(data.varianceAmount))} vs estimate
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Modify job overview page.tsx:**
- Add `getJobProfitability(id)` to the Promise.all
- Pass result to OverviewClient as `profitability` prop

**Modify overview-client.tsx:**
- Add `profitability` prop (optional, null when not OWNER/MANAGER)
- Import and render `<JobProfitabilityCard>` after the Release Summary section, only if `profitability` is not null
- The server component should only pass profitability data if `can(role, "analytics:view")`

**Verify:** `npx tsc --noEmit` — 0 errors

---

### Task 8: Dashboard Home Enhancement (Role-Aware)

**Files:**
- Replace: `src/app/(dashboard)/page.tsx`
- Create: `src/app/(dashboard)/dashboard-client.tsx`

**Server component** (`page.tsx`):
- Fetch session
- For OWNER/MANAGER: call `getDashboardMetrics()` from analytics service
- For TECHNICIAN: call `getMyDashboard(userId, "TECHNICIAN")`
- For ADVISOR: call `getMyDashboard(userId, "ADVISOR")`
- Pass role-appropriate data to client component

**Client component** (`dashboard-client.tsx`):
Renders different layouts based on role:

**Owner/Manager dashboard:**
- Greeting header with date
- 6 metric cards with LIVE data (not "—"):
  - Active Jobs → `metrics.activeJobs`
  - Pending Estimates → `metrics.pendingEstimates`
  - Techs Clocked In → `metrics.clockedIn`
  - Overdue Jobs → `metrics.overdueCount` (red if >0)
  - Unpaid Invoices → `metrics.unpaidInvoices`
  - Today's Revenue → `formatPeso(metrics.todayRevenue)`
- Today's snapshot card: "X checked in today, Y released today, Z received today"
- Overdue alert banner (if overdueCount > 0): red banner with link to jobs list
- Recent Activity feed: last 10 activities with user, JO#, action, timestamp
- Quick Actions: buttons for "New Inquiry" (→ /estimates/new), "Search" (→ global search), "Reports" (→ /analytics/reports)

**Technician dashboard:**
- Greeting + clock status card (green pulsing if clocked in, gray if not)
- My Tasks list: assigned tasks across active jobs, grouped by JO#
- My Hours This Week: number with visual bar
- Efficiency Score This Month: number with color coding

**Advisor dashboard:**
- Greeting
- My Active Jobs table: JO#, customer, vehicle, status, with clickable rows
- Pending Customer Approval count
- Ready for Release count
- Quick link buttons

**Verify:** `npx tsc --noEmit` — 0 errors

---

## Batch 6: Final Build Verification (1 agent)

### Task 9: Final Build + Route Verification

**Run:** `rm -rf .next && npx next build`

**Expected:** 0 errors. All new routes compile:
- `ƒ /analytics` — Shop analytics dashboard
- `ƒ /analytics/technicians` — Technician leaderboard
- `ƒ /analytics/technicians/[id]` — Technician detail
- `ƒ /analytics/reports` — Reports listing + generation
- `ƒ /api/analytics` — Analytics data API
- `ƒ /api/analytics/technicians` — Tech performance API
- `ƒ /api/analytics/technicians/[id]` — Tech detail API
- `ƒ /` — Dashboard (enhanced, role-aware)
- All existing routes still work

---

## Summary: Task Count & Batching

| Batch | Tasks | Agents | Description |
|-------|-------|--------|-------------|
| 1 | 1, 2 | 2 parallel | Install recharts + DateRangePicker, Analytics service |
| 2 | 3 | 1 agent | Shop analytics dashboard (page + charts + API) |
| 3 | 4 | 1 agent | Technician leaderboard + detail pages + APIs |
| 4 | 5, 6 | 2 parallel | Reports (daily sales + receivables, then remaining 7) |
| 5 | 7, 8 | 2 parallel | Job profitability card, dashboard home enhancement |
| 6 | 9 | 1 agent | Final build verification |

**Total: 9 tasks, 6 batches**

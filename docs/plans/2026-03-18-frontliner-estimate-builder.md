# Frontliner Estimate Builder — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a mobile-friendly, dark-themed estimate builder to the frontliner view so advisors can create estimates without switching to the admin dashboard.

**Architecture:** Three new frontliner routes reuse existing backend services (addLineItem, recalculateVersionTotals, etc.). A new `createEstimateFromServices()` function creates the full Request → Estimate → Version → LineItems chain in one transaction. A new `EstimateCardBuilder` component provides a card-per-service layout optimized for touch.

**Tech Stack:** Next.js 14 App Router, React Server Components + Client Components, Prisma, Server Actions, Tailwind CSS with `--sch-*` CSS variables (dark theme), lucide-react icons.

**Design doc:** `docs/plans/2026-03-18-frontliner-estimate-builder-design.md`

---

### Task 1: Create `createEstimateFromServices()` Service Function

**Files:**
- Create: `src/lib/services/estimate-from-services.ts`

**Step 1: Create the service function**

```typescript
// src/lib/services/estimate-from-services.ts
import { prisma } from "@/lib/prisma";
import { getNextEstimateSequence } from "./estimate-requests";
import { recalculateVersionTotals } from "./estimates";

interface CreateEstimateFromServicesInput {
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  userId: string;
  jobOrderId?: string;
  customerConcern?: string;
}

export async function createEstimateFromServices(
  input: CreateEstimateFromServicesInput
) {
  const { customerId, vehicleId, serviceIds, userId, jobOrderId, customerConcern } = input;

  // Fetch selected services from catalog
  const services = await prisma.serviceCatalog.findMany({
    where: { id: { in: serviceIds }, isActive: true, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  if (services.length === 0) {
    throw new Error("No valid services selected");
  }

  // Derive categories from services
  const categories = [...new Set(services.map((s) => s.category))];

  // Generate request number
  const seq = await getNextEstimateSequence();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const requestNumber = `EST-${dateStr}-${String(seq).padStart(4, "0")}`;
  const versionLabel = `${requestNumber}-v1`;

  // Build concern text if not provided
  const concern =
    customerConcern ||
    `Estimate for: ${services.map((s) => s.name).join(", ")}`;

  // Single transaction: Request → Estimate → Version → LineItems
  const result = await prisma.$transaction(async (tx) => {
    // 1. EstimateRequest
    const estimateRequest = await tx.estimateRequest.create({
      data: {
        requestNumber,
        customerId,
        vehicleId,
        customerConcern: concern,
        requestedCategories: JSON.stringify(categories),
        status: "PENDING_ESTIMATE",
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 2. Estimate (linked to job if provided)
    const estimate = await tx.estimate.create({
      data: {
        estimateRequestId: estimateRequest.id,
        jobOrderId: jobOrderId || null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 3. EstimateVersion
    const version = await tx.estimateVersion.create({
      data: {
        estimateId: estimate.id,
        versionNumber: 1,
        versionLabel,
        vatRate: 12,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 4. LineItems — one LABOR item per service with catalog defaults
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      const hours = svc.defaultEstimatedHours || 1;
      const rate = svc.defaultLaborRate || 0; // centavos per hour
      const subtotal = Math.round(hours * rate);

      await tx.estimateLineItem.create({
        data: {
          estimateVersionId: version.id,
          group: "LABOR",
          description: svc.name,
          serviceCatalogId: svc.id,
          quantity: hours,
          unit: "hrs",
          unitCost: rate,
          markup: 0,
          subtotal,
          sortOrder: i * 10, // spacing for future reorder
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    return {
      estimateRequestId: estimateRequest.id,
      estimateId: estimate.id,
      estimateVersionId: version.id,
    };
  });

  // 5. Recalculate totals (outside transaction — uses extension-based prisma)
  await recalculateVersionTotals(result.estimateVersionId);

  return result;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/estimate-from-services.ts
git commit -m "feat: add createEstimateFromServices() service function"
```

---

### Task 2: Create Server Actions for Frontliner Estimate Flow

**Files:**
- Create: `src/lib/actions/frontliner-estimate-actions.ts`

**Step 1: Create the actions file**

```typescript
// src/lib/actions/frontliner-estimate-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createEstimateFromServices } from "@/lib/services/estimate-from-services";
import { generateApprovalToken, getEstimateVersionById } from "@/lib/services/estimates";

// Action: Create estimate from selected services
export async function createEstimateFromServicesAction(input: {
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  jobOrderId?: string;
  customerConcern?: string;
}) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const result = await createEstimateFromServices({
      ...input,
      userId: session.user.id,
    });

    revalidatePath("/frontliner/jobs");
    revalidatePath("/frontliner/estimate");
    revalidatePath("/estimates");

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create estimate",
    };
  }
}

// Action: Generate approval token for "Save & Send"
export async function generateApprovalTokenAction(versionId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const token = await generateApprovalToken(versionId, session.user.id);
    return { success: true, data: { token } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate token",
    };
  }
}

// Action: Get estimate version with line items (for edit page)
export async function getEstimateVersionAction(versionId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const version = await getEstimateVersionById(versionId);
    if (!version) return { success: false, error: "Version not found" };
    return { success: true, data: version };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load estimate",
    };
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/actions/frontliner-estimate-actions.ts
git commit -m "feat: add frontliner estimate server actions"
```

---

### Task 3: Create `EstimateCardBuilder` Component

This is the core UI — card-per-service layout with inline labor editing, part addition, and sticky footer.

**Files:**
- Create: `src/components/frontliner/estimate-card-builder.tsx`

**Step 1: Create the component**

This is a large component (~400 lines). Key sections:

1. **Types & Props** — `ServiceCard` groups line items by `serviceCatalogId`
2. **Service Card** — labor hours/rate inputs with stepper (+/-), parts list, "Add Part" inline form
3. **Sticky Footer** — subtotal, discount, total, VAT note, Save/Send/Print buttons
4. **State Management** — local optimistic state, server action calls on input change

The component receives `versionId`, `lineItems`, `version` (totals), and `onSave` callback. It groups line items by `serviceCatalogId` to create one card per service.

**Input specs:**
- All number inputs: `h-12` (48px), `font-mono text-lg`, dark-themed
- Stepper buttons: `h-11 w-11` (44px), `var(--sch-accent)` background on active
- Part description input: full width, `h-12`
- "Add Part" / "Remove Part": touch-friendly tap targets

**Server action calls:**
- Labor hours change → `updateLineItemAction(laborItemId, { quantity: newHours })` → response has recalculated totals
- Labor rate change → `updateLineItemAction(laborItemId, { unitCost: newRate })` → recalculated totals
- Add part → `addLineItemAction(versionId, { group: "PARTS", serviceCatalogId, description, quantity, unitCost, unit: "pcs" })` → recalculated totals
- Remove part → `deleteLineItemAction(partItemId)` → recalculated totals

**After each mutation**, fetch updated version totals and update the footer.

**Save actions:**
- "Save" → call `onSave()` which navigates back
- "Save & Send" → call `generateApprovalTokenAction(versionId)` → show modal with copyable link `${origin}/view/estimate/${token}`
- "Save & Print" → open `/view/estimate/${token}` in new tab (generates token first if needed)

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/frontliner/estimate-card-builder.tsx
git commit -m "feat: add EstimateCardBuilder component for frontliner"
```

---

### Task 4: Create Estimate Wizard Component

**Files:**
- Create: `src/components/frontliner/estimate-wizard.tsx`

**Step 1: Create the wizard orchestrator**

A 3-step wizard for creating new estimates:
1. **Plate Lookup** — reuse `IntakePlateLookup` from `src/components/schedule/intake-plate-lookup.tsx`
2. **Service Selection** — reuse `IntakeServiceSelect` from `src/components/schedule/service-select/index.tsx`
3. **Line Item Builder** — use new `EstimateCardBuilder`

Props:
```typescript
interface EstimateWizardProps {
  // Pre-fill from job (skips steps 1 & 2)
  prefilledCustomerId?: string;
  prefilledVehicleId?: string;
  prefilledServiceIds?: string[];
  prefilledJobOrderId?: string;
  // Header info for pre-filled cases
  customerName?: string;
  vehiclePlate?: string;
  vehicleDesc?: string;
}
```

**Step flow:**
- If `prefilledCustomerId` + `prefilledVehicleId` + `prefilledServiceIds` all provided → skip directly to step 3 (create estimate immediately with `createEstimateFromServicesAction`, then show card builder)
- If only customer/vehicle provided → skip step 1, start at step 2 (service selection)
- Otherwise → start at step 1 (plate lookup)

**Step transitions:**
- Step 1 complete → plate lookup returns `customerId`, `vehicleId` → move to step 2
- Step 2 complete → `IntakeServiceSelect.onComplete(serviceIds, categories)` → call `createEstimateFromServicesAction` → move to step 3
- Step 3 → user is in the card builder, "Save" navigates away

**Top bar:** Shows step indicator (1/3, 2/3, 3/3) with back button. Dark themed.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/frontliner/estimate-wizard.tsx
git commit -m "feat: add EstimateWizard component for frontliner"
```

---

### Task 5: Create Frontliner Estimate Pages

**Files:**
- Create: `src/app/(frontliner)/frontliner/estimate/page.tsx`
- Create: `src/app/(frontliner)/frontliner/estimate/[id]/page.tsx`
- Create: `src/app/(frontliner)/frontliner/estimate/job/[jobId]/page.tsx`

**Step 1: New estimate page**

```typescript
// src/app/(frontliner)/frontliner/estimate/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import dynamic from "next/dynamic";

const EstimateWizard = dynamic(
  () => import("@/components/frontliner/estimate-wizard").then((m) => ({ default: m.EstimateWizard })),
  { ssr: false }
);

export default async function FrontlinerNewEstimatePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "estimates:create")) redirect("/frontliner");

  return <EstimateWizard />;
}
```

**Step 2: Edit estimate page**

```typescript
// src/app/(frontliner)/frontliner/estimate/[id]/page.tsx
// Server component that loads EstimateVersion by ID, passes to EstimateCardBuilder
// Uses getEstimateVersionById(params.id) to fetch version with lineItems
// Renders EstimateCardBuilder with pre-loaded data
// onSave navigates back to /frontliner/jobs
```

**Step 3: Add pricing to job page**

```typescript
// src/app/(frontliner)/frontliner/estimate/job/[jobId]/page.tsx
// Server component that loads job order with customer/vehicle/tasks
// Uses getJobOrderDetail(params.jobId) to get relations
// If job already has an estimate with a version → redirect to edit page /frontliner/estimate/[versionId]
// If no estimate → extract service IDs from job's tasks, pass to EstimateWizard with prefilled data
// EstimateWizard skips steps 1 & 2, creates estimate linked to jobOrderId
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/(frontliner)/frontliner/estimate/
git commit -m "feat: add frontliner estimate pages (new, edit, job)"
```

---

### Task 6: Add "New Estimate" Button to Live Floor

**Files:**
- Modify: `src/components/schedule/live-floor.tsx:5` (add ClipboardList import)
- Modify: `src/components/schedule/live-floor.tsx:120-136` (add button between Quick Job and New Intake)

**Step 1: Add the button**

In `src/components/schedule/live-floor.tsx`, add import:
```typescript
import { Wrench, Plus, Zap, FileText, History, ClipboardList } from "lucide-react";
```

Between the "Quick Job" button (line 128) and the "New Intake" link (line 129), add:
```typescript
          <Link
            href="/frontliner/estimate"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--sch-surface)", color: "var(--sch-text)", border: "1px solid var(--sch-border)" }}
          >
            <ClipboardList className="h-4 w-4" />
            New Estimate
          </Link>
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/schedule/live-floor.tsx
git commit -m "feat: add New Estimate button to Live Floor action bar"
```

---

### Task 7: Add "Add Pricing" Button to Frontliner Jobs Page

**Files:**
- Modify: `src/app/(frontliner)/frontliner/jobs/page.tsx` — add `hasEstimate` field to job data
- Modify: `src/components/frontliner/jobs-client.tsx` — add `hasEstimate` to Job type, show "Add Pricing" button

**Step 1: Update jobs page to include estimate relation**

In `src/lib/services/job-orders.ts`, update `getActiveJobsForFloor()` to include estimates:
```typescript
// Add to include block:
estimates: {
  where: { deletedAt: null },
  select: {
    id: true,
    versions: {
      where: { deletedAt: null },
      select: { id: true, grandTotal: true },
      take: 1,
      orderBy: { versionNumber: "desc" as const },
    },
  },
  take: 1,
},
```

In `src/app/(frontliner)/frontliner/jobs/page.tsx`, add to the `jobs.map()`:
```typescript
hasEstimate: jo.estimates.length > 0 && jo.estimates[0].versions.length > 0,
latestVersionId: jo.estimates[0]?.versions[0]?.id || null,
```

**Step 2: Update jobs-client to show "Add Pricing" button**

Add `hasEstimate: boolean` and `latestVersionId: string | null` to the `Job` type.

In the job detail bottom sheet, add a button:
```typescript
{!selectedJob.hasEstimate && (
  <Link
    href={`/frontliner/estimate/job/${selectedJob.id}`}
    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
    style={{ background: "var(--sch-accent)", color: "#1A1A2E" }}
  >
    <ClipboardList className="h-4 w-4" />
    Add Pricing
  </Link>
)}
{selectedJob.hasEstimate && selectedJob.latestVersionId && (
  <Link
    href={`/frontliner/estimate/${selectedJob.latestVersionId}`}
    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
    style={{ background: "var(--sch-surface)", color: "var(--sch-text)", border: "1px solid var(--sch-border)" }}
  >
    <ClipboardList className="h-4 w-4" />
    Edit Estimate
  </Link>
)}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/services/job-orders.ts src/app/(frontliner)/frontliner/jobs/page.tsx src/components/frontliner/jobs-client.tsx
git commit -m "feat: add Add Pricing / Edit Estimate buttons to frontliner jobs"
```

---

### Task 8: Full Build + Visual Verification

**Step 1: Run full build**

Run: `npx next build 2>&1 | tail -20`
Expected: 0 errors, all routes compile including new `/frontliner/estimate/*` routes

**Step 2: Start dev server and verify in browser**

Start preview server, then verify:

1. **Live Floor** → "New Estimate" button visible in action bar
2. **Click "New Estimate"** → opens `/frontliner/estimate` with plate lookup step
3. **Plate lookup** → search a customer, select vehicle → advance to service selection
4. **Service selection** → select 1-2 services → advance to line item builder
5. **Line item builder** → cards appear with pre-filled labor hours/rate from catalog
6. **Edit labor hours** → stepper works, total recalculates live
7. **Add a part** → inline form appears, fill description/qty/price, add → card total updates
8. **Sticky footer** → shows correct subtotal, "Total", "*Prices are VAT-inclusive"
9. **"Save"** → creates estimate, navigates back
10. **Frontliner Jobs** → jobs without estimates show "Add Pricing" button
11. **Admin Estimates list** → estimate created from frontliner appears in the table

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address visual verification issues"
```

---

## File Summary

### New Files (7)
| File | Purpose |
|---|---|
| `src/lib/services/estimate-from-services.ts` | `createEstimateFromServices()` — full chain creation |
| `src/lib/actions/frontliner-estimate-actions.ts` | Server actions for frontliner estimate flow |
| `src/components/frontliner/estimate-card-builder.tsx` | Card-based line item builder (core UI) |
| `src/components/frontliner/estimate-wizard.tsx` | 3-step wizard orchestrator |
| `src/app/(frontliner)/frontliner/estimate/page.tsx` | New estimate page |
| `src/app/(frontliner)/frontliner/estimate/[id]/page.tsx` | Edit estimate page |
| `src/app/(frontliner)/frontliner/estimate/job/[jobId]/page.tsx` | Add pricing to job page |

### Modified Files (3)
| File | Change |
|---|---|
| `src/components/schedule/live-floor.tsx` | Add "New Estimate" button to action bar |
| `src/lib/services/job-orders.ts` | Add estimates relation to `getActiveJobsForFloor()` |
| `src/app/(frontliner)/frontliner/jobs/page.tsx` + `src/components/frontliner/jobs-client.tsx` | Add hasEstimate field + "Add Pricing" button |

## Deferred (Phase 2)
- Quick Quote calculator modal
- Intake Wizard integration (pricing step after service selection)
- Frontliner home screen quick action

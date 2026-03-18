# Frontliner Estimate Builder — Design Document

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Phase 1 — Frontliner Estimate Builder pages + entry points. Quick Quote and Intake integration deferred.

## Problem

Creating an estimate requires the admin dashboard. The advisor must switch out of frontliner/schedule view, navigate Estimates → New Inquiry → 5-step wizard → line items. This breaks the shop floor workflow.

## Solution

Add a simplified, dark-themed, mobile-friendly estimate flow accessible directly from frontliner and schedule views. Reuses all existing backend services — only the UI is new.

## Approach

**Approach A (selected):** New dedicated frontliner pages. The admin builder is a 400+ line component built around a collapsible-group spreadsheet pattern fundamentally different from the card-per-service layout needed for mobile. Backend services (`addLineItem`, `recalculateVersionTotals`, etc.) are already shared.

## Routes

| Route | Purpose |
|---|---|
| `/frontliner/estimate` | New estimate — full flow (plate lookup → services → line items → save) |
| `/frontliner/estimate/[id]` | Edit existing estimate (skip to line item builder, pre-filled) |
| `/frontliner/estimate/job/[jobId]` | Add pricing to existing job (skip plate/services, pre-fill from job's services) |

### Entry Points (Phase 1)

1. **Live Floor action bar:** "New Estimate" button → `/frontliner/estimate`
2. **Frontliner Jobs page:** "Add Pricing" button on jobs without estimates → `/frontliner/estimate/job/[jobId]`

## New Service Function: `createEstimateFromServices()`

Single transaction that creates the full chain: EstimateRequest → Estimate → EstimateVersion → pre-filled LineItems.

```typescript
createEstimateFromServices({
  customerId: string,
  vehicleId: string,
  serviceIds: string[],
  userId: string,
  jobOrderId?: string,
  customerConcern?: string,
})
// Returns: { estimateRequestId, estimateId, estimateVersionId }
```

**Steps inside the transaction:**
1. Get next estimate sequence → generate `EST-YYYYMMDD-XXXX`
2. Create `EstimateRequest` (status: `PENDING_ESTIMATE`)
3. Create `Estimate` linked to request
4. Create `EstimateVersion` (v1)
5. For each service: create LABOR line item with `defaultLaborRate` and `defaultEstimatedHours` from ServiceCatalog
6. Call `recalculateVersionTotals()`
7. If `jobOrderId` provided, link estimate to job order
8. Return IDs

**Pre-fills LABOR only.** Parts are job-specific — no universal defaults in the catalog.

## Component: `EstimateCardBuilder`

New component at `src/components/frontliner/estimate-card-builder.tsx`.

### Props

```typescript
interface EstimateCardBuilderProps {
  versionId: string;
  lineItems: LineItem[];
  version: EstimateVersionSummary;
  onSave: () => void;
}
```

### Card Layout (per service)

Line items grouped by `serviceCatalogId`. Each service gets one card:

```
┌─ Service Card ──────────────────────────────┐
│ 🔧 Brake Pad Replacement (Front)            │
│                                              │
│ Labor                                        │
│ [- 2 +] hrs  ×  ₱ [ 500 ]  =  ₱1,000.00   │
│                                              │
│ Parts  (0)                                   │
│ + Add Part                                   │
│                                        ──────│
│ Card Total              ₱1,000.00           │
└──────────────────────────────────────────────┘
```

### Add Part (inline form inside card)

```
│ ┌─────────────────────────────────────────┐  │
│ │ Description: [ Brake Pad Set (Front)  ] │  │
│ │ Qty: [- 1 +]    Price: ₱ [ 1800 ]      │  │
│ │ [ Cancel ]                 [ Add ✓ ]    │  │
│ └─────────────────────────────────────────┘  │
```

### Sticky Footer (summary + actions)

```
┌──────────────────────────────────────────────┐
│ Subtotal               ₱2,800.00            │
│ Discount               None ▼               │
│ Total                  ₱2,800.00            │
│ *Prices are VAT-inclusive                    │
│                                              │
│ [ Save ]    [ Save & Send ]   [ Save & Print ]│
└──────────────────────────────────────────────┘
```

### Design Tokens

- Card background: `var(--sch-surface)` + `var(--sch-border)` border
- Inputs: 48px height, `font-mono` for numbers, `text-lg` for prices
- Stepper buttons (- / +): 44px touch targets, `var(--sch-accent)` on tap
- Card total: right-aligned, `font-mono font-bold`
- Sticky footer: `fixed bottom-0` with blur backdrop, above bottom nav (z-40)
- Dark theme throughout (inherits from frontliner layout's ScheduleThemeProvider)

### State Management

- Local state mirrors server data (optimistic updates)
- Each input change → server action (`updateLineItemAction`, `addLineItemAction`, `deleteLineItemAction`)
- Response includes recalculated totals → update footer live
- No "recalculate" button — everything auto-calculates

### Grouping Logic

- `group === "LABOR"` with same `serviceCatalogId` → labor row of that card
- `group === "PARTS"` with same `serviceCatalogId` → parts list of that card
- Ungrouped items (no `serviceCatalogId`) → "Other Items" card at bottom

## Save Actions

| Button | Behavior |
|---|---|
| **Save** | Save estimate, navigate back to referring page |
| **Save & Send** | Save + `generateApprovalToken()` + show copyable link |
| **Save & Print** | Save + open `/view/estimate/[token]` in new tab |

## Wizard Steps (new estimate flow)

`/frontliner/estimate` runs a 3-step wizard:

1. **Plate Lookup** — reuse `IntakePlateLookup` component
2. **Service Selection** — reuse `IntakeServiceSelect` component (3-layer nav)
3. **Line Item Builder** — new `EstimateCardBuilder` component

Steps 1 and 2 are skipped when entering from `/frontliner/estimate/job/[jobId]` (customer, vehicle, and services already known from the job).

## Files to Create/Modify

### New Files
- `src/app/(frontliner)/frontliner/estimate/page.tsx` — new estimate wizard page
- `src/app/(frontliner)/frontliner/estimate/[id]/page.tsx` — edit estimate page
- `src/app/(frontliner)/frontliner/estimate/job/[jobId]/page.tsx` — add pricing to job page
- `src/components/frontliner/estimate-card-builder.tsx` — card-based line item builder
- `src/components/frontliner/estimate-wizard.tsx` — 3-step wizard orchestrator
- `src/lib/services/estimate-from-services.ts` — `createEstimateFromServices()` function
- `src/lib/actions/frontliner-estimate-actions.ts` — server actions for frontliner estimate flow

### Modified Files
- `src/components/schedule/live-floor.tsx` — add "New Estimate" button to action bar
- `src/components/frontliner/jobs-client.tsx` — add "Add Pricing" button on unpriced jobs

## Deferred (Phase 2)
- Quick Quote calculator modal
- Intake Wizard integration (pricing step after service selection)
- "Add Estimate" from frontliner home screen quick actions

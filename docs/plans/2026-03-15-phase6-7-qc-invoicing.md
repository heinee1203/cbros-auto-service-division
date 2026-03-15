# Phase 6+7: Quality Control & Invoicing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the QC inspection workflow (configurable checklists, rework loop, re-inspection) and full invoicing/payment pipeline (auto-generation, split payments, PDF/receipt, public share link).

**Architecture:** QC inspections are append-only (new record per attempt). Invoice auto-generates on QC_PASSED from estimate line items + supplements. Payments are multiple records per invoice; status derived from sum vs total. Public invoice view uses token-based access like supplement approval.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma/SQLite, Tailwind CSS, Zod, Server Actions, `window.print()` for PDF/receipt.

---

## Pre-Implementation: Schema Migration

Before any tasks begin, add missing fields to `QCChecklistItem`:

```prisma
model QCChecklistItem {
  // ... existing fields ...
  photoId       String?    // optional photo reference (Photo.id)
  inspectedAt   DateTime?  // timestamp when result was set
}
```

Run: `npx prisma db push` (dev mode, SQLite)

Also add `insurancePays` and `customerCopay` fields to Invoice:

```prisma
model Invoice {
  // ... existing fields ...
  insurancePays   Int @default(0)  // insurance portion (centavos)
  customerCopay   Int @default(0)  // customer portion (centavos)
  version         Int @default(1)  // invoice version number
  isLatest        Boolean @default(true)  // only latest version is active
  shareToken      String? @unique  // for public share link
}
```

---

## Batch 1: Schema + Seed + Validators (2 parallel agents)

### Task 1: Schema Migration + QC Checklist Seed Data

**Files:**
- Modify: `prisma/schema.prisma` — add `photoId`, `inspectedAt` to QCChecklistItem; add `insurancePays`, `customerCopay`, `version`, `isLatest`, `shareToken` to Invoice
- Modify: `prisma/seed.ts` — add QC checklist template settings
- Modify: `src/types/enums.ts` — add QC/Invoice display labels and colors
- Modify: `src/lib/constants.ts` — add QC checklist categories, payment method labels/icons, invoice status tabs

**QC Checklist Templates to seed** (stored as JSON in Setting model):

Key: `qc_checklist_paint_body`, value: JSON array of `{ description, sortOrder }`:
```json
[
  {"description": "Color match accuracy (natural light + fluorescent)", "sortOrder": 1},
  {"description": "Orange peel level acceptable", "sortOrder": 2},
  {"description": "No runs, sags, drips, or fisheyes", "sortOrder": 3},
  {"description": "Blending on adjacent panels seamless", "sortOrder": 4},
  {"description": "Clear coat gloss and DOI satisfactory", "sortOrder": 5},
  {"description": "No sanding marks, halos, or burn-throughs", "sortOrder": 6},
  {"description": "All masking removed cleanly", "sortOrder": 7},
  {"description": "Panel alignment and gaps consistent", "sortOrder": 8},
  {"description": "All clips, fasteners, trim reinstalled", "sortOrder": 9},
  {"description": "No rattles or loose components", "sortOrder": 10},
  {"description": "All hardware torqued", "sortOrder": 11}
]
```

Key: `qc_checklist_detailing`, value:
```json
[
  {"description": "Surface free of swirls, holograms, marring (LED inspection)", "sortOrder": 1},
  {"description": "Coating applied evenly, no high spots", "sortOrder": 2},
  {"description": "Glass clean and streak-free", "sortOrder": 3},
  {"description": "Interior surfaces clean, no residue", "sortOrder": 4},
  {"description": "Tires and trim dressed evenly", "sortOrder": 5},
  {"description": "No fingerprints or water spots", "sortOrder": 6},
  {"description": "No chemical odor remaining", "sortOrder": 7}
]
```

Key: `qc_checklist_undercoating`, value:
```json
[
  {"description": "Full coverage on specified areas", "sortOrder": 1},
  {"description": "Consistent thickness", "sortOrder": 2},
  {"description": "No drips or runs", "sortOrder": 3},
  {"description": "Drain holes not blocked", "sortOrder": 4},
  {"description": "No overspray on suspension/exhaust/brake components", "sortOrder": 5},
  {"description": "Adequate curing time observed", "sortOrder": 6}
]
```

Key: `qc_checklist_mechanical`, value:
```json
[
  {"description": "All lights function", "sortOrder": 1},
  {"description": "Doors, hood, trunk open/close/latch properly", "sortOrder": 2},
  {"description": "Windows operate correctly", "sortOrder": 3},
  {"description": "Locks function", "sortOrder": 4},
  {"description": "No fluid leaks", "sortOrder": 5},
  {"description": "Test drive completed (if applicable)", "sortOrder": 6}
]
```

**Enums to add** in `src/types/enums.ts`:
```typescript
export const QCOverallResult = {
  PENDING: "PENDING",
  PASSED: "PASSED",
  FAILED: "FAILED",
} as const;
export type QCOverallResult = (typeof QCOverallResult)[keyof typeof QCOverallResult];

export const QC_RESULT_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
};

export const QC_RESULT_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PASSED: "bg-success-100 text-success-600",
  FAILED: "bg-danger-100 text-danger-600",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  GCASH: "GCash",
  MAYA: "Maya",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  CHECK: "Check",
  INSURANCE_DIRECT: "Insurance Direct",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Fully Paid",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: "bg-danger-100 text-danger-600",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  PAID: "bg-success-100 text-success-600",
};
```

**Constants to add** in `src/lib/constants.ts`:
```typescript
export const QC_CHECKLIST_CATEGORIES = [
  { id: "paint_body", label: "Paint & Body", settingKey: "qc_checklist_paint_body" },
  { id: "detailing", label: "Detailing", settingKey: "qc_checklist_detailing" },
  { id: "undercoating", label: "Undercoating", settingKey: "qc_checklist_undercoating" },
  { id: "mechanical", label: "Mechanical / Functional", settingKey: "qc_checklist_mechanical" },
] as const;

export const INVOICE_STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Fully Paid" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash", icon: "Banknote" },
  { value: "GCASH", label: "GCash", icon: "Smartphone" },
  { value: "MAYA", label: "Maya", icon: "Smartphone" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: "Building2" },
  { value: "CREDIT_CARD", label: "Credit Card", icon: "CreditCard" },
  { value: "DEBIT_CARD", label: "Debit Card", icon: "CreditCard" },
  { value: "CHECK", label: "Check", icon: "FileText" },
  { value: "INSURANCE_DIRECT", label: "Insurance Direct", icon: "Shield" },
] as const;
```

After modifying schema, run: `npx prisma db push`
After modifying seed, run: `npx prisma db seed`

**Verification:** `npx tsc --noEmit` passes with zero errors.

---

### Task 2: Zod Validators for QC + Invoice + Payment

**Files:**
- Modify: `src/lib/validators.ts` — add schemas for QC, Invoice, Payment

**Add these Zod schemas:**

```typescript
// ---------------------------------------------------------------------------
// Phase 6: QC Inspection
// ---------------------------------------------------------------------------
export const qcChecklistResultSchema = z.object({
  checklistItemId: z.string().min(1),
  status: z.enum(["PASS", "FAIL", "NA"]),
  notes: z.string().optional().nullable(),
  photoId: z.string().optional().nullable(),
});
export type QCChecklistResultInput = z.infer<typeof qcChecklistResultSchema>;

export const qcSubmitSchema = z.object({
  notes: z.string().optional().nullable(),
  results: z.array(qcChecklistResultSchema).min(1, "All items must be inspected"),
});
export type QCSubmitInput = z.infer<typeof qcSubmitSchema>;

// ---------------------------------------------------------------------------
// Phase 7: Invoice
// ---------------------------------------------------------------------------
export const invoiceLineItemSchema = z.object({
  group: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().default("pcs"),
  unitCost: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().default(0),
});
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

export const invoiceDiscountSchema = z.object({
  discountType: z.enum(["flat", "percentage"]),
  discountValue: z.coerce.number().min(0),
  discountReason: z.string().min(1, "Discount reason is required"),
});
export type InvoiceDiscountInput = z.infer<typeof invoiceDiscountSchema>;

export const invoiceEditSchema = z.object({
  billingMode: z.enum(["estimated", "actual"]).optional(),
  notes: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});
export type InvoiceEditInput = z.infer<typeof invoiceEditSchema>;

// ---------------------------------------------------------------------------
// Phase 7: Payment
// ---------------------------------------------------------------------------
export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.string().min(1, "Payment method is required"),
  referenceNumber: z.string().optional().nullable(),
  last4Digits: z.string().optional().nullable(),
  approvalCode: z.string().optional().nullable(),
  checkBank: z.string().optional().nullable(),
  checkDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
```

**Verification:** `npx tsc --noEmit` passes.

---

## Batch 2: QC Service + Actions (2 parallel agents)

### Task 3: QC Service (`src/lib/services/qc.ts`)

**Files:**
- Create: `src/lib/services/qc.ts`

**Dependencies (import from):**
- `@/lib/prisma` for database access
- `@/lib/services/job-activities` for `logActivity()`
- `@/types/enums` for status constants

**Functions to implement:**

1. **`createQCInspection(jobOrderId, inspectorId)`**
   - Fetch the job's service categories from `estimates → estimateRequest.requestedCategories`
   - For each relevant category, fetch the checklist template from Settings (`qc_checklist_[category]`)
   - Parse the JSON template arrays
   - If this is a re-inspection (previous FAILED inspection exists):
     - Only include items that were FAIL in the previous inspection
     - Copy over the descriptions from the failed items
   - Create `QCInspection` record with `overallResult: "PENDING"`
   - Create `QCChecklistItem` records from templates (status: "PASS" default? No — for fresh inspection use an empty/null-like default. Since schema defaults to "NA", that works as "not yet inspected")
   - Wait — the schema defaults status to "NA" but the spec says "default null — not yet inspected". Since we can't have null (it's a String field), we can treat "NA" differently. Better approach: change the initial status to a sentinel. Actually, looking at the enum `QCChecklistItemStatus: PASS | FAIL | NA`, "NA" means "Not Applicable" per the spec. We need a 4th state or use a different approach. **Solution:** Leave status as "NA" initially but use `inspectedAt IS NULL` to mean "not yet inspected". When the inspector sets a result (PASS/FAIL/NA), `inspectedAt` gets set. Items with `inspectedAt IS NULL` are "pending inspection".
   - Log `JobActivity`: "QC inspection #N started by [Inspector Name]"
   - Return the created inspection with checklist items

2. **`getQCInspection(inspectionId)`**
   - Fetch inspection with all checklist items, inspector name
   - Include photos for each checklist item (polymorphic: `entityType: "QC_CHECKLIST_ITEM"`)

3. **`getJobQCInspections(jobOrderId)`**
   - Fetch all QC inspections for a job, ordered by `inspectionDate desc`
   - Include item counts (total, passed, failed, pending)

4. **`updateChecklistItem(itemId, data: { status, notes?, photoId? }, inspectorId)`**
   - Update the checklist item's status, notes, photoId
   - Set `inspectedAt` to `new Date()`
   - Set `updatedBy` to inspectorId

5. **`submitQCInspection(inspectionId, inspectorId, notes?)`**
   - Verify ALL items have `inspectedAt` set (all inspected)
   - Count FAIL items
   - If 0 FAIL items:
     - Set `overallResult: "PASSED"`
     - Update JobOrder status to `QC_PASSED`
     - Set all tasks to `DONE` status
     - Log `JobActivity`: "QC passed by [Inspector Name]"
     - Create `QC_PASSED` notification for ADVISOR users
   - If any FAIL items:
     - Set `overallResult: "FAILED"`
     - Update JobOrder status to `QC_FAILED_REWORK`
     - For each FAIL item, create a rework Task:
       - `name: "REWORK: [failed item description]"`
       - `isRework: true`
       - `status: "QUEUED"`
       - Attempt to assign to the original technician (from the job's primary tech or task technician)
     - Log `JobActivity`: "QC failed — X items need rework"
     - Create `QC_FAILED` notification for MANAGER/OWNER users
   - Return the result

6. **`getQCChecklistTemplates()`**
   - Fetch all `qc_checklist_*` settings
   - Parse JSON values
   - Return as `Record<string, Array<{ description, sortOrder }>>`

7. **`updateQCChecklistTemplate(category, items)`**
   - Update the Setting record for `qc_checklist_[category]` with new JSON value

**Key logic — determining which checklist categories to include:**
- Fetch the job's `estimates → estimateRequest.requestedCategories` (string array like `["Painting & Refinishing", "Car Detailing"]`)
- Map service categories to QC categories:
  - "Collision Repair", "Painting & Refinishing" → `paint_body`
  - "Buffing & Paint Correction", "Car Detailing" → `detailing`
  - "Undercoating & Rust Protection" → `undercoating`
  - ALL jobs get `mechanical` (always included)

**Key logic — re-inspection:**
- Query: `prisma.qcInspection.findFirst({ where: { jobOrderId, overallResult: "FAILED", deletedAt: null }, orderBy: { inspectionDate: "desc" } })`
- If found, get its FAIL items: `prisma.qcChecklistItem.findMany({ where: { qcInspectionId: prev.id, status: "FAIL", deletedAt: null } })`
- Create new inspection with only those items (same descriptions, fresh status)

---

### Task 4: QC Actions (`src/lib/actions/qc-actions.ts`)

**Files:**
- Create: `src/lib/actions/qc-actions.ts`

**Pattern:** Follow `src/lib/actions/supplement-actions.ts` exactly.

**Actions to implement:**

1. **`createQCInspectionAction(jobOrderId)`**
   - Permission: `qc:inspect`
   - Calls `createQCInspection(jobOrderId, session.user.id)`
   - Revalidate `/jobs/${jobOrderId}`

2. **`updateChecklistItemAction(itemId, jobOrderId, data)`**
   - Permission: `qc:inspect`
   - Validates with `qcChecklistResultSchema`
   - Calls `updateChecklistItem(itemId, data, session.user.id)`
   - Revalidate `/jobs/${jobOrderId}`

3. **`submitQCInspectionAction(inspectionId, jobOrderId, notes?)`**
   - Permission: `qc:inspect`
   - Calls `submitQCInspection(inspectionId, session.user.id, notes)`
   - Revalidate `/jobs/${jobOrderId}`

---

## Batch 3: QC UI + QC Summary (2 parallel agents)

### Task 5: QC Inspection Page (`src/app/(dashboard)/jobs/[id]/qc/page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/qc/page.tsx` — replace placeholder
- Create: `src/app/(dashboard)/jobs/[id]/qc/qc-client.tsx` — client component

**Server component (`page.tsx`):**
- Fetch job order with tasks
- Fetch all QC inspections for this job via `getJobQCInspections(id)`
- Fetch the latest/active inspection detail if one exists in PENDING state
- Fetch intake photos for angle reference (entityType: "INTAKE", entityId: intakeRecord.id)
- Pass serialized data to client component

**Client component (`qc-client.tsx`):**
- **Top section:** QC status banner
  - If no inspections: "No QC inspection started" + "Start QC Inspection" button (only shown if job is `QC_PENDING` or `QC_FAILED_REWORK`)
  - If PENDING inspection: show progress "14 of 22 items inspected" with progress bar
  - If PASSED: green "QC Passed" banner with inspector name and date
  - If FAILED: red "QC Failed" banner with failed item count
  - Show attempt number if multiple: "QC Inspection #2 (Re-inspection)"

- **Checklist section** (only for PENDING inspection):
  - Items grouped by category with category headers (Paint & Body, Detailing, etc.)
  - Each item row:
    - Description text
    - Three large buttons: ✅ Pass (green), ❌ Fail (red), ➖ N/A (gray)
    - Active button shows filled/highlighted state
    - When FAIL is tapped: notes textarea auto-expands below, photo upload button appears
    - When any button is tapped, calls `updateChecklistItemAction` immediately
    - Show `inspectedAt` timestamp if set
  - Touch targets: min 44px height for mobile/tablet use

- **QC Photos section:**
  - File upload for QC completion photos (entityType: "QC_INSPECTION", stage: "QC")
  - Show intake reference photos as thumbnails with labels "Match this angle"
  - Grid of captured QC photos

- **Submit QC button:**
  - Only enabled when ALL items have `inspectedAt` set
  - Shows count of uninspected items if not all done
  - Calls `submitQCInspectionAction`
  - On success: shows result (PASSED/FAILED) with details

- **History section** (below active inspection):
  - List of previous inspections with date, inspector, result, item counts
  - Expandable to see individual item results

**Important:** The `inspectedAt IS NULL` check determines "not yet inspected" vs "inspected as N/A". When an inspector explicitly sets N/A, `inspectedAt` gets a timestamp. Items without `inspectedAt` are uninspected.

---

### Task 6: QC Summary on Job Overview

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx` — fetch QC data
- Modify: `src/app/(dashboard)/jobs/[id]/overview-client.tsx` — add QC summary card

**Server component changes:**
- Add to the `Promise.all`: fetch latest QC inspection with item counts
```typescript
prisma.qcInspection.findFirst({
  where: { jobOrderId: id, deletedAt: null },
  orderBy: { inspectionDate: "desc" },
  include: {
    inspector: { select: { firstName: true, lastName: true } },
    checklistItems: {
      where: { deletedAt: null },
      select: { status: true, inspectedAt: true },
    },
  },
})
```
- Count total QC attempts: `prisma.qcInspection.count({ where: { jobOrderId: id, deletedAt: null } })`

**Client component changes — QC Summary Card:**
- Show between the tasks progress section and supplements section
- Card content based on state:
  - **No QC yet:** Gray card "QC Not Started" with `Clock` icon
  - **PENDING:** Yellow card "QC In Progress" — "X of Y items inspected" progress bar
  - **PASSED:** Green card "QC Passed ✅" — inspector name, date, attempt #
  - **FAILED:** Red card "QC Failed ❌" — X failed items, list failed item descriptions, rework task status for each
- If failed: show each failed item with its rework task status (QUEUED/IN_PROGRESS/DONE)

---

## Batch 4: Invoice Service + Actions (2 parallel agents)

### Task 7: Invoice Service (`src/lib/services/invoices.ts`)

**Files:**
- Create: `src/lib/services/invoices.ts`

**Functions to implement:**

1. **`generateInvoice(jobOrderId, userId)`**
   - Called when job reaches `QC_PASSED`
   - Fetch the job's active estimate with latest version + line items
   - Fetch all APPROVED supplemental estimates with their line items
   - Get `next_inv_sequence` from Settings, increment it
   - Generate invoice number: `generateDocNumber("INV", sequence)`
   - Default `billingMode`: check if job is INSURANCE priority → "actual", otherwise "estimated"
   - **Build line items from estimate:**
     - For each estimate line item: create InvoiceLineItem with same group, description, quantity, unit, unitCost
     - For each supplement: create InvoiceLineItems with group label prefixed (e.g., "SUP-001: description")
   - **Calculate totals:**
     - Sum by group: subtotalLabor, subtotalParts, subtotalMaterials, subtotalPaint, subtotalSublet, subtotalOther
     - Get VAT rate from Settings (`vat_rate`, default 12)
     - Get `vat_enabled` from Settings
     - If VAT enabled: `vatableAmount = sum of all subtotals`, `vatAmount = Math.round(vatableAmount * vatRate / 100)`
     - `grandTotal = vatableAmount + vatAmount`
     - `balanceDue = grandTotal`
     - Set `estimatedTotal = grandTotal` (for variance tracking)
   - **For insurance jobs:**
     - Check if job priority is INSURANCE
     - If yes, look for insurance info on the estimate (the estimate's line items represent what insurance covers)
     - Set `insurancePays` and `customerCopay` (can be adjusted later by advisor)
   - **Calculate actual total** (for variance):
     - Sum all TimeEntry.laborCost for the job
     - Sum all MaterialUsage.actualCost for the job
     - Set `actualTotal` = labor cost + materials cost
   - Create Invoice record + InvoiceLineItem records
   - Update JobOrder status to `AWAITING_PAYMENT`
   - Log `JobActivity`: "Invoice INV-XXXXXXXX-XXXX generated"
   - Return the invoice

2. **`getInvoice(invoiceId)`**
   - Fetch invoice with line items, payments, job order (customer, vehicle info)
   - Calculate derived fields: totalPaid, balanceDue, paymentStatus

3. **`getJobInvoice(jobOrderId)`**
   - Find the latest (isLatest=true) invoice for a job
   - Same includes as getInvoice

4. **`updateInvoice(invoiceId, data, userId)`**
   - Update billing mode, notes, dueDate
   - If billing mode changed to "actual": recalculate line items from TimeEntry + MaterialUsage
   - If billing mode changed to "estimated": recalculate from estimate line items
   - Recalculate totals
   - Return updated invoice

5. **`recalculateInvoiceTotals(invoiceId)`**
   - Sum line items by group
   - Apply discount if set
   - Calculate VAT
   - Update grandTotal, balanceDue (grandTotal - totalPaid)
   - Update paymentStatus based on totalPaid vs grandTotal

6. **`applyDiscount(invoiceId, discountType, discountValue, reason, userId)`**
   - Validate permission (only OWNER/MANAGER for large discounts — check `estimates:approve_discount` permission)
   - Apply discount: if "flat" → subtract from pre-VAT total; if "percentage" → calculate percentage
   - Recalculate totals
   - Log `JobActivity`: "Discount of ₱X applied to invoice"

7. **`addInvoiceLineItem(invoiceId, data, userId)`**
   - Create line item, recalculate totals

8. **`updateInvoiceLineItem(lineItemId, data, userId)`**
   - Update line item, recalculate totals

9. **`deleteInvoiceLineItem(lineItemId, userId)`**
   - Soft delete, recalculate totals

10. **`generateShareToken(invoiceId)`**
    - Generate UUID token, save to `shareToken` field
    - Return the token

11. **`getInvoiceByToken(token)`**
    - Find invoice by shareToken
    - Include job order, customer, vehicle, line items
    - Return null if not found

**Key logic — "Bill as Actual" recalculation:**
```typescript
// Fetch actual labor from time entries
const laborEntries = await prisma.timeEntry.findMany({
  where: { jobOrderId, deletedAt: null, clockOut: { not: null } },
  select: { netMinutes: true, laborCost: true, task: { select: { name: true } } },
});
// Group by task, create LABOR line items: description = task name, quantity = hours, unitCost = hourly rate

// Fetch actual materials
const materials = await prisma.materialUsage.findMany({
  where: { jobOrderId, deletedAt: null },
  select: { itemDescription: true, quantity: true, unit: true, actualCost: true },
});
// Create PARTS/MATERIALS line items from actual usage
```

---

### Task 8: Invoice Actions (`src/lib/actions/invoice-actions.ts`)

**Files:**
- Create: `src/lib/actions/invoice-actions.ts`

**Pattern:** Follow `src/lib/actions/supplement-actions.ts`

**Actions:**

1. **`generateInvoiceAction(jobOrderId)`** — permission: `invoices:create`
2. **`updateInvoiceAction(invoiceId, jobOrderId, data)`** — permission: `invoices:edit`, validate with `invoiceEditSchema`
3. **`applyDiscountAction(invoiceId, jobOrderId, data)`** — permission: `invoices:edit`, validate with `invoiceDiscountSchema`; check `estimates:approve_discount` for large discounts
4. **`addInvoiceLineItemAction(invoiceId, jobOrderId, data)`** — permission: `invoices:edit`, validate with `invoiceLineItemSchema`
5. **`updateInvoiceLineItemAction(lineItemId, jobOrderId, data)`** — permission: `invoices:edit`
6. **`deleteInvoiceLineItemAction(lineItemId, jobOrderId)`** — permission: `invoices:edit`
7. **`generateShareLinkAction(invoiceId, jobOrderId)`** — permission: `invoices:edit`
8. **`toggleBillingModeAction(invoiceId, jobOrderId, mode)`** — permission: `invoices:edit`, calls `updateInvoice` with new billingMode

---

## Batch 5: Payment Service + Actions (2 parallel agents)

### Task 9: Payment Service (`src/lib/services/payments.ts`)

**Files:**
- Create: `src/lib/services/payments.ts`

**Functions:**

1. **`recordPayment(invoiceId, data: PaymentInput, userId)`**
   - Create Payment record with `paidAt: new Date()`, `createdBy: userId`
   - Update Invoice:
     - `totalPaid += amount`
     - `balanceDue = grandTotal - totalPaid`
     - Determine `paymentStatus`:
       - totalPaid >= grandTotal → "PAID"
       - totalPaid > 0 → "PARTIAL"
       - else → "UNPAID"
     - If PAID: set `paidInFullAt = new Date()`
   - Update JobOrder status:
     - If PAID: → `FULLY_PAID` (which triggers `AWAITING_RELEASE` readiness)
     - If PARTIAL: → `PARTIAL_PAYMENT`
   - Log `JobActivity`: "Payment of ₱X,XXX received via [method]"
   - Create `PAYMENT_RECEIVED` notification for OWNER/MANAGER
   - Return the payment

2. **`getInvoicePayments(invoiceId)`**
   - Fetch all payments for an invoice, ordered by `paidAt desc`
   - Include creator name

3. **`voidPayment(paymentId, userId)`**
   - Soft delete the payment
   - Recalculate invoice totalPaid, balanceDue, paymentStatus
   - Log `JobActivity`

4. **`generateReceipt(paymentId)`**
   - Fetch payment with invoice, job order, customer details
   - Get `next_or_sequence` from Settings, increment it
   - Generate OR number: `generateDocNumber("OR", sequence)`
   - Update invoice `orNumber` if not set
   - Return receipt data (for rendering)

5. **`getReceiptData(paymentId)`**
   - Fetch all data needed for receipt rendering:
     - Shop info from Settings (name, address, phone, TIN, logo)
     - Payment details
     - Invoice details
     - Customer info
     - Running balance after this payment

---

### Task 10: Payment Actions (`src/lib/actions/payment-actions.ts`)

**Files:**
- Create: `src/lib/actions/payment-actions.ts`

**Actions:**

1. **`recordPaymentAction(invoiceId, jobOrderId, data)`** — permission: `payments:process`, validate with `paymentSchema`. Amount comes in as pesos from the form, convert to centavos via `pesosToCentavos`.
2. **`voidPaymentAction(paymentId, jobOrderId)`** — permission: `payments:process`
3. **`generateReceiptAction(paymentId)`** — permission: `invoices:view`

---

## Batch 6: Invoice UI + Payment UI (2 parallel agents)

### Task 11: Invoice Page (`src/app/(dashboard)/jobs/[id]/invoice/page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/invoice/page.tsx` — replace placeholder
- Create: `src/app/(dashboard)/jobs/[id]/invoice/invoice-client.tsx`

**Server component:**
- Fetch the job's latest invoice via `getJobInvoice(id)`
- Fetch job order detail for customer/vehicle info
- Fetch shop settings for header (shop_name, shop_address, etc.)
- If no invoice and job is `QC_PASSED`: show "Generate Invoice" button
- Pass serialized data to client

**Client component — Invoice View:**

- **Invoice header area:**
  - Shop logo + name + address + phone + email + TIN (from settings)
  - Invoice number, date, due date
  - Billing mode toggle: "Estimated" / "Actual" radio buttons (calls `toggleBillingModeAction`)
  - Status badge (UNPAID/PARTIAL/PAID)

- **Customer + Vehicle info:**
  - Customer name, phone, email, address
  - Vehicle: year make model, color, plate number

- **Line items table:**
  - Grouped by: LABOR, PARTS, MATERIALS, PAINT, SUBLET, OTHER
  - Then supplemental groups: "Supplemental #1: [description]", "Supplemental #2: [description]"
  - Each item: description, qty, unit, unit price (₱), subtotal (₱)
  - Group subtotal row
  - Editable: pencil icon → inline edit mode for description, qty, unit cost
  - Add line item button per group
  - Delete line item (with confirm)

- **Totals section:**
  - Subtotal (sum all groups)
  - Discount: if applied, show "Discount ([type]): -₱X,XXX" with reason
  - "Apply Discount" button → opens form: type (flat/%), value, reason
  - VATable Amount
  - VAT (12%)
  - VAT Exempt (if any)
  - **Grand Total** (large, bold)
  - For insurance: "Insurance Pays: ₱XX,XXX" and "Customer Copay: ₱XX,XXX"

- **Internal variance section** (only visible to OWNER/MANAGER — check `can(role, "analytics:view")`):
  - "Estimated Total: ₱XX,XXX"
  - "Actual Total: ₱XX,XXX"
  - "Variance: ₱XX,XXX (X%)" — green if under, red if over
  - Labor hours: estimated vs actual
  - Parts cost: estimated vs actual

- **Notes/Terms textarea:**
  - Editable field for invoice notes

- **Action buttons:**
  - "Print Invoice" → `window.print()` (print CSS hides non-print elements)
  - "Share Link" → generates public URL, shows copy-to-clipboard
  - "Generate Invoice" (only if no invoice exists yet)

---

### Task 12: Payment Recording UI

**Files:**
- Create: `src/components/invoices/payment-form.tsx`
- Create: `src/components/invoices/payment-history.tsx`

**Payment Form component (`payment-form.tsx`):**
- Shown on the invoice page below the totals
- **Payment method selector:**
  - Grid of large buttons with icons (from PAYMENT_METHOD_OPTIONS constant)
  - Selected method gets highlighted border
  - Active selection changes visible fields:
    - CASH: just amount
    - GCASH/MAYA: amount + reference number. Optionally show shop QR code if `gcash_qr_url` or `maya_qr_url` setting exists
    - BANK_TRANSFER: amount + reference number
    - CREDIT_CARD/DEBIT_CARD: amount + last 4 digits + approval code
    - CHECK: amount + bank name + check date
    - INSURANCE_DIRECT: amount + claim/reference number
- **Amount field:** defaults to remaining balance (editable for partial payment)
- **Reference number field** (conditional)
- **Notes field**
- **"Record Payment" button** → calls `recordPaymentAction`

**Payment History component (`payment-history.tsx`):**
- Table below payment form
- Columns: Date, Method, Reference, Amount, Recorded By
- Each row has a "Void" button (with confirm dialog)
- **Balance summary bar at top:**
  - "Invoice Total: ₱XX,XXX | Paid: ₱XX,XXX | Balance: ₱XX,XXX"
  - If overpaid: "Credit: ₱XX,XXX" in green
- Badge for payment method with appropriate icon

---

## Batch 7: Invoices List + Receipt/Share (2 parallel agents)

### Task 13: Invoices List Page (`src/app/(dashboard)/invoices/page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/invoices/page.tsx` — replace placeholder
- Create: `src/lib/services/invoice-list.ts` — list query (or add to invoices.ts)

**Service function — `getInvoices(params)`:**
- Same pattern as `getJobOrders` in `src/lib/services/job-orders.ts`
- Paginated, searchable, filterable by paymentStatus
- Search by: invoiceNumber, customer firstName/lastName, vehicle plateNumber
- Include: job order (customer, vehicle), payment count
- Calculate aging: `daysOutstanding = Math.ceil((Date.now() - createdAt) / (1000*60*60*24))`

**Page component:**
- Use `DataTable` pattern from customers/vehicles pages
- **Status tabs:** All | Unpaid | Partial | Fully Paid (from `INVOICE_STATUS_TABS`)
- **Columns:**
  - Invoice # (link to job invoice tab)
  - Customer name
  - Vehicle (plate number)
  - Total (₱ formatPeso)
  - Paid (₱ formatPeso)
  - Balance (₱ formatPeso)
  - Status (Badge)
  - Date (formatDate)
- **Aging indicators** on the Balance column for UNPAID/PARTIAL:
  - 0-30 days: green text
  - 31-60 days: yellow text
  - 61-90 days: orange text
  - 90+ days: red text + bold
- Search bar + sort by columns
- Click row → navigates to `/jobs/[jobOrderId]/invoice`

---

### Task 14: Receipt + Public Invoice Share

**Files:**
- Create: `src/app/(dashboard)/jobs/[id]/invoice/receipt/[paymentId]/page.tsx` — thermal receipt page
- Create: `src/app/view/invoice/[token]/page.tsx` — public invoice view
- Create: `src/app/api/invoices/[id]/share/route.ts` — generate share token API

**Thermal Receipt Page:**
- Server component: fetch payment data via `getReceiptData(paymentId)`
- Standalone HTML page (no dashboard layout — uses a minimal layout)
- **Print CSS:** `@page { size: 80mm auto; margin: 0; }`, monospace font, narrow margins
- Content:
  - Shop name (centered, bold)
  - Shop address, phone, TIN
  - Divider line (dashes)
  - "OFFICIAL RECEIPT" heading
  - OR number, date
  - Customer name
  - Divider
  - Payment: method, reference #, amount
  - "Amount Paid: ₱X,XXX.XX"
  - Running balance: "Balance After: ₱X,XXX.XX"
  - Divider
  - "Thank you!" message
- **Print button** at top (hidden in print): `window.print()`
- Hide browser chrome: `@media print { .no-print { display: none; } }`

**Public Invoice View (`/view/invoice/[token]`):**
- Server component: fetch invoice by token via `getInvoiceByToken(token)`
- If not found: show "Invoice not found" message
- **Document-style layout** (not a "web page with a print button"):
  - `max-width: 800px`, centered, white background
  - Shop header: logo, name, address, phone, email, TIN
  - "INVOICE" heading with invoice number
  - Customer + vehicle info
  - Line items table grouped with subtotals (same as internal view but read-only)
  - Tax breakdown
  - Grand Total (prominent)
  - Payment status badge
  - Payment instructions / notes
  - For insurance: show insurance vs copay split
- **Print button** floating at bottom right (hidden in print)
- NO auth required (public route)
- Add `approve` pattern to middleware exclusion for `/view/invoice`

---

## Batch 8: Integration Wiring + Final Verification

### Task 15: Auto-Generate Invoice on QC Pass + Wiring

**Files:**
- Modify: `src/lib/services/qc.ts` — in `submitQCInspection`, when PASSED, call `generateInvoice`
- Modify: `src/middleware.ts` — add `/view` to exclusion list for public invoice view
- Modify: `src/app/(dashboard)/jobs/[id]/layout.tsx` — ensure QC and Invoice tabs are properly linked

**QC Pass → Invoice auto-generation:**
In the `submitQCInspection` function, after setting `QC_PASSED`:
```typescript
// Auto-generate invoice
const { generateInvoice } = await import("@/lib/services/invoices");
await generateInvoice(jobOrderId, inspectorId);
```

**Middleware update:**
Add `"view"` to the public paths exclusion in `src/middleware.ts`.

**Job status flow verification:**
- `QC_PENDING` → QC inspection created
- QC submitted with all PASS → `QC_PASSED` → Invoice auto-generated → `AWAITING_PAYMENT`
- QC submitted with FAIL → `QC_FAILED_REWORK` → rework tasks created
- Rework tasks completed → `QC_PENDING` → re-inspection
- Payment PARTIAL → `PARTIAL_PAYMENT`
- Payment FULL → `FULLY_PAID` → (Phase 8 will handle `AWAITING_RELEASE`)

### Task 16: Final Build Verification

**Run:** `rm -rf .next && npx next build`

**Expected:** 0 errors, all routes compile including:
- `/jobs/[id]/qc` — QC inspection page
- `/jobs/[id]/invoice` — Invoice page
- `/jobs/[id]/invoice/receipt/[paymentId]` — Thermal receipt
- `/invoices` — Invoices list
- `/view/invoice/[token]` — Public invoice view
- All existing routes still work

**Verify checklist from spec:**
- [ ] Complete all QC items as Pass → job moves to QC_PASSED → invoice auto-generated
- [ ] Fail 2 QC items → rework tasks created with REWORK badge → complete rework → re-inspection shows only failed items → pass → QC_PASSED
- [ ] Invoice shows correct line items from estimate + supplements
- [ ] Toggle billing mode → totals recalculate
- [ ] Apply discount → total updates, reason note saved
- [ ] Record GCash partial → PARTIAL → record cash remaining → FULLY_PAID → job moves to AWAITING_RELEASE (via FULLY_PAID)
- [ ] Split payment across 3 methods → all 3 records visible
- [ ] Thermal receipt prints correctly (80mm @page CSS)
- [ ] Invoices list shows aging colors
- [ ] Insurance job: invoice shows insurance vs customer copay
- [ ] Rework hours tracked separately

---

## Summary: Task Count & Batching

| Batch | Tasks | Agents | Description |
|-------|-------|--------|-------------|
| 1 | 1, 2 | 2 parallel | Schema + seed + validators |
| 2 | 3, 4 | 2 parallel | QC service + actions |
| 3 | 5, 6 | 2 parallel | QC UI + QC overview summary |
| 4 | 7, 8 | 2 parallel | Invoice service + actions |
| 5 | 9, 10 | 2 parallel | Payment service + actions |
| 6 | 11, 12 | 2 parallel | Invoice UI + payment UI |
| 7 | 13, 14 | 2 parallel | Invoices list + receipt/share |
| 8 | 15, 16 | sequential | Integration wiring + final build |

**Total: 16 tasks, 8 batches**

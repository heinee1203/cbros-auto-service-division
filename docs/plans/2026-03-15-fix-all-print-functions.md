# Fix ALL Print Functions — Dedicated Print Routes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace every `window.print()` on dashboard pages with `window.open()` to dedicated print routes, and add global print CSS as a safety net.

**Architecture:** Dashboard print buttons open public/standalone routes in new tabs. Public routes (`/view/*`) already render clean documents without app chrome — reuse them. Analytics reports keep `window.print()` with enhanced CSS. Global `@media print` in `globals.css` hides sidebar/topbar on any Ctrl+P.

**Tech Stack:** Next.js 14, React, Tailwind CSS, Prisma (for receipt token generation)

---

### Task 1: Add Global Print CSS Safety Net

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add `@media print` block to `globals.css`**

Append after the existing `@layer utilities` block:

```css
/* Global print safety net — hides app chrome on any Ctrl+P */
@media print {
  /* Hide app shell */
  [data-sidebar],
  [data-topbar],
  nav:not(.print-nav),
  aside,
  .mobile-bottom-nav,
  .global-search,
  .no-print {
    display: none !important;
  }

  /* Remove layout constraints */
  main {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  body {
    background: white !important;
  }
}
```

**Step 2: Verify**

Open any dashboard page, press Ctrl+P (or use browser print preview). Sidebar and topbar should be hidden.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add global print CSS safety net to hide app chrome"
```

---

### Task 2: Fix Invoice Print — Use Existing `/view/invoice/[token]`

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/invoice/invoice-client.tsx`

**Context:** The invoice already has a "Share Link" feature that generates a `shareToken` via `generateShareLinkAction()`. The public route `/view/invoice/[token]` already renders a clean standalone invoice. The `invoice` prop (typed as `any`) includes `shareToken` when it exists.

**Step 1: Change Print Invoice button to open public route**

In `invoice-client.tsx`, find the Print Invoice button (~line 957-963):

```tsx
// CURRENT (line 957-963):
<button
  onClick={() => window.print()}
  className="flex items-center gap-2 border border-surface-300 text-surface-600 hover:bg-surface-50 px-4 py-2 rounded-lg text-sm font-medium"
>
  <Printer className="h-4 w-4" />
  Print Invoice
</button>
```

Replace with:

```tsx
<button
  onClick={() => {
    if (invoice.shareToken) {
      window.open(`/view/invoice/${invoice.shareToken}`, '_blank');
    } else {
      // Generate token first, then open
      startTransition(async () => {
        const result = await generateShareLinkAction(invoice.id, job.id);
        if (result.success && result.data?.token) {
          window.open(`/view/invoice/${result.data.token}`, '_blank');
        } else {
          setError(result.error ?? "Failed to generate print link");
        }
      });
    }
  }}
  disabled={isPending}
  className="flex items-center gap-2 border border-surface-300 text-surface-600 hover:bg-surface-50 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
>
  <Printer className="h-4 w-4" />
  {isPending ? "Opening..." : "Print Invoice"}
</button>
```

**Step 2: Verify**

Navigate to a job's invoice tab. Click "Print Invoice". A new tab should open with the clean `/view/invoice/[token]` page (no sidebar, no topbar). That page has its own floating print button.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/jobs/[id]/invoice/invoice-client.tsx
git commit -m "fix: invoice print opens standalone public route in new tab"
```

---

### Task 3: Fix Completion Report Print — Use Existing `/view/report/[token]`

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/release/report/report-client.tsx`
- Modify: `src/app/(dashboard)/jobs/[id]/release/report/page.tsx`

**Context:** The report page already generates a `completionReportToken` (on ReleaseRecord model, line 796 in schema). The public route `/view/report/[token]` renders a clean standalone report. We need to pass the token to the client component.

**Step 1: Pass `completionReportToken` from page.tsx to ReportClient**

In `page.tsx`, the `release` object already has `completionReportToken`. Find where `<ReportClient />` is rendered and add the token prop:

```tsx
// Change from:
<ReportClient />

// To:
<ReportClient completionReportToken={release.completionReportToken} />
```

**Step 2: Update ReportClient to accept token and use `window.open()`**

Replace the entire `report-client.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

export default function ReportClient({
  completionReportToken,
}: {
  completionReportToken?: string | null;
}) {
  const router = useRouter();

  return (
    <div className="no-print flex items-center gap-3 mb-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 px-4 py-2 text-sm border border-surface-300 rounded-lg hover:bg-surface-50"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <button
        onClick={() => {
          if (completionReportToken) {
            window.open(`/view/report/${completionReportToken}`, '_blank');
          } else {
            window.print(); // fallback if no token
          }
        }}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-accent-600 text-white rounded-lg hover:bg-accent-700"
      >
        <Printer className="w-4 h-4" /> Print Report
      </button>
    </div>
  );
}
```

**Step 3: Verify**

Navigate to a released job's report page. Click "Print Report". A new tab should open with the clean `/view/report/[token]` page.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/jobs/[id]/release/report/report-client.tsx src/app/(dashboard)/jobs/[id]/release/report/page.tsx
git commit -m "fix: completion report print opens standalone public route in new tab"
```

---

### Task 4: Create Standalone Receipt Route at `/view/receipt/[paymentId]`

**Files:**
- Create: `src/app/view/receipt/[paymentId]/page.tsx`

**Context:** The thermal receipt currently lives inside the dashboard layout at `/jobs/[id]/invoice/receipt/[paymentId]`. We need a standalone route outside the dashboard layout. The `ReceiptContent` component and `getReceiptData` service function already exist and can be reused. The `/view/` path is already excluded from auth middleware.

**Step 1: Create the standalone receipt page**

Create `src/app/view/receipt/[paymentId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getReceiptData } from "@/lib/services/payments";
import { ReceiptContent } from "@/app/(dashboard)/jobs/[id]/invoice/receipt/[paymentId]/receipt-client";

interface ReceiptPageProps {
  params: Promise<{ paymentId: string }>;
}

export default async function PublicReceiptPage({ params }: ReceiptPageProps) {
  const { paymentId } = await params;

  let data;
  try {
    data = await getReceiptData(paymentId);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const serializedData = {
    shopInfo: data.shopInfo,
    payment: {
      id: data.payment.id,
      amount: data.payment.amount,
      method: data.payment.method,
      referenceNumber: data.payment.referenceNumber,
      paidAt: data.payment.paidAt.toISOString(),
      notes: data.payment.notes,
    },
    invoice: {
      invoiceNumber: data.invoice.invoiceNumber,
      grandTotal: data.invoice.grandTotal,
      orNumber: data.invoice.orNumber,
    },
    customer: {
      firstName: data.customer.firstName,
      lastName: data.customer.lastName,
      company: data.customer.company,
    },
    totalPaidUpToThis: data.totalPaidUpToThis,
    runningBalance: data.runningBalance,
  };

  return <ReceiptContent data={serializedData} />;
}
```

**Important note:** The import path for `ReceiptContent` references the dashboard receipt-client. If this import causes issues due to the bracket path, extract `ReceiptContent` to a shared location like `src/components/receipt/receipt-content.tsx` instead.

**Step 2: Update dashboard receipt page to use `window.open()` instead of `window.print()`**

In `src/app/(dashboard)/jobs/[id]/invoice/receipt/[paymentId]/receipt-client.tsx`, change the Print Receipt button (line 63-65):

```tsx
// CURRENT:
onClick={() => window.print()}

// CHANGE TO:
onClick={() => window.open(`/view/receipt/${data.payment.id}`, '_blank')}
```

**Step 3: Also update the "Print Receipt" button on the invoice tab**

Search `invoice-client.tsx` for any "Print Receipt" button that navigates to the dashboard receipt page. If it uses `router.push()`, change to `window.open('/view/receipt/${paymentId}', '_blank')`.

**Step 4: Verify**

Navigate to an invoice tab → find a payment → click "Print Receipt". A new tab opens with just the thermal receipt (80mm width, no sidebar).

**Step 5: Commit**

```bash
git add src/app/view/receipt/[paymentId]/page.tsx src/app/(dashboard)/jobs/[id]/invoice/receipt/[paymentId]/receipt-client.tsx
git commit -m "feat: add standalone receipt route at /view/receipt/[paymentId]"
```

---

### Task 5: Enhance Analytics Reports Print CSS

**Files:**
- Modify: `src/app/(dashboard)/analytics/reports/reports-client.tsx`

**Context:** 9 report types, all using `window.print()` at line 407. Creating 9 standalone routes is overkill. Instead, enhance the print CSS already in the component to comprehensively hide all app chrome and make the report fill the page.

**Step 1: Find and replace the existing `<style>` block in reports-client.tsx**

Find the existing print CSS (search for `@media print`):

```tsx
// CURRENT:
<style>{`
  @media print {
    .no-print { display: none !important; }
    .print-full { width: 100% !important; max-width: 100% !important; }
    body { font-size: 12px; }
  }
`}</style>
```

Replace with:

```tsx
<style>{`
  @media print {
    /* Hide ALL app chrome */
    .no-print,
    nav, aside, header,
    [data-sidebar], [data-topbar],
    .mobile-bottom-nav,
    .global-search { display: none !important; }

    /* Full-width report content */
    main {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    .print-full {
      width: 100% !important;
      max-width: 100% !important;
    }

    body {
      background: white !important;
      font-size: 12px;
    }

    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  }
`}</style>
```

**Step 2: Keep `window.print()`** — This is acceptable for analytics reports since the enhanced CSS now hides all chrome.

**Step 3: Verify**

Open Analytics → Reports → Generate any report → Click "Print / PDF". Print preview should show ONLY the report data table with no sidebar, topbar, or buttons.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/analytics/reports/reports-client.tsx
git commit -m "fix: enhance analytics reports print CSS to hide all app chrome"
```

---

### Task 6: Verify All Existing Public Print Routes

**Files:** (read-only verification, no changes expected)
- `src/app/view/estimate/[token]/page.tsx` + `print-button.tsx`
- `src/app/view/invoice/[token]/page.tsx` + `print-button.tsx`
- `src/app/view/report/[token]/page.tsx` + `print-button.tsx`

**Step 1:** Verify estimate print: Go to an estimate detail → click "Print / View Estimate" → new tab opens `/view/estimate/[token]` → clean A4 document, no app chrome. ✓

**Step 2:** Verify invoice print: Test via Task 2 flow above. ✓

**Step 3:** Verify completion report print: Test via Task 3 flow above. ✓

**Step 4:** Verify all three public routes have `@media print` CSS that hides their floating print buttons.

---

### Task 7: Final Build Verification

**Step 1: Run build**

```bash
npx next build
```

Expected: 0 errors. New routes should appear in the route list.

**Step 2: Manual smoke test checklist**

- [ ] Invoice: "Print Invoice" opens `/view/invoice/[token]` in new tab
- [ ] Receipt: "Print Receipt" opens `/view/receipt/[paymentId]` in new tab
- [ ] Completion Report: "Print Report" opens `/view/report/[token]` in new tab
- [ ] Estimate: "Print / View Estimate" opens `/view/estimate/[token]` in new tab (already working)
- [ ] Analytics: "Print / PDF" shows clean print preview (no sidebar/topbar)
- [ ] Ctrl+P on any dashboard page: sidebar/topbar hidden via global CSS
- [ ] All public routes (`/view/*`) render without auth (middleware excludes `view`)

**Step 3: Commit any final fixes and tag**

```bash
git add -A
git commit -m "fix: all print functions use dedicated routes, no app chrome in prints"
```

# Phase 8: Release / Vehicle Handover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete vehicle release/handover workflow — pre-release validation, release wizard (6 steps), before/after comparison viewer, belongings return checklist, warranty auto-creation, follow-up scheduling, completion report (printable + public shareable), and customer report portal.

**Architecture:** Release follows the intake wizard pattern (multi-step client component with server data fetching). Completion report uses the same `window.print()` + print CSS approach as invoices. Public report route mirrors `/view/invoice/[token]`. Warranties auto-created per service category with durations from Settings. Follow-ups stored as future-dated Notification records with `scheduledAt` field.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma/SQLite, Tailwind CSS, Zod, Server Actions, `qrcode` npm package for QR SVG generation, CSS clip-path for before/after slider.

---

## Batch 1: Schema + Seeds + Enums + Install (2 parallel agents)

### Task 1: Schema Migration + Warranty Seed Settings

**Files:**
- Modify: `prisma/schema.prisma` — add fields to ReleaseRecord and Notification
- Modify: `prisma/seed.ts` — add warranty duration + care instruction settings

**Schema changes to `ReleaseRecord`:**
Add after `deletedAt`:
```prisma
  completionReportToken String? @unique
  belongingsNotes       String?
```

**Schema changes to `Notification`:**
Add after `metadata`:
```prisma
  scheduledAt     DateTime?  // for future-dated notifications (follow-ups)
```
Add index:
```prisma
  @@index([scheduledAt])
```

**Run:** `npx prisma db push`

**Seed data to add** (in the settings upsert array in `prisma/seed.ts`):

Warranty durations (add after existing warranty settings):
```typescript
{ key: "warranty_duration_detailing", value: "6", category: "warranty", description: "Detailing warranty duration in months" },
{ key: "warranty_duration_undercoating", value: "12", category: "warranty", description: "Undercoating warranty duration in months" },
{ key: "warranty_duration_ppf", value: "60", category: "warranty", description: "PPF warranty duration in months" },
{ key: "warranty_duration_restoration", value: "12", category: "warranty", description: "Car restoration warranty duration in months" },
```

Care instructions (new settings):
```typescript
{ key: "care_instructions_paint", value: "Avoid washing for 7 days. Avoid automatic car washes for 30 days. No waxing for 60 days. Hand wash only with pH-neutral shampoo.", category: "care_instructions", description: "Care instructions for paint/repaint jobs" },
{ key: "care_instructions_ceramic_coating", value: "Avoid water for 24 hours. No soap wash for 7 days. First maintenance wash at 2 weeks. Use pH-neutral shampoo only.", category: "care_instructions", description: "Care instructions for ceramic coating" },
{ key: "care_instructions_undercoating", value: "Allow 48 hours for full cure. Avoid pressure washing underbody for 1 week. Inspect annually.", category: "care_instructions", description: "Care instructions for undercoating" },
{ key: "care_instructions_ppf", value: "No washing for 48 hours. Avoid pressure washer on film edges. Use pH-neutral shampoo. No abrasive polishing on film.", category: "care_instructions", description: "Care instructions for PPF" },
{ key: "care_instructions_detailing", value: "Maintain with pH-neutral shampoo. Avoid automatic car washes. Use microfiber towels only. Re-apply coating maintenance spray monthly.", category: "care_instructions", description: "Care instructions for detailing" },
{ key: "care_instructions_collision", value: "Avoid high-pressure washing on repaired areas for 14 days. Check for any paint chips or bubbling within first month.", category: "care_instructions", description: "Care instructions for collision repair" },
```

Warranty terms template:
```typescript
{ key: "warranty_terms_template", value: "This warranty covers defects in workmanship and materials for the specified service. Normal wear and tear, accident damage, and modifications by third parties are excluded. To make a claim, contact us at the shop phone number with your completion report reference.", category: "warranty", description: "Default warranty terms template" },
```

### Task 2: Enums + Constants + Validators + Install qrcode

**Files:**
- Modify: `src/types/enums.ts` — add new notification types, release-related labels
- Modify: `src/lib/constants.ts` — add release wizard steps, warranty category mapping
- Modify: `src/lib/validators.ts` — add release validation schemas
- Install: `qrcode` npm package

**Enum additions to `src/types/enums.ts`:**

Add to `NotificationType`:
```typescript
FOLLOW_UP_SATISFACTION: "FOLLOW_UP_SATISFACTION",
FOLLOW_UP_SURVEY: "FOLLOW_UP_SURVEY",
FOLLOW_UP_MAINTENANCE: "FOLLOW_UP_MAINTENANCE",
WARRANTY_EXPIRY: "WARRANTY_EXPIRY",
```

Add release display labels:
```typescript
export const RELEASE_STEP_LABELS: Record<number, string> = {
  0: "Release Photos",
  1: "Before/After Review",
  2: "Belongings Return",
  3: "Vehicle Condition",
  4: "Warranty & Care",
  5: "Sign-Off",
};
```

**Constants additions to `src/lib/constants.ts`:**

```typescript
// Phase 8: Release wizard steps
export const RELEASE_WIZARD_STEPS = [
  { id: 0, label: "Photos", icon: "Camera" },
  { id: 1, label: "Before/After", icon: "Columns" },
  { id: 2, label: "Belongings", icon: "Package" },
  { id: 3, label: "Condition", icon: "Gauge" },
  { id: 4, label: "Warranty", icon: "Shield" },
  { id: 5, label: "Sign-Off", icon: "PenTool" },
] as const;

// Service category → warranty setting key mapping
export const SERVICE_WARRANTY_MAP: Record<string, { durationKey: string; careKey: string; label: string }> = {
  "Collision Repair": { durationKey: "warranty_collision_repair_months", careKey: "care_instructions_collision", label: "Collision Repair" },
  "Painting & Refinishing": { durationKey: "warranty_full_repaint_months", careKey: "care_instructions_paint", label: "Paint / Refinishing" },
  "Buffing & Paint Correction": { durationKey: "warranty_duration_detailing", careKey: "care_instructions_detailing", label: "Paint Correction" },
  "Car Detailing": { durationKey: "warranty_duration_detailing", careKey: "care_instructions_detailing", label: "Car Detailing" },
  "Undercoating & Rust Protection": { durationKey: "warranty_duration_undercoating", careKey: "care_instructions_undercoating", label: "Undercoating" },
  "Car Restoration": { durationKey: "warranty_duration_restoration", careKey: "care_instructions_collision", label: "Car Restoration" },
};

// Minimum required release photos (same count as intake base walkaround)
export const MIN_RELEASE_PHOTOS = 10; // At least 10 of the 18 walkaround angles
```

**Validators to add to `src/lib/validators.ts`:**

```typescript
export const releaseRecordSchema = z.object({
  odometerReading: z.coerce.number().int().min(0).optional().nullable(),
  fuelLevel: z.string().optional().nullable(),
  belongingsReturned: z.boolean().optional(),
  belongingsNotes: z.string().optional().nullable(),
  fuelLevelMatches: z.boolean().optional(),
  keysReturned: z.boolean().optional(),
  customerSatisfied: z.boolean().optional(),
  warrantyExplained: z.boolean().optional(),
  careInstructionsGiven: z.boolean().optional(),
  customerSignature: z.string().optional().nullable(),
  advisorSignature: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ReleaseRecordInput = z.infer<typeof releaseRecordSchema>;

export const belongingReturnSchema = z.object({
  belongingId: z.string().min(1),
  isReturned: z.boolean(),
  notes: z.string().optional().nullable(),
});
```

**Install qrcode:**
```bash
npm install qrcode
npm install -D @types/qrcode
```

**Verify:** `npx tsc --noEmit`

---

## Batch 2: Release Service + Actions (2 parallel agents)

### Task 3: Release Service (`src/lib/services/release.ts`)

**Files:**
- Create: `src/lib/services/release.ts`

**Pattern:** Follow `src/lib/services/invoices.ts` and `src/lib/services/qc.ts`

**Imports:**
```typescript
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/job-activities";
import { SERVICE_WARRANTY_MAP, MIN_RELEASE_PHOTOS } from "@/lib/constants";
import { WALKAROUND_SHOTS } from "@/lib/constants";
import crypto from "crypto";
```

**Functions to implement:**

1. **`validatePreRelease(jobOrderId: string)`** → `Promise<{ valid: boolean; issues: string[] }>`
   - Check all tasks are DONE: `prisma.task.count({ where: { jobOrderId, status: { not: "DONE" }, deletedAt: null } })` — if > 0, add issue
   - Check QC passed: `prisma.qCInspection.findFirst({ where: { jobOrderId, overallResult: "PASSED", deletedAt: null } })` — if null, add issue
   - Check invoice fully paid: `prisma.invoice.findFirst({ where: { jobOrderId, isLatest: true, paymentStatus: "PAID", deletedAt: null } })` — if null, add issue "Invoice not fully paid"
   - Check release photos: `prisma.photo.count({ where: { entityType: "JOB_ORDER", entityId: jobOrderId, stage: "RELEASE", deletedAt: null } })` — if < `MIN_RELEASE_PHOTOS`, add issue
   - Check belongings: fetch intake record, get `IntakeBelonging` records where `isReturned: false, deletedAt: null` — if count > 0, add issue
   - Return `{ valid: issues.length === 0, issues }`

2. **`createReleaseRecord(jobOrderId: string, userId: string)`** → Promise
   - Check if one already exists for this job (unique constraint on jobOrderId)
   - Generate `completionReportToken`: `crypto.randomUUID()`
   - Create ReleaseRecord with defaults
   - Log activity: "Release process initiated"
   - Return the record

3. **`updateReleaseRecord(releaseId: string, data: Partial<ReleaseRecordInput>, userId: string)`** → Promise
   - Update the specified fields
   - If `customerSignature` provided, set `customerSignedAt: new Date()`
   - If `advisorSignature` provided, set `advisorSignedAt: new Date()`, `advisorId: userId`
   - Return updated record

4. **`completeRelease(releaseId: string, userId: string)`** → Promise
   - Fetch the release record with job order (include customer, vehicle, estimates → estimateRequest.requestedCategories)
   - **Validate completeness:**
     - Both signatures present
     - `customerSatisfied: true`
     - `warrantyExplained: true`
     - `careInstructionsGiven: true`
     - `belongingsReturned: true` OR `belongingsNotes` is not empty
     - Throw error if any validation fails
   - **In a transaction:**
     - Update job status → `RELEASED`
     - Set `releaseDate: new Date()` on the release record
     - Set follow-up dates on release record:
       - `followUp7DayDate: addDays(releaseDate, 7)`
       - `followUp30DayDate: addDays(releaseDate, 30)`
       - `followUp6MonthDate: addDays(releaseDate, 180)`
       - `followUp1YearDate: addDays(releaseDate, 365)`
   - **Create Warranty records** (outside transaction is fine):
     - Get service categories from job's estimate request `requestedCategories`
     - For each category that has a `SERVICE_WARRANTY_MAP` entry:
       - Fetch duration from Settings (e.g., `warranty_collision_repair_months`)
       - Fetch terms from `warranty_terms_template` setting
       - Calculate `endDate = addMonths(releaseDate, durationMonths)`
       - Create Warranty record with `status: "ACTIVE"`, linking to jobOrderId, vehicleId, customerId
   - **Schedule follow-up Notifications:**
     - Fetch follow-up enabled settings
     - For each enabled follow-up, create Notification record with `scheduledAt`:
       - 7-day: type `FOLLOW_UP_SATISFACTION`, message: "How's your [Make Model]? Any concerns with the work?"
       - 30-day: type `FOLLOW_UP_SURVEY`, message: "We'd love your feedback on the service."
       - 6-month (only for coating/PPF/detailing services): type `FOLLOW_UP_MAINTENANCE`
       - Warranty expiry - 30 days: type `WARRANTY_EXPIRY`, for each warranty created
     - Recipient: find ADVISOR users (or the job's assigned advisor if known)
   - **Log activity:** "Vehicle released to [Customer FirstName LastName]"
   - Return the release record

5. **`getReleaseRecord(jobOrderId: string)`** → Promise
   - Fetch with job order, customer, vehicle info
   - Include intake record (for comparison data: fuel level, odometer)

6. **`getBeforeAfterPhotos(jobOrderId: string)`** → Promise
   - Fetch intake photos: `entityType: "JOB_ORDER"` OR `entityType: "INTAKE"`, `stage: "INTAKE"`, for this job
   - Actually, intake photos use `entityType` and `entityId` pointing to the intake record. Check the photo upload pattern:
     - Intake photos: `entityType: "INTAKE"`, `entityId: intakeRecord.id`
     - Release photos: `entityType: "JOB_ORDER"`, `entityId: jobOrderId`, `stage: "RELEASE"`
   - Need to fetch the intakeRecordId first from the job's intake record
   - Match by `category` field (e.g., "front_full", "left_side_full")
   - Return: `{ pairs: Array<{ angle: string, label: string, intake: Photo | null, release: Photo | null }>, unmatchedIntake: Photo[], unmatchedRelease: Photo[] }`
   - Use `WALKAROUND_SHOTS` to map category IDs to labels

7. **`getCompletionReportData(token: string)`** → Promise
   - Find release record by `completionReportToken`
   - If not found, return null
   - Fetch: job order, customer, vehicle, estimates (services performed), before/after photos, warranties, intake record
   - Fetch shop settings (name, address, phone, tin, logo)
   - Fetch care instructions from Settings
   - Return all data needed for the report render

**Helper — `addDays(date, days)` and `addMonths(date, months)`:**
```typescript
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
```

### Task 4: Release Actions (`src/lib/actions/release-actions.ts`)

**Files:**
- Create: `src/lib/actions/release-actions.ts`

**Pattern:** Follow `src/lib/actions/invoice-actions.ts` exactly.

**Imports:**
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { releaseRecordSchema, belongingReturnSchema } from "@/lib/validators";
import * as releaseService from "@/lib/services/release";
import { prisma } from "@/lib/prisma";
```

**ActionResult type** (define locally, same pattern):
```typescript
export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  warning?: string;
};
```

**Actions:**

1. **`validatePreReleaseAction(jobOrderId: string)`** — permission: `release:create`
   - Calls `releaseService.validatePreRelease(jobOrderId)`
   - Returns `{ success: true, data: { valid, issues } }`

2. **`createReleaseAction(jobOrderId: string)`** — permission: `release:create`
   - Calls `releaseService.createReleaseRecord(jobOrderId, session.user.id)`
   - Revalidate `/jobs/${jobOrderId}`
   - Returns `{ success: true, data: { id: record.id } }`

3. **`updateReleaseAction(releaseId: string, jobOrderId: string, data: unknown)`** — permission: `release:create`
   - Validate with `releaseRecordSchema.partial().safeParse(data)`
   - Calls `releaseService.updateReleaseRecord(releaseId, parsed.data, session.user.id)`
   - Revalidate `/jobs/${jobOrderId}`

4. **`completeReleaseAction(releaseId: string, jobOrderId: string)`** — permission: `release:create`
   - Calls `releaseService.completeRelease(releaseId, session.user.id)`
   - Revalidate `/jobs/${jobOrderId}` and `/customers`

5. **`returnBelongingAction(jobOrderId: string, data: unknown)`** — permission: `release:create`
   - Validate with `belongingReturnSchema.safeParse(data)`
   - Update `IntakeBelonging` record: set `isReturned`, `returnedAt`, and optionally add notes
   - Revalidate `/jobs/${jobOrderId}`

**Verify:** `npx tsc --noEmit`

---

## Batch 3: Before/After Viewer + Belongings Return (2 parallel agents)

### Task 5: Before/After Comparison Viewer (`src/components/release/before-after-viewer.tsx`)

**Files:**
- Create: `src/components/release/before-after-viewer.tsx`

**`"use client"` component.**

**Props:**
```typescript
interface PhotoPair {
  angle: string;
  label: string;
  intake: { id: string; fullSizePath: string; thumbnailPath: string } | null;
  release: { id: string; fullSizePath: string; thumbnailPath: string } | null;
}

interface BeforeAfterViewerProps {
  pairs: PhotoPair[];
  unmatchedIntake?: Array<{ id: string; category: string | null; thumbnailPath: string; fullSizePath: string }>;
  unmatchedRelease?: Array<{ id: string; category: string | null; thumbnailPath: string; fullSizePath: string }>;
}
```

**Two viewing modes** toggled by a segmented control at the top:

**Mode 1 — Side-by-Side Grid:**
- 2-column grid: intake left, release right
- Each pair has angle label above (e.g., "Front — full")
- If only one side has a photo, show placeholder on the other
- Scrollable, responsive (1 col on mobile, 2 cols on desktop)

**Mode 2 — Slider Overlay:**
- Single photo view with angle selector dropdown/arrows
- Two `<img>` elements stacked absolutely
- Release photo on top with CSS `clip-path: inset(0 ${100 - sliderPos}% 0 0)`
- Vertical divider line at slider position
- Touch/mouse drag to control slider via `onMouseDown`/`onTouchStart` + move handlers
- Show "BEFORE" label on left side, "AFTER" on right side
- Arrow buttons to cycle through pairs

**Styling:**
- Card wrapper: `bg-white rounded-lg border border-surface-200 overflow-hidden`
- Mode toggle: `flex bg-surface-100 rounded-lg p-1` with active tab in `bg-white shadow-sm`
- Image labels: `text-xs font-medium text-surface-500 uppercase tracking-wider`

### Task 6: Belongings Return Checklist (`src/components/release/belongings-return.tsx`)

**Files:**
- Create: `src/components/release/belongings-return.tsx`

**`"use client"` component.**

**Props:**
```typescript
interface Belonging {
  id: string;
  description: string;
  condition: string | null;
  isReturned: boolean;
}

interface BelongingsReturnProps {
  belongings: Belonging[];
  jobOrderId: string;
  onUpdate?: () => void;
}
```

**Layout:**
- Summary badge at top: "X of Y items returned" — green if all, amber if partial
- Checklist of items, each with:
  - Checkbox (checked = returned)
  - Description text
  - Condition note from intake (italic, smaller text)
  - When unchecked: "Not Returned" label + required notes textarea expands
  - When checked: "Returned ✓" label in green
- Each checkbox change calls `returnBelongingAction(jobOrderId, { belongingId, isReturned, notes })`
- Use `useTransition` for pending states
- If no belongings from intake: show "No belongings were recorded during intake" message

---

## Batch 4: Release Wizard UI (1 agent — large task)

### Task 7: Release Wizard Server + Client Components

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/release/page.tsx` — replace placeholder with server component
- Create: `src/app/(dashboard)/jobs/[id]/release/release-wizard-client.tsx` — multi-step client component

**Server component (`page.tsx`):**
```typescript
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getReleaseRecord, getBeforeAfterPhotos, validatePreRelease } from "@/lib/services/release";
import ReleaseWizardClient from "./release-wizard-client";
```

- Fetch job order with customer, vehicle, intake record (fuel, odometer, belongings)
- Fetch release record (if exists) via `getReleaseRecord`
- Fetch before/after photos via `getBeforeAfterPhotos`
- Fetch pre-release validation via `validatePreRelease`
- Fetch service categories from estimate request
- Fetch warranty settings and care instructions from Settings
- Fetch existing release photos (stage: "RELEASE")
- Pass all serialized data to client component

**Client component (`release-wizard-client.tsx`):**

Follow the exact pattern from `src/app/(dashboard)/jobs/[id]/intake/intake-wizard-client.tsx`:
- `useState` for current step (0-5)
- `StepIndicator` component for progress (reuse from intake)
- Back/Next navigation buttons
- Each step renders a different section

**Props interface:**
```typescript
interface ReleaseWizardClientProps {
  jobOrderId: string;
  jobOrderNumber: string;
  releaseRecord: ReleaseRecordData | null;
  vehicle: { plateNumber: string; make: string; model: string; year: number | null; color: string };
  customer: { firstName: string; lastName: string; phone: string };
  intakeRecord: {
    id: string;
    fuelLevel: string | null;
    odometerReading: number | null;
  };
  belongings: Array<{ id: string; description: string; condition: string | null; isReturned: boolean }>;
  serviceCategories: string[];
  beforeAfterPairs: PhotoPair[];
  unmatchedIntake: Photo[];
  unmatchedRelease: Photo[];
  existingReleasePhotos: Photo[];
  preReleaseValidation: { valid: boolean; issues: string[] };
  warrantyInfo: Array<{ category: string; label: string; durationMonths: number; careInstructions: string; terms: string }>;
  canRelease: boolean;
}
```

**Step 0 — Release Photos:**
- Reuse `WalkaroundCapture` component with modified props:
  - `intakeRecordId` → use job order ID as entity
  - `stage: "RELEASE"` for photo uploads
  - Show intake thumbnails as reference: for each walkaround angle, show the intake photo as a small thumbnail below the capture button with label "Match this angle"
- Actually, `WalkaroundCapture` is tightly coupled to intake. Better approach: create a lightweight wrapper that:
  - Lists the `WALKAROUND_SHOTS` angles
  - For each, shows intake thumbnail as reference
  - Has a camera/upload button
  - Uploads via the existing `/api/photos/upload` endpoint with `entityType: "JOB_ORDER"`, `entityId: jobOrderId`, `stage: "RELEASE"`, `category: shot.id`
- Progress: "X of Y required photos captured"
- Use existing `existingReleasePhotos` to track which angles are done

**Step 1 — Before/After Review:**
- Render `BeforeAfterViewer` component (Task 5)
- Pass `beforeAfterPairs`, `unmatchedIntake`, `unmatchedRelease`
- Informational step — advisor shows customer on tablet

**Step 2 — Belongings Return:**
- Render `BelongingsReturn` component (Task 6)
- Pass `belongings` and `jobOrderId`

**Step 3 — Vehicle Condition:**
- Final mileage input: number field, show intake mileage for comparison
  - If difference > 100: amber warning "Mileage increased by X km since intake"
- Fuel level: reuse `FuelGauge` component, show intake fuel level for comparison
  - If lower than intake: amber warning "Fuel level is lower than at intake"
- Keys returned checkbox
- All changes call `updateReleaseAction`

**Step 4 — Warranty & Care:**
- For each service in `warrantyInfo`:
  - Card with service name, warranty duration (e.g., "24 months")
  - Start date: release date, End date: calculated
  - Terms text (from Settings)
  - Care instructions text (from Settings)
- "Customer acknowledges warranty terms" checkbox → sets `warrantyExplained` via `updateReleaseAction`
- "Care instructions provided and explained" checkbox → sets `careInstructionsGiven`

**Step 5 — Sign-Off:**
- Summary section: services performed, before/after thumbnail grid (small), warranty terms, care highlights, belongings status
- Customer satisfaction checkbox → `customerSatisfied`
- Customer signature: `SignaturePad` component → saves to `customerSignature` via `updateReleaseAction`
- Advisor signature: `SignaturePad` component → saves to `advisorSignature`
- **"Complete Release" button:**
  - Disabled until: both signatures captured, `customerSatisfied`, `warrantyExplained`, `careInstructionsGiven`, all belongings handled
  - Calls `completeReleaseAction(releaseRecord.id, jobOrderId)`
  - On success: show success message, confetti optional, link to completion report

---

## Batch 5: Completion Report + Public Portal (2 parallel agents)

### Task 8: Completion Report Page

**Files:**
- Create: `src/app/(dashboard)/jobs/[id]/release/report/page.tsx` — printable completion report (inside dashboard)
- Create: `src/app/(dashboard)/jobs/[id]/release/report/report-client.tsx` — client component for print button

**Server component (`report/page.tsx`):**
- Fetch release record, job, customer, vehicle, before/after photos, warranties, care instructions, shop info
- Fetch QR code data URL using `qrcode` package:
  ```typescript
  import QRCode from "qrcode";
  const publicUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/view/report/${releaseRecord.completionReportToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { width: 150, margin: 1 });
  ```
- Render the completion report HTML (server-rendered, no client interactivity needed except print button)

**Report layout (all in one page with CSS page breaks):**

**Cover section** (`page-break-after: always` in print):
- Shop logo (from settings `shop_logo_url`) — if not set, just shop name
- Shop name large, centered
- "VEHICLE SERVICE COMPLETION REPORT" heading
- Vehicle: [Year] [Make] [Model] — [Plate Number]
- Customer: [FirstName LastName]
- Job Order: [JO Number]
- Service Period: [Intake Date] → [Release Date]
- Clean, centered layout with generous spacing

**Scope of Work section** (`page-break-after: always`):
- "SCOPE OF WORK" heading
- List all service categories performed (from estimate's requestedCategories)
- Brief descriptions (from estimate line items — group by category, list descriptions)
- If supplements: "Additional Work" subsection with supplement descriptions

**Before/After section** (`page-break-after: always`):
- "BEFORE & AFTER" heading
- 2-column grid: intake photo left, release photo right
- Each pair labeled by angle
- Use `fullSizePath` for print quality
- Only show matched pairs (skip unmatched)

**Warranty & Care section:**
- "WARRANTY INFORMATION" heading
- For each warranty:
  - Service name
  - Warranty period: [Start Date] — [End Date]
  - Coverage terms
- "CARE INSTRUCTIONS" heading
- Per-service care instructions
- "CONTACT US" section: shop phone, address
- QR code: `<img src={qrDataUrl} />` with caption "Scan for digital version"

**Print CSS:**
```css
@media print {
  @page { size: A4; margin: 15mm; }
  .no-print { display: none !important; }
  .page-break { page-break-before: always; }
  nav, aside, header, [data-sidebar] { display: none !important; }
  main { padding: 0 !important; margin: 0 !important; }
}
```

**Client component (`report-client.tsx`):**
- Just a print button + back button (hidden in print)
- `window.print()` on click

### Task 9: Public Report Portal (`/view/report/[token]`)

**Files:**
- Create: `src/app/view/report/[token]/page.tsx` — public completion report
- Create: `src/app/view/report/[token]/report-view-client.tsx` — client component for interactive slider

**Server component:**
- Fetch data via `getCompletionReportData(token)` from release service
- If null: show "Report not found" page
- Fetch shop settings
- Generate QR code (same as internal report, but pointing to self — for print)
- No auth required (public route — already excluded in middleware via `view` pattern)

**Layout:** Document-style (same as `/view/invoice/[token]`):
- `max-width: 800px`, centered, `bg-white`, clean typography
- `min-h-screen bg-surface-100 py-8 px-4`

**Sections:**
- Shop header (centered)
- Vehicle info + customer name (no address/phone for privacy)
- "Services Performed" list
- Before/After section with interactive `BeforeAfterViewer` (slider mode works on mobile!)
- Warranty details with live status calculation:
  - If `endDate > now()`: "Active — expires [date]" in green
  - If `endDate <= now()`: "Expired on [date]" in red
- Care instructions per service
- **NO pricing/cost information** — this is a service report, not an invoice
- Footer: shop contact info, "Powered by AutoServ Pro"

**Print button** — floating bottom-right (reuse the print-button client component pattern from invoice)

**Print CSS:**
```css
@media print {
  @page { size: A4; margin: 20mm; }
  .no-print { display: none !important; }
}
```

**Update middleware** — `/view` is already in the exclusion list from Phase 7, so `/view/report/[token]` is already public. Verify this.

---

## Batch 6: Customer Follow-ups + Job Finalization (1 agent)

### Task 10: Customer Follow-ups on Detail Page + Job Overview Update

**Files:**
- Modify: `src/app/(dashboard)/customers/[id]/page.tsx` — fetch upcoming follow-ups
- Modify: `src/app/(dashboard)/customers/[id]/customer-detail-client.tsx` — add follow-ups section
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx` — add release summary to overview
- Modify: `src/app/(dashboard)/jobs/[id]/overview-client.tsx` — add release summary card

**Customer detail — upcoming follow-ups:**
- In the server component, fetch Notifications with `scheduledAt > now()` for this customer's related job orders:
  ```typescript
  const upcomingFollowUps = await prisma.notification.findMany({
    where: {
      type: { in: ["FOLLOW_UP_SATISFACTION", "FOLLOW_UP_SURVEY", "FOLLOW_UP_MAINTENANCE", "WARRANTY_EXPIRY"] },
      scheduledAt: { gt: new Date() },
      deletedAt: null,
      // Join through job order to customer
    },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });
  ```
  Actually, notifications are tied to `recipientId` (a user), not a customer. Better approach: query through the ReleaseRecord's follow-up dates. Or query Warranties for this customer:
  ```typescript
  // Fetch warranties for this customer
  const warranties = await prisma.warranty.findMany({
    where: { customerId: customer.id, status: "ACTIVE", deletedAt: null },
    include: { jobOrder: { select: { jobOrderNumber: true } } },
    orderBy: { endDate: "asc" },
  });

  // Fetch release records for this customer's jobs
  const releaseRecords = await prisma.releaseRecord.findMany({
    where: {
      jobOrder: { customerId: customer.id },
      deletedAt: null,
    },
    select: {
      followUp7DayDate: true, followUp7DaySent: true,
      followUp30DayDate: true, followUp30DaySent: true,
      followUp6MonthDate: true, followUp6MonthSent: true,
      followUp1YearDate: true, followUp1YearSent: true,
      jobOrder: { select: { jobOrderNumber: true, vehicle: { select: { make: true, model: true } } } },
    },
  });
  ```

- In the client component, add a "Follow-ups & Warranties" card section:
  - Active warranties with status and expiry countdown
  - Upcoming follow-up dates with type labels
  - Simple list/timeline format

**Job overview — release summary card:**
- Add to the overview `Promise.all`: fetch release record
- In overview client, add a "Release" card (after the QC and invoice/payment cards):
  - If job is RELEASED: green card with release date, advisor name, "View Completion Report" link
  - If not yet released: gray card "Pending Release"

---

## Batch 7: Final Build Verification (1 agent)

### Task 11: Final Build Verification + Wiring Check

**Run:** `rm -rf .next && npx next build`

**Expected:** 0 errors, all new routes compile:
- `/jobs/[id]/release` — Release wizard
- `/jobs/[id]/release/report` — Completion report (printable)
- `/view/report/[token]` — Public report portal
- All existing routes still work

**Verify route list includes:**
- `ƒ /jobs/[id]/release`
- `ƒ /jobs/[id]/release/report`
- `ƒ /view/report/[token]`

**Manual verification checklist (for reference, not automated):**
- [ ] Initiate release on fully paid job → wizard opens
- [ ] Capture release photos → progress shows
- [ ] Before/after viewer works (side-by-side + slider)
- [ ] Belongings checklist shows intake items
- [ ] Mileage/fuel comparison with warnings
- [ ] Warranty terms display per service
- [ ] Both signatures → Complete Release enabled
- [ ] Complete → RELEASED status, warranties created
- [ ] Completion Report printable with QR code
- [ ] Public report URL works without auth
- [ ] Customer detail shows follow-ups/warranties

---

## Summary: Task Count & Batching

| Batch | Tasks | Agents | Description |
|-------|-------|--------|-------------|
| 1 | 1, 2 | 2 parallel | Schema + seeds + enums + validators + install qrcode |
| 2 | 3, 4 | 2 parallel | Release service + actions |
| 3 | 5, 6 | 2 parallel | Before/After viewer + Belongings return |
| 4 | 7 | 1 agent | Release wizard (server + client) — large task |
| 5 | 8, 9 | 2 parallel | Completion report + Public report portal |
| 6 | 10 | 1 agent | Customer follow-ups + Job overview update |
| 7 | 11 | 1 agent | Final build verification |

**Total: 11 tasks, 7 batches**

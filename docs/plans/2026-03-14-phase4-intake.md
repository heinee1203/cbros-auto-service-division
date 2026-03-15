# Phase 4: Intake / Vehicle Check-In — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete vehicle intake / check-in flow — from an approved estimate through walkaround photos, damage mapping, belongings inventory, fuel level, job configuration, and customer sign-off — creating a Job Order and moving the vehicle into "Checked In" status.

**Architecture:** Server actions + service layer (established pattern). Intake is a 6-step wizard on `jobs/[id]/intake/page.tsx`. Photos stored to local filesystem (public/uploads/) with Sharp processing. Signature capture via HTML5 canvas. SVG-based interactive damage mapper. All data persisted to IntakeRecord, IntakeDamageMap, IntakeBelonging, Photo, and JobOrder models.

**Tech Stack:** Next.js 14, React 18, Prisma/SQLite, Sharp (image processing), HTML5 Canvas (signatures), HTML5 getUserMedia (camera), Zod validation, Sonner toasts, Lucide icons, Tailwind CSS.

---

## Task 1: Install Dependencies & Add New Constants/Enums

**Files:**
- Modify: `package.json` (add `sharp` dependency)
- Modify: `src/types/enums.ts` (add display labels for DamageType, DamageSeverity, FuelLevel)
- Modify: `src/lib/constants.ts` (add WALKAROUND_SHOTS, CONDITIONAL_SHOTS, COMMON_BELONGINGS, JO_STATUS_TABS, DAMAGE_TYPE_LABELS, etc.)

**What to do:**

1. `npm install sharp` — image processing for photo pipeline
2. Add to `src/types/enums.ts`:
   - `DAMAGE_TYPE_LABELS: Record<DamageType, string>` — "SCRATCH" → "Scratch", etc.
   - `DAMAGE_TYPE_COLORS: Record<DamageType, string>` — color classes per type
   - `DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string>` — "COSMETIC" → "Cosmetic", etc.
   - `DAMAGE_SEVERITY_COLORS: Record<DamageSeverity, string>` — green/yellow/orange/red
   - `FUEL_LEVEL_LABELS: Record<FuelLevel, string>` — "EMPTY" → "E", "QUARTER" → "¼", etc.
3. Add to `src/lib/constants.ts`:
   - `WALKAROUND_SHOTS` — array of 18 required shot objects: `{ id: string, label: string, category: string, required: true }`
   - `CONDITIONAL_SHOTS` — map of service category → additional required shots: `{ serviceCategory: string, shots: { id, label, category }[] }`
   - `COMMON_BELONGINGS` — array of pre-built checklist items: `{ id, label, hasNotes: boolean }`
   - `JOB_ORDER_STATUS_TABS` — status filter tabs for jobs list: All | Checked In | In Progress | QC Pending | Awaiting Payment | Released

**Build checkpoint:** `npx next build` — should pass.

---

## Task 2: Zod Validators for Intake

**Files:**
- Modify: `src/lib/validators.ts` (add intake-related schemas)

**What to add:**

```typescript
// Damage map entry
export const damageEntrySchema = z.object({
  zone: z.string().min(1),
  positionX: z.coerce.number().optional().nullable(),
  positionY: z.coerce.number().optional().nullable(),
  damageType: z.string().min(1),
  severity: z.string().min(1),
  notes: z.string().optional().nullable(),
});
export type DamageEntryInput = z.infer<typeof damageEntrySchema>;

// Belonging entry
export const belongingSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  condition: z.string().optional().nullable(),
});
export type BelongingInput = z.infer<typeof belongingSchema>;

// Intake record (Step 4-5 data)
export const intakeRecordSchema = z.object({
  odometerReading: z.coerce.number().int().min(0).optional().nullable(),
  fuelLevel: z.string().default("HALF"),
  hasWarningLights: z.boolean().default(false),
  warningLightsNote: z.string().optional().nullable(),
  keysCount: z.coerce.number().int().min(0).default(1),
});
export type IntakeRecordInput = z.infer<typeof intakeRecordSchema>;

// Job order configuration (Step 5)
export const jobOrderConfigSchema = z.object({
  primaryTechnicianId: z.string().min(1, "Primary technician is required"),
  targetCompletionDate: z.string().optional().nullable(),
  priority: z.string().default("NORMAL"),
  bayAssignment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type JobOrderConfigInput = z.infer<typeof jobOrderConfigSchema>;
```

**Build checkpoint:** `npx next build` — should pass.

---

## Task 3: Photo Upload API Route (with Sharp Processing)

**Files:**
- Create: `src/app/api/photos/upload/route.ts`

**What to build:**
- POST handler accepting `multipart/form-data`
- Fields: `file` (the image), `entityType`, `entityId`, `stage`, `category`, `jobOrderNumber` (for watermark)
- Auth check (session required)
- Processing pipeline:
  1. Save original to `public/uploads/originals/original_[cuid].[ext]`
  2. Use Sharp to create full-size (2000px max, 85% quality) → `public/uploads/full/full_[cuid].jpg`
  3. Use Sharp to create thumbnail (300px, 75% quality) → `public/uploads/thumbs/thumb_[cuid].jpg`
  4. Burn watermark on full-size: bottom-right, semi-transparent white text on dark bar, format: `YYYY-MM-DD h:mm A • AutoServ Pro Intake • JO-XXXXXXXX-XXXX`
  5. Extract basic metadata (width, height, file size)
  6. Create `Photo` record in database
- Return: `{ id, thumbnailPath, fullSizePath, originalPath }`
- Error handling: if Sharp fails, save original, create record with flag for manual review

**Ensure `public/uploads/originals/`, `public/uploads/full/`, `public/uploads/thumbs/` directories are created.**
**Add `public/uploads/` to `.gitignore`.**

**Build checkpoint:** `npx next build` — should pass.

---

## Task 4: Intake Service Layer

**Files:**
- Create: `src/lib/services/intake.ts`

**Functions to implement:**

1. **`createJobOrderFromEstimate(estimateRequestId, userId)`** — Transactional:
   - Fetch the estimate request with customer, vehicle, estimate+versions+lineItems
   - Get next JO sequence from Settings (`next_jo_sequence`), generate JO number
   - Create `JobOrder` record (status: PENDING, copy insurance fields from estimate request)
   - Create `IntakeRecord` linked to the new JO
   - Return `{ jobOrder, intakeRecord }`

2. **`getIntakeRecord(jobOrderId)`** — Full detail:
   - IntakeRecord with damageMarks, belongings
   - JobOrder with customer, vehicle, estimates→versions→lineItems
   - Photos where entityType='INTAKE' and entityId=intakeRecord.id

3. **`addDamageEntry(intakeRecordId, data: DamageEntryInput, userId)`** — Creates IntakeDamageMap record

4. **`updateDamageEntry(id, data: Partial<DamageEntryInput>, userId)`** — Updates damage mark

5. **`deleteDamageEntry(id, userId)`** — Soft delete damage mark

6. **`addBelonging(intakeRecordId, data: BelongingInput, userId)`** — Creates IntakeBelonging record

7. **`deleteBelonging(id, userId)`** — Soft delete belonging

8. **`updateIntakeRecord(intakeRecordId, data, userId)`** — Update fuel level, odometer, warning lights, keys count, signatures, etc.

9. **`completeIntake(intakeRecordId, config: JobOrderConfigInput, signatures, userId)`** — Transactional:
   - Update IntakeRecord with signatures + timestamps
   - Update JobOrder: status → CHECKED_IN, set primaryTechnicianId, targetCompletionDate, priority, notes
   - Create `Task` records from each LABOR line item in the approved estimate (status: QUEUED)
   - Update EstimateRequest status if needed
   - Return the completed JobOrder

10. **`getRequiredPhotos(serviceCategories: string[])`** — Returns the full shot list (base 18 + conditional) based on service types from the estimate

**Build checkpoint:** `npx next build` — should pass.

---

## Task 5: Job Order Service Layer

**Files:**
- Create: `src/lib/services/job-orders.ts`

**Functions to implement:**

1. **`getJobOrders(params)`** — Paginated list with search (JO number, plate, customer name), status filter, sorting. Include: customer (name, phone), vehicle (plate, make, model), primaryTechnician (name), tasks count, estimate grand total.

2. **`getJobOrderDetail(id)`** — Full detail with ALL relations: customer, vehicle, intakeRecord (with damageMarks, belongings), estimates→versions→lineItems, tasks, photos (where entityType='INTAKE' or entityType='JOB_ORDER'), primaryTechnician.

3. **`updateJobOrderStatus(id, newStatus, userId)`** — Update status with audit trail.

4. **`getNextJOSequence()`** — Read/increment `next_jo_sequence` from Settings (same pattern as estimate sequence).

**Build checkpoint:** `npx next build` — should pass.

---

## Task 6: Server Actions for Intake

**Files:**
- Create: `src/lib/actions/intake-actions.ts`

**Actions to implement:**

1. `beginIntakeAction(estimateRequestId)` — Calls `createJobOrderFromEstimate`, revalidates paths, returns `{ jobOrderId, intakeRecordId }`
2. `addDamageEntryAction(intakeRecordId, data)` — Zod validate, call service
3. `updateDamageEntryAction(id, data)` — Zod validate partial, call service
4. `deleteDamageEntryAction(id)` — Call service
5. `addBelongingAction(intakeRecordId, data)` — Zod validate, call service
6. `deleteBelongingAction(id)` — Call service
7. `updateIntakeRecordAction(intakeRecordId, data)` — Update fuel, odometer, warnings, keys
8. `completeIntakeAction(intakeRecordId, config, signatures)` — Zod validate config, call `completeIntake`, revalidate `/jobs`, `/estimates`, return `{ jobOrderId }`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 7: API Routes for Jobs & Intake

**Files:**
- Create: `src/app/api/jobs/route.ts` — GET handler for job orders list
- Create: `src/app/api/jobs/[id]/route.ts` — GET handler for single job order detail
- Modify: `src/app/api/customers/[id]/vehicles/route.ts` — Verify this exists (needed by inquiry wizard for fetching customer vehicles); create if missing

**Build checkpoint:** `npx next build` — should pass.

---

## Task 8: Shared UI Components (Signature Pad, Fuel Gauge, Step Indicator)

**Files:**
- Create: `src/components/ui/signature-pad.tsx` — HTML5 Canvas signature capture with clear button, returns base64 data URL
- Create: `src/components/ui/step-indicator.tsx` — Horizontal stepper with numbered circles, connecting lines, completed/active/pending states
- Create: `src/components/intake/fuel-gauge.tsx` — Visual semicircular or linear gauge with E/¼/½/¾/F snap positions, tap/click to select

**Signature Pad spec:**
- Canvas element, touch + mouse support
- Pen color: dark (charcoal), line width 2px
- "Clear" button to reset
- Props: `onSave(dataUrl: string)`, `width`, `height`
- Show "Sign here" placeholder text when empty

**Step Indicator spec:**
- Props: `steps: { label: string }[]`, `currentStep: number`, `completedSteps: number[]`
- Circles: green+check for completed, amber for current, gray for future
- Labels below each circle

**Fuel Gauge spec:**
- 5 positions in a horizontal bar layout
- Tap/click to select, selected position highlighted in amber
- Labels: E, ¼, ½, ¾, F
- Props: `value: FuelLevel`, `onChange(value: FuelLevel)`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 9: Walkaround Photo Capture Component

**Files:**
- Create: `src/components/intake/walkaround-capture.tsx`

**This is the most critical UI component.** Build a full-screen photo capture interface:

- **Shot list sidebar/bottom panel** showing all required shots (base 18 + conditional based on service categories prop)
- Each shot item: shot number, label, status (pending/captured with thumbnail)
- **Progress indicator**: "X of Y required photos captured" — large, prominent
- **Active shot area**: when a shot is selected:
  - "Use Camera" button → opens `<input type="file" accept="image/*" capture="environment">` (mobile-friendly, uses rear camera)
  - "Upload from Gallery" button → opens `<input type="file" accept="image/*">` (no capture attr)
  - After file selected: show preview thumbnail, "Accept" / "Retake" buttons
  - On accept: upload via `POST /api/photos/upload` with shot category, show upload progress
  - On success: update checklist item with green check + thumbnail
- **"Add Extra Photos" button** — for additional shots tagged as `extra`
- **"Next" button** — disabled until all required shots captured, with message "X required photos remaining"
- Props: `intakeRecordId`, `jobOrderNumber`, `serviceCategories: string[]`, `existingPhotos: Photo[]`, `onComplete()`

**Note:** Use `<input type="file" capture="environment">` for camera (simpler, more reliable than getUserMedia for photo capture). getUserMedia is better for video/streaming — file input with capture attribute is the standard for "take a photo" on mobile.

**Build checkpoint:** `npx next build` — should pass.

---

## Task 10: Damage Mapper Component

**Files:**
- Create: `src/components/intake/damage-mapper.tsx`
- Create: `src/components/intake/car-svg.tsx` — SVG car silhouette with clickable zones

**Car SVG spec:**
- 5 views toggled by tabs: Top-Down (default), Left Side, Right Side, Front, Rear
- Each view is an SVG with named clickable zone `<path>` elements
- Zones: hood, roof, trunk, left_fender, right_fender, left_front_door, left_rear_door, right_front_door, right_rear_door, left_quarter_panel, right_quarter_panel, front_bumper, rear_bumper, grille, left_headlight, right_headlight, left_taillight, right_taillight, windshield, rear_windshield, left_mirror, right_mirror, left_rocker, right_rocker
- Zones with damage entries: filled with severity color (green/yellow/orange/red) + numbered marker
- Click zone → callback with zone ID

**Damage Mapper spec:**
- Top section: car SVG with view tabs
- On zone click → slide-up form panel:
  - Damage type dropdown (from DamageType enum)
  - Severity radio buttons (4 options with color indicators)
  - Description textarea (optional)
  - Photo link picker: thumbnails from walkaround photos, option to capture new close-up
  - Save / Cancel buttons
- Below diagram: damage summary list
  - Numbered entries matching diagram markers
  - Each: zone name, damage type badge, severity badge, description, linked photo thumbs
  - Edit / Delete buttons per entry
- **"No Pre-Existing Damage" checkbox** — when checked, hides the mapper, adds note
- Props: `intakeRecordId`, `damageEntries: DamageEntry[]`, `photos: Photo[]`, `onUpdate()`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 11: Belongings Checklist Component

**Files:**
- Create: `src/components/intake/belongings-checklist.tsx`

**Spec:**
- Pre-built checklist from `COMMON_BELONGINGS` constant — checkboxes
- Each checked item reveals an optional notes input
- "Add Custom Item" button for items not in the list → description + condition fields
- **"No Items Left in Vehicle" checkbox** — hides the checklist, marks all items as N/A
- List of recorded belongings below with edit/delete
- Optional "Take Photo" button for overview shot of collected items
- Props: `intakeRecordId`, `belongings: Belonging[]`, `onUpdate()`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 12: Authorization & Sign-Off Component

**Files:**
- Create: `src/components/intake/authorization-form.tsx`

**Spec:**
- Summary section showing all collected data:
  - Vehicle info (plate, make/model/year/color, odometer)
  - Scope of work (services from estimate)
  - Estimated cost (grand total from estimate)
  - Estimated completion date (from Step 5 config)
  - Pre-existing damage count + severity breakdown
  - Belongings inventory count
  - Fuel level
- **Terms and conditions** — scrollable text pulled from Settings (`intake_authorization_terms` key), fetched via prop
- **Customer signature pad** — using SignaturePad component
- **Advisor signature pad** — second SignaturePad
- **"Customer Not Present" toggle** — skips customer signature, shows warning banner
- **"Complete Check-In" button** — disabled until: advisor signed, and (customer signed OR "not present" toggled)
  - Calls `completeIntakeAction` with signatures + job config
  - On success: toast, redirect to `/jobs/[id]`
- Props: `intakeRecordId`, `estimateData`, `intakeData`, `jobConfig`, `onComplete(jobOrderId: string)`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 13: Intake Wizard Page (6-Step Orchestrator)

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/intake/page.tsx` — Replace placeholder with full intake wizard

**Spec:**
- Server component wrapper that fetches job order + intake record data
- Client component `IntakeWizardClient` orchestrating 6 steps:
  1. Walkaround Photos → `WalkaroundCapture`
  2. Damage Mapper → `DamageMapper`
  3. Belongings → `BelongingsChecklist`
  4. Fuel & Vehicle Condition → fuel gauge + odometer input + warning lights toggle + keys count
  5. Job Configuration → tech assignment, target date, priority, bay, notes
  6. Authorization & Sign-Off → `AuthorizationForm`
- **StepIndicator** at top showing progress through 6 steps
- Each step must be completed (or explicitly skipped where allowed) before "Next"
- Back navigation allowed
- Step completion state tracked in local state
- On final step completion → redirect to `/jobs/[id]`

**Build checkpoint:** `npx next build` — should pass.

---

## Task 14: "Begin Intake" Button on Estimate Detail

**Files:**
- Modify: `src/components/estimates/estimate-summary.tsx` — Add "Begin Intake / Check-In" button when status is `ESTIMATE_APPROVED`
- Modify: `src/components/estimates/estimate-detail-client.tsx` — Pass status to summary, handle navigation after intake creation

**What to add:**
- When estimate request status is `ESTIMATE_APPROVED`, show a prominent green button: "Begin Intake / Check-In"
- On click: call `beginIntakeAction(estimateRequestId)` → creates JO + IntakeRecord
- On success: redirect to `/jobs/[jobOrderId]/intake`
- The button should be the most prominent action when status is approved

**Build checkpoint:** `npx next build` — should pass.

---

## Task 15: Job Orders List Page

**Files:**
- Modify: `src/app/(dashboard)/jobs/page.tsx` — Replace placeholder with full data table

**Spec:**
- Client component following customers/vehicles page pattern
- Status filter tabs from `JOB_ORDER_STATUS_TABS`
- Debounced search (JO number, plate, customer name)
- DataTable columns: JO Number (mono/bold), Customer (name + phone), Vehicle (formatted plate + make/model), Status (color badge), Assigned Tech, Target Date, Days in Shop (live calc), Priority (badge)
- **Overdue indicator**: if today > target date AND status not RELEASED/CANCELLED, show red "OVERDUE" badge + days overdue
- Row click → `/jobs/[id]`
- Empty state with Wrench icon

**Build checkpoint:** `npx next build` — should pass.

---

## Task 16: Job Order Detail — Overview Tab

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx` — Replace placeholder with real overview
- Create: `src/app/(dashboard)/jobs/[id]/overview-client.tsx` — Client component

**Spec:**
- Server component fetches `getJobOrderDetail(id)`, passes to client
- **Status pipeline visualization** — horizontal stepper: Checked In → In Progress → QC → Payment → Released (current highlighted, completed checked)
- **Key info cards** (grid): Customer + Vehicle, Estimate total, Assigned tech(s), Target date, Priority badge, Days in shop
- **Quick stats** row: Estimated hours (sum from tasks), Actual hours (sum from time entries, 0 for now), Efficiency ratio
- **Activity timeline** placeholder (will be populated from AuditLog in later phases)
- **Action buttons** by status:
  - CHECKED_IN: "Start Work" → transitions to IN_PROGRESS
  - Other statuses: contextual actions (future phases)

**Build checkpoint:** `npx next build` — should pass.

---

## Task 17: Job Detail Layout Enhancement

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/layout.tsx` — Fetch job data to show JO number + vehicle in header breadcrumb

**What to change:**
- Convert to server component that fetches basic JO info (jobOrderNumber, vehicle plate)
- Pass to a client layout wrapper that shows the tab navigation
- Breadcrumb: "Job Orders / JO-20260314-0001 — ABC 1234"

**Build checkpoint:** `npx next build` — should pass.

---

## Task 18: Global Search Enhancement + Final Integration

**Files:**
- Modify: `src/app/api/search/route.ts` — Add job orders to global search results (search by JO number, plate)
- Modify: `src/components/search/global-search.tsx` — Add job order result type with Wrench icon

**Final verification checklist (manual):**
- [ ] From approved estimate → "Begin Intake" button visible and functional
- [ ] Intake wizard opens with 6-step stepper
- [ ] Photo capture via file input with camera works
- [ ] Required photo checklist enforces all 18+ shots
- [ ] Damage mapper: tap zone → form → save → zone highlights
- [ ] Belongings checklist + "No Items" shortcut
- [ ] Fuel gauge interactive on touch/click
- [ ] Signature pads capture + "Customer Not Present" option
- [ ] On completion: JO created, tasks created, redirect to job detail
- [ ] Jobs list shows new job with all columns
- [ ] Job detail overview shows status pipeline, info cards, action buttons
- [ ] Global search finds jobs by JO number

**Build checkpoint:** `npx next build` — MUST pass with 0 errors.

---

## Execution Order & Parallelization

**Sequential dependencies:**
- Tasks 1-2 (constants, validators) → must be first
- Task 3 (photo upload API) → depends on Task 1
- Tasks 4-5 (service layers) → depend on Tasks 1-2
- Task 6 (server actions) → depends on Tasks 4-5
- Task 7 (API routes) → depends on Task 5
- Tasks 8-12 (UI components) → depend on Tasks 1-2, can be parallelized with each other
- Task 13 (wizard page) → depends on Tasks 8-12
- Task 14 (Begin Intake button) → depends on Task 6
- Task 15 (Jobs list) → depends on Tasks 5, 7
- Task 16-17 (Job detail) → depends on Task 5
- Task 18 (search + final) → depends on everything

**Parallel batches:**
1. **Batch 1:** Tasks 1 + 2 (constants + validators)
2. **Batch 2:** Tasks 3, 4, 5 (photo API, intake service, JO service) — can be parallelized
3. **Batch 3:** Tasks 6 + 7 (actions + API routes)
4. **Batch 4:** Tasks 8, 9, 10, 11, 12 (all UI components — can be parallelized)
5. **Batch 5:** Tasks 13, 14, 15 (wizard assembly, begin intake button, jobs list)
6. **Batch 6:** Tasks 16, 17, 18 (job detail, layout, search)

# Unified Intake Wizard — Design Document

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Unified intake wizard in scheduler, CBROS board features, new service categories

---

## Overview

A single multi-step intake wizard that lives IN the scheduler app (`(schedule)` route group). It adapts its depth based on selected services — from a 2-minute quick intake for oil changes to a 5-minute full documentation flow for collision work. The advisor never leaves the scheduler during intake.

## Intake Level System

### Level Detection

Pure function `getIntakeLevel(categories: string[]): 1 | 2 | 3` — returns highest level across all selected service categories. Advisor can upgrade but never downgrade below what services require.

### Category-to-Level Mapping

**Level 1 (Quick ~2min):**
- Preventive Maintenance (new seed)
- Tire & Alignment (new seed)
- Electrical (new seed)
- Air Conditioning (new seed)
- Diagnostics & Inspection (new seed)
- Accessories & Add-ons (existing)

**Level 2 (Standard ~3min):**
- Mechanical Repair (new seed)
- Buffing & Paint Correction (existing)

**Level 3 (Full ~5min):**
- Collision Repair (existing)
- Painting & Refinishing (existing)
- Car Detailing (existing)
- Undercoating & Rust Protection (existing)
- Car Restoration (existing)

### Steps Per Level

| Step | Level 1 | Level 2 | Level 3 |
|------|---------|---------|---------|
| 1. Plate Lookup | yes | yes | yes |
| 2. Services | yes | yes | yes |
| 3. Photos (4 quick exterior) | yes | - | - |
| 3. Photos (8 focused) | - | yes | - |
| 3. Photos (15+ walkaround) | - | - | yes |
| 4. Damage Map | - | - | yes |
| 5. Customer/Vehicle Details | yes | yes | yes |
| 6. Belongings & Fuel | - | yes | yes |
| 7. Estimate Review | - | - | if linked |
| 8. Assignment & Config | yes | yes | yes |
| 9. Sign-off (button tap) | yes | - | - |
| 9. Sign-off (advisor sig) | - | yes | - |
| 9. Sign-off (dual sig) | - | - | yes |

## Wizard Steps — Detailed Design

### Step 1: Plate Lookup (All Levels)

Single large input: "Scan or type plate number"

- Debounced API call to `GET /api/vehicles/lookup?plate=XXX` after 4+ chars
- Returns: vehicle details + linked customer + visit count + last visit date
- **"Use This Vehicle"** → auto-fills vehicle & customer, advances to Step 2
- **"Different Customer"** → auto-fills vehicle, clears customer (Step 5 requires manual entry)
- **"New Vehicle + New Customer"** → both blank, Step 5 collects everything
- No match → "New vehicle" state, advisor enters plate and continues

### Step 2: Service Selection (All Levels)

Categorized checkbox grid matching existing Select Services modal design.

- "Check-Up Only" toggle at top (maps to Diagnostics category)
- Services grouped by category (all 15 categories: 9 existing + 6 new)
- After selection, `getIntakeLevel()` runs and shows detected level
- "Upgrade to Standard/Full" button available; no downgrade below detected level
- If linked to approved estimate, services pre-selected from estimate line items

### Step 3: Photos (Adaptive)

**Level 1 — 4 Quick Exterior:** Front, rear, driver side, passenger side. Simple 2x2 grid of camera buttons. No shot list sidebar. ~30 seconds.

**Level 2 — 8 Focused:** 4 exterior + 4 work-area photos. Work-area shots determined by service categories via `CONDITIONAL_SHOTS` mapping (e.g., engine bay for A/C, wheel closeups for brakes).

**Level 3 — 15+ Full Walkaround:** Reuses existing `WalkaroundCapture` component with full shot list sidebar, progress tracking, and conditional shots. Dark-themed via CSS variable migration.

All levels upload to `/api/photos/upload` with `stage: "INTAKE"`.

### Step 4: Damage Map (Level 3 Only)

Reuses existing `DamageMapper` + `CarSvg` components. Dark-themed via CSS variable migration. Skipped entirely for Level 1 and 2.

### Step 5: Customer & Vehicle Details (All Levels)

**Returning vehicle (plate found):** Pre-filled summary card (read-only). "Edit" button expands to editable fields. Odometer always editable (shows last recorded value for reference).

**New vehicle:** Full form — Year, Make, Model, VIN, Plate, Odometer, Customer Name, Phone. Creates both records on wizard completion.

**"Different Customer" path:** Vehicle pre-filled, customer fields blank. Can search existing customers or enter new.

### Step 6: Belongings & Fuel (Level 2 & 3)

Reuses existing `BelongingsChecklist` and `FuelGauge` components side-by-side. Also captures warning lights toggle and key count. Dark-themed. Skipped for Level 1.

### Step 7: Estimate Review (Level 3, only if linked to estimate)

Shows approved estimate line items with add/edit/remove capability.

- Displays original estimate version with all line items
- Advisor can add new items, modify quantities/prices, remove items
- Shows running total with change delta from original
- **Within tolerance** (configurable: default 10% or P1,000, whichever higher): verbal approval option, proceed
- **Over tolerance**: requires formal customer approval (present = sign now, absent = SMS link)
- Creates Estimate v2 if changes made (v1 preserved)
- "No changes needed" checkbox skips modifications

### Step 8: Assignment & Config (All Levels)

- Front Desk Lead (required) — dropdown of advisors
- Lead Mechanic (optional — "Assign later...")
- Assistant Mechanic (optional)
- Bay assignment — dropdown with `suggestBayForJob()` auto-suggestion
- Priority — Normal / Rush / Insurance
- Internal Notes — free text

### Step 9: Sign-off (Adaptive)

**Level 1:** Single "Confirm & Create Job" button. No signatures. Logged as "Quick intake — advisor confirmation."

**Level 2:** Advisor signature pad only. Summary of services and total.

**Level 3:** Reuses existing `AuthorizationForm` — full summary, terms & conditions, customer + advisor signatures. "Customer Not Present" toggle.

## Three Customer Paths

**Path A — Walk-in:** Customer is here now. `+ New Intake` button → wizard runs with empty state → job created on board.

**Path B — Scheduled:** Appointment booked earlier. Customer arrives → "Mark Arrived" on Live Floor → wizard launches pre-filled from appointment data (customer, vehicle, scheduled services).

**Path C — Estimate-linked:** Estimate approved → appointment created → customer arrives → "Mark Arrived" → wizard pre-filled from estimate AND appointment data. Estimate Review step (Step 7) appears.

## Quick Job (Emergency Escape)

Separate `Quick Job` button next to `+ New Intake` on floor page. NOT part of the wizard.

- Minimal form: Plate, Customer Name, Phone, Reason (text)
- Creates job with status `CHECKED_IN` and `incompleteIntake: true` flag
- Persistent `INCOMPLETE INTAKE` badge on board card
- Full intake wizard can be opened later from the card to complete documentation

## CBROS Board/List Features

1. **"Done / Paid" button** — on board cards and list rows. Advances status: QC_PASSED → AWAITING_PAYMENT → FULLY_PAID → RELEASED. Calls `updateJobOrderStatus()`.

2. **< > arrows** — on board cards. Move jobs between adjacent Kanban columns (valid status transitions only).

3. **"Unassigned" filter** — new filter tab showing jobs where `primaryTechnicianId` is null. Each card gets "Quick Assign" dropdown.

4. **"Parts Ordered" filter** — filter tab for jobs with parts on order (requires parts tracking field).

5. **Expand/Collapse toggle** — cards show minimal by default (JO#, vehicle, status). Chevron expands to show tech, customer, services, dates. "Collapse All" button in toolbar.

6. **Bay badge** — colored pill on board cards showing assigned bay name.

7. **EOD Report button** — in floor page action bar. Links to `/schedule/registry?view=eod&date=today`.

8. **History button** — in floor page action bar. Links to `/schedule/registry`.

## New Service Categories (Seed Data)

### Preventive Maintenance (Level 1) — 11 services
- PMS Basic Package (1.5 hrs)
- PMS Intermediate Package (3 hrs)
- PMS Major Package (5 hrs)
- Change Oil & Filter (0.75 hrs)
- Coolant Flush (1 hr)
- Transmission Fluid Service (1.5 hrs)
- Differential Fluid Change (1 hr)
- Brake Fluid Flush (0.75 hrs)
- Power Steering Fluid Flush (0.75 hrs)
- Spark Plug Replacement (1.5 hrs)
- Drive Belt Replacement (1 hr)

### Mechanical Repair (Level 2) — 17 services
- Brake Pad/Shoe Replacement (1.5 hrs)
- Brake Rotor Resurfacing/Replacement (2 hrs)
- Brake Caliper Service (2 hrs)
- Steering Rack Replacement (4 hrs)
- Power Steering Pump Replacement (3 hrs)
- Shock Absorber/Strut Replacement (3 hrs)
- Control Arm Replacement (3 hrs)
- Ball Joint Replacement (2.5 hrs)
- Tie Rod End Replacement (2 hrs)
- CV Joint/Axle Replacement (3 hrs)
- Water Pump Replacement (3 hrs)
- Radiator Replacement (3 hrs)
- Thermostat Replacement (1.5 hrs)
- Clutch Replacement (6 hrs)
- Timing Belt/Chain Replacement (5 hrs)
- Engine Mount Replacement (3 hrs)
- Exhaust System Repair (2.5 hrs)

### Tire & Alignment (Level 1) — 6 services
- Tire Rotation (0.5 hrs)
- Wheel Alignment (1 hr)
- Wheel Balancing (0.75 hrs)
- Tire Replacement (1 hr)
- Tire Repair/Patch (0.5 hrs)
- TPMS Sensor Service (1 hr)

### Electrical (Level 1) — 7 services
- Battery Replacement (0.5 hrs)
- Alternator Replacement (2.5 hrs)
- Starter Motor Replacement (2.5 hrs)
- Wiring Repair/Harness (3 hrs)
- Light Bulb/LED Replacement (0.5 hrs)
- Fuse Diagnosis & Replacement (1 hr)
- ECU Diagnostic/Reset (1.5 hrs)

### Air Conditioning (Level 1) — 5 services
- A/C Recharge/Refill (1 hr)
- A/C Compressor Replacement (4 hrs)
- A/C Condenser Replacement (3 hrs)
- Evaporator Service (4 hrs)
- A/C Leak Detection & Repair (2 hrs)

### Diagnostics & Inspection (Level 1) — 5 services
- Engine Diagnostic/Scanning (1 hr)
- Pre-Purchase Inspection (2 hrs)
- Emission Test Preparation (1.5 hrs)
- Underbody Inspection (1 hr)
- Check-Up Only (0.5 hrs)

**Total new services: 51. Combined with existing 55 = 106 services across 15 categories.**

## Architecture

### Route Structure
```
src/app/(schedule)/schedule/floor/
  page.tsx              — existing Live Floor page
  intake/
    page.tsx            — new intake wizard page (full-screen overlay)
```

### New Components
```
src/components/schedule/
  intake-wizard.tsx           — orchestrator (adaptive steps, level detection)
  intake-plate-lookup.tsx     — Step 1: plate search + vehicle/customer lookup
  intake-service-select.tsx   — Step 2: categorized service selector
  intake-quick-photos.tsx     — Step 3 Level 1/2: simplified photo capture
  intake-details-form.tsx     — Step 5: customer/vehicle details (new + returning)
  intake-estimate-review.tsx  — Step 7: estimate line item review
  intake-assignment.tsx       — Step 8: tech/bay/priority assignment
  intake-quick-signoff.tsx    — Step 9 Level 1/2: simplified sign-off
  quick-job-modal.tsx         — emergency quick job form
```

### Reused Components (dark-theme migration needed)
```
src/components/intake/
  walkaround-capture.tsx      — Step 3 Level 3 (needs CSS var migration)
  damage-mapper.tsx           — Step 4 Level 3 (needs CSS var migration)
  car-svg.tsx                 — used by damage-mapper (needs CSS var migration)
  belongings-checklist.tsx    — Step 6 (needs CSS var migration)
  fuel-gauge.tsx              — Step 6 (needs CSS var migration)
  authorization-form.tsx      — Step 9 Level 3 (needs CSS var migration)
```

### New API Routes
```
GET /api/vehicles/lookup?plate=XXX    — plate search returning vehicle + customer
```

### New/Modified Server Actions
```
src/lib/actions/intake-actions.ts     — add createWalkInIntake(), createQuickJob()
```

### Shared Utilities
```
src/lib/intake-levels.ts              — getIntakeLevel(), CATEGORY_LEVEL_MAP, INTAKE_LEVEL_STEPS
```

### Seed Data
```
prisma/seed.ts                        — add 51 new services across 6 categories
```

## Data Flow

### Walk-in (Path A)
1. Advisor clicks `+ New Intake` on floor page
2. Navigates to `/schedule/floor/intake`
3. Wizard collects all data across steps
4. On completion: creates Customer (if new) → Vehicle (if new) → EstimateRequest → Estimate → JobOrder → IntakeRecord → Tasks
5. Job appears on board with status `CHECKED_IN`

### Scheduled Arrival (Path B)
1. Advisor clicks `Mark Arrived` on appointment card
2. Navigates to `/schedule/floor/intake?appointmentId=XXX`
3. Wizard pre-fills from appointment data (customer, vehicle, scheduled services)
4. On completion: updates appointment status to COMPLETED, creates JobOrder → IntakeRecord → Tasks
5. Job appears on board

### Estimate-Linked (Path C)
1. Advisor clicks `Mark Arrived` on appointment with linked estimate
2. Navigates to `/schedule/floor/intake?appointmentId=XXX&estimateId=YYY`
3. Wizard pre-fills from estimate + appointment. Estimate Review step appears.
4. On completion: creates Estimate v2 if changed, creates JobOrder linked to estimate, creates IntakeRecord → Tasks
5. Job appears on board

### Quick Job (Emergency)
1. Advisor clicks `Quick Job` on floor page
2. Modal form: plate, name, phone, reason
3. Creates minimal JobOrder with `CHECKED_IN` status and `incompleteIntake` flag
4. Job appears on board with warning badge
5. Later: advisor opens full intake wizard from card to complete documentation

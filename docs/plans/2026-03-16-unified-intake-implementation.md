# Unified Intake Wizard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified, service-adaptive intake wizard embedded in the scheduler app, plus CBROS-style board enhancements and new service categories.

**Architecture:** New `ScheduleIntakeWizard` orchestrator in `(schedule)` route group with adaptive step rendering based on `getIntakeLevel()`. Reuses existing intake sub-components (WalkaroundCapture, DamageMapper, BelongingsChecklist, FuelGauge, SignaturePad, AuthorizationForm) after dark-theme CSS variable migration. New API route for plate lookup. Walk-in path creates full job pipeline (Customer → Vehicle → EstimateRequest → Estimate → JobOrder → IntakeRecord → Tasks) in a single transaction.

**Tech Stack:** Next.js 14 App Router, Prisma/SQLite, Server Actions, React Context, CSS Variables (`--sch-*`), Sonner toasts, Lucide icons

**Verification:** `npx next build` (0 errors) + browser preview after each task

**Design Doc:** `docs/plans/2026-03-16-unified-intake-wizard-design.md`

---

## Task 1: Seed New Service Categories

**Files:**
- Modify: `prisma/seed.ts` (lines 33-102, add after existing services array)

**Step 1: Add 51 new services to the seed services array**

Add these 6 new categories to the `services` array in `prisma/seed.ts`, after the existing "Accessories & Add-ons" entries (line 101). Each service follows the existing pattern: `{ category, name, description?, defaultEstimatedHours, defaultLaborRate, sortOrder, milestones }`.

```typescript
// --- Preventive Maintenance ---
{ category: "Preventive Maintenance", name: "PMS Basic Package", description: "Oil, filter, basic inspection", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 1, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "PMS Intermediate Package", description: "Fluids, filters, brakes check, belt inspection", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 2, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "PMS Major Package", description: "Full fluid change, timing belt check, suspension check", defaultEstimatedHours: 5, defaultLaborRate: 50000, sortOrder: 3, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Change Oil & Filter", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Coolant Flush", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 5, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Transmission Fluid Service", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 6, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Differential Fluid Change", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 7, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Brake Fluid Flush", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 8, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Power Steering Fluid Flush", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 9, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Spark Plug Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 10, milestones: ["before", "after"] },
{ category: "Preventive Maintenance", name: "Drive Belt Replacement", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 11, milestones: ["before", "after"] },

// --- Mechanical Repair ---
{ category: "Mechanical Repair", name: "Brake Pad/Shoe Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 1, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Brake Rotor Resurfacing/Replacement", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 2, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Brake Caliper Service", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 3, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Steering Rack Replacement", defaultEstimatedHours: 4, defaultLaborRate: 50000, sortOrder: 4, milestones: ["before", "in_progress", "after"] },
{ category: "Mechanical Repair", name: "Power Steering Pump Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 5, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Shock Absorber/Strut Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 6, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Control Arm Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 7, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Ball Joint Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 8, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Tie Rod End Replacement", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 9, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "CV Joint/Axle Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 10, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Water Pump Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 11, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Radiator Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 12, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Thermostat Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 35000, sortOrder: 13, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Clutch Replacement", defaultEstimatedHours: 6, defaultLaborRate: 50000, sortOrder: 14, milestones: ["before", "in_progress", "after"] },
{ category: "Mechanical Repair", name: "Timing Belt/Chain Replacement", defaultEstimatedHours: 5, defaultLaborRate: 50000, sortOrder: 15, milestones: ["before", "in_progress", "after"] },
{ category: "Mechanical Repair", name: "Engine Mount Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 16, milestones: ["before", "after"] },
{ category: "Mechanical Repair", name: "Exhaust System Repair", defaultEstimatedHours: 2.5, defaultLaborRate: 40000, sortOrder: 17, milestones: ["before", "after"] },

// --- Tire & Alignment ---
{ category: "Tire & Alignment", name: "Tire Rotation", defaultEstimatedHours: 0.5, defaultLaborRate: 30000, sortOrder: 1, milestones: ["before", "after"] },
{ category: "Tire & Alignment", name: "Wheel Alignment", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 2, milestones: ["before", "after"] },
{ category: "Tire & Alignment", name: "Wheel Balancing", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 3, milestones: ["before", "after"] },
{ category: "Tire & Alignment", name: "Tire Replacement", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
{ category: "Tire & Alignment", name: "Tire Repair/Patch", defaultEstimatedHours: 0.5, defaultLaborRate: 25000, sortOrder: 5, milestones: ["before", "after"] },
{ category: "Tire & Alignment", name: "TPMS Sensor Service", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 6, milestones: ["before", "after"] },

// --- Electrical ---
{ category: "Electrical", name: "Battery Replacement", defaultEstimatedHours: 0.5, defaultLaborRate: 30000, sortOrder: 1, milestones: ["before", "after"] },
{ category: "Electrical", name: "Alternator Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 2, milestones: ["before", "after"] },
{ category: "Electrical", name: "Starter Motor Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 3, milestones: ["before", "after"] },
{ category: "Electrical", name: "Wiring Repair/Harness", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 4, milestones: ["before", "in_progress", "after"] },
{ category: "Electrical", name: "Light Bulb/LED Replacement", defaultEstimatedHours: 0.5, defaultLaborRate: 25000, sortOrder: 5, milestones: ["before", "after"] },
{ category: "Electrical", name: "Fuse Diagnosis & Replacement", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 6, milestones: ["before", "after"] },
{ category: "Electrical", name: "ECU Diagnostic/Reset", defaultEstimatedHours: 1.5, defaultLaborRate: 50000, sortOrder: 7, milestones: ["before", "after"] },

// --- Air Conditioning ---
{ category: "Air Conditioning", name: "A/C Recharge/Refill", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 1, milestones: ["before", "after"] },
{ category: "Air Conditioning", name: "A/C Compressor Replacement", defaultEstimatedHours: 4, defaultLaborRate: 50000, sortOrder: 2, milestones: ["before", "in_progress", "after"] },
{ category: "Air Conditioning", name: "A/C Condenser Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 3, milestones: ["before", "after"] },
{ category: "Air Conditioning", name: "Evaporator Service", defaultEstimatedHours: 4, defaultLaborRate: 50000, sortOrder: 4, milestones: ["before", "in_progress", "after"] },
{ category: "Air Conditioning", name: "A/C Leak Detection & Repair", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 5, milestones: ["before", "after"] },

// --- Diagnostics & Inspection ---
{ category: "Diagnostics & Inspection", name: "Engine Diagnostic/Scanning", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 1, milestones: ["before", "after"] },
{ category: "Diagnostics & Inspection", name: "Pre-Purchase Inspection", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 2, milestones: ["before", "after"] },
{ category: "Diagnostics & Inspection", name: "Emission Test Preparation", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 3, milestones: ["before", "after"] },
{ category: "Diagnostics & Inspection", name: "Underbody Inspection", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
{ category: "Diagnostics & Inspection", name: "Check-Up Only", description: "General inspection — no specific service needed", defaultEstimatedHours: 0.5, defaultLaborRate: 25000, sortOrder: 5, milestones: ["before", "after"] },
```

**Step 2: Add intake tolerance settings**

Add to the `settings` array in `prisma/seed.ts`:

```typescript
// Intake Estimate Tolerance
{ key: "intake_tolerance_percentage", value: "10", category: "intake", description: "Max % change at intake without formal re-approval" },
{ key: "intake_tolerance_amount", value: "100000", category: "intake", description: "Max absolute change (centavos) at intake without formal re-approval" },
{ key: "intake_tolerance_mode", value: '"higher"', category: "intake", description: "Which threshold applies: higher, lower, or both" },
```

**Step 3: Run seed and verify**

```bash
npx tsx prisma/seed.ts
```

Expected: "Created 106 service catalog entries" (55 existing + 51 new) and intake settings created.

**Step 4: Build verify**

```bash
npx next build
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed 51 new services (6 categories) + intake tolerance settings"
```

---

## Task 2: Intake Level Detection Utility

**Files:**
- Create: `src/lib/intake-levels.ts`

**Step 1: Create the intake level utility**

```typescript
// src/lib/intake-levels.ts

export type IntakeLevel = 1 | 2 | 3;

/**
 * Maps service categories to their required intake documentation level.
 * Level 1 = Quick (~2min): basic PMS/electrical/tire work
 * Level 2 = Standard (~3min): mechanical repair, paint correction
 * Level 3 = Full (~5min): collision, paint, detailing, undercoating, restoration
 */
export const CATEGORY_LEVEL_MAP: Record<string, IntakeLevel> = {
  // Level 1 — Quick
  "Preventive Maintenance": 1,
  "Tire & Alignment": 1,
  "Electrical": 1,
  "Air Conditioning": 1,
  "Diagnostics & Inspection": 1,
  "Accessories & Add-ons": 1,

  // Level 2 — Standard
  "Mechanical Repair": 2,
  "Buffing & Paint Correction": 2,

  // Level 3 — Full
  "Collision Repair": 3,
  "Painting & Refinishing": 3,
  "Car Detailing": 3,
  "Undercoating & Rust Protection": 3,
  "Car Restoration": 3,
};

/**
 * Returns the highest intake level required by any of the selected categories.
 * Unknown categories default to Level 2 (standard) for safety.
 */
export function getIntakeLevel(categories: string[]): IntakeLevel {
  if (categories.length === 0) return 1;
  let max: IntakeLevel = 1;
  for (const cat of categories) {
    const level = CATEGORY_LEVEL_MAP[cat] ?? 2;
    if (level > max) max = level;
  }
  return max;
}

/** Human-readable labels for each level */
export const INTAKE_LEVEL_LABELS: Record<IntakeLevel, { name: string; description: string; time: string }> = {
  1: { name: "Quick", description: "4 exterior photos, quick sign-off", time: "~2 min" },
  2: { name: "Standard", description: "8 photos, belongings, advisor signature", time: "~3 min" },
  3: { name: "Full", description: "15+ photos, damage map, dual signatures", time: "~5 min" },
};

/** Step IDs that each level includes */
export const INTAKE_LEVEL_STEPS: Record<IntakeLevel, string[]> = {
  1: ["plate-lookup", "services", "quick-photos", "details", "assignment", "quick-signoff"],
  2: ["plate-lookup", "services", "focused-photos", "details", "belongings-fuel", "assignment", "advisor-signoff"],
  3: ["plate-lookup", "services", "walkaround-photos", "damage-map", "details", "belongings-fuel", "estimate-review", "assignment", "full-signoff"],
};

/** Photo counts per level */
export const INTAKE_PHOTO_COUNTS: Record<IntakeLevel, { min: number; label: string }> = {
  1: { min: 4, label: "4 quick exterior" },
  2: { min: 8, label: "8 focused" },
  3: { min: 15, label: "15+ walkaround" },
};

/** Quick exterior shots for Level 1 */
export const QUICK_EXTERIOR_SHOTS = [
  { id: "front", label: "Front", description: "Full front view" },
  { id: "rear", label: "Rear", description: "Full rear view" },
  { id: "driver-side", label: "Driver Side", description: "Full driver side" },
  { id: "passenger-side", label: "Passenger Side", description: "Full passenger side" },
];

/** Focused shots for Level 2 — 4 exterior + 4 work-area (determined by category) */
export const FOCUSED_WORK_AREA_SHOTS: Record<string, { id: string; label: string; description: string }[]> = {
  "Mechanical Repair": [
    { id: "engine-bay", label: "Engine Bay", description: "Open hood, engine visible" },
    { id: "undercarriage-front", label: "Undercarriage Front", description: "Under front of vehicle" },
    { id: "undercarriage-rear", label: "Undercarriage Rear", description: "Under rear of vehicle" },
    { id: "work-area-closeup", label: "Work Area", description: "Close-up of area to be repaired" },
  ],
  "Buffing & Paint Correction": [
    { id: "paint-defect-1", label: "Paint Defect 1", description: "Close-up of primary defect" },
    { id: "paint-defect-2", label: "Paint Defect 2", description: "Close-up of secondary area" },
    { id: "paint-overall", label: "Paint Overview", description: "Overall paint condition under light" },
    { id: "paint-gauge", label: "Paint Gauge", description: "Paint thickness measurement" },
  ],
};
```

**Step 2: Build verify**

```bash
npx next build
```

Expected: 0 errors. New file is a pure utility with no imports from components.

**Step 3: Commit**

```bash
git add src/lib/intake-levels.ts
git commit -m "feat: add intake level detection utility with category mapping"
```

---

## Task 3: Vehicle Plate Lookup API Route

**Files:**
- Create: `src/app/api/vehicles/lookup/route.ts`

**Step 1: Create the plate lookup API route**

This endpoint searches for a vehicle by plate number and returns the vehicle with its linked customer and visit history.

```typescript
// src/app/api/vehicles/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plate = request.nextUrl.searchParams.get("plate");
  if (!plate || plate.length < 3) {
    return NextResponse.json({ error: "Plate number too short" }, { status: 400 });
  }

  // Normalize: strip spaces and dashes, uppercase
  const normalized = plate.replace(/[\s-]/g, "").toUpperCase();

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      plateNumber: {
        contains: normalized,
      },
      deletedAt: null,
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      jobOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          intakeRecord: {
            select: { odometerReading: true },
          },
        },
      },
      _count: {
        select: {
          jobOrders: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  if (!vehicle) {
    return NextResponse.json({ found: false });
  }

  const lastJob = vehicle.jobOrders[0] || null;

  return NextResponse.json({
    found: true,
    vehicle: {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      vin: vehicle.vin,
      lastOdometer: lastJob?.intakeRecord?.odometerReading ?? null,
      lastVisitDate: lastJob?.createdAt ?? null,
      visitCount: vehicle._count.jobOrders,
    },
    customer: vehicle.customer
      ? {
          id: vehicle.customer.id,
          firstName: vehicle.customer.firstName,
          lastName: vehicle.customer.lastName,
          phone: vehicle.customer.phone,
          email: vehicle.customer.email,
        }
      : null,
  });
}
```

**Step 2: Build verify**

```bash
npx next build
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/app/api/vehicles/lookup/route.ts
git commit -m "feat: add vehicle plate lookup API route"
```

---

## Task 4: Walk-in Intake Server Actions & Service

**Files:**
- Create: `src/lib/services/walk-in-intake.ts`
- Modify: `src/lib/actions/intake-actions.ts` (add new actions)
- Modify: `src/lib/validators.ts` (add new schemas)

**Step 1: Add new Zod schemas to validators.ts**

Add these schemas to the end of `src/lib/validators.ts`:

```typescript
// Walk-in intake — new vehicle + customer creation
export const walkInVehicleSchema = z.object({
  plateNumber: z.string().min(1, "Plate number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().int().min(1950).max(2030).optional().nullable(),
  color: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
});
export type WalkInVehicleInput = z.infer<typeof walkInVehicleSchema>;

export const walkInCustomerSchema = z.object({
  firstName: z.string().min(1, "Customer name is required"),
  lastName: z.string().optional().default(""),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().nullable(),
});
export type WalkInCustomerInput = z.infer<typeof walkInCustomerSchema>;

export const walkInIntakeSchema = z.object({
  // Vehicle: either existing ID or new vehicle data
  vehicleId: z.string().optional().nullable(),
  newVehicle: walkInVehicleSchema.optional().nullable(),
  // Customer: either existing ID or new customer data
  customerId: z.string().optional().nullable(),
  newCustomer: walkInCustomerSchema.optional().nullable(),
  // Services
  serviceIds: z.array(z.string()).min(1, "At least one service is required"),
  // Intake level (auto-detected, may be upgraded by advisor)
  intakeLevel: z.coerce.number().int().min(1).max(3),
  // Vehicle condition (Level 2+)
  odometerReading: z.coerce.number().int().min(0).optional().nullable(),
  fuelLevel: z.string().default("HALF"),
  hasWarningLights: z.boolean().default(false),
  warningLightsNote: z.string().optional().nullable(),
  keysCount: z.coerce.number().int().min(0).default(1),
  // Assignment
  frontDeskLeadId: z.string().optional().nullable(),
  primaryTechnicianId: z.string().optional().nullable(),
  assistantTechnicianId: z.string().optional().nullable(),
  assignedBayId: z.string().optional().nullable(),
  priority: z.string().default("NORMAL"),
  internalNotes: z.string().optional().nullable(),
  // Signatures
  customerSignature: z.string().optional().nullable(),
  advisorSignature: z.string().optional().nullable(),
  // Linked estimate (Path C)
  estimateRequestId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
});
export type WalkInIntakeInput = z.infer<typeof walkInIntakeSchema>;

// Quick Job (emergency)
export const quickJobSchema = z.object({
  plateNumber: z.string().min(1, "Plate number is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Phone number is required"),
  reason: z.string().min(1, "Reason is required"),
  vehicleId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
});
export type QuickJobInput = z.infer<typeof quickJobSchema>;
```

**Step 2: Create the walk-in intake service**

Create `src/lib/services/walk-in-intake.ts`:

```typescript
// src/lib/services/walk-in-intake.ts
import prisma from "@/lib/prisma";
import type { WalkInIntakeInput, QuickJobInput } from "@/lib/validators";

/**
 * Creates a complete job pipeline from a walk-in intake:
 * Customer (if new) → Vehicle (if new) → EstimateRequest → Estimate with line items
 * → JobOrder → IntakeRecord → BayAssignment (if bay selected) → Tasks from services
 *
 * All in a single transaction.
 */
export async function createWalkInJob(
  input: WalkInIntakeInput,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    // 1. Resolve or create Customer
    let customerId = input.customerId;
    if (!customerId && input.newCustomer) {
      const customer = await tx.customer.create({
        data: {
          firstName: input.newCustomer.firstName,
          lastName: input.newCustomer.lastName || "",
          phone: input.newCustomer.phone,
          email: input.newCustomer.email || null,
        },
      });
      customerId = customer.id;
    }
    if (!customerId) throw new Error("Customer is required");

    // 2. Resolve or create Vehicle
    let vehicleId = input.vehicleId;
    if (!vehicleId && input.newVehicle) {
      const vehicle = await tx.vehicle.create({
        data: {
          customerId,
          plateNumber: input.newVehicle.plateNumber.replace(/[\s-]/g, "").toUpperCase(),
          make: input.newVehicle.make.toUpperCase(),
          model: input.newVehicle.model.toUpperCase(),
          year: input.newVehicle.year || null,
          color: input.newVehicle.color || null,
          vin: input.newVehicle.vin || null,
        },
      });
      vehicleId = vehicle.id;
    }
    if (!vehicleId) throw new Error("Vehicle is required");

    // 3. Get selected services for estimate line items
    const services = await tx.serviceCatalog.findMany({
      where: { id: { in: input.serviceIds }, deletedAt: null },
    });

    // 4. Generate estimate request number
    const seqSetting = await tx.setting.findUnique({ where: { key: "next_est_sequence" } });
    const seq = seqSetting ? parseInt(seqSetting.value, 10) : 1;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const estNumber = `EST-${dateStr}-${String(seq).padStart(4, "0")}`;

    await tx.setting.update({
      where: { key: "next_est_sequence" },
      data: { value: String(seq + 1) },
    });

    // 5. Create EstimateRequest
    const categories = [...new Set(services.map((s) => s.category))];
    const estimateRequest = await tx.estimateRequest.create({
      data: {
        requestNumber: estNumber,
        customerId,
        vehicleId,
        status: "ESTIMATE_APPROVED",
        requestedCategories: JSON.stringify(categories),
        description: `Walk-in intake — ${services.map((s) => s.name).join(", ")}`,
        isInsuranceClaim: input.priority === "INSURANCE",
        createdById: userId,
      },
    });

    // 6. Create Estimate with version
    const estimate = await tx.estimate.create({
      data: {
        estimateRequestId: estimateRequest.id,
        createdById: userId,
      },
    });

    // Build line items from services
    const laborRate = services[0]?.defaultLaborRate ?? 50000;
    let subtotal = 0;
    const lineItems = services.map((svc, i) => {
      const amount = Math.round(svc.defaultEstimatedHours * svc.defaultLaborRate);
      subtotal += amount;
      return {
        group: "LABOR" as const,
        description: svc.name,
        quantity: svc.defaultEstimatedHours,
        unitPrice: svc.defaultLaborRate,
        amount,
        sortOrder: i + 1,
        serviceCatalogId: svc.id,
      };
    });

    // VAT
    const vatSetting = await tx.setting.findUnique({ where: { key: "vat_rate" } });
    const vatRate = vatSetting ? parseFloat(vatSetting.value) : 12;
    const vatAmount = Math.round(subtotal * (vatRate / 100));
    const grandTotal = subtotal + vatAmount;

    await tx.estimateVersion.create({
      data: {
        estimateId: estimate.id,
        versionNumber: 1,
        versionLabel: "Walk-in Estimate",
        subtotal,
        vatRate,
        vatAmount,
        grandTotal,
        status: "APPROVED",
        lineItems: { create: lineItems },
        createdById: userId,
      },
    });

    // 7. Generate job order number
    const joSeq = await tx.setting.findUnique({ where: { key: "next_jo_sequence" } });
    const joNum = joSeq ? parseInt(joSeq.value, 10) : 1;
    const joNumber = `JO-${dateStr}-${String(joNum).padStart(4, "0")}`;
    await tx.setting.update({
      where: { key: "next_jo_sequence" },
      data: { value: String(joNum + 1) },
    });

    // 8. Create JobOrder
    const jobOrder = await tx.jobOrder.create({
      data: {
        jobOrderNumber: joNumber,
        customerId,
        vehicleId,
        estimateRequestId: estimateRequest.id,
        status: "CHECKED_IN",
        priority: input.priority || "NORMAL",
        primaryTechnicianId: input.primaryTechnicianId || null,
        assignedBayId: input.assignedBayId || null,
        internalNotes: input.internalNotes || null,
        isInsuranceJob: input.priority === "INSURANCE",
        createdById: userId,
      },
    });

    // 9. Create IntakeRecord
    const intakeTermsSetting = await tx.setting.findUnique({ where: { key: "intake_authorization_terms" } });
    const authTerms = intakeTermsSetting ? JSON.parse(intakeTermsSetting.value) : "";

    const intakeRecord = await tx.intakeRecord.create({
      data: {
        jobOrderId: jobOrder.id,
        odometerReading: input.odometerReading || null,
        fuelLevel: input.fuelLevel || "HALF",
        hasWarningLights: input.hasWarningLights || false,
        warningLightsNote: input.warningLightsNote || null,
        keysCount: input.keysCount ?? 1,
        customerSignature: input.customerSignature || null,
        customerSignedAt: input.customerSignature ? new Date() : null,
        advisorSignature: input.advisorSignature || null,
        advisorSignedAt: input.advisorSignature ? new Date() : null,
        advisorId: userId,
        authorizationTerms: authTerms,
        completedAt: new Date(),
      },
    });

    // 10. Create Tasks from services
    for (let i = 0; i < services.length; i++) {
      await tx.task.create({
        data: {
          jobOrderId: jobOrder.id,
          serviceCatalogId: services[i].id,
          title: services[i].name,
          description: services[i].description || null,
          status: "QUEUED",
          estimatedHours: services[i].defaultEstimatedHours,
          sortOrder: i + 1,
          assignedTechnicianId: input.primaryTechnicianId || null,
        },
      });
    }

    // 11. Bay assignment (if bay selected)
    if (input.assignedBayId) {
      await tx.bayAssignment.create({
        data: {
          bayId: input.assignedBayId,
          jobOrderId: jobOrder.id,
          startDate: new Date(),
        },
      });
    }

    // 12. Update appointment status if linked
    if (input.appointmentId) {
      await tx.appointment.update({
        where: { id: input.appointmentId },
        data: { status: "COMPLETED" },
      });
    }

    // 13. Log activity
    await tx.jobActivity.create({
      data: {
        jobOrderId: jobOrder.id,
        activityType: "status_change",
        description: `Vehicle checked in via ${input.intakeLevel === 1 ? "quick" : input.intakeLevel === 2 ? "standard" : "full"} intake`,
        performedById: userId,
        metadata: JSON.stringify({
          intakeLevel: input.intakeLevel,
          fromStatus: null,
          toStatus: "CHECKED_IN",
        }),
      },
    });

    return {
      jobOrder,
      intakeRecord,
      estimateRequest,
    };
  });
}

/**
 * Creates a minimal "quick job" with incomplete intake flag.
 */
export async function createQuickJob(input: QuickJobInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    // Resolve or create customer
    let customerId = input.customerId;
    if (!customerId) {
      const nameParts = input.customerName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";
      const customer = await tx.customer.create({
        data: { firstName, lastName, phone: input.customerPhone },
      });
      customerId = customer.id;
    }

    // Resolve or create vehicle
    let vehicleId = input.vehicleId;
    if (!vehicleId) {
      const vehicle = await tx.vehicle.create({
        data: {
          customerId,
          plateNumber: input.plateNumber.replace(/[\s-]/g, "").toUpperCase(),
          make: "TBD",
          model: "TBD",
        },
      });
      vehicleId = vehicle.id;
    }

    // Generate JO number
    const joSeq = await tx.setting.findUnique({ where: { key: "next_jo_sequence" } });
    const joNum = joSeq ? parseInt(joSeq.value, 10) : 1;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const joNumber = `JO-${dateStr}-${String(joNum).padStart(4, "0")}`;
    await tx.setting.update({
      where: { key: "next_jo_sequence" },
      data: { value: String(joNum + 1) },
    });

    const jobOrder = await tx.jobOrder.create({
      data: {
        jobOrderNumber: joNumber,
        customerId,
        vehicleId,
        status: "CHECKED_IN",
        priority: "NORMAL",
        internalNotes: `QUICK JOB: ${input.reason}`,
        incompleteIntake: true,
        createdById: userId,
      },
    });

    // Minimal intake record
    await tx.intakeRecord.create({
      data: {
        jobOrderId: jobOrder.id,
        fuelLevel: "HALF",
        keysCount: 1,
      },
    });

    await tx.jobActivity.create({
      data: {
        jobOrderId: jobOrder.id,
        activityType: "status_change",
        description: `Quick job created: ${input.reason}`,
        performedById: userId,
        metadata: JSON.stringify({ quickJob: true, reason: input.reason }),
      },
    });

    return jobOrder;
  });
}
```

**Step 3: Add `incompleteIntake` field to JobOrder schema**

Add to `prisma/schema.prisma` in the JobOrder model:

```prisma
incompleteIntake Boolean @default(false)
```

Run migration:

```bash
npx prisma db push
```

**Step 4: Add new server actions to intake-actions.ts**

Append to `src/lib/actions/intake-actions.ts`:

```typescript
import { walkInIntakeSchema, quickJobSchema } from "@/lib/validators";
import { createWalkInJob, createQuickJob } from "@/lib/services/walk-in-intake";

// ---------------------------------------------------------------------------
// 9. createWalkInIntakeAction
// ---------------------------------------------------------------------------
export async function createWalkInIntakeAction(
  input: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = walkInIntakeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await createWalkInJob(parsed.data, session.user.id);
    revalidatePath("/schedule/floor");
    revalidatePath("/jobs");
    return {
      success: true,
      data: {
        jobOrderId: result.jobOrder.id,
        intakeRecordId: result.intakeRecord.id,
        jobOrderNumber: result.jobOrder.jobOrderNumber,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create job";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 10. createQuickJobAction
// ---------------------------------------------------------------------------
export async function createQuickJobAction(
  input: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = quickJobSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const jobOrder = await createQuickJob(parsed.data, session.user.id);
    revalidatePath("/schedule/floor");
    revalidatePath("/jobs");
    return {
      success: true,
      data: {
        jobOrderId: jobOrder.id,
        jobOrderNumber: jobOrder.jobOrderNumber,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create quick job";
    return { success: false, error: message };
  }
}
```

**Step 5: Build verify**

```bash
npx next build
```

Expected: 0 errors.

**Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/validators.ts src/lib/services/walk-in-intake.ts src/lib/actions/intake-actions.ts
git commit -m "feat: add walk-in intake service, quick job, and server actions"
```

---

## Task 5: Dark-Theme CSS Variable Migration for Intake Components

**Files:**
- Modify: `src/components/intake/walkaround-capture.tsx` (hardcoded Tailwind colors → CSS variables)
- Modify: `src/components/intake/car-svg.tsx` (hardcoded hex → CSS variables)
- Modify: `src/components/intake/belongings-checklist.tsx` (hardcoded green → CSS variables)
- Modify: `src/components/intake/fuel-gauge.tsx` (hardcoded accent → CSS variables)
- Modify: `src/components/intake/authorization-form.tsx` (hardcoded surface → CSS variables)

**Context:** These components currently use hardcoded Tailwind classes (e.g., `bg-amber-500`, `text-green-500`) and inline hex colors in SVGs. They need to support the `--sch-*` CSS variable system so they render correctly in the scheduler's dark theme. The dashboard uses its own theme, so these components should detect which context they're in and use the appropriate styles.

**Approach:** Add a `darkMode?: boolean` prop to each component. When `darkMode` is true, use inline `style={{ ... }}` with `var(--sch-*)` variables. When false, use existing Tailwind classes. This avoids breaking the dashboard intake flow.

**Step 1: Migrate WalkaroundCapture**

Add `darkMode?: boolean` prop. When `darkMode=true`:
- Replace `bg-amber-500` progress indicators with `style={{ background: "var(--sch-accent)" }}`
- Replace `text-green-500` completed indicators with `style={{ color: "#34D399" }}`
- Replace `bg-gray-*` containers with `style={{ background: "var(--sch-surface)" }}`
- Replace `border-gray-*` with `style={{ borderColor: "var(--sch-border)" }}`
- Replace `text-gray-*` labels with `style={{ color: "var(--sch-text-muted)" }}`

**Step 2: Migrate CarSvg**

Replace hardcoded `SEVERITY_FILLS` hex values with CSS variable versions when `darkMode=true`:
- Green (#bbf7d0) → keep (good contrast on dark)
- Yellow (#fef08a) → keep
- Orange (#fed7aa) → keep
- Red (#fecaca) → keep
These SVG fills are light-toned and work on both dark/light backgrounds. Main change: zone hover/stroke colors.

**Step 3: Migrate BelongingsChecklist**

Add `darkMode?: boolean`. When true:
- Replace `bg-green-500` checked state with `style={{ background: "var(--sch-accent)" }}`
- Replace `bg-green-50` container with `style={{ background: "var(--sch-surface)" }}`
- Replace text colors with CSS variables

**Step 4: Migrate FuelGauge**

Add `darkMode?: boolean`. When true:
- Replace `bg-accent` with `style={{ background: "var(--sch-accent)" }}`
- Replace `bg-white` with `style={{ background: "var(--sch-surface)" }}`

**Step 5: Migrate AuthorizationForm**

Add `darkMode?: boolean`. When true:
- Summary card backgrounds → `var(--sch-surface)`
- Border colors → `var(--sch-border)`
- Text colors → `var(--sch-text)`, `var(--sch-text-muted)`

**Step 6: Build verify**

```bash
npx next build
```

Expected: 0 errors. Existing dashboard intake flow unaffected (darkMode defaults to false).

**Step 7: Commit**

```bash
git add src/components/intake/
git commit -m "feat: add dark mode support to intake components via CSS variables"
```

---

## Task 6: Schedule Intake Wizard — Plate Lookup Step

**Files:**
- Create: `src/components/schedule/intake-plate-lookup.tsx`

**Step 1: Build the plate lookup component**

```typescript
// Key behaviors:
// - Large input for plate number entry
// - Debounced fetch to /api/vehicles/lookup?plate=XXX (500ms, after 3+ chars)
// - Shows vehicle + customer card when found
// - Three action buttons: "Use This Vehicle", "Different Customer", "New Vehicle + New Customer"
// - Calls onComplete callback with lookup result
// - Fully styled with --sch-* CSS variables

interface PlateLookupResult {
  mode: "existing" | "existing-diff-customer" | "new";
  vehicleId?: string;
  customerId?: string;
  vehicle?: { plateNumber: string; make: string; model: string; year: number | null; color: string | null; vin: string | null; lastOdometer: number | null };
  customer?: { firstName: string; lastName: string; phone: string; email: string | null };
  visitCount?: number;
  lastVisitDate?: string;
  plateNumber?: string; // for new vehicles — carries the typed plate forward
}

interface IntakePlateLookupProps {
  onComplete: (result: PlateLookupResult) => void;
  prefilledPlate?: string; // from appointment or estimate
}
```

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/intake-plate-lookup.tsx
git commit -m "feat: add intake plate lookup component with debounced search"
```

---

## Task 7: Schedule Intake Wizard — Service Selection Step

**Files:**
- Create: `src/components/schedule/intake-service-select.tsx`

**Step 1: Build the service selection component**

```typescript
// Key behaviors:
// - Fetches /api/service-catalog for all services grouped by category
// - "Check-Up Only" toggle at top (selects Diagnostics & Inspection → Check-Up Only service)
// - Multi-column checkbox grid grouped by category
// - Shows detected intake level after selection changes
// - "Upgrade to Standard/Full" button (can upgrade, never downgrade)
// - Pre-selects services if linked to existing estimate
// - Calls onComplete with selected serviceIds and final intake level

interface IntakeServiceSelectProps {
  onComplete: (serviceIds: string[], categories: string[], intakeLevel: IntakeLevel) => void;
  preselectedServiceIds?: string[];  // from linked estimate
  onBack: () => void;
}
```

Uses `getIntakeLevel()` from `src/lib/intake-levels.ts`.

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/intake-service-select.tsx
git commit -m "feat: add intake service selection component with level detection"
```

---

## Task 8: Schedule Intake Wizard — Quick Photos Step (Level 1 & 2)

**Files:**
- Create: `src/components/schedule/intake-quick-photos.tsx`

**Step 1: Build the quick photos component**

```typescript
// Key behaviors:
// - Level 1: 4 exterior shots in 2x2 grid (from QUICK_EXTERIOR_SHOTS)
// - Level 2: 4 exterior + 4 work-area shots (from FOCUSED_WORK_AREA_SHOTS based on categories)
// - Each shot: large camera button, shows thumbnail after capture
// - Uploads to /api/photos/upload with stage="INTAKE"
// - Simple progress counter: "3/4 photos captured"
// - "Continue" enabled when minimum met (all required shots captured)
// - Skip button for Level 1 (convenience, not recommended)

interface IntakeQuickPhotosProps {
  intakeLevel: 1 | 2;
  intakeRecordId: string;
  jobOrderNumber: string;
  categories: string[];
  onComplete: () => void;
  onBack: () => void;
}
```

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/intake-quick-photos.tsx
git commit -m "feat: add quick photos component for Level 1 & 2 intake"
```

---

## Task 9: Schedule Intake Wizard — Customer/Vehicle Details Step

**Files:**
- Create: `src/components/schedule/intake-details-form.tsx`

**Step 1: Build the details form component**

```typescript
// Key behaviors:
// - Returning vehicle: read-only summary card with Edit toggle
// - New vehicle: full form (Year dropdown, Make text/dropdown, Model, VIN, Plate, Color)
// - Customer section: returning = summary card, new = Name + Phone + Email
// - Odometer ALWAYS editable (shows last recorded value for reference)
// - "Different Customer" mode: vehicle summary + blank customer form + customer search
// - Validates required fields before allowing Continue

interface IntakeDetailsFormProps {
  lookupResult: PlateLookupResult;
  onComplete: (details: {
    vehicleId?: string;
    newVehicle?: WalkInVehicleInput;
    customerId?: string;
    newCustomer?: WalkInCustomerInput;
    odometerReading: number | null;
  }) => void;
  onBack: () => void;
}
```

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/intake-details-form.tsx
git commit -m "feat: add intake customer/vehicle details form component"
```

---

## Task 10: Schedule Intake Wizard — Assignment Step

**Files:**
- Create: `src/components/schedule/intake-assignment.tsx`

**Step 1: Build the assignment component**

```typescript
// Key behaviors:
// - Front Desk Lead dropdown (ADVISOR role users, required)
// - Lead Mechanic dropdown (TECHNICIAN role users, optional — "Assign later...")
// - Assistant Mechanic dropdown (only after lead selected, optional)
// - Bay dropdown (all active bays, shows availability status)
// - Priority radio: Normal / Rush / Insurance
// - Internal Notes textarea
// - Fetches users from /api/users?role=ADVISOR and /api/users?role=TECHNICIAN
// - Fetches bays from /api/bays/live-floor for availability

interface IntakeAssignmentProps {
  onComplete: (assignment: {
    frontDeskLeadId: string;
    primaryTechnicianId: string | null;
    assistantTechnicianId: string | null;
    assignedBayId: string | null;
    priority: string;
    internalNotes: string | null;
  }) => void;
  onBack: () => void;
  prefilledTechId?: string;
  prefilledBayId?: string;
}
```

**Step 2: Check if `/api/users` route exists. If not, create a minimal one:**

```typescript
// src/app/api/users/route.ts — only if it doesn't exist
// GET /api/users?role=ADVISOR — returns users filtered by role
```

**Step 3: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/intake-assignment.tsx src/app/api/users/route.ts
git commit -m "feat: add intake assignment step with tech/bay/priority selection"
```

---

## Task 11: Schedule Intake Wizard — Quick Sign-off (Level 1 & 2)

**Files:**
- Create: `src/components/schedule/intake-quick-signoff.tsx`

**Step 1: Build the quick sign-off component**

```typescript
// Key behaviors:
// Level 1: Summary card + "Confirm & Create Job" button. No signatures.
//   Shows: vehicle, customer, services, assigned tech/bay
// Level 2: Summary card + advisor SignaturePad + "Create Job" button.
//   Uses existing SignaturePad component from src/components/ui/signature-pad.tsx
// Both: Confirmation dialog before final submit
// Calls onComplete with signature data (null for Level 1)

interface IntakeQuickSignoffProps {
  intakeLevel: 1 | 2;
  summary: {
    vehicle: { plateNumber: string; make: string; model: string };
    customer: { firstName: string; lastName: string };
    services: string[];
    techName: string | null;
    bayName: string | null;
    priority: string;
  };
  onComplete: (signatures: { customerSignature: string | null; advisorSignature: string | null }) => void;
  onBack: () => void;
  submitting: boolean;
}
```

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/intake-quick-signoff.tsx
git commit -m "feat: add quick sign-off component for Level 1 & 2 intake"
```

---

## Task 12: Schedule Intake Wizard — Orchestrator

**Files:**
- Create: `src/components/schedule/intake-wizard.tsx`
- Create: `src/app/(schedule)/schedule/floor/intake/page.tsx`

**Step 1: Build the wizard orchestrator**

This is the central component. It:
- Manages wizard state (current step, collected data from all steps)
- Dynamically renders steps based on intake level (from `INTAKE_LEVEL_STEPS`)
- Handles the three entry paths via URL search params:
  - No params = walk-in (Path A)
  - `?appointmentId=XXX` = scheduled arrival (Path B)
  - `?appointmentId=XXX&estimateId=YYY` = estimate-linked (Path C)
- Pre-fills data when appointment/estimate params are present
- On final step completion, calls `createWalkInIntakeAction()` with all collected data
- Shows success state with JO number and "View on Board" link
- Full-screen overlay within scheduler layout (covers floor page)
- Progress indicator showing current step / total steps
- Back button on all steps except first

```typescript
"use client";

// Orchestrator state shape:
interface WizardState {
  // Step 1 result
  plateLookup: PlateLookupResult | null;
  // Step 2 result
  serviceIds: string[];
  categories: string[];
  intakeLevel: IntakeLevel;
  // Step 3 — photos uploaded to server, just track completion
  photosComplete: boolean;
  // Step 4 — damage entries (Level 3 only, saved to server via actions)
  damageComplete: boolean;
  // Step 5
  details: { vehicleId?; newVehicle?; customerId?; newCustomer?; odometerReading? } | null;
  // Step 6 — belongings/fuel (Level 2+, saved to server)
  belongingsFuelComplete: boolean;
  fuelLevel: string;
  hasWarningLights: boolean;
  warningLightsNote: string;
  keysCount: number;
  // Step 7 — estimate review (Level 3 + linked estimate only)
  estimateReviewComplete: boolean;
  // Step 8
  assignment: { frontDeskLeadId; primaryTechnicianId; assistantTechnicianId; assignedBayId; priority; internalNotes } | null;
  // Step 9 — signatures
  customerSignature: string | null;
  advisorSignature: string | null;
}
```

**Step 2: Create the intake page**

```typescript
// src/app/(schedule)/schedule/floor/intake/page.tsx
"use client";

import dynamic from "next/dynamic";

const IntakeWizard = dynamic(
  () => import("@/components/schedule/intake-wizard").then((m) => ({ default: m.IntakeWizard })),
  { ssr: false }
);

export default function IntakePage() {
  return <IntakeWizard />;
}
```

**Step 3: Build verify**

```bash
npx next build
```

Expected: 0 errors, new route `/schedule/floor/intake` appears in build output.

**Step 4: Commit**

```bash
git add src/components/schedule/intake-wizard.tsx src/app/(schedule)/schedule/floor/intake/page.tsx
git commit -m "feat: add schedule intake wizard orchestrator with adaptive steps"
```

---

## Task 13: Quick Job Modal

**Files:**
- Create: `src/components/schedule/quick-job-modal.tsx`

**Step 1: Build the quick job modal**

```typescript
// Key behaviors:
// - Opens from "⚡ Quick Job" button on floor page
// - Minimal form: Plate, Customer Name, Phone, Reason
// - Plate field does quick lookup (reuse debounced logic from plate-lookup)
// - If plate found, auto-fills customer + shows "Returning vehicle" badge
// - "Create Job" calls createQuickJobAction()
// - Success: toast with JO number, close modal, refresh floor data
// - Warning text: "⚠ This creates an incomplete job. Full intake must be completed later."

interface QuickJobModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;  // triggers floor data refresh
}
```

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/quick-job-modal.tsx
git commit -m "feat: add quick job emergency modal"
```

---

## Task 14: Wire Intake & Quick Job into Live Floor

**Files:**
- Modify: `src/components/schedule/live-floor.tsx` (add buttons, import modal)

**Step 1: Add action bar to live-floor.tsx**

Below the stats bar and above the bay grid, add an action bar with three buttons:

```tsx
{/* Action bar */}
<div className="flex items-center justify-between">
  <div className="flex gap-2">
    {/* Left: filters placeholder */}
  </div>
  <div className="flex gap-2">
    <Link
      href="/schedule/floor/intake"
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
      style={{ background: "#3B82F6" }}
    >
      <Plus className="h-4 w-4" />
      New Intake
    </Link>
    <button
      onClick={() => setQuickJobOpen(true)}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
      style={{ background: "var(--sch-surface)", color: "var(--sch-text)", border: "1px solid var(--sch-border)" }}
    >
      <Zap className="h-4 w-4" />
      Quick Job
    </button>
  </div>
</div>
```

Add QuickJobModal import and state.

**Step 2: Add EOD Report and History buttons**

Below the job board section:

```tsx
<div className="flex gap-2 mt-4">
  <Link
    href="/schedule/registry?view=eod"
    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
    style={{ background: "#059669", color: "white" }}
  >
    <FileText className="h-4 w-4" />
    EOD Report
  </Link>
  <Link
    href="/schedule/registry"
    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
    style={{ background: "#7C3AED", color: "white" }}
  >
    <History className="h-4 w-4" />
    History
  </Link>
</div>
```

**Step 3: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/live-floor.tsx
git commit -m "feat: wire intake wizard and quick job into live floor page"
```

---

## Task 15: CBROS Board Features — Card Enhancements

**Files:**
- Modify: `src/components/schedule/job-board-card.tsx` (add expand/collapse, bay badge, status arrows, Done/Paid)
- Modify: `src/components/schedule/job-board.tsx` (add Collapse All, pass new props)
- Modify: `src/components/schedule/live-floor-types.ts` (extend LiveFloorJob with new fields)

**Step 1: Extend LiveFloorJob type**

Add to `LiveFloorJob` in `live-floor-types.ts`:

```typescript
// Add to LiveFloorJob
bayName: string | null;
intakeTime: string | null;           // createdAt formatted
serviceStartedAt: string | null;     // first task startedAt
serviceDoneAt: string | null;        // last task completedAt
services: string[];                  // service names from tasks
incompleteIntake: boolean;
```

**Step 2: Update `/api/bays/live-floor` to return new fields**

Modify the API route query to include:
- `bay.name` for `bayName` (from bay assignment)
- `tasks` for service names
- `intakeRecord.completedAt` as intakeTime
- `incompleteIntake` boolean
- First/last task dates for serviceStartedAt/serviceDoneAt

**Step 3: Enhance JobBoardCard**

Add to the card:
- **Bay badge**: small colored pill showing bay name (if assigned)
- **Expand/Collapse**: collapsed by default shows JO#, vehicle, status only. Expanded shows tech, customer, services list, intake time, bay. Chevron toggle.
- **< > arrows**: visible on hover. Left/right buttons that call `updateJobOrderStatus()` for valid transitions. Only show valid directions.
- **Done/Paid button**: green button, visible for QC_PASSED+ statuses. Advances through: QC_PASSED → AWAITING_PAYMENT → FULLY_PAID → RELEASED.
- **Incomplete intake badge**: orange `⚠ INCOMPLETE` pill when `incompleteIntake` is true.

**Step 4: Add Collapse All to JobBoard**

Add "Collapse All" / "Expand All" toggle button in the board toolbar (next to the Board/List toggle).

**Step 5: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/job-board-card.tsx src/components/schedule/job-board.tsx src/components/schedule/live-floor-types.ts src/app/api/bays/live-floor/route.ts
git commit -m "feat: add CBROS board features — expand/collapse, bay badge, arrows, done/paid"
```

---

## Task 16: CBROS List View Enhancements

**Files:**
- Modify: `src/components/schedule/live-floor-jobs-table.tsx` (add columns, Done/Paid, Unassigned filter)

**Step 1: Add new columns to list view**

Match the screenshot layout:
- Queue # (with date below)
- Intake Time
- Status (colored pill)
- Vehicle (make model + plate badge below)
- Customer (name + phone below)
- Mechanic (name or red "Unassigned")
- Service Started (datetime)
- Service Done (datetime or "—")
- Actions column: Done/Paid button

**Step 2: Add Unassigned and Parts Ordered filter tabs**

Add to FILTER_TABS:
```typescript
{ key: "unassigned", label: "Unassigned" },
{ key: "parts", label: "Parts Ordered" },
```

Unassigned filter: `job.primaryTechnician === null`

**Step 3: Quick-assign dropdown for unassigned jobs**

When a job has no technician, the Mechanic column shows a dropdown instead of just "Unassigned". Selecting a tech calls a server action to assign them.

**Step 4: Build verify + Commit**

```bash
npx next build
git add src/components/schedule/live-floor-jobs-table.tsx
git commit -m "feat: enhance list view with columns, done/paid, unassigned filter, quick-assign"
```

---

## Task 17: Status Transition Server Action

**Files:**
- Create: `src/lib/actions/job-status-actions.ts`

**Step 1: Create the status advancement action**

```typescript
// src/lib/actions/job-status-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/estimate-actions";

const VALID_TRANSITIONS: Record<string, string[]> = {
  CHECKED_IN: ["IN_PROGRESS"],
  IN_PROGRESS: ["CHECKED_IN", "QC_PENDING"],
  QC_PENDING: ["IN_PROGRESS", "QC_PASSED", "QC_FAILED_REWORK"],
  QC_PASSED: ["QC_PENDING", "AWAITING_PAYMENT"],
  QC_FAILED_REWORK: ["IN_PROGRESS"],
  AWAITING_PAYMENT: ["QC_PASSED", "PARTIAL_PAYMENT", "FULLY_PAID"],
  PARTIAL_PAYMENT: ["FULLY_PAID"],
  FULLY_PAID: ["RELEASED"],
  RELEASED: [],
};

export async function advanceJobStatusAction(
  jobOrderId: string,
  direction: "forward" | "backward"
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const job = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { status: true },
  });
  if (!job) return { success: false, error: "Job not found" };

  const transitions = VALID_TRANSITIONS[job.status] || [];
  if (transitions.length === 0) return { success: false, error: "No valid transitions" };

  // Forward = next status in the natural flow, Backward = first entry (previous)
  const newStatus = direction === "forward" ? transitions[transitions.length > 1 ? 1 : 0] : transitions[0];
  if (!newStatus) return { success: false, error: "Cannot move in that direction" };

  await prisma.jobOrder.update({
    where: { id: jobOrderId },
    data: {
      status: newStatus,
      ...(newStatus === "RELEASED" ? { actualCompletionDate: new Date() } : {}),
    },
  });

  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      activityType: "status_change",
      description: `Status changed from ${job.status} to ${newStatus}`,
      performedById: session.user.id,
      metadata: JSON.stringify({ fromStatus: job.status, toStatus: newStatus }),
    },
  });

  revalidatePath("/schedule/floor");
  revalidatePath("/jobs");
  return { success: true, data: { newStatus } };
}

/** Quick "Done/Paid" advancement — skips through to RELEASED */
export async function markDonePaidAction(
  jobOrderId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const job = await prisma.jobOrder.findUnique({
    where: { id: jobOrderId },
    select: { status: true },
  });
  if (!job) return { success: false, error: "Job not found" };

  // Determine next "done" status based on current
  const DONE_FLOW: Record<string, string> = {
    QC_PASSED: "AWAITING_PAYMENT",
    AWAITING_PAYMENT: "FULLY_PAID",
    PARTIAL_PAYMENT: "FULLY_PAID",
    FULLY_PAID: "RELEASED",
  };

  const newStatus = DONE_FLOW[job.status];
  if (!newStatus) return { success: false, error: `Cannot mark done/paid from ${job.status}` };

  await prisma.jobOrder.update({
    where: { id: jobOrderId },
    data: {
      status: newStatus,
      ...(newStatus === "RELEASED" ? { actualCompletionDate: new Date() } : {}),
    },
  });

  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      activityType: "status_change",
      description: `Quick advance: ${job.status} → ${newStatus}`,
      performedById: session.user.id,
      metadata: JSON.stringify({ fromStatus: job.status, toStatus: newStatus, quickAdvance: true }),
    },
  });

  revalidatePath("/schedule/floor");
  revalidatePath("/jobs");
  return { success: true, data: { newStatus } };
}

/** Quick-assign technician to job */
export async function quickAssignTechAction(
  jobOrderId: string,
  technicianId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.jobOrder.update({
    where: { id: jobOrderId },
    data: { primaryTechnicianId: technicianId },
  });

  // Also assign tech to all unassigned tasks
  await prisma.task.updateMany({
    where: {
      jobOrderId,
      assignedTechnicianId: null,
      deletedAt: null,
    },
    data: { assignedTechnicianId: technicianId },
  });

  await prisma.jobActivity.create({
    data: {
      jobOrderId,
      activityType: "assignment_change",
      description: "Technician assigned via quick-assign",
      performedById: session.user.id,
      metadata: JSON.stringify({ technicianId }),
    },
  });

  revalidatePath("/schedule/floor");
  revalidatePath("/jobs");
  return { success: true };
}
```

**Step 2: Build verify + Commit**

```bash
npx next build
git add src/lib/actions/job-status-actions.ts
git commit -m "feat: add job status transition, done/paid, and quick-assign actions"
```

---

## Task 18: Final Build Verification & Integration Testing

**Step 1: Full build**

```bash
npx next build
```

Expected: 0 TypeScript errors, all routes render.

**Step 2: Re-seed database**

```bash
npx tsx prisma/seed.ts
```

Expected: 106 services seeded.

**Step 3: Browser verification**

Start dev server, navigate to `/schedule/floor`:
- Verify `+ New Intake` button appears
- Verify `Quick Job` button appears
- Click `+ New Intake` → verify wizard opens at plate lookup step
- Verify board cards show expand/collapse chevrons
- Verify Done/Paid button appears on eligible cards
- Verify EOD Report and History buttons render

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from browser verification"
```

---

## Execution Notes

**Parallelizable tasks:**
- Tasks 1, 2, 3 are fully independent (seed, utility, API route)
- Tasks 6, 7, 8, 9, 10, 11 are independent step components (can build in parallel)
- Task 5 (dark theme migration) is independent of wizard components
- Task 17 (status actions) is independent of UI components

**Sequential dependencies:**
- Task 4 depends on Task 1 (schema change for `incompleteIntake`)
- Task 12 (orchestrator) depends on Tasks 6-11 (all step components)
- Task 13 (quick job modal) depends on Task 4 (quick job action)
- Task 14 (wiring) depends on Tasks 12, 13
- Tasks 15, 16 depend on Task 17 (status actions)
- Task 18 depends on all others

**Recommended execution order:**
1. Tasks 1 + 2 + 3 (parallel) → seed, utility, API
2. Task 4 → schema + service + actions
3. Task 5 → dark theme migration
4. Tasks 6 + 7 + 8 + 9 + 10 + 11 + 17 (parallel) → all step components + status actions
5. Task 12 → orchestrator (assembles steps)
6. Task 13 → quick job modal
7. Tasks 14 + 15 + 16 (parallel) → wiring + board features + list features
8. Task 18 → final verification

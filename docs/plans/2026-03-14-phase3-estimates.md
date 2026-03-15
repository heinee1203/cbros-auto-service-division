# Phase 3: Estimate Request → Quotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete estimate workflow — from customer inquiry submission through line-item quotation building — covering Stages 1 & 2 of the AutoServ Pro lifecycle.

**Architecture:** Multi-step wizard for inquiry creation (customer → vehicle → concerns → photos → review). Split-panel estimate builder (left: grouped line items, right: running totals & actions). All data flows through service layer → server actions → API routes, following Phase 2 patterns exactly.

**Tech Stack:** Next.js 14 App Router, Prisma (SQLite), Zod validation, @tanstack/react-table, Sonner toasts, Tailwind CSS with existing design tokens.

---

## Task 1: Add Enum Labels, Colors & Constants

**Files:**
- Modify: `src/types/enums.ts`
- Modify: `src/lib/constants.ts`

**Step 1: Add display labels and color maps for EstimateRequestStatus**

In `src/types/enums.ts`, append after the existing `USER_ROLE_LABELS` block:

```typescript
export const ESTIMATE_REQUEST_STATUS_LABELS: Record<EstimateRequestStatus, string> = {
  INQUIRY_RECEIVED: "New Inquiry",
  PENDING_ESTIMATE: "Pending Estimate",
  ESTIMATE_SENT: "Sent",
  ESTIMATE_APPROVED: "Approved",
  ESTIMATE_REVISION_REQUESTED: "Revision Requested",
  CANCELLED: "Cancelled",
};

export const ESTIMATE_REQUEST_STATUS_COLORS: Record<EstimateRequestStatus, string> = {
  INQUIRY_RECEIVED: "bg-blue-100 text-blue-700",
  PENDING_ESTIMATE: "bg-accent-100 text-accent-700",
  ESTIMATE_SENT: "bg-purple-100 text-purple-700",
  ESTIMATE_APPROVED: "bg-success-100 text-success-600",
  ESTIMATE_REVISION_REQUESTED: "bg-warning-100 text-warning-600",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export const ESTIMATE_LINE_ITEM_GROUP_LABELS: Record<EstimateLineItemGroup, string> = {
  LABOR: "Labor",
  PARTS: "Parts & Materials",
  MATERIALS: "Paint & Consumables",
  PAINT: "Paint & Consumables",
  SUBLET: "Sublet / Outsourced",
  OTHER: "Other",
};

export const PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "RUSH", label: "Rush" },
  { value: "INSURANCE", label: "Insurance Claim" },
] as const;
```

**Step 2: Add estimate-related constants**

In `src/lib/constants.ts`, append:

```typescript
export const LINE_ITEM_UNITS = [
  "pcs", "set", "pair", "liters", "ml", "sheets",
  "rolls", "meters", "ft", "hrs", "lot",
] as const;

export const ESTIMATE_STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "INQUIRY_RECEIVED", label: "New Inquiries" },
  { value: "PENDING_ESTIMATE", label: "Pending Estimate" },
  { value: "ESTIMATE_SENT", label: "Sent" },
  { value: "ESTIMATE_APPROVED", label: "Approved" },
  { value: "ESTIMATE_REVISION_REQUESTED", label: "Revision Requested" },
] as const;
```

**Step 3: Verify build**

Run: `npx next build`
Expected: Build succeeds with 0 errors.

**Step 4: Commit**

```bash
git add src/types/enums.ts src/lib/constants.ts
git commit -m "feat(estimates): add estimate enum labels, colors, and constants"
```

---

## Task 2: Zod Validators for Estimates

**Files:**
- Modify: `src/lib/validators.ts`

**Step 1: Add estimate request and line item schemas**

Append to `src/lib/validators.ts`:

```typescript
export const estimateRequestSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  vehicleId: z.string().min(1, "Vehicle is required"),
  customerConcern: z.string().min(1, "Please describe the concern"),
  requestedCategories: z.array(z.string()).min(1, "Select at least one service category"),
  priority: z.string().default("NORMAL"),
  isInsuranceClaim: z.boolean().default(false),
  claimNumber: z.string().optional().nullable(),
  adjusterName: z.string().optional().nullable(),
  adjusterContact: z.string().optional().nullable(),
});

export type EstimateRequestInput = z.infer<typeof estimateRequestSchema>;

export const estimateLineItemSchema = z.object({
  group: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  serviceCatalogId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be positive").default(1),
  unit: z.string().default("pcs"),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative"),
  markup: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).optional().nullable(),
  assignedTechnicianId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

export type EstimateLineItemInput = z.infer<typeof estimateLineItemSchema>;

export const estimateVersionSchema = z.object({
  discountType: z.string().optional().nullable(),
  discountValue: z.coerce.number().min(0).default(0),
  discountReason: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  estimatedDays: z.coerce.number().int().min(0).optional().nullable(),
});

export type EstimateVersionInput = z.infer<typeof estimateVersionSchema>;
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat(estimates): add Zod schemas for estimate requests, line items, versions"
```

---

## Task 3: Service Layer — Estimate Requests

**Files:**
- Create: `src/lib/services/estimate-requests.ts`

**Step 1: Create the estimate request service**

```typescript
import { prisma } from "@/lib/prisma";
import type { EstimateRequestInput } from "@/lib/validators";

export interface EstimateRequestListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getEstimateRequests({
  page = 1,
  pageSize = 25,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: EstimateRequestListParams = {}) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { requestNumber: { contains: search } },
      { customer: { firstName: { contains: search } } },
      { customer: { lastName: { contains: search } } },
      { vehicle: { plateNumber: { contains: search.replace(/[\s-]/g, "").toUpperCase() } } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  const validSortFields = ["createdAt", "requestNumber", "status"];
  const orderBy: Record<string, string> = {};
  if (validSortFields.includes(sortBy)) {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.createdAt = "desc";
  }

  const [requests, total] = await Promise.all([
    prisma.estimateRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true, color: true } },
        estimates: {
          where: { deletedAt: null },
          include: {
            versions: {
              where: { deletedAt: null },
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: { id: true, versionNumber: true, grandTotal: true, isApproved: true },
            },
          },
        },
      },
    }),
    prisma.estimateRequest.count({ where }),
  ]);

  return {
    requests,
    total,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getEstimateRequestById(id: string) {
  return prisma.estimateRequest.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: {
        include: {
          jobOrders: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              jobOrderNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      estimates: {
        where: { deletedAt: null },
        include: {
          versions: {
            where: { deletedAt: null },
            orderBy: { versionNumber: "desc" },
            include: {
              lineItems: {
                where: { deletedAt: null },
                orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
              },
            },
          },
        },
      },
    },
  });
}

export async function createEstimateRequest(
  data: EstimateRequestInput,
  requestNumber: string,
  userId?: string
) {
  return prisma.estimateRequest.create({
    data: {
      requestNumber,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      customerConcern: data.customerConcern,
      requestedCategories: JSON.stringify(data.requestedCategories),
      isInsuranceClaim: data.isInsuranceClaim,
      claimNumber: data.claimNumber || null,
      adjusterName: data.adjusterName || null,
      adjusterContact: data.adjusterContact || null,
      status: "INQUIRY_RECEIVED",
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

export async function updateEstimateRequestStatus(
  id: string,
  status: string,
  userId?: string
) {
  return prisma.estimateRequest.update({
    where: { id },
    data: { status, updatedBy: userId },
  });
}

export async function getNextEstimateSequence(): Promise<number> {
  const setting = await prisma.setting.findUnique({
    where: { key: "next_est_sequence" },
  });
  const current = parseInt(setting?.value ?? "1", 10);
  // Increment for next use
  await prisma.setting.upsert({
    where: { key: "next_est_sequence" },
    update: { value: String(current + 1) },
    create: { key: "next_est_sequence", value: String(current + 1), label: "Next EST Sequence", group: "numbering" },
  });
  return current;
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/services/estimate-requests.ts
git commit -m "feat(estimates): add estimate request service layer"
```

---

## Task 4: Service Layer — Estimates & Line Items

**Files:**
- Create: `src/lib/services/estimates.ts`

**Step 1: Create the estimate/version/line-item service**

```typescript
import { prisma } from "@/lib/prisma";
import type { EstimateLineItemInput, EstimateVersionInput } from "@/lib/validators";

export async function createEstimateWithVersion(
  estimateRequestId: string,
  versionLabel: string,
  userId?: string
) {
  return prisma.estimate.create({
    data: {
      estimateRequestId,
      createdBy: userId,
      updatedBy: userId,
      versions: {
        create: {
          versionNumber: 1,
          versionLabel,
          createdBy: userId,
          updatedBy: userId,
        },
      },
    },
    include: {
      versions: {
        include: {
          lineItems: true,
        },
      },
    },
  });
}

export async function getEstimateVersionById(versionId: string) {
  return prisma.estimateVersion.findUnique({
    where: { id: versionId },
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
        include: {
          serviceCatalog: {
            select: { id: true, name: true, category: true },
          },
        },
      },
      estimate: {
        include: {
          estimateRequest: {
            include: {
              customer: true,
              vehicle: true,
            },
          },
        },
      },
    },
  });
}

export async function addLineItem(
  estimateVersionId: string,
  data: EstimateLineItemInput,
  userId?: string
) {
  // Calculate subtotal: (quantity * unitCost) * (1 + markup/100)
  const baseAmount = Math.round(data.quantity * data.unitCost);
  const markupAmount = Math.round(baseAmount * (data.markup / 100));
  const subtotal = baseAmount + markupAmount;

  const item = await prisma.estimateLineItem.create({
    data: {
      estimateVersionId,
      group: data.group,
      description: data.description,
      serviceCatalogId: data.serviceCatalogId || null,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      markup: data.markup,
      subtotal,
      notes: data.notes || null,
      estimatedHours: data.estimatedHours ?? null,
      assignedTechnicianId: data.assignedTechnicianId || null,
      sortOrder: data.sortOrder,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalculateVersionTotals(estimateVersionId);
  return item;
}

export async function updateLineItem(
  id: string,
  data: Partial<EstimateLineItemInput>,
  userId?: string
) {
  // Get current item for defaults
  const current = await prisma.estimateLineItem.findUnique({ where: { id } });
  if (!current) throw new Error("Line item not found");

  const quantity = data.quantity ?? current.quantity;
  const unitCost = data.unitCost ?? current.unitCost;
  const markup = data.markup ?? current.markup;

  const baseAmount = Math.round(quantity * unitCost);
  const markupAmount = Math.round(baseAmount * (markup / 100));
  const subtotal = baseAmount + markupAmount;

  const item = await prisma.estimateLineItem.update({
    where: { id },
    data: {
      ...(data.group !== undefined && { group: data.group }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.serviceCatalogId !== undefined && { serviceCatalogId: data.serviceCatalogId || null }),
      quantity,
      ...(data.unit !== undefined && { unit: data.unit }),
      unitCost,
      markup,
      subtotal,
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours ?? null }),
      ...(data.assignedTechnicianId !== undefined && { assignedTechnicianId: data.assignedTechnicianId || null }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedBy: userId,
    },
  });

  await recalculateVersionTotals(current.estimateVersionId);
  return item;
}

export async function deleteLineItem(id: string, userId?: string) {
  const item = await prisma.estimateLineItem.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
  await recalculateVersionTotals(item.estimateVersionId);
  return item;
}

export async function duplicateLineItem(id: string, userId?: string) {
  const source = await prisma.estimateLineItem.findUnique({ where: { id } });
  if (!source) throw new Error("Line item not found");

  const item = await prisma.estimateLineItem.create({
    data: {
      estimateVersionId: source.estimateVersionId,
      group: source.group,
      description: source.description,
      serviceCatalogId: source.serviceCatalogId,
      quantity: source.quantity,
      unit: source.unit,
      unitCost: source.unitCost,
      markup: source.markup,
      subtotal: source.subtotal,
      notes: source.notes,
      estimatedHours: source.estimatedHours,
      assignedTechnicianId: source.assignedTechnicianId,
      sortOrder: source.sortOrder + 1,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await recalculateVersionTotals(source.estimateVersionId);
  return item;
}

export async function updateLineItemOrder(
  items: { id: string; sortOrder: number }[],
  userId?: string
) {
  await prisma.$transaction(
    items.map((item) =>
      prisma.estimateLineItem.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder, updatedBy: userId },
      })
    )
  );
}

export async function recalculateVersionTotals(versionId: string) {
  const lineItems = await prisma.estimateLineItem.findMany({
    where: { estimateVersionId: versionId, deletedAt: null },
  });

  const subtotals = {
    subtotalLabor: 0,
    subtotalParts: 0,
    subtotalMaterials: 0,
    subtotalPaint: 0,
    subtotalSublet: 0,
    subtotalOther: 0,
  };

  for (const item of lineItems) {
    switch (item.group) {
      case "LABOR": subtotals.subtotalLabor += item.subtotal; break;
      case "PARTS": subtotals.subtotalParts += item.subtotal; break;
      case "MATERIALS": subtotals.subtotalMaterials += item.subtotal; break;
      case "PAINT": subtotals.subtotalPaint += item.subtotal; break;
      case "SUBLET": subtotals.subtotalSublet += item.subtotal; break;
      case "OTHER": subtotals.subtotalOther += item.subtotal; break;
    }
  }

  const version = await prisma.estimateVersion.findUnique({
    where: { id: versionId },
    select: { vatRate: true, discountType: true, discountValue: true },
  });

  const rawTotal = Object.values(subtotals).reduce((a, b) => a + b, 0);

  // Apply discount
  let discountAmount = 0;
  if (version?.discountType === "flat") {
    discountAmount = version.discountValue;
  } else if (version?.discountType === "percentage") {
    discountAmount = Math.round(rawTotal * (version.discountValue / 10000)); // basis points
  }
  const afterDiscount = rawTotal - discountAmount;

  // Calculate VAT
  const vatRate = version?.vatRate ?? 12.0;
  const vatAmount = Math.round(afterDiscount * (vatRate / 100));
  const grandTotal = afterDiscount + vatAmount;

  await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      ...subtotals,
      vatAmount,
      grandTotal,
    },
  });

  return { ...subtotals, vatAmount, grandTotal, rawTotal, discountAmount };
}

export async function updateVersionDetails(
  versionId: string,
  data: EstimateVersionInput,
  userId?: string
) {
  await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      ...(data.discountType !== undefined && { discountType: data.discountType || null }),
      ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
      ...(data.discountReason !== undefined && { discountReason: data.discountReason || null }),
      ...(data.termsAndConditions !== undefined && { termsAndConditions: data.termsAndConditions || null }),
      ...(data.estimatedDays !== undefined && { estimatedDays: data.estimatedDays ?? null }),
      updatedBy: userId,
    },
  });

  // Recalculate after discount change
  return recalculateVersionTotals(versionId);
}

export async function searchServiceCatalog(query: string, category?: string) {
  const where: Record<string, unknown> = { isActive: true };
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { description: { contains: query } },
    ];
  }
  if (category) {
    where.category = category;
  }
  return prisma.serviceCatalog.findMany({
    where,
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    take: 20,
  });
}

export async function getActiveTechnicians() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: { in: ["TECHNICIAN", "QC_INSPECTOR"] },
    },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: { firstName: "asc" },
  });
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/services/estimates.ts
git commit -m "feat(estimates): add estimate, version, and line item service layer"
```

---

## Task 5: Server Actions for Estimates

**Files:**
- Create: `src/lib/actions/estimate-actions.ts`

**Step 1: Create server actions**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  estimateRequestSchema,
  estimateLineItemSchema,
  estimateVersionSchema,
  type EstimateRequestInput,
  type EstimateLineItemInput,
  type EstimateVersionInput,
} from "@/lib/validators";
import {
  createEstimateRequest,
  getNextEstimateSequence,
  updateEstimateRequestStatus,
} from "@/lib/services/estimate-requests";
import {
  createEstimateWithVersion,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  duplicateLineItem,
  updateLineItemOrder,
  updateVersionDetails,
  recalculateVersionTotals,
} from "@/lib/services/estimates";
import { generateDocNumber } from "@/lib/utils";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  warning?: string;
};

// --- Estimate Request Actions ---

export async function createEstimateRequestAction(
  input: EstimateRequestInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = estimateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const sequence = await getNextEstimateSequence();
  const requestNumber = generateDocNumber("EST", sequence);

  const request = await createEstimateRequest(
    parsed.data,
    requestNumber,
    session.user.id
  );

  revalidatePath("/estimates");
  return { success: true, data: { id: request.id, requestNumber } };
}

// --- Estimate & Version Actions ---

export async function startEstimateAction(
  estimateRequestId: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  // Get the request to build version label
  const { prisma } = await import("@/lib/prisma");
  const request = await prisma.estimateRequest.findUnique({
    where: { id: estimateRequestId },
    select: { requestNumber: true },
  });
  if (!request) return { success: false, error: "Estimate request not found" };

  const versionLabel = `${request.requestNumber}-v1`;
  const estimate = await createEstimateWithVersion(
    estimateRequestId,
    versionLabel,
    session.user.id
  );

  // Update request status
  await updateEstimateRequestStatus(
    estimateRequestId,
    "PENDING_ESTIMATE",
    session.user.id
  );

  const version = estimate.versions[0];
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateRequestId}`);
  return {
    success: true,
    data: {
      estimateId: estimate.id,
      versionId: version.id,
    },
  };
}

// --- Line Item Actions ---

export async function addLineItemAction(
  estimateVersionId: string,
  input: EstimateLineItemInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = estimateLineItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Convert peso amounts to centavos for storage
  const dataInCentavos = {
    ...parsed.data,
    unitCost: Math.round(parsed.data.unitCost * 100),
  };

  const item = await addLineItem(estimateVersionId, dataInCentavos, session.user.id);
  revalidatePath("/estimates");
  return { success: true, data: { id: item.id } };
}

export async function updateLineItemAction(
  id: string,
  input: Partial<EstimateLineItemInput>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  // Convert peso amounts to centavos if present
  const dataInCentavos = { ...input };
  if (dataInCentavos.unitCost !== undefined) {
    dataInCentavos.unitCost = Math.round(dataInCentavos.unitCost * 100);
  }

  const item = await updateLineItem(id, dataInCentavos, session.user.id);
  revalidatePath("/estimates");
  return { success: true, data: { id: item.id } };
}

export async function deleteLineItemAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await deleteLineItem(id, session.user.id);
  revalidatePath("/estimates");
  return { success: true };
}

export async function duplicateLineItemAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const item = await duplicateLineItem(id, session.user.id);
  revalidatePath("/estimates");
  return { success: true, data: { id: item.id } };
}

export async function reorderLineItemsAction(
  items: { id: string; sortOrder: number }[]
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await updateLineItemOrder(items, session.user.id);
  return { success: true };
}

// --- Version Details Actions ---

export async function updateVersionDetailsAction(
  versionId: string,
  input: EstimateVersionInput
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = estimateVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Convert discount to centavos if flat
  const data = { ...parsed.data };
  if (data.discountType === "flat" && data.discountValue) {
    data.discountValue = Math.round(data.discountValue * 100);
  }

  const totals = await updateVersionDetails(versionId, data, session.user.id);
  revalidatePath("/estimates");
  return { success: true, data: totals as unknown as Record<string, unknown> };
}

export async function updateEstimateStatusAction(
  estimateRequestId: string,
  status: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await updateEstimateRequestStatus(estimateRequestId, status, session.user.id);
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateRequestId}`);
  return { success: true };
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/actions/estimate-actions.ts
git commit -m "feat(estimates): add server actions for estimate requests, line items, versions"
```

---

## Task 6: API Routes for Estimates

**Files:**
- Modify: `src/app/api/estimates/route.ts` (replace placeholder if exists, else create)
- Create: `src/app/api/estimates/[id]/route.ts`
- Create: `src/app/api/service-catalog/route.ts`
- Create: `src/app/api/technicians/route.ts`

**Step 1: Create estimate list API route**

`src/app/api/estimates/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEstimateRequests } from "@/lib/services/estimate-requests";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)));
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = (searchParams.get("sortOrder") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const result = await getEstimateRequests({
    page,
    pageSize,
    search,
    status,
    sortBy,
    sortOrder,
  });

  return NextResponse.json(result);
}
```

**Step 2: Create estimate detail API route**

`src/app/api/estimates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEstimateRequestById } from "@/lib/services/estimate-requests";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const estimateRequest = await getEstimateRequestById(params.id);
  if (!estimateRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(estimateRequest);
}
```

**Step 3: Create service catalog search API route**

`src/app/api/service-catalog/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchServiceCatalog } from "@/lib/services/estimates";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? undefined;

  const services = await searchServiceCatalog(query, category);
  return NextResponse.json(services);
}
```

**Step 4: Create technicians API route**

`src/app/api/technicians/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveTechnicians } from "@/lib/services/estimates";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const technicians = await getActiveTechnicians();
  return NextResponse.json(technicians);
}
```

**Step 5: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/app/api/estimates/ src/app/api/service-catalog/ src/app/api/technicians/
git commit -m "feat(estimates): add API routes for estimate list, detail, service catalog, technicians"
```

---

## Task 7: Estimate List Page

**Files:**
- Modify: `src/app/(dashboard)/estimates/page.tsx` (replace placeholder)

**Step 1: Build the estimate list page**

Replace the placeholder with a full client component. Pattern matches `customers/page.tsx`:

- Status filter tabs across top (All | New Inquiries | Pending Estimate | Sent | Approved | Revision Requested)
- Search bar (debounced, searches EST number, customer name, plate number)
- DataTable with columns: EST Number (mono), Customer, Vehicle (plate), Categories (badges), Status (color badge), Created, Assigned To
- Click row → `/estimates/[id]`
- "New Inquiry" button → `/estimates/new`
- Empty state when no estimates

Key implementation details:
- Use `ESTIMATE_STATUS_TABS` from constants for tab filter
- Use `ESTIMATE_REQUEST_STATUS_LABELS` and `ESTIMATE_REQUEST_STATUS_COLORS` for badge display
- Parse `requestedCategories` from JSON string for badge display
- Show latest version's `grandTotal` formatted with `formatPeso()` in a "Total" column
- `formatDate()` for created date
- Use existing `Badge` component for status and category display

This is a large file (~300 lines). The implementing agent should follow the exact pattern from `src/app/(dashboard)/customers/page.tsx` but adapted for estimate data shape.

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/estimates/page.tsx
git commit -m "feat(estimates): build estimate list page with status tabs, search, and data table"
```

---

## Task 8: New Inquiry Wizard — Multi-Step Form

**Files:**
- Create: `src/app/(dashboard)/estimates/new/page.tsx`
- Create: `src/components/estimates/inquiry-wizard.tsx`

**Step 1: Create the wizard page**

`src/app/(dashboard)/estimates/new/page.tsx` — client component wrapper with breadcrumb nav.

**Step 2: Build the multi-step wizard component**

`src/components/estimates/inquiry-wizard.tsx` — 5-step stepper:

1. **Customer Step** — Search existing customers (reuse the searchable customer dropdown from vehicle form). "Create New" button opens inline CustomerForm in SlideOver. Show selected customer card with name, phone, email.

2. **Vehicle Step** — Show vehicles belonging to selected customer. Select one or "Add New Vehicle" opens inline VehicleForm in SlideOver. **Returning vehicle detection:** If selected vehicle has past job orders, show amber banner: "This vehicle has been here before. View History" linking to `/vehicles/[id]`.

3. **Concern Details Step**:
   - `customerConcern` — required textarea
   - `requestedCategories` — multi-select checkboxes using `SERVICE_CATEGORIES`
   - `priority` — radio group: Normal, Rush, Insurance
   - If Insurance selected, show conditional fields: claimNumber, adjusterName, adjusterContact (adjuster phone/email combined field)

4. **Photos Step** — Placeholder for now (Photo module is Phase 4). Show message: "Photos can be added after creating the estimate request." with drag-drop zone UI stub.

5. **Review & Submit Step** — Summary card showing all selections. "Create Estimate Request" button calls `createEstimateRequestAction`. On success, redirect to `/estimates/[id]` with success toast.

Key UX details:
- Step indicator at top showing progress (Step 1 of 5, with labels)
- Back/Next buttons at bottom of each step
- Next button disabled until required fields filled
- Steps visually connected with lines/dots
- Each step validates before allowing Next
- Customer and Vehicle search use `/api/customers/search` and fetch customer vehicles respectively

**Step 3: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/estimates/new/ src/components/estimates/
git commit -m "feat(estimates): build multi-step inquiry wizard with customer/vehicle/concern steps"
```

---

## Task 9: Estimate Detail Page — Server Component Shell

**Files:**
- Create: `src/app/(dashboard)/estimates/[id]/page.tsx`

**Step 1: Create the server component**

Server component that:
1. Fetches estimate request by ID using `getEstimateRequestById()`
2. If not found, calls `notFound()`
3. Maps data to client component shape
4. If no estimate exists yet (status is INQUIRY_RECEIVED), shows inquiry detail with "Start Estimate" button
5. If estimate exists, renders the `EstimateBuilderClient` component

Key data mapping:
- Parse `requestedCategories` from JSON string to array
- Pass customer, vehicle, estimates (with versions and line items) to client
- Convert centavo amounts to peso display values for the UI

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/estimates/[id]/
git commit -m "feat(estimates): add estimate detail server component shell"
```

---

## Task 10: Estimate Detail — Inquiry View & Start Estimate

**Files:**
- Create: `src/components/estimates/estimate-detail-client.tsx`

**Step 1: Build the inquiry detail + estimate builder client component**

This is the main client component for `/estimates/[id]`. It has two modes:

**Mode A: Inquiry View** (when no estimate exists yet)
- Header: EST number, status badge, created date
- Customer card: name, phone, email
- Vehicle card: plate (mono/bold), make/model/year, color
- Concern details: description text, category badges, priority badge
- Insurance info (if applicable): claim #, adjuster details
- Returning vehicle banner (if vehicle has past JOs)
- "Start Estimate" button → calls `startEstimateAction()`, transitions to Mode B

**Mode B: Estimate Builder** (when estimate with version exists)
- Renders the `EstimateBuilder` component (Task 11)

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/estimates/estimate-detail-client.tsx
git commit -m "feat(estimates): build inquiry detail view with start estimate flow"
```

---

## Task 11: Estimate Builder — Left Panel (Line Items)

**Files:**
- Create: `src/components/estimates/estimate-builder.tsx`
- Create: `src/components/estimates/line-item-group.tsx`
- Create: `src/components/estimates/line-item-row.tsx`
- Create: `src/components/estimates/add-line-item-form.tsx`

**Step 1: Build the estimate builder layout**

`estimate-builder.tsx` — Split layout:
- Left panel (flex-1 or ~65% width): Line items grouped by type
- Right panel (~35% width, sticky): Running totals & actions

**Step 2: Build line item group component**

`line-item-group.tsx` — Collapsible section per group (LABOR, PARTS, PAINT, SUBLET, OTHER):
- Header with group label, item count, group subtotal
- Chevron toggle for expand/collapse
- "Add [Group] Item" button
- List of `LineItemRow` components

**Step 3: Build line item row component**

`line-item-row.tsx` — Inline-editable row:
- Description (click to edit, shows service name if from catalog)
- Quantity + unit
- Unit cost (₱, formatted)
- Markup % (for PARTS group)
- Estimated hours (for LABOR group)
- Subtotal (auto-calculated, read-only, formatted with `formatPeso`)
- Action menu: Duplicate, Delete (with confirm)
- For LABOR: optional technician assignment dropdown

Inline editing: Click any editable field → input appears → blur or Enter saves via `updateLineItemAction()` → toast on error. Auto-recalculates subtotal.

**Step 4: Build add line item form**

`add-line-item-form.tsx` — Modal or inline form per group:
- For LABOR: Service catalog searchable dropdown (fetches from `/api/service-catalog?category=...`), auto-fills description + hours + rate. Manual override fields.
- For PARTS: Description, part number (optional), quantity, unit select, unit cost, markup %, OEM/Aftermarket toggle (stored in notes)
- For PAINT: Item description, quantity, unit, unit cost
- For SUBLET: Description, vendor name (in notes), quoted price, markup %
- For OTHER: Description, amount

When a ServiceCatalog item is selected for LABOR:
- Auto-fill description from `serviceCatalog.name`
- Auto-fill estimatedHours from `serviceCatalog.defaultEstimatedHours`
- Auto-fill unitCost from `serviceCatalog.defaultLaborRate` (convert centavos to pesos for display)
- Auto-fill unit as "hrs"

**Step 5: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/components/estimates/estimate-builder.tsx src/components/estimates/line-item-group.tsx src/components/estimates/line-item-row.tsx src/components/estimates/add-line-item-form.tsx
git commit -m "feat(estimates): build line item editor with grouped sections, inline editing, catalog search"
```

---

## Task 12: Estimate Builder — Right Panel (Summary & Actions)

**Files:**
- Create: `src/components/estimates/estimate-summary.tsx`

**Step 1: Build the summary panel**

Sticky right panel showing:

1. **Running Totals** (update in real-time as items change):
   - Labor subtotal
   - Parts subtotal
   - Paint & Materials subtotal
   - Sublet subtotal
   - Other subtotal
   - **Subtotal** (sum of all)
   - Discount (editable: type dropdown [None/Flat/Percentage], value input, reason text)
   - **After Discount**
   - VAT (12%, auto-calculated, shown as "VAT (12%): ₱X,XXX.XX")
   - **Grand Total** (bold, large font-mono)

2. **Estimate Details**:
   - Estimated days to complete (number input)
   - Terms & conditions (textarea, default from Settings `estimate_terms`)

3. **Actions**:
   - "Save Draft" — already auto-saves on blur, but explicit save button recalculates totals
   - "Mark as Sent" — updates status to ESTIMATE_SENT
   - "Mark as Approved" — updates status to ESTIMATE_APPROVED (for manual approval tracking)
   - "Request Revision" — updates status to ESTIMATE_REVISION_REQUESTED

All monetary values displayed with `formatPeso()`. Discount edits call `updateVersionDetailsAction()` which recalculates totals server-side.

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/estimates/estimate-summary.tsx
git commit -m "feat(estimates): build estimate summary panel with running totals, discount, VAT, actions"
```

---

## Task 13: Wire Up Data Fetching & State Management

**Files:**
- Modify: `src/components/estimates/estimate-builder.tsx`
- Modify: `src/components/estimates/estimate-detail-client.tsx`
- Modify: `src/app/(dashboard)/estimates/[id]/page.tsx`

**Step 1: Connect the estimate builder to server data**

The estimate builder needs to:
1. Receive initial data from server component (line items, version totals)
2. Maintain local state for optimistic UI updates
3. Refetch after mutations to sync with server
4. Keep right panel totals in sync with left panel changes

State management approach:
- Initial data from server component props (SSR)
- After each mutation (add/edit/delete line item), call a `refreshData()` function that fetches `/api/estimates/[id]` and updates local state
- Alternatively, since server actions call `revalidatePath`, a `router.refresh()` after each action would refetch server component data

Use `useRouter().refresh()` after successful mutations to let Next.js re-render the server component with fresh data. This keeps the pattern simple and consistent with the server-first architecture.

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/estimates/ src/app/(dashboard)/estimates/
git commit -m "feat(estimates): wire up data fetching and state management for estimate builder"
```

---

## Task 14: Customer Vehicle Search API for Wizard

**Files:**
- Create: `src/app/api/customers/[id]/vehicles/route.ts`

**Step 1: Create API route for customer's vehicles**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { customerId: params.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      jobOrders: {
        where: { deletedAt: null },
        select: { id: true, jobOrderNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  return NextResponse.json(vehicles);
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/customers/[id]/vehicles/
git commit -m "feat(estimates): add API for fetching customer vehicles with job history"
```

---

## Task 15: Final Integration & Build Verification

**Files:**
- Modify: `src/app/(dashboard)/estimates/page.tsx` (ensure all imports resolve)
- Verify all routes compile

**Step 1: Full build**

Run: `npx next build`
Expected: Build succeeds with all new routes:
- `/estimates` (client component list)
- `/estimates/new` (wizard)
- `/estimates/[id]` (detail/builder)
- `/api/estimates`
- `/api/estimates/[id]`
- `/api/service-catalog`
- `/api/technicians`
- `/api/customers/[id]/vehicles`

**Step 2: Review & fix any type errors**

Check for:
- Correct use of `.issues[0].message` (not `.errors[0].message`) in Zod
- Money fields properly converting between centavos and pesos at the action layer boundary
- JSON fields (requestedCategories) properly parsed/stringified
- All imports resolving

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(estimates): Phase 3 complete — estimate request inquiry and quotation builder"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Enum labels, colors, constants | `enums.ts`, `constants.ts` |
| 2 | Zod validators | `validators.ts` |
| 3 | Estimate request service | `services/estimate-requests.ts` |
| 4 | Estimate/line item service | `services/estimates.ts` |
| 5 | Server actions | `actions/estimate-actions.ts` |
| 6 | API routes | `api/estimates/`, `api/service-catalog/`, `api/technicians/` |
| 7 | Estimate list page | `estimates/page.tsx` |
| 8 | New inquiry wizard | `estimates/new/page.tsx`, `inquiry-wizard.tsx` |
| 9 | Estimate detail shell | `estimates/[id]/page.tsx` |
| 10 | Inquiry view + start | `estimate-detail-client.tsx` |
| 11 | Line item editor | `estimate-builder.tsx`, `line-item-*.tsx` |
| 12 | Summary panel | `estimate-summary.tsx` |
| 13 | State management wiring | Multiple files |
| 14 | Customer vehicles API | `api/customers/[id]/vehicles/` |
| 15 | Final integration | Build verification |

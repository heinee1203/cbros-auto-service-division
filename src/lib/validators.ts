import { z } from "zod";

export const customerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, "");
        return (
          (digits.startsWith("09") && digits.length === 11) ||
          (digits.startsWith("639") && digits.length === 12)
        );
      },
      { message: "Invalid Philippine phone number (09XX or +639XX format)" }
    ),
  phoneAlt: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  referredBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const vehicleSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  plateNumber: z
    .string()
    .min(1, "Plate number is required")
    .transform((val) => val.replace(/[\s-]/g, "").toUpperCase()),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  color: z.string().min(1, "Color is required"),
  colorCode: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
  engineType: z.string().optional().nullable(),
  bodyType: z.string().default("SEDAN"),
  insuranceCompany: z.string().optional().nullable(),
  policyNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

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

// ---------------------------------------------------------------------------
// Intake — Damage entry
// ---------------------------------------------------------------------------
export const damageEntrySchema = z.object({
  zone: z.string().min(1, "Zone is required"),
  positionX: z.coerce.number().optional().nullable(),
  positionY: z.coerce.number().optional().nullable(),
  damageType: z.string().min(1, "Damage type is required"),
  severity: z.string().min(1, "Severity is required"),
  notes: z.string().optional().nullable(),
});
export type DamageEntryInput = z.infer<typeof damageEntrySchema>;

// ---------------------------------------------------------------------------
// Intake — Belonging entry
// ---------------------------------------------------------------------------
export const belongingSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  condition: z.string().optional().nullable(),
});
export type BelongingInput = z.infer<typeof belongingSchema>;

// ---------------------------------------------------------------------------
// Intake — Intake record (fuel, odometer, warnings, keys)
// ---------------------------------------------------------------------------
export const intakeRecordSchema = z.object({
  odometerReading: z.coerce.number().int().min(0).optional().nullable(),
  fuelLevel: z.string().default("HALF"),
  hasWarningLights: z.boolean().default(false),
  warningLightsNote: z.string().optional().nullable(),
  keysCount: z.coerce.number().int().min(0).default(1),
});
export type IntakeRecordInput = z.infer<typeof intakeRecordSchema>;

// ---------------------------------------------------------------------------
// Intake — Job order configuration (Step 5)
// ---------------------------------------------------------------------------
export const jobOrderConfigSchema = z.object({
  primaryTechnicianId: z.string().min(1, "Primary technician is required"),
  targetCompletionDate: z.string().optional().nullable(),
  priority: z.string().default("NORMAL"),
  bayAssignment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type JobOrderConfigInput = z.infer<typeof jobOrderConfigSchema>;

// ---------------------------------------------------------------------------
// Phase 5: Task — create/update
// ---------------------------------------------------------------------------
export const taskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional().nullable(),
  serviceCatalogId: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).default(0),
  hourlyRate: z.coerce.number().min(0).default(0),
  assignedTechnicianId: z.string().optional().nullable(),
  dependsOnTaskId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type TaskInput = z.infer<typeof taskSchema>;

// ---------------------------------------------------------------------------
// Phase 5: Time Entry — manual creation/edit
// ---------------------------------------------------------------------------
export const manualTimeEntrySchema = z.object({
  taskId: z.string().min(1, "Task is required"),
  jobOrderId: z.string().min(1, "Job order is required"),
  technicianId: z.string().min(1, "Technician is required"),
  clockIn: z.string().min(1, "Clock in time is required"),
  clockOut: z.string().min(1, "Clock out time is required"),
  breakMinutes: z.coerce.number().int().min(0).default(0),
  notes: z.string().min(1, "Notes are required for manual entries"),
});
export type ManualTimeEntryInput = z.infer<typeof manualTimeEntrySchema>;

// ---------------------------------------------------------------------------
// Phase 5: Material Usage — log
// ---------------------------------------------------------------------------
export const materialUsageSchema = z.object({
  taskId: z.string().optional().nullable(),
  itemDescription: z.string().min(1, "Item description is required"),
  partNumber: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be positive").default(1),
  unit: z.string().default("pcs"),
  actualCost: z.coerce.number().min(0, "Cost cannot be negative"),
  estimatedLineItemId: z.string().optional().nullable(),
});
export type MaterialUsageInput = z.infer<typeof materialUsageSchema>;

// ---------------------------------------------------------------------------
// Phase 5: Supplemental Estimate
// ---------------------------------------------------------------------------
export const supplementSchema = z.object({
  description: z.string().min(1, "Description is required"),
  reason: z.string().optional().nullable(),
});
export type SupplementInput = z.infer<typeof supplementSchema>;

export const supplementLineItemSchema = z.object({
  group: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().default("pcs"),
  unitCost: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type SupplementLineItemInput = z.infer<typeof supplementLineItemSchema>;

// ---------------------------------------------------------------------------
// Phase 5: Job Note
// ---------------------------------------------------------------------------
export const jobNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  mentions: z.array(z.string()).optional().default([]),
});
export type JobNoteInput = z.infer<typeof jobNoteSchema>;

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

// ---------------------------------------------------------------------------
// Phase 8: Release Record
// ---------------------------------------------------------------------------
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

export type BelongingReturnInput = z.infer<typeof belongingReturnSchema>;

// ---------------------------------------------------------------------------
// Phase 9: Analytics Date Range
// ---------------------------------------------------------------------------
export const dateRangeSchema = z.object({
  from: z.string().min(1, "Start date is required"),
  to: z.string().min(1, "End date is required"),
});
export type DateRangeInput = z.infer<typeof dateRangeSchema>;

// ---------------------------------------------------------------------------
// Phase 10: Settings
// ---------------------------------------------------------------------------
export const settingUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const settingsBatchSchema = z.object({
  updates: z.array(settingUpdateSchema).min(1),
});

// ---------------------------------------------------------------------------
// Phase 10: User Management
// ---------------------------------------------------------------------------
export const userCreateSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum([
    "OWNER",
    "MANAGER",
    "ADVISOR",
    "ESTIMATOR",
    "TECHNICIAN",
    "QC_INSPECTOR",
    "CASHIER",
  ]),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  pin: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional()
    .or(z.literal("")),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z
    .enum([
      "OWNER",
      "MANAGER",
      "ADVISOR",
      "ESTIMATOR",
      "TECHNICIAN",
      "QC_INSPECTOR",
      "CASHIER",
    ])
    .optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

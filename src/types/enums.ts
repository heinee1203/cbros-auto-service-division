// TypeScript enum types — application-layer enforcement for SQLite string fields
// When migrating to PostgreSQL, these map directly to Prisma native enums

export const UserRole = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  ADVISOR: "ADVISOR",
  ESTIMATOR: "ESTIMATOR",
  TECHNICIAN: "TECHNICIAN",
  QC_INSPECTOR: "QC_INSPECTOR",
  CASHIER: "CASHIER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const EstimateRequestStatus = {
  INQUIRY_RECEIVED: "INQUIRY_RECEIVED",
  PENDING_ESTIMATE: "PENDING_ESTIMATE",
  ESTIMATE_SENT: "ESTIMATE_SENT",
  ESTIMATE_APPROVED: "ESTIMATE_APPROVED",
  ESTIMATE_REVISION_REQUESTED: "ESTIMATE_REVISION_REQUESTED",
  CANCELLED: "CANCELLED",
} as const;
export type EstimateRequestStatus =
  (typeof EstimateRequestStatus)[keyof typeof EstimateRequestStatus];

export const EstimateLineItemGroup = {
  LABOR: "LABOR",
  PARTS: "PARTS",
  MATERIALS: "MATERIALS",
  PAINT: "PAINT",
  SUBLET: "SUBLET",
  OTHER: "OTHER",
} as const;
export type EstimateLineItemGroup =
  (typeof EstimateLineItemGroup)[keyof typeof EstimateLineItemGroup];

export const JobOrderStatus = {
  PENDING: "PENDING",
  CHECKED_IN: "CHECKED_IN",
  IN_PROGRESS: "IN_PROGRESS",
  QC_PENDING: "QC_PENDING",
  QC_PASSED: "QC_PASSED",
  QC_FAILED_REWORK: "QC_FAILED_REWORK",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PARTIAL_PAYMENT: "PARTIAL_PAYMENT",
  FULLY_PAID: "FULLY_PAID",
  RELEASED: "RELEASED",
  CANCELLED: "CANCELLED",
} as const;
export type JobOrderStatus =
  (typeof JobOrderStatus)[keyof typeof JobOrderStatus];

export const JobOrderPriority = {
  NORMAL: "NORMAL",
  RUSH: "RUSH",
  INSURANCE: "INSURANCE",
} as const;
export type JobOrderPriority =
  (typeof JobOrderPriority)[keyof typeof JobOrderPriority];

export const TaskStatus = {
  QUEUED: "QUEUED",
  IN_PROGRESS: "IN_PROGRESS",
  PAUSED: "PAUSED",
  QC_REVIEW: "QC_REVIEW",
  DONE: "DONE",
  REWORK: "REWORK",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TimeEntrySource = {
  MANUAL: "MANUAL",
  PIN_CLOCK: "PIN_CLOCK",
  TABLET_CLOCK: "TABLET_CLOCK",
} as const;
export type TimeEntrySource =
  (typeof TimeEntrySource)[keyof typeof TimeEntrySource];

export const QCChecklistItemStatus = {
  PASS: "PASS",
  FAIL: "FAIL",
  NA: "NA",
} as const;
export type QCChecklistItemStatus =
  (typeof QCChecklistItemStatus)[keyof typeof QCChecklistItemStatus];

export const PaymentMethod = {
  CASH: "CASH",
  GCASH: "GCASH",
  MAYA: "MAYA",
  BANK_TRANSFER: "BANK_TRANSFER",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  CHECK: "CHECK",
  INSURANCE_DIRECT: "INSURANCE_DIRECT",
} as const;
export type PaymentMethod =
  (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
} as const;
export type PaymentStatus =
  (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const WarrantyStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CLAIMED: "CLAIMED",
  VOIDED: "VOIDED",
} as const;
export type WarrantyStatus =
  (typeof WarrantyStatus)[keyof typeof WarrantyStatus];

export const PhotoStage = {
  INQUIRY: "INQUIRY",
  ESTIMATE: "ESTIMATE",
  INTAKE: "INTAKE",
  PROGRESS: "PROGRESS",
  QC: "QC",
  RELEASE: "RELEASE",
  SUPPLEMENTAL: "SUPPLEMENTAL",
  WARRANTY_CLAIM: "WARRANTY_CLAIM",
} as const;
export type PhotoStage = (typeof PhotoStage)[keyof typeof PhotoStage];

export const SupplementStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  APPEAL: "APPEAL",
} as const;
export type SupplementStatus =
  (typeof SupplementStatus)[keyof typeof SupplementStatus];

export const DamageSeverity = {
  COSMETIC: "COSMETIC",
  MINOR: "MINOR",
  MODERATE: "MODERATE",
  SEVERE: "SEVERE",
} as const;
export type DamageSeverity =
  (typeof DamageSeverity)[keyof typeof DamageSeverity];

export const DamageType = {
  SCRATCH: "SCRATCH",
  DENT: "DENT",
  CHIP: "CHIP",
  CRACK: "CRACK",
  RUST: "RUST",
  MISSING_PART: "MISSING_PART",
  BROKEN: "BROKEN",
  OTHER: "OTHER",
} as const;
export type DamageType = (typeof DamageType)[keyof typeof DamageType];

export const FuelLevel = {
  EMPTY: "EMPTY",
  QUARTER: "QUARTER",
  HALF: "HALF",
  THREE_QUARTER: "THREE_QUARTER",
  FULL: "FULL",
} as const;
export type FuelLevel = (typeof FuelLevel)[keyof typeof FuelLevel];

export const NotificationType = {
  ESTIMATE_REQUEST: "ESTIMATE_REQUEST",
  ESTIMATE_APPROVED: "ESTIMATE_APPROVED",
  ESTIMATE_REVISION: "ESTIMATE_REVISION",
  JOB_STARTED: "JOB_STARTED",
  TASK_OVERRUN: "TASK_OVERRUN",
  QC_FAILED: "QC_FAILED",
  QC_PASSED: "QC_PASSED",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  JOB_OVERDUE: "JOB_OVERDUE",
  SUPPLEMENT_APPROVED: "SUPPLEMENT_APPROVED",
  CLOCK_IN: "CLOCK_IN",
  CLOCK_OUT: "CLOCK_OUT",
  VEHICLE_READY: "VEHICLE_READY",
  FOLLOW_UP: "FOLLOW_UP",
  GENERAL: "GENERAL",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const BodyType = {
  SEDAN: "SEDAN",
  SUV: "SUV",
  PICKUP: "PICKUP",
  VAN: "VAN",
  HATCHBACK: "HATCHBACK",
  COUPE: "COUPE",
  TRUCK: "TRUCK",
  MOTORCYCLE: "MOTORCYCLE",
  WAGON: "WAGON",
  MPV: "MPV",
  CROSSOVER: "CROSSOVER",
  OTHER: "OTHER",
} as const;
export type BodyType = (typeof BodyType)[keyof typeof BodyType];

// Display labels for UI
export const JOB_ORDER_STATUS_LABELS: Record<JobOrderStatus, string> = {
  PENDING: "Pending",
  CHECKED_IN: "Checked In",
  IN_PROGRESS: "In Progress",
  QC_PENDING: "QC Pending",
  QC_PASSED: "QC Passed",
  QC_FAILED_REWORK: "Rework Required",
  AWAITING_PAYMENT: "Awaiting Payment",
  PARTIAL_PAYMENT: "Partial Payment",
  FULLY_PAID: "Fully Paid",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

export const JOB_ORDER_STATUS_COLORS: Record<JobOrderStatus, string> = {
  PENDING: "bg-surface-300 text-primary",
  CHECKED_IN: "bg-accent-100 text-accent-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  QC_PENDING: "bg-warning-100 text-warning-600",
  QC_PASSED: "bg-success-100 text-success-600",
  QC_FAILED_REWORK: "bg-danger-100 text-danger-600",
  AWAITING_PAYMENT: "bg-purple-100 text-purple-700",
  PARTIAL_PAYMENT: "bg-yellow-100 text-yellow-700",
  FULLY_PAID: "bg-success-100 text-success-600",
  RELEASED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner / Admin",
  MANAGER: "Shop Manager",
  ADVISOR: "Service Advisor",
  ESTIMATOR: "Estimator",
  TECHNICIAN: "Technician",
  QC_INSPECTOR: "QC Inspector",
  CASHIER: "Cashier",
};

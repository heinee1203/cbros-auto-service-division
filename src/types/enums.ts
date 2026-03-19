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
  FOLLOW_UP_SATISFACTION: "FOLLOW_UP_SATISFACTION",
  FOLLOW_UP_SURVEY: "FOLLOW_UP_SURVEY",
  FOLLOW_UP_MAINTENANCE: "FOLLOW_UP_MAINTENANCE",
  WARRANTY_EXPIRY: "WARRANTY_EXPIRY",
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
  PENDING: "bg-amber-100 text-amber-700",
  CHECKED_IN: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  QC_PENDING: "bg-blue-100 text-blue-700",
  QC_PASSED: "bg-blue-100 text-blue-700",
  QC_FAILED_REWORK: "bg-danger-100 text-danger-600",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-700",
  PARTIAL_PAYMENT: "bg-orange-100 text-orange-700",
  FULLY_PAID: "bg-emerald-100 text-emerald-700",
  RELEASED: "bg-gray-100 text-gray-600",
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
  PAINT: "Paint",
  SUBLET: "Sublet / Outsourced",
  OTHER: "Other",
};

export const PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "RUSH", label: "Rush" },
  { value: "INSURANCE", label: "Insurance Claim" },
] as const;

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  SCRATCH: "Scratch",
  DENT: "Dent",
  CHIP: "Chip",
  CRACK: "Crack",
  RUST: "Rust",
  MISSING_PART: "Missing Part",
  BROKEN: "Broken",
  OTHER: "Other",
};

export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  COSMETIC: "Cosmetic",
  MINOR: "Minor",
  MODERATE: "Moderate",
  SEVERE: "Severe",
};

export const DAMAGE_SEVERITY_COLORS: Record<DamageSeverity, string> = {
  COSMETIC: "bg-success-100 text-success-600",
  MINOR: "bg-yellow-100 text-yellow-700",
  MODERATE: "bg-orange-100 text-orange-700",
  SEVERE: "bg-danger-100 text-danger-600",
};

export const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  EMPTY: "E",
  QUARTER: "¼",
  HALF: "½",
  THREE_QUARTER: "¾",
  FULL: "F",
};

export const FUEL_LEVEL_DISPLAY: Record<FuelLevel, string> = {
  EMPTY: "Empty",
  QUARTER: "Quarter",
  HALF: "Half",
  THREE_QUARTER: "Three Quarter",
  FULL: "Full",
};

// Phase 5: Task status display
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  QUEUED: "Queued",
  IN_PROGRESS: "In Progress",
  PAUSED: "Paused",
  QC_REVIEW: "QC Review",
  DONE: "Done",
  REWORK: "Rework",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  QUEUED: "bg-surface-200 text-surface-600",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  QC_REVIEW: "bg-blue-100 text-blue-700",
  DONE: "bg-gray-100 text-gray-600",
  REWORK: "bg-danger-100 text-danger-600",
};

export const SUPPLEMENT_STATUS_LABELS: Record<SupplementStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  DENIED: "Denied",
  APPEAL: "Appeal",
};

export const SUPPLEMENT_STATUS_COLORS: Record<SupplementStatus, string> = {
  DRAFT: "bg-surface-200 text-surface-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  APPROVED: "bg-success-100 text-success-600",
  DENIED: "bg-danger-100 text-danger-600",
  APPEAL: "bg-warning-100 text-warning-600",
};

export const TIME_ENTRY_SOURCE_LABELS: Record<TimeEntrySource, string> = {
  MANUAL: "Manual",
  PIN_CLOCK: "PIN Clock",
  TABLET_CLOCK: "Task Board",
};

// Phase 6+7: QC Result Display
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

// Phase 7: Payment Display
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

export const RELEASE_STEP_LABELS: Record<number, string> = {
  0: "Release Photos",
  1: "Before/After Review",
  2: "Belongings Return",
  3: "Vehicle Condition",
  4: "Warranty & Care",
  5: "Sign-Off",
};

// Bay types
export const BayType = {
  GENERAL: "GENERAL",
  PAINT_BOOTH: "PAINT_BOOTH",
  DETAIL: "DETAIL",
  PDR: "PDR",
  MECHANICAL: "MECHANICAL",
  WASH: "WASH",
} as const;
export type BayType = (typeof BayType)[keyof typeof BayType];

export const BAY_TYPE_LABELS: Record<BayType, string> = {
  GENERAL: "General",
  PAINT_BOOTH: "Paint Booth",
  DETAIL: "Detail",
  PDR: "PDR",
  MECHANICAL: "Mechanical",
  WASH: "Wash",
};

// Appointment types
export const AppointmentType = {
  ESTIMATE_INSPECTION: "ESTIMATE_INSPECTION",
  DROP_OFF: "DROP_OFF",
  PICK_UP: "PICK_UP",
  FOLLOW_UP: "FOLLOW_UP",
  CONSULTATION: "CONSULTATION",
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  ESTIMATE_INSPECTION: "Estimate Inspection",
  DROP_OFF: "Drop-Off",
  PICK_UP: "Pick-Up",
  FOLLOW_UP: "Follow-Up",
  CONSULTATION: "Consultation",
};

export const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, string> = {
  ESTIMATE_INSPECTION: "blue",
  DROP_OFF: "green",
  PICK_UP: "amber",
  FOLLOW_UP: "purple",
  CONSULTATION: "surface",
};

// Appointment status
export const AppointmentStatus = {
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  ARRIVED: "ARRIVED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "surface",
  CONFIRMED: "blue",
  ARRIVED: "green",
  NO_SHOW: "red",
  CANCELLED: "surface",
  COMPLETED: "green",
};

// Commission
export const CommissionPeriodStatus = {
  DRAFT: "DRAFT",
  FINALIZED: "FINALIZED",
  PAID: "PAID",
} as const;
export type CommissionPeriodStatus =
  (typeof CommissionPeriodStatus)[keyof typeof CommissionPeriodStatus];

export const COMMISSION_PERIOD_STATUS_LABELS: Record<CommissionPeriodStatus, string> = {
  DRAFT: "Draft",
  FINALIZED: "Finalized",
  PAID: "Paid",
};

export const COMMISSION_PERIOD_STATUS_COLORS: Record<CommissionPeriodStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  FINALIZED: "bg-blue-100 text-blue-700",
  PAID: "bg-success-100 text-success-600",
};

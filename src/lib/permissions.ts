import { UserRole } from "@/types/enums";

// Centralized permissions map — single source of truth
// Used by: middleware (route protection), API routes (action auth), UI (conditional rendering)
export const PERMISSIONS = {
  // Job Orders
  "jobs:create": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "jobs:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
    UserRole.TECHNICIAN,
    UserRole.QC_INSPECTOR,
    UserRole.CASHIER,
  ],
  "jobs:edit": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "jobs:delete": [UserRole.OWNER, UserRole.MANAGER],
  "jobs:clock": [UserRole.TECHNICIAN, UserRole.QC_INSPECTOR],

  // Estimates
  "estimates:create": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
  ],
  "estimates:edit": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
  ],
  "estimates:approve_discount": [UserRole.OWNER, UserRole.MANAGER],
  "estimate:tech_review": [UserRole.OWNER, UserRole.MANAGER],
  "estimate:mgmt_approve": [UserRole.OWNER, UserRole.MANAGER],
  "estimates:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
    UserRole.CASHIER,
  ],

  // Intake
  "intake:create": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "intake:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
    UserRole.TECHNICIAN,
    UserRole.QC_INSPECTOR,
  ],

  // Tasks & Time
  "tasks:manage": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "tasks:update_status": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.TECHNICIAN,
  ],
  "time:edit_others": [UserRole.OWNER, UserRole.MANAGER],
  "time:view_all": [UserRole.OWNER, UserRole.MANAGER],

  // QC
  "qc:inspect": [UserRole.QC_INSPECTOR, UserRole.MANAGER, UserRole.OWNER],
  "qc:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.QC_INSPECTOR,
  ],

  // Invoicing & Payments
  "invoices:create": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.CASHIER,
  ],
  "invoices:edit": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.CASHIER,
  ],
  "invoices:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.CASHIER,
  ],
  "payments:process": [UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER],

  // Customers & Vehicles
  "customers:create": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
  ],
  "customers:edit": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
  ],
  "customers:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
    UserRole.CASHIER,
  ],

  // Photos
  "photos:upload": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.ESTIMATOR,
    UserRole.TECHNICIAN,
    UserRole.QC_INSPECTOR,
  ],

  // Analytics & Reports
  "analytics:view": [UserRole.OWNER, UserRole.MANAGER],
  "reports:view": [UserRole.OWNER, UserRole.MANAGER],
  "reports:export": [UserRole.OWNER, UserRole.MANAGER],

  // Settings & Users
  "settings:manage": [UserRole.OWNER],
  "users:manage": [UserRole.OWNER, UserRole.MANAGER],
  "users:view": [UserRole.OWNER, UserRole.MANAGER],

  // Release
  "release:create": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],

  // Warranty
  "warranty:manage": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "warranty:view": [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.ADVISOR,
    UserRole.CASHIER,
  ],

  // Schedule
  "schedule:view": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "schedule:appointments": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "schedule:bays_manage": [UserRole.OWNER, UserRole.MANAGER],
  "schedule:bays_assign": [UserRole.OWNER, UserRole.MANAGER, UserRole.ADVISOR],
  "schedule:tech_view": [UserRole.OWNER, UserRole.MANAGER],
  "schedule:tech_manage": [UserRole.OWNER, UserRole.MANAGER],

  // Commissions
  "commissions:view": [UserRole.OWNER, UserRole.MANAGER],
  "commissions:manage": [UserRole.OWNER, UserRole.MANAGER],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole, action: Permission): boolean {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(role);
}

export function canAny(role: UserRole, actions: Permission[]): boolean {
  return actions.some((action) => can(role, action));
}

export function canAll(role: UserRole, actions: Permission[]): boolean {
  return actions.every((action) => can(role, action));
}

// Route-level permission mapping for middleware
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/settings": "settings:manage",
  "/settings/users": "users:manage",
  "/analytics": "analytics:view",
  "/reports": "reports:view",
  "/schedule": "schedule:view",
  "/commissions": "commissions:view",
};

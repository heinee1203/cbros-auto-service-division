// Navigation items for the sidebar
export const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    icon: "LayoutDashboard",
    permission: null, // visible to all authenticated users
  },
  {
    label: "Job Orders",
    href: "/jobs",
    icon: "Wrench",
    permission: "jobs:view" as const,
    showBadge: true,
  },
  {
    label: "Estimates",
    href: "/estimates",
    icon: "ClipboardList",
    permission: "estimates:view" as const,
  },
  {
    label: "Customers",
    href: "/customers",
    icon: "Users",
    permission: "customers:view" as const,
  },
  {
    label: "Vehicles",
    href: "/vehicles",
    icon: "Car",
    permission: "customers:view" as const,
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: "Receipt",
    permission: "invoices:view" as const,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "BarChart3",
    permission: "analytics:view" as const,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    permission: "settings:manage" as const,
  },
] as const;

// Philippine vehicle makes (common)
export const VEHICLE_MAKES = [
  "Toyota",
  "Mitsubishi",
  "Nissan",
  "Honda",
  "Ford",
  "Hyundai",
  "Kia",
  "Suzuki",
  "Isuzu",
  "Chevrolet",
  "Mazda",
  "Subaru",
  "MG",
  "Geely",
  "Chery",
  "BYD",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Lexus",
  "Volvo",
  "Peugeot",
  "JAC",
  "Foton",
  "GAC",
  "Changan",
  "Great Wall",
  "Jetour",
  "Other",
] as const;

// Service categories matching spec Section 3
export const SERVICE_CATEGORIES = [
  "Collision Repair",
  "Painting & Refinishing",
  "Buffing & Paint Correction",
  "Car Detailing",
  "Undercoating & Rust Protection",
  "Car Restoration",
  "Accessories & Add-ons",
] as const;

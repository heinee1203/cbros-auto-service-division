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
  "Preventive Maintenance Service (PMS)",
  "Brake System",
  "Suspension & Steering",
  "Engine & Drivetrain",
  "Electrical & Diagnostics",
  "Tires & Wheels",
  "Air Conditioning",
  "Diagnostics & Inspection",
] as const;

// Service group → categories mapping for the three-layer navigation
export const SERVICE_GROUPS = {
  "Body & Paint": [
    "Collision Repair",
    "Painting & Refinishing",
    "Buffing & Paint Correction",
    "Car Detailing",
    "Undercoating & Rust Protection",
    "Car Restoration",
  ],
  "Auto Service": [
    "Preventive Maintenance Service (PMS)",
    "Brake System",
    "Suspension & Steering",
    "Engine & Drivetrain",
    "Electrical & Diagnostics",
    "Tires & Wheels",
    "Air Conditioning",
  ],
  "Other": [
    "Accessories & Add-ons",
    "Diagnostics & Inspection",
  ],
} as const;

export type ServiceGroupName = keyof typeof SERVICE_GROUPS;

// Short labels for category pills (horizontal scrollable nav)
export const CATEGORY_SHORT_LABELS: Record<string, string> = {
  "Collision Repair": "Collision",
  "Painting & Refinishing": "Paint",
  "Buffing & Paint Correction": "Buffing",
  "Car Detailing": "Detailing",
  "Undercoating & Rust Protection": "Undercoating",
  "Car Restoration": "Restoration",
  "Accessories & Add-ons": "Accessories",
  "Preventive Maintenance Service (PMS)": "PMS",
  "Brake System": "Brakes",
  "Suspension & Steering": "Suspension",
  "Engine & Drivetrain": "Engine",
  "Electrical & Diagnostics": "Electrical",
  "Tires & Wheels": "Tires",
  "Air Conditioning": "A/C",
  "Diagnostics & Inspection": "Diagnostics",
};

// Frequently used services — shown as quick picks at top of grid
export const FREQUENTLY_USED_SERVICE_NAMES = [
  "PMS Basic (Oil, Filter, Inspect)",
  "Brake Pad Replacement (Front)",
  "Oil Change Only",
  "Full Repaint (Single Stage)",
  "Spot Painting / Touch-Up (per panel)",
  "A/C Recharge / Refrigerant Refill",
  "Wheel Alignment (4-Wheel)",
  "Engine Tune-Up (Spark Plugs, Filters, Timing)",
];

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

// Walkaround shot list — 18 required base shots
export const WALKAROUND_SHOTS = [
  { id: "front_full", label: "Front — full", category: "exterior", required: true },
  { id: "front_34_left", label: "Front — ¾ left", category: "exterior", required: true },
  { id: "front_34_right", label: "Front — ¾ right", category: "exterior", required: true },
  { id: "left_side_full", label: "Left side — full", category: "exterior", required: true },
  { id: "right_side_full", label: "Right side — full", category: "exterior", required: true },
  { id: "rear_full", label: "Rear — full", category: "exterior", required: true },
  { id: "rear_34_left", label: "Rear — ¾ left", category: "exterior", required: true },
  { id: "rear_34_right", label: "Rear — ¾ right", category: "exterior", required: true },
  { id: "roof_top", label: "Roof / top", category: "exterior", required: true },
  { id: "dashboard_odometer", label: "Dashboard — odometer", category: "interior", required: true },
  { id: "dashboard_warnings", label: "Dashboard — warning lights", category: "interior", required: true },
  { id: "interior_front", label: "Interior — front", category: "interior", required: true },
  { id: "interior_rear", label: "Interior — rear", category: "interior", required: true },
  { id: "trunk_cargo", label: "Trunk / cargo area", category: "interior", required: true },
  { id: "wheel_front_left", label: "Wheel — front left", category: "wheels", required: true },
  { id: "wheel_front_right", label: "Wheel — front right", category: "wheels", required: true },
  { id: "wheel_rear_left", label: "Wheel — rear left", category: "wheels", required: true },
  { id: "wheel_rear_right", label: "Wheel — rear right", category: "wheels", required: true },
] as const;

// Conditional shots based on service categories from estimate
export const CONDITIONAL_SHOTS: Record<string, { id: string; label: string; category: string }[]> = {
  "Undercoating & Rust Protection": [
    { id: "underbody_front", label: "Underbody — front", category: "underbody" },
    { id: "underbody_mid", label: "Underbody — mid", category: "underbody" },
    { id: "underbody_rear", label: "Underbody — rear", category: "underbody" },
  ],
  "Car Detailing": [
    { id: "paint_closeup_1", label: "Paint condition — close-up 1", category: "detail" },
    { id: "paint_closeup_2", label: "Paint condition — close-up 2", category: "detail" },
  ],
  "Car Restoration": [
    { id: "restoration_detail_1", label: "Restoration area — detail 1", category: "restoration" },
    { id: "restoration_detail_2", label: "Restoration area — detail 2", category: "restoration" },
    { id: "restoration_detail_3", label: "Restoration area — detail 3", category: "restoration" },
    { id: "restoration_detail_4", label: "Restoration area — detail 4", category: "restoration" },
  ],
};
// Note: "ENGINE BAY" conditional shot is triggered by checking if any service name contains "engine"
// We handle that in the component logic rather than here since it's name-based, not category-based

// Common belongings for intake checklist
export const COMMON_BELONGINGS = [
  { id: "phone_charger", label: "Phone charger / cable", hasNotes: true },
  { id: "sunglasses", label: "Sunglasses", hasNotes: false },
  { id: "dashcam", label: "Dashcam", hasNotes: true },
  { id: "toll_device", label: "EZ-Pass / toll device", hasNotes: true },
  { id: "spare_tire", label: "Spare tire & jack", hasNotes: false },
  { id: "tools", label: "Tools", hasNotes: true },
  { id: "documents", label: "Documents / registration", hasNotes: true },
  { id: "floor_mats", label: "Floor mats (OEM / aftermarket)", hasNotes: true },
  { id: "seat_covers", label: "Seat covers", hasNotes: false },
  { id: "child_seat", label: "Child seat", hasNotes: false },
  { id: "aftermarket", label: "Aftermarket accessories", hasNotes: true },
  { id: "valuables", label: "Valuables", hasNotes: true },
] as const;

// Job order status filter tabs for the jobs list page
export const JOB_ORDER_STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "QC_PENDING", label: "QC Pending" },
  { value: "AWAITING_PAYMENT", label: "Awaiting Payment" },
  { value: "RELEASED", label: "Released" },
] as const;

// Damage mapper zones for the car SVG diagram
export const DAMAGE_ZONES = [
  { id: "hood", label: "Hood", views: ["top", "front"] },
  { id: "roof", label: "Roof", views: ["top"] },
  { id: "trunk", label: "Trunk / Tailgate", views: ["top", "rear"] },
  { id: "left_fender", label: "Left Fender", views: ["top", "left"] },
  { id: "right_fender", label: "Right Fender", views: ["top", "right"] },
  { id: "left_front_door", label: "Left Front Door", views: ["top", "left"] },
  { id: "left_rear_door", label: "Left Rear Door", views: ["top", "left"] },
  { id: "right_front_door", label: "Right Front Door", views: ["top", "right"] },
  { id: "right_rear_door", label: "Right Rear Door", views: ["top", "right"] },
  { id: "left_quarter_panel", label: "Left Quarter Panel", views: ["top", "left"] },
  { id: "right_quarter_panel", label: "Right Quarter Panel", views: ["top", "right"] },
  { id: "front_bumper", label: "Front Bumper", views: ["front"] },
  { id: "rear_bumper", label: "Rear Bumper", views: ["rear"] },
  { id: "grille", label: "Grille", views: ["front"] },
  { id: "left_headlight", label: "Left Headlight", views: ["front"] },
  { id: "right_headlight", label: "Right Headlight", views: ["front"] },
  { id: "left_taillight", label: "Left Taillight", views: ["rear"] },
  { id: "right_taillight", label: "Right Taillight", views: ["rear"] },
  { id: "windshield", label: "Windshield", views: ["front", "top"] },
  { id: "rear_windshield", label: "Rear Windshield", views: ["rear", "top"] },
  { id: "left_mirror", label: "Left Mirror", views: ["left"] },
  { id: "right_mirror", label: "Right Mirror", views: ["right"] },
  { id: "left_rocker", label: "Left Rocker Panel", views: ["left"] },
  { id: "right_rocker", label: "Right Rocker Panel", views: ["right"] },
] as const;

// Job order stage pipeline for the status visualization
export const JOB_STAGES = [
  { id: "CHECKED_IN", label: "Checked In", statuses: ["CHECKED_IN"] },
  { id: "IN_PROGRESS", label: "In Progress", statuses: ["IN_PROGRESS"] },
  { id: "QC", label: "Quality Check", statuses: ["QC_PENDING", "QC_PASSED", "QC_FAILED_REWORK"] },
  { id: "PAYMENT", label: "Payment", statuses: ["AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"] },
  { id: "RELEASED", label: "Released", statuses: ["RELEASED"] },
] as const;

// Phase 5: Kanban board columns
export const TASK_BOARD_COLUMNS = [
  { id: "QUEUED", label: "Queued" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "PAUSED", label: "Paused" },
  { id: "QC_REVIEW", label: "QC Review" },
  { id: "DONE", label: "Done" },
] as const;

// Milestone photo label mapping
export const MILESTONE_LABELS: Record<string, string> = {
  before: "Before",
  after: "After",
  in_progress: "In Progress",
  before_disassembly: "Before Disassembly",
  after_disassembly: "After Disassembly",
  after_metalwork: "After Metalwork",
  after_filler: "After Body Filler",
  after_primer: "After Primer",
  after_paint: "After Paint",
  after_reassembly: "After Reassembly",
  after_install: "After Install",
  during_straightening: "During Straightening",
  during_welding: "During Welding",
  after_sanding: "After Sanding",
  after_masking: "After Masking",
  after_base_coat: "After Base Coat",
  after_clear_coat: "After Clear Coat",
  after_cut_buff: "After Cut & Buff",
  after_clear: "After Clear",
  design_layout: "Design Layout",
  fifty_fifty: "50/50 Comparison",
  after_wet_sand: "After Wet Sand",
  after_compound: "After Compound",
  after_polish: "After Polish",
  after_decontamination: "After Decontamination",
  after_correction: "After Correction",
  during_application: "During Application",
  after_curing: "After Curing",
  after_prep: "After Prep",
  before_cleaning: "Before Cleaning",
  after_degreasing: "After Degreasing",
  before_detail: "Before Detail",
  after_detail: "After Detail",
  // General auto repair milestones
  before_service: "Before Service",
  old_parts: "Old Parts Removed",
  new_parts_installed: "New Parts Installed",
  after_service: "After Service",
  old_parts_removed: "Old Parts Removed",
  worn_parts: "Worn Parts",
  during_teardown: "During Teardown",
  running_test: "Running Test",
  diagnostic_screen: "Diagnostic Screen",
  before_repair: "Before Repair",
  after_repair: "After Repair",
  codes_cleared: "Codes Cleared",
  alignment_printout: "Alignment Printout",
};

// Phase 6: QC Checklist Categories
export const QC_CHECKLIST_CATEGORIES = [
  { id: "paint_body", label: "Paint & Body", settingKey: "qc_checklist_paint_body" },
  { id: "detailing", label: "Detailing", settingKey: "qc_checklist_detailing" },
  { id: "undercoating", label: "Undercoating", settingKey: "qc_checklist_undercoating" },
  { id: "mechanical", label: "Mechanical / Functional", settingKey: "qc_checklist_mechanical" },
  { id: "pms", label: "Preventive Maintenance", settingKey: "qc_checklist_pms" },
  { id: "brake", label: "Brake System", settingKey: "qc_checklist_brake" },
  { id: "suspension", label: "Suspension & Steering", settingKey: "qc_checklist_suspension" },
  { id: "engine", label: "Engine & Drivetrain", settingKey: "qc_checklist_engine" },
  { id: "electrical", label: "Electrical & Diagnostics", settingKey: "qc_checklist_electrical" },
  { id: "tire", label: "Tires & Wheels", settingKey: "qc_checklist_tire" },
] as const;

// Service category → QC checklist category mapping
export const SERVICE_TO_QC_CATEGORY: Record<string, string[]> = {
  "Collision Repair": ["paint_body"],
  "Painting & Refinishing": ["paint_body"],
  "Buffing & Paint Correction": ["detailing"],
  "Car Detailing": ["detailing"],
  "Undercoating & Rust Protection": ["undercoating"],
  "Car Restoration": ["paint_body", "mechanical"],
  "Accessories & Add-ons": ["mechanical"],
  "Preventive Maintenance Service (PMS)": ["pms"],
  "Brake System": ["brake"],
  "Suspension & Steering": ["suspension"],
  "Engine & Drivetrain": ["engine"],
  "Electrical & Diagnostics": ["electrical"],
  "Tires & Wheels": ["tire"],
  "Air Conditioning": ["mechanical"],
  "Diagnostics & Inspection": ["electrical"],
};

// Phase 7: Invoice
export const INVOICE_STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Fully Paid" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash", icon: "Banknote" },
  { value: "GCASH", label: "GCash", icon: "Smartphone" },
  { value: "MAYA", label: "Maya", icon: "Smartphone" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: "Building2" },
  { value: "CREDIT_CARD", label: "Credit Card", icon: "CreditCard" },
  { value: "DEBIT_CARD", label: "Debit Card", icon: "CreditCard" },
  { value: "CHECK", label: "Check", icon: "FileText" },
  { value: "INSURANCE_DIRECT", label: "Insurance Direct", icon: "Shield" },
] as const;

// Suggested dependency chains by service category
export const DEPENDENCY_CHAINS: Record<string, string[]> = {
  "Collision Repair": [
    "Disassembly", "Metalwork", "Body Filler", "Primer",
    "Paint", "Clear Coat", "Reassembly",
  ],
  "Painting & Refinishing": [
    "Sanding/Prep", "Masking", "Primer/Sealer", "Base Coat",
    "Clear Coat", "Cut/Buff", "Reassembly",
  ],
  "Buffing & Paint Correction": [
    "Wash/Decon", "Paint Correction", "Final Polish",
  ],
  "Car Detailing": [
    "Wash/Decon", "Paint Correction", "Coating Application", "Final Inspection",
  ],
  "Undercoating & Rust Protection": [
    "Cleaning", "Degreasing", "Application", "Curing/Drying",
  ],
  "Preventive Maintenance Service (PMS)": [
    "Drain & Remove Old", "Install New Parts", "Top Up Fluids", "Test & Inspect",
  ],
  "Brake System": [
    "Disassembly", "Inspection/Measurement", "Install New Parts", "Bleed/Adjust", "Test Drive",
  ],
  "Suspension & Steering": [
    "Disassembly", "Remove Old Parts", "Install New Parts", "Alignment", "Test Drive",
  ],
  "Engine & Drivetrain": [
    "Diagnosis", "Disassembly", "Repair/Replace", "Reassembly", "Test & Tune",
  ],
  "Electrical & Diagnostics": [
    "Diagnosis/Scan", "Repair/Replace", "Clear Codes", "Verify",
  ],
  "Tires & Wheels": [
    "Remove Wheels", "Service Tires", "Mount & Balance", "TPMS Reset",
  ],
};

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

// Minimum required release photos
export const MIN_RELEASE_PHOTOS = 10;

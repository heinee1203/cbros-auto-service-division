export type IntakeLevel = 1 | 2 | 3;

/**
 * Maps service categories to their required intake documentation level.
 * Level 1 = Quick (~2min): basic PMS/electrical/tire work
 * Level 2 = Standard (~3min): mechanical repair, paint correction
 * Level 3 = Full (~5min): collision, paint, detailing, undercoating, restoration
 */
export const CATEGORY_LEVEL_MAP: Record<string, IntakeLevel> = {
  // Level 1 — Quick
  "Preventive Maintenance Service (PMS)": 1,
  "Electrical & Diagnostics": 1,
  "Tires & Wheels": 1,
  "Air Conditioning": 1,
  "Diagnostics & Inspection": 1,
  "Accessories & Add-ons": 1,

  // Level 2 — Standard
  "Brake System": 2,
  "Suspension & Steering": 2,
  "Buffing & Paint Correction": 2,

  // Level 3 — Full
  "Engine & Drivetrain": 3,
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
] as const;

/** Focused shots for Level 2 — 4 exterior + 4 work-area (determined by category) */
export const FOCUSED_WORK_AREA_SHOTS: Record<string, { id: string; label: string; description: string }[]> = {
  "Brake System": [
    { id: "wheel-area", label: "Wheel Area", description: "Close-up of brake assembly area" },
    { id: "undercarriage-front", label: "Undercarriage Front", description: "Under front of vehicle" },
    { id: "undercarriage-rear", label: "Undercarriage Rear", description: "Under rear of vehicle" },
    { id: "work-area-closeup", label: "Work Area", description: "Close-up of area to be repaired" },
  ],
  "Suspension & Steering": [
    { id: "undercarriage-front", label: "Undercarriage Front", description: "Under front of vehicle" },
    { id: "undercarriage-rear", label: "Undercarriage Rear", description: "Under rear of vehicle" },
    { id: "wheel-area", label: "Wheel Area", description: "Close-up of suspension components" },
    { id: "work-area-closeup", label: "Work Area", description: "Close-up of area to be repaired" },
  ],
  "Engine & Drivetrain": [
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

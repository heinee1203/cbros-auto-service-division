import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ========================================================================
  // 1. Default Admin User
  // ========================================================================
  const passwordHash = await bcrypt.hash("changeme", 12);
  const pinHash = await bcrypt.hash("1234", 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      pinHash,
      firstName: "Shop",
      lastName: "Owner",
      role: "OWNER",
      isActive: true,
    },
  });
  console.log(`  Created admin user: ${admin.username} (password: changeme, PIN: 1234)`);

  // ========================================================================
  // 2. Service Catalog — Full catalog from CLAUDE.md Section 3
  // ========================================================================
  const services = [
    // --- Collision Repair ---
    { category: "Collision Repair", name: "Dent Removal / PDR", defaultEstimatedHours: 2, defaultLaborRate: 50000, sortOrder: 1, milestones: ["before", "in_progress", "after"] },
    { category: "Collision Repair", name: "Panel Beating / Reshaping", defaultEstimatedHours: 4, defaultLaborRate: 50000, sortOrder: 2, milestones: ["before", "after_metalwork", "after_filler", "after_primer", "after_paint"] },
    { category: "Collision Repair", name: "Panel Replacement", description: "Fender, door, hood, trunk, bumper, quarter panel, rocker panel", defaultEstimatedHours: 6, defaultLaborRate: 55000, sortOrder: 3, milestones: ["before", "after_disassembly", "after_install", "after_paint", "after_reassembly"] },
    { category: "Collision Repair", name: "Frame / Unibody Straightening", defaultEstimatedHours: 8, defaultLaborRate: 60000, sortOrder: 4, milestones: ["before", "during_straightening", "after"] },
    { category: "Collision Repair", name: "Bumper Repair", description: "Plastic welding, reshaping, replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 5, milestones: ["before", "in_progress", "after"] },
    { category: "Collision Repair", name: "Headlight / Taillight Repair or Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 6, milestones: ["before", "after"] },
    { category: "Collision Repair", name: "Windshield / Glass Replacement", defaultEstimatedHours: 2, defaultLaborRate: 40000, requiresSublet: true, sortOrder: 7, milestones: ["before", "after"] },
    { category: "Collision Repair", name: "Structural Welding", defaultEstimatedHours: 5, defaultLaborRate: 60000, sortOrder: 8, milestones: ["before", "during_welding", "after"] },

    // --- Painting & Refinishing ---
    { category: "Painting & Refinishing", name: "Full Repaint", description: "Single-stage, base/clear, tri-coat, candy, matte/satin", defaultEstimatedHours: 24, defaultLaborRate: 55000, sortOrder: 1, milestones: ["before", "after_sanding", "after_masking", "after_primer", "after_base_coat", "after_clear_coat", "after_cut_buff", "after_reassembly"] },
    { category: "Painting & Refinishing", name: "Partial Repaint (Panel-Specific)", defaultEstimatedHours: 8, defaultLaborRate: 55000, sortOrder: 2, milestones: ["before", "after_sanding", "after_primer", "after_paint", "after_clear"] },
    { category: "Painting & Refinishing", name: "Spot Painting / Touch-Up", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 3, milestones: ["before", "after"] },
    { category: "Painting & Refinishing", name: "Color Matching / Tinting", defaultEstimatedHours: 1, defaultLaborRate: 50000, sortOrder: 4, milestones: ["before", "after"] },
    { category: "Painting & Refinishing", name: "Blending (Adjacent Panels)", defaultEstimatedHours: 3, defaultLaborRate: 50000, sortOrder: 5, milestones: ["before", "after"] },
    { category: "Painting & Refinishing", name: "Clear Coat Restoration", defaultEstimatedHours: 4, defaultLaborRate: 45000, sortOrder: 6, milestones: ["before", "after"] },
    { category: "Painting & Refinishing", name: "Custom Paint", description: "Two-tone, graphics, stripes, racing livery", defaultEstimatedHours: 40, defaultLaborRate: 60000, sortOrder: 7, milestones: ["before", "design_layout", "in_progress", "after"] },
    { category: "Painting & Refinishing", name: "Vinyl Wrap Installation", description: "Full, partial, accents", defaultEstimatedHours: 12, defaultLaborRate: 50000, sortOrder: 8, milestones: ["before", "in_progress", "after"] },
    { category: "Painting & Refinishing", name: "Plasti-Dip Application", defaultEstimatedHours: 6, defaultLaborRate: 40000, sortOrder: 9, milestones: ["before", "in_progress", "after"] },

    // --- Buffing & Paint Correction ---
    { category: "Buffing & Paint Correction", name: "Single-Stage Polish", description: "Light swirl removal", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 1, milestones: ["before", "fifty_fifty", "after"] },
    { category: "Buffing & Paint Correction", name: "Multi-Stage Paint Correction", description: "Cut + polish + finish", defaultEstimatedHours: 8, defaultLaborRate: 50000, sortOrder: 2, milestones: ["before", "fifty_fifty", "after"] },
    { category: "Buffing & Paint Correction", name: "Wet Sanding + Compound + Polish", defaultEstimatedHours: 6, defaultLaborRate: 50000, sortOrder: 3, milestones: ["before", "after_wet_sand", "after_compound", "after_polish"] },
    { category: "Buffing & Paint Correction", name: "Headlight Restoration / Lens Polishing", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
    { category: "Buffing & Paint Correction", name: "Chrome Polishing", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 5, milestones: ["before", "after"] },

    // --- Car Detailing ---
    { category: "Car Detailing", name: "Exterior Wash & Decontamination", description: "Clay bar, iron remover, tar remover", defaultEstimatedHours: 2, defaultLaborRate: 35000, sortOrder: 1, milestones: ["before", "after"] },
    { category: "Car Detailing", name: "Interior Deep Cleaning", description: "Vacuum, shampoo, steam", defaultEstimatedHours: 3, defaultLaborRate: 35000, sortOrder: 2, milestones: ["before", "after"] },
    { category: "Car Detailing", name: "Leather Cleaning & Conditioning", defaultEstimatedHours: 2, defaultLaborRate: 35000, sortOrder: 3, milestones: ["before", "after"] },
    { category: "Car Detailing", name: "Engine Bay Cleaning / Detailing", defaultEstimatedHours: 1.5, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
    { category: "Car Detailing", name: "Ceramic Coating Application", description: "1-layer, 2-layer, 3-layer", defaultEstimatedHours: 8, defaultLaborRate: 55000, sortOrder: 5, milestones: ["before", "after_decontamination", "after_correction", "during_application", "after_curing"] },
    { category: "Car Detailing", name: "Graphene Coating Application", defaultEstimatedHours: 8, defaultLaborRate: 55000, sortOrder: 6, milestones: ["before", "after_prep", "during_application", "after_curing"] },
    { category: "Car Detailing", name: "Paint Protection Film (PPF) Installation", description: "Full front, full body, partial", defaultEstimatedHours: 16, defaultLaborRate: 55000, sortOrder: 7, milestones: ["before", "during_application", "after"] },
    { category: "Car Detailing", name: "Glass Coating / Rain Repellent", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 8, milestones: ["before", "after"] },
    { category: "Car Detailing", name: "Wheel & Caliper Detailing / Coating", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 9, milestones: ["before", "after"] },
    { category: "Car Detailing", name: "Odor Removal / Ozone Treatment", defaultEstimatedHours: 2, defaultLaborRate: 30000, sortOrder: 10, milestones: ["before", "after"] },

    // --- Undercoating & Rust Protection ---
    { category: "Undercoating & Rust Protection", name: "Rubberized Undercoating (Full Underbody)", defaultEstimatedHours: 4, defaultLaborRate: 40000, sortOrder: 1, milestones: ["before_cleaning", "after_cleaning", "during_application", "after_curing"] },
    { category: "Undercoating & Rust Protection", name: "Tar-Based Undercoating", defaultEstimatedHours: 4, defaultLaborRate: 40000, sortOrder: 2, milestones: ["before", "during_application", "after"] },
    { category: "Undercoating & Rust Protection", name: "Wax-Based Cavity Protection", defaultEstimatedHours: 3, defaultLaborRate: 40000, sortOrder: 3, milestones: ["before", "after"] },
    { category: "Undercoating & Rust Protection", name: "Rust Conversion Treatment", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 4, milestones: ["before", "after_treatment", "after_curing"] },
    { category: "Undercoating & Rust Protection", name: "Rust Removal + Undercoating", defaultEstimatedHours: 6, defaultLaborRate: 45000, sortOrder: 5, milestones: ["before", "after_removal", "after_coating"] },
    { category: "Undercoating & Rust Protection", name: "Bed Liner Spray (Truck Beds)", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 6, milestones: ["before", "after_prep", "after_spray"] },
    { category: "Undercoating & Rust Protection", name: "Wheel Well Liner Coating", defaultEstimatedHours: 2, defaultLaborRate: 35000, sortOrder: 7, milestones: ["before", "after"] },
    { category: "Undercoating & Rust Protection", name: "Frame Rust Treatment", defaultEstimatedHours: 5, defaultLaborRate: 50000, sortOrder: 8, milestones: ["before", "during_treatment", "after"] },

    // --- Car Restoration ---
    { category: "Car Restoration", name: "Full Body Restoration", description: "Strip to bare metal, bodywork, prime, paint", defaultEstimatedHours: 80, defaultLaborRate: 55000, sortOrder: 1, milestones: ["before", "after_strip", "during_bodywork", "after_primer", "after_paint", "after_reassembly"] },
    { category: "Car Restoration", name: "Partial Restoration (Specific Areas)", defaultEstimatedHours: 20, defaultLaborRate: 55000, sortOrder: 2, milestones: ["before", "in_progress", "after"] },
    { category: "Car Restoration", name: "Fiberglass Repair", defaultEstimatedHours: 6, defaultLaborRate: 50000, sortOrder: 3, milestones: ["before", "during_repair", "after"] },
    { category: "Car Restoration", name: "Lead Work / Body Filler Sculpting", defaultEstimatedHours: 8, defaultLaborRate: 55000, sortOrder: 4, milestones: ["before", "during_shaping", "after_primer"] },
    { category: "Car Restoration", name: "Chrome Re-Plating Coordination", defaultEstimatedHours: 1, defaultLaborRate: 40000, requiresSublet: true, sortOrder: 5, milestones: ["before", "after"] },
    { category: "Car Restoration", name: "Interior Restoration", description: "Dashboard, panels, trim", defaultEstimatedHours: 16, defaultLaborRate: 50000, sortOrder: 6, milestones: ["before", "in_progress", "after"] },
    { category: "Car Restoration", name: "Convertible Top Repair / Replacement", defaultEstimatedHours: 8, defaultLaborRate: 50000, sortOrder: 7, milestones: ["before", "after"] },
    { category: "Car Restoration", name: "Classic Car Paint", description: "Period-correct colors, single-stage enamel", defaultEstimatedHours: 30, defaultLaborRate: 60000, sortOrder: 8, milestones: ["before", "after_strip", "after_bodywork", "after_primer", "after_paint"] },

    // --- Accessories & Add-ons ---
    { category: "Accessories & Add-ons", name: "Body Kit Installation", defaultEstimatedHours: 6, defaultLaborRate: 45000, sortOrder: 1, milestones: ["before", "during_fitment", "after"] },
    { category: "Accessories & Add-ons", name: "Spoiler / Wing Installation", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 2, milestones: ["before", "after"] },
    { category: "Accessories & Add-ons", name: "Side Mirror Replacement", defaultEstimatedHours: 0.5, defaultLaborRate: 35000, sortOrder: 3, milestones: ["before", "after"] },
    { category: "Accessories & Add-ons", name: "Door Handle Repair / Replacement", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
    { category: "Accessories & Add-ons", name: "Emblem / Badge Installation", defaultEstimatedHours: 0.5, defaultLaborRate: 30000, sortOrder: 5, milestones: ["before", "after"] },
    { category: "Accessories & Add-ons", name: "Window Tinting (Film)", defaultEstimatedHours: 3, defaultLaborRate: 40000, sortOrder: 6, milestones: ["before", "after"] },
    { category: "Accessories & Add-ons", name: "Dashcam Installation", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 7, milestones: ["before", "after"] },
  ];

  let serviceCount = 0;
  for (const svc of services) {
    await prisma.serviceCatalog.upsert({
      where: {
        id: `seed-${svc.category}-${svc.sortOrder}`,
      },
      update: {},
      create: {
        id: `seed-${svc.category.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${svc.sortOrder}`,
        category: svc.category,
        name: svc.name,
        description: svc.description ?? null,
        defaultEstimatedHours: svc.defaultEstimatedHours,
        defaultLaborRate: svc.defaultLaborRate,
        requiresSublet: svc.requiresSublet ?? false,
        isActive: true,
        sortOrder: svc.sortOrder,
        requiredMilestonePhotos: JSON.stringify(svc.milestones),
      },
    });
    serviceCount++;
  }
  console.log(`  Created ${serviceCount} service catalog entries`);

  // ========================================================================
  // 3. Default Settings
  // ========================================================================
  const settings = [
    // Shop Profile
    { key: "shop_name", value: '"AutoServ Pro"', category: "shop_profile", description: "Business name" },
    { key: "shop_address", value: '""', category: "shop_profile", description: "Business address" },
    { key: "shop_phone", value: '""', category: "shop_profile", description: "Business phone number" },
    { key: "shop_email", value: '""', category: "shop_profile", description: "Business email" },
    { key: "shop_tin", value: '""', category: "shop_profile", description: "Tax Identification Number" },
    { key: "shop_logo_url", value: '""', category: "shop_profile", description: "Shop logo file path or URL" },

    // Labor & Pricing
    { key: "default_labor_rate", value: "50000", category: "labor", description: "Default labor rate in centavos per hour" },
    { key: "overtime_multiplier", value: "1.5", category: "labor", description: "Overtime rate multiplier" },
    { key: "overtime_threshold_hours", value: "8", category: "labor", description: "Daily hours before overtime kicks in" },
    { key: "default_parts_markup", value: "25", category: "labor", description: "Default parts markup percentage" },

    // Tax
    { key: "vat_rate", value: "12", category: "tax", description: "VAT rate percentage" },
    { key: "vat_enabled", value: "true", category: "tax", description: "Whether to apply VAT" },

    // Photo Requirements
    { key: "intake_min_photos", value: "15", category: "photos", description: "Minimum intake walkaround photos" },
    { key: "progress_min_photos", value: "3", category: "photos", description: "Minimum progress photos per task" },
    { key: "qc_min_photos", value: "5", category: "photos", description: "Minimum QC completion photos" },
    { key: "release_min_photos", value: "10", category: "photos", description: "Minimum release walkaround photos" },
    { key: "photo_max_size_mb", value: "10", category: "photos", description: "Maximum photo file size in MB" },
    { key: "photo_watermark_enabled", value: "true", category: "photos", description: "Enable timestamp watermark on photos" },

    // Documents
    { key: "estimate_terms", value: '"All prices are estimates and may change upon disassembly and further inspection. Payment is due upon completion unless otherwise agreed. Vehicle storage fees may apply after 7 days of completion notice."', category: "documents", description: "Default estimate terms and conditions" },
    { key: "intake_authorization_terms", value: '"I authorize AutoServ Pro to perform the work as described in the approved estimate. I understand that additional work may be required pending further inspection, and will be communicated with a supplemental estimate for my approval. I agree to the storage and payment terms."', category: "documents", description: "Default intake authorization legal terms" },
    { key: "release_acceptance_terms", value: '"I have inspected the vehicle and accept the completed work as satisfactory. I acknowledge the warranty terms and care instructions provided."', category: "documents", description: "Default release acceptance terms" },

    // Warranty Defaults
    { key: "warranty_full_repaint_months", value: "24", category: "warranty", description: "Full repaint warranty duration in months" },
    { key: "warranty_spot_paint_months", value: "12", category: "warranty", description: "Spot paint warranty duration in months" },
    { key: "warranty_ceramic_coating_months", value: "24", category: "warranty", description: "Ceramic coating warranty duration in months" },
    { key: "warranty_collision_repair_months", value: "12", category: "warranty", description: "Collision repair warranty duration in months" },

    // Numbering
    { key: "next_est_sequence", value: "1", category: "numbering", description: "Next estimate request sequence number" },
    { key: "next_jo_sequence", value: "1", category: "numbering", description: "Next job order sequence number" },
    { key: "next_inv_sequence", value: "1", category: "numbering", description: "Next invoice sequence number" },
    { key: "next_or_sequence", value: "1", category: "numbering", description: "Next official receipt sequence number" },
    { key: "next_sup_sequence", value: "1", category: "numbering", description: "Next supplemental estimate sequence number" },

    // Follow-up
    { key: "followup_7day_enabled", value: "true", category: "followup", description: "Enable 7-day post-release follow-up" },
    { key: "followup_30day_enabled", value: "true", category: "followup", description: "Enable 30-day satisfaction survey" },
    { key: "followup_6month_enabled", value: "true", category: "followup", description: "Enable 6-month maintenance reminder" },
    { key: "followup_1year_enabled", value: "true", category: "followup", description: "Enable 1-year anniversary reminder" },

    // Working Hours
    { key: "shop_open_time", value: '"08:00"', category: "schedule", description: "Shop opening time (24hr format)" },
    { key: "shop_close_time", value: '"18:00"', category: "schedule", description: "Shop closing time (24hr format)" },
    { key: "shop_working_days", value: '["MON","TUE","WED","THU","FRI","SAT"]', category: "schedule", description: "Working days" },

    // Session
    { key: "session_timeout_admin_hours", value: "8", category: "session", description: "Admin/office session timeout in hours" },
    { key: "session_timeout_tech_hours", value: "2", category: "session", description: "Technician session timeout in hours" },

    // Overrun alerts
    { key: "hour_overrun_warning_pct", value: "80", category: "alerts", description: "Yellow warning at this % of estimated hours" },
    { key: "hour_overrun_critical_pct", value: "100", category: "alerts", description: "Red alert at this % of estimated hours" },
    { key: "parts_variance_threshold_pct", value: "15", category: "alerts", description: "Flag variance when actual exceeds estimated by this %" },

    // Approval link expiry
    { key: "estimate_approval_link_days", value: "7", category: "documents", description: "Days before estimate approval link expires" },
  ];

  let settingCount = 0;
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        value: s.value,
        category: s.category,
        description: s.description,
      },
    });
    settingCount++;
  }
  console.log(`  Created ${settingCount} default settings`);

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

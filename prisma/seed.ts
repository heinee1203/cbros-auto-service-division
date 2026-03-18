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

    // --- Preventive Maintenance Service (PMS) ---
    { category: "Preventive Maintenance Service (PMS)", name: "PMS Basic (Oil + Filter Change)", description: "Oil change, oil filter, basic visual inspection", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 1, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "PMS Intermediate", description: "Oil + filter + air filter + cabin filter + spark plugs", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 2, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "PMS Full / Major", description: "Comprehensive — all fluids, filters, plugs, belts, inspection", defaultEstimatedHours: 5, defaultLaborRate: 50000, sortOrder: 3, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Oil Change Only", defaultEstimatedHours: 0.5, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Transmission Fluid Change (ATF / CVT / Manual)", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 5, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Coolant Flush & Replacement", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 6, milestones: ["before_service", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Brake Fluid Flush & Replacement", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 7, milestones: ["before_service", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Power Steering Fluid Change", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 8, milestones: ["before_service", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Differential / Transfer Case Fluid Change", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 9, milestones: ["before_service", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Air Filter Replacement", defaultEstimatedHours: 0.25, defaultLaborRate: 25000, sortOrder: 10, milestones: ["old_parts", "new_parts_installed"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Cabin / AC Filter Replacement", defaultEstimatedHours: 0.25, defaultLaborRate: 25000, sortOrder: 11, milestones: ["old_parts", "new_parts_installed"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Spark Plug Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 12, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Drive Belt / Serpentine Belt Replacement", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 13, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Timing Belt / Chain Replacement", defaultEstimatedHours: 5, defaultLaborRate: 50000, sortOrder: 14, milestones: ["before_service", "old_parts", "new_parts_installed", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Fuel Filter Replacement", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 15, milestones: ["old_parts", "new_parts_installed"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Battery Replacement / Testing", defaultEstimatedHours: 0.5, defaultLaborRate: 30000, sortOrder: 16, milestones: ["before_service", "after_service"] },
    { category: "Preventive Maintenance Service (PMS)", name: "Wiper Blade Replacement", defaultEstimatedHours: 0.25, defaultLaborRate: 20000, sortOrder: 17, milestones: ["before_service", "after_service"] },

    // --- Brake System ---
    { category: "Brake System", name: "Brake Pad Replacement (Front)", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 1, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Pad Replacement (Rear)", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 2, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Disc / Rotor Replacement (Front)", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 3, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Disc / Rotor Replacement (Rear)", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 4, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Disc Resurfacing / Machining", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 5, milestones: ["before_disassembly", "worn_parts", "after_reassembly"] },
    { category: "Brake System", name: "Brake Drum Replacement / Machining", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 6, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Shoe Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 7, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Caliper Repair / Replacement", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 8, milestones: ["before_disassembly", "worn_parts", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Line Repair / Replacement", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 9, milestones: ["before_disassembly", "new_parts_installed", "after_reassembly"] },
    { category: "Brake System", name: "Brake Fluid Bleeding", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 10, milestones: ["before_disassembly", "after_reassembly"] },
    { category: "Brake System", name: "Handbrake / Parking Brake Adjustment", defaultEstimatedHours: 0.5, defaultLaborRate: 30000, sortOrder: 11, milestones: ["before_disassembly", "after_reassembly"] },
    { category: "Brake System", name: "ABS Sensor Diagnosis / Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 45000, sortOrder: 12, milestones: ["diagnostic_screen", "before_disassembly", "new_parts_installed", "after_reassembly"] },

    // --- Suspension & Steering ---
    { category: "Suspension & Steering", name: "Shock Absorber Replacement (Front)", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 1, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Shock Absorber Replacement (Rear)", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 2, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Strut Assembly Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 3, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Coil Spring Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 4, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Leaf Spring Repair / Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 5, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Ball Joint Replacement (Upper / Lower)", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 6, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Tie Rod End Replacement (Inner / Outer)", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 7, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Stabilizer Link / Sway Bar Link Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 8, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Stabilizer Bar Bushing Replacement", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 9, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Control Arm / Wishbone Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 10, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Steering Rack Repair / Replacement", defaultEstimatedHours: 4, defaultLaborRate: 50000, sortOrder: 11, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Power Steering Pump Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 12, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Wheel Bearing Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 13, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "CV Joint / CV Boot Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 14, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Drive Shaft Repair", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 15, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Wheel Alignment (2-Wheel / 4-Wheel)", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 16, milestones: ["before_disassembly", "alignment_printout", "after_reassembly"] },
    { category: "Suspension & Steering", name: "Wheel Balancing", defaultEstimatedHours: 0.75, defaultLaborRate: 35000, sortOrder: 17, milestones: ["before_disassembly", "after_reassembly"] },

    // --- Engine & Drivetrain ---
    { category: "Engine & Drivetrain", name: "Engine Tune-Up", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 1, milestones: ["before_disassembly", "during_teardown", "new_parts_installed", "after_reassembly", "running_test"] },
    { category: "Engine & Drivetrain", name: "Engine Overhaul (Top / Full)", description: "Top overhaul or full engine rebuild", defaultEstimatedHours: 40, defaultLaborRate: 55000, sortOrder: 2, milestones: ["before_disassembly", "during_teardown", "new_parts_installed", "after_reassembly", "running_test"] },
    { category: "Engine & Drivetrain", name: "Cylinder Head Gasket Replacement", defaultEstimatedHours: 8, defaultLaborRate: 50000, sortOrder: 3, milestones: ["before_disassembly", "during_teardown", "new_parts_installed", "after_reassembly", "running_test"] },
    { category: "Engine & Drivetrain", name: "Valve Cover Gasket Replacement", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 4, milestones: ["before_disassembly", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Engine Mount Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 5, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Clutch Assembly Replacement", defaultEstimatedHours: 6, defaultLaborRate: 50000, sortOrder: 6, milestones: ["before_disassembly", "during_teardown", "new_parts_installed", "after_reassembly", "running_test"] },
    { category: "Engine & Drivetrain", name: "Flywheel Resurfacing / Replacement", defaultEstimatedHours: 4, defaultLaborRate: 45000, sortOrder: 7, milestones: ["before_disassembly", "during_teardown", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Radiator Repair / Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 8, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Thermostat Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 35000, sortOrder: 9, milestones: ["before_disassembly", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Water Pump Replacement", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 10, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Alternator Repair / Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 11, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Starter Motor Repair / Replacement", defaultEstimatedHours: 2.5, defaultLaborRate: 45000, sortOrder: 12, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "AC Compressor Repair / Replacement", defaultEstimatedHours: 4, defaultLaborRate: 50000, sortOrder: 13, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly", "running_test"] },
    { category: "Engine & Drivetrain", name: "AC System Recharge / Regas", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 14, milestones: ["before_disassembly", "after_reassembly", "running_test"] },
    { category: "Engine & Drivetrain", name: "AC Evaporator / Condenser Cleaning", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 15, milestones: ["before_disassembly", "during_teardown", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Exhaust System Repair", defaultEstimatedHours: 2.5, defaultLaborRate: 40000, sortOrder: 16, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Catalytic Converter Replacement", defaultEstimatedHours: 3, defaultLaborRate: 50000, sortOrder: 17, milestones: ["before_disassembly", "old_parts_removed", "new_parts_installed", "after_reassembly"] },
    { category: "Engine & Drivetrain", name: "Turbo Repair / Replacement", defaultEstimatedHours: 6, defaultLaborRate: 55000, sortOrder: 18, milestones: ["before_disassembly", "during_teardown", "new_parts_installed", "after_reassembly", "running_test"] },

    // --- Electrical & Diagnostics ---
    { category: "Electrical & Diagnostics", name: "OBD2 / Computer Diagnostic Scan", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 1, milestones: ["diagnostic_screen", "codes_cleared"] },
    { category: "Electrical & Diagnostics", name: "Check Engine Light Diagnosis", defaultEstimatedHours: 1.5, defaultLaborRate: 45000, sortOrder: 2, milestones: ["diagnostic_screen", "before_repair", "after_repair", "codes_cleared"] },
    { category: "Electrical & Diagnostics", name: "Sensor Replacement", description: "O2, MAP, MAF, TPS, CKP, CMP, knock, coolant temp, etc.", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 3, milestones: ["diagnostic_screen", "before_repair", "after_repair", "codes_cleared"] },
    { category: "Electrical & Diagnostics", name: "Wiring Repair / Harness Repair", defaultEstimatedHours: 3, defaultLaborRate: 45000, sortOrder: 4, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Headlight Bulb Replacement (Halogen / LED / HID)", defaultEstimatedHours: 0.5, defaultLaborRate: 25000, sortOrder: 5, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Headlight Assembly Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 6, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Taillight Assembly Replacement", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 7, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Turn Signal / Marker Light Repair", defaultEstimatedHours: 0.75, defaultLaborRate: 30000, sortOrder: 8, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Horn Repair / Replacement", defaultEstimatedHours: 0.5, defaultLaborRate: 25000, sortOrder: 9, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Power Window Motor Replacement", defaultEstimatedHours: 2, defaultLaborRate: 40000, sortOrder: 10, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Central Lock Actuator Replacement", defaultEstimatedHours: 1.5, defaultLaborRate: 40000, sortOrder: 11, milestones: ["before_repair", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Car Alarm / Immobilizer Programming", defaultEstimatedHours: 2, defaultLaborRate: 50000, sortOrder: 12, milestones: ["diagnostic_screen", "after_repair"] },
    { category: "Electrical & Diagnostics", name: "Dashboard Warning Light Diagnosis", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 13, milestones: ["diagnostic_screen", "codes_cleared"] },

    // --- Tires & Wheels ---
    { category: "Tires & Wheels", name: "Tire Mounting & Balancing", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 1, milestones: ["before", "after"] },
    { category: "Tires & Wheels", name: "Tire Rotation", defaultEstimatedHours: 0.5, defaultLaborRate: 30000, sortOrder: 2, milestones: ["before", "after"] },
    { category: "Tires & Wheels", name: "Flat Tire Repair (Plug / Patch)", defaultEstimatedHours: 0.5, defaultLaborRate: 25000, sortOrder: 3, milestones: ["before", "after"] },
    { category: "Tires & Wheels", name: "Tire Replacement", description: "Per tire — specify size", defaultEstimatedHours: 1, defaultLaborRate: 35000, sortOrder: 4, milestones: ["before", "after"] },
    { category: "Tires & Wheels", name: "TPMS Sensor Reset / Replacement", defaultEstimatedHours: 1, defaultLaborRate: 40000, sortOrder: 5, milestones: ["before", "after"] },
    { category: "Tires & Wheels", name: "Rim Repair / Straightening", defaultEstimatedHours: 2, defaultLaborRate: 45000, sortOrder: 6, milestones: ["before", "after"] },

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
  ];

  let serviceCount = 0;
  for (const svc of services) {
    const seedId = `seed-${svc.category.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${svc.sortOrder}`;
    await prisma.serviceCatalog.upsert({
      where: {
        id: seedId,
      },
      update: {},
      create: {
        id: seedId,
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
    { key: "vat_inclusive", value: "true", category: "tax", description: "Prices are VAT-inclusive (backed out on invoices, not added on top)" },

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
    { key: "warranty_duration_detailing", value: "6", category: "warranty", description: "Detailing warranty duration in months" },
    { key: "warranty_duration_undercoating", value: "12", category: "warranty", description: "Undercoating warranty duration in months" },
    { key: "warranty_duration_ppf", value: "60", category: "warranty", description: "PPF warranty duration in months" },
    { key: "warranty_duration_restoration", value: "12", category: "warranty", description: "Car restoration warranty duration in months" },

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

    // Care Instructions
    { key: "care_instructions_paint", value: "Avoid washing for 7 days. Avoid automatic car washes for 30 days. No waxing for 60 days. Hand wash only with pH-neutral shampoo.", category: "care_instructions", description: "Care instructions for paint/repaint jobs" },
    { key: "care_instructions_ceramic_coating", value: "Avoid water for 24 hours. No soap wash for 7 days. First maintenance wash at 2 weeks. Use pH-neutral shampoo only.", category: "care_instructions", description: "Care instructions for ceramic coating" },
    { key: "care_instructions_undercoating", value: "Allow 48 hours for full cure. Avoid pressure washing underbody for 1 week. Inspect annually.", category: "care_instructions", description: "Care instructions for undercoating" },
    { key: "care_instructions_ppf", value: "No washing for 48 hours. Avoid pressure washer on film edges. Use pH-neutral shampoo. No abrasive polishing on film.", category: "care_instructions", description: "Care instructions for PPF" },
    { key: "care_instructions_detailing", value: "Maintain with pH-neutral shampoo. Avoid automatic car washes. Use microfiber towels only. Re-apply coating maintenance spray monthly.", category: "care_instructions", description: "Care instructions for detailing" },
    { key: "care_instructions_collision", value: "Avoid high-pressure washing on repaired areas for 14 days. Check for any paint chips or bubbling within first month.", category: "care_instructions", description: "Care instructions for collision repair" },

    // Warranty Terms Template
    { key: "warranty_terms_template", value: "This warranty covers defects in workmanship and materials for the specified service. Normal wear and tear, accident damage, and modifications by third parties are excluded. To make a claim, contact us at the shop phone number with your completion report reference.", category: "warranty", description: "Default warranty terms template" },

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

    // QC Checklist Templates
    { key: "qc_checklist_paint_body", value: JSON.stringify([
      {"description": "Color match accuracy (natural light + fluorescent)", "sortOrder": 1},
      {"description": "Orange peel level acceptable", "sortOrder": 2},
      {"description": "No runs, sags, drips, or fisheyes", "sortOrder": 3},
      {"description": "Blending on adjacent panels seamless", "sortOrder": 4},
      {"description": "Clear coat gloss and DOI satisfactory", "sortOrder": 5},
      {"description": "No sanding marks, halos, or burn-throughs", "sortOrder": 6},
      {"description": "All masking removed cleanly", "sortOrder": 7},
      {"description": "Panel alignment and gaps consistent", "sortOrder": 8},
      {"description": "All clips, fasteners, trim reinstalled", "sortOrder": 9},
      {"description": "No rattles or loose components", "sortOrder": 10},
      {"description": "All hardware torqued", "sortOrder": 11},
    ]), category: "qc", description: "Paint & Body QC checklist template" },

    { key: "qc_checklist_detailing", value: JSON.stringify([
      {"description": "Surface free of swirls, holograms, marring (LED inspection)", "sortOrder": 1},
      {"description": "Coating applied evenly, no high spots", "sortOrder": 2},
      {"description": "Glass clean and streak-free", "sortOrder": 3},
      {"description": "Interior surfaces clean, no residue", "sortOrder": 4},
      {"description": "Tires and trim dressed evenly", "sortOrder": 5},
      {"description": "No fingerprints or water spots", "sortOrder": 6},
      {"description": "No chemical odor remaining", "sortOrder": 7},
    ]), category: "qc", description: "Detailing QC checklist template" },

    { key: "qc_checklist_undercoating", value: JSON.stringify([
      {"description": "Full coverage on specified areas", "sortOrder": 1},
      {"description": "Consistent thickness", "sortOrder": 2},
      {"description": "No drips or runs", "sortOrder": 3},
      {"description": "Drain holes not blocked", "sortOrder": 4},
      {"description": "No overspray on suspension/exhaust/brake components", "sortOrder": 5},
      {"description": "Adequate curing time observed", "sortOrder": 6},
    ]), category: "qc", description: "Undercoating QC checklist template" },

    { key: "qc_checklist_mechanical", value: JSON.stringify([
      {"description": "All lights function", "sortOrder": 1},
      {"description": "Doors, hood, trunk open/close/latch properly", "sortOrder": 2},
      {"description": "Windows operate correctly", "sortOrder": 3},
      {"description": "Locks function", "sortOrder": 4},
      {"description": "No fluid leaks", "sortOrder": 5},
      {"description": "Test drive completed (if applicable)", "sortOrder": 6},
    ]), category: "qc", description: "Mechanical/Functional QC checklist template" },

    { key: "qc_checklist_pms", value: JSON.stringify([
      {"description": "Correct oil type and quantity used", "sortOrder": 1},
      {"description": "Oil filter properly seated — no leaks", "sortOrder": 2},
      {"description": "Drain plug torqued to spec with new washer", "sortOrder": 3},
      {"description": "All fluid levels topped off (coolant, brake, PS, washer)", "sortOrder": 4},
      {"description": "Belt tension within spec (no glazing or cracks)", "sortOrder": 5},
      {"description": "Battery terminals clean and tight", "sortOrder": 6},
      {"description": "No visible leaks under vehicle after 5-min idle", "sortOrder": 7},
      {"description": "Air filter / cabin filter properly seated", "sortOrder": 8},
      {"description": "Spark plugs gapped correctly (if replaced)", "sortOrder": 9},
      {"description": "All under-hood covers / shields reinstalled", "sortOrder": 10},
      {"description": "Test drive completed — no warning lights", "sortOrder": 11},
    ]), category: "qc", description: "Preventive Maintenance QC checklist template" },

    { key: "qc_checklist_brake", value: JSON.stringify([
      {"description": "Correct pad model / OE-equivalent installed", "sortOrder": 1},
      {"description": "Disc thickness within service limit (measured)", "sortOrder": 2},
      {"description": "Caliper slide pins greased and moving freely", "sortOrder": 3},
      {"description": "All brake hardware / clips / shims installed", "sortOrder": 4},
      {"description": "Brake lines — no kinks, cracks, or leaks", "sortOrder": 5},
      {"description": "Brake fluid level correct — no air in system", "sortOrder": 6},
      {"description": "Pedal feel firm — no sponginess", "sortOrder": 7},
      {"description": "No grinding / squealing during test drive", "sortOrder": 8},
      {"description": "Handbrake / parking brake holds on incline", "sortOrder": 9},
      {"description": "Test drive completed — straight-line braking", "sortOrder": 10},
    ]), category: "qc", description: "Brake System QC checklist template" },

    { key: "qc_checklist_suspension", value: JSON.stringify([
      {"description": "All bolts torqued to spec (mark with paint pen)", "sortOrder": 1},
      {"description": "No play in ball joints / tie rods (loaded test)", "sortOrder": 2},
      {"description": "Shock absorbers — no leaks or weeping", "sortOrder": 3},
      {"description": "Springs seated correctly — even ride height", "sortOrder": 4},
      {"description": "CV boots intact — no grease leakage", "sortOrder": 5},
      {"description": "Steering wheel centered during straight driving", "sortOrder": 6},
      {"description": "Alignment within manufacturer spec (printout attached)", "sortOrder": 7},
      {"description": "No clunks / knocks over bumps (test drive)", "sortOrder": 8},
      {"description": "No vibration at highway speed", "sortOrder": 9},
      {"description": "Test drive completed — stable and predictable", "sortOrder": 10},
    ]), category: "qc", description: "Suspension & Steering QC checklist template" },

    { key: "qc_checklist_engine", value: JSON.stringify([
      {"description": "No oil / coolant / fuel leaks after warm-up", "sortOrder": 1},
      {"description": "Gasket surfaces clean — proper sealant application", "sortOrder": 2},
      {"description": "Engine mounts tight — no excessive vibration", "sortOrder": 3},
      {"description": "Clutch engagement smooth (if replaced)", "sortOrder": 4},
      {"description": "AC blows cold to spec temp (if AC work done)", "sortOrder": 5},
      {"description": "Radiator cap holds pressure — no bubbling", "sortOrder": 6},
      {"description": "All hose clamps tight — no weeping", "sortOrder": 7},
      {"description": "No dashboard warning lights after test drive", "sortOrder": 8},
      {"description": "Test drive completed — smooth idle, good power", "sortOrder": 9},
      {"description": "Exhaust — no leaks, normal sound level", "sortOrder": 10},
    ]), category: "qc", description: "Engine & Drivetrain QC checklist template" },

    { key: "qc_checklist_electrical", value: JSON.stringify([
      {"description": "All lights function (head, tail, brake, turn, reverse, fog)", "sortOrder": 1},
      {"description": "OBD scan — all codes cleared", "sortOrder": 2},
      {"description": "No new DTCs after test drive", "sortOrder": 3},
      {"description": "Sensor readings within normal range", "sortOrder": 4},
      {"description": "All wiring secured — no loose connectors", "sortOrder": 5},
      {"description": "Power windows operate smoothly (all doors)", "sortOrder": 6},
      {"description": "Central lock / keyless entry working on all doors", "sortOrder": 7},
      {"description": "Horn functions properly", "sortOrder": 8},
      {"description": "Test drive completed — no warning lights", "sortOrder": 9},
    ]), category: "qc", description: "Electrical & Diagnostics QC checklist template" },

    { key: "qc_checklist_tire", value: JSON.stringify([
      {"description": "Lug nuts torqued to manufacturer spec", "sortOrder": 1},
      {"description": "Tire pressures set to door placard spec (cold)", "sortOrder": 2},
      {"description": "Balance weights secure — no vibration at speed", "sortOrder": 3},
      {"description": "TPMS light off — sensors reading correctly", "sortOrder": 4},
      {"description": "Tread depth adequate and even across width", "sortOrder": 5},
      {"description": "Spare tire / jack / tools accounted for", "sortOrder": 6},
    ]), category: "qc", description: "Tires & Wheels QC checklist template" },

    // Discount threshold
    { key: "discount_approval_threshold", value: "500000", category: "invoicing", description: "Discount amount (centavos) requiring OWNER/MANAGER approval" },

    // Intake Estimate Tolerance
    { key: "intake_tolerance_percentage", value: "10", category: "intake", description: "Max % change at intake without formal re-approval" },
    { key: "intake_tolerance_amount", value: "100000", category: "intake", description: "Max absolute change (centavos) at intake without formal re-approval" },
    { key: "intake_tolerance_mode", value: '"higher"', category: "intake", description: "Which threshold applies: higher, lower, or both" },
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

  // ========================================================================
  // 4. Soft-delete old placeholder bays (only if no active assignments)
  // ========================================================================
  const oldBayNames = ["Bay 1", "Bay 2", "Bay 3", "Paint Booth", "Detail Bay", "PDR Station"];
  for (const name of oldBayNames) {
    const oldBay = await prisma.bay.findFirst({
      where: { name, deletedAt: null },
      include: { assignments: true },
    });
    if (oldBay && oldBay.assignments.length === 0) {
      await prisma.bay.update({
        where: { id: oldBay.id },
        data: { deletedAt: new Date(), isActive: false },
      });
      console.log(`  Soft-deleted old bay: ${name}`);
    }
  }

  // ========================================================================
  // 5. Real CBROS Bays (17 total)
  // ========================================================================
  const realBays: { name: string; type: string; color: string; sortOrder: number }[] = [];
  for (let i = 1; i <= 7; i++) {
    realBays.push({ name: `Lifter ${i}`, type: "GENERAL", color: "#3B82F6", sortOrder: i });
  }
  for (let i = 1; i <= 10; i++) {
    realBays.push({ name: `Non-Lifter ${i}`, type: "GENERAL", color: "#10B981", sortOrder: 7 + i });
  }

  for (const bay of realBays) {
    const existing = await prisma.bay.findFirst({
      where: { name: bay.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.bay.create({ data: bay });
    }
  }
  console.log(`  Created/verified ${realBays.length} real bays`);

  // ========================================================================
  // 6. Technicians (12)
  // ========================================================================
  const technicians = [
    { firstName: "Allan", username: "allan", pin: "1001" },
    { firstName: "Inggo", username: "inggo", pin: "1002" },
    { firstName: "Lino", username: "lino", pin: "1003" },
    { firstName: "Toni", username: "toni", pin: "1004" },
    { firstName: "Jurell", username: "jurell", pin: "1005" },
    { firstName: "Sam", username: "sam", pin: "1006" },
    { firstName: "Nold", username: "nold", pin: "1007" },
    { firstName: "Joy", username: "joy", pin: "1008" },
    { firstName: "Kevin", username: "kevin", pin: "1009" },
    { firstName: "Joseph", username: "joseph", pin: "1010" },
    { firstName: "Roi", username: "roi", pin: "1011" },
    { firstName: "Buban", username: "buban", pin: "1012" },
  ];

  for (const tech of technicians) {
    const hashedPin = await bcrypt.hash(tech.pin, 12);
    const hashedPw = await bcrypt.hash(tech.pin, 12);
    await prisma.user.upsert({
      where: { username: tech.username },
      update: {},
      create: {
        username: tech.username,
        passwordHash: hashedPw,
        pinHash: hashedPin,
        firstName: tech.firstName,
        lastName: ".",
        role: "TECHNICIAN",
        isActive: true,
      },
    });
  }
  console.log(`  Created/verified ${technicians.length} technicians`);

  // ========================================================================
  // 7. Front Desk Advisors (7)
  // ========================================================================
  const advisors = [
    { firstName: "Abi", username: "abi", pin: "2001" },
    { firstName: "Kathleen", username: "kathleen", pin: "2002" },
    { firstName: "Jelyn", username: "jelyn", pin: "2003" },
    { firstName: "Arlene", username: "arlene", pin: "2004" },
    { firstName: "Leslie", username: "leslie", pin: "2005" },
    { firstName: "Ma Jelyn", username: "majelyn", pin: "2006" },
    { firstName: "Ronna", username: "ronna", pin: "2007" },
  ];

  for (const adv of advisors) {
    const hashedPin = await bcrypt.hash(adv.pin, 12);
    const hashedPw = await bcrypt.hash(adv.pin, 12);
    await prisma.user.upsert({
      where: { username: adv.username },
      update: {},
      create: {
        username: adv.username,
        passwordHash: hashedPw,
        pinHash: hashedPin,
        firstName: adv.firstName,
        lastName: ".",
        role: "ADVISOR",
        isActive: true,
      },
    });
  }
  console.log(`  Created/verified ${advisors.length} front desk advisors`);

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

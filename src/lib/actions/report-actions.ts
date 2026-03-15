"use server";

import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import * as reports from "@/lib/services/reports";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  warning?: string;
};

// ---------------------------------------------------------------------------
// 1. Daily Sales Report
// ---------------------------------------------------------------------------
export async function generateDailySalesAction(
  dateStr: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getDailySalesReport(new Date(dateStr));
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Receivables Aging Report
// ---------------------------------------------------------------------------
export async function generateReceivablesAgingAction(
  insuranceOnly?: boolean
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getReceivablesAgingReport(insuranceOnly);
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 3. Job Status Report
// ---------------------------------------------------------------------------
export async function generateJobStatusAction(range: {
  from: string;
  to: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getJobStatusReport({
      from: new Date(range.from),
      to: new Date(range.to),
    });
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Technician Utilization Report
// ---------------------------------------------------------------------------
export async function generateTechUtilizationAction(range: {
  from: string;
  to: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getTechUtilizationReport({
      from: new Date(range.from),
      to: new Date(range.to),
    });
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 5. Service Revenue Report
// ---------------------------------------------------------------------------
export async function generateServiceRevenueAction(range: {
  from: string;
  to: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getServiceRevenueReport({
      from: new Date(range.from),
      to: new Date(range.to),
    });
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 6. Parts Usage Report
// ---------------------------------------------------------------------------
export async function generatePartsUsageAction(range: {
  from: string;
  to: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getPartsUsageReport({
      from: new Date(range.from),
      to: new Date(range.to),
    });
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 7. Customer Report
// ---------------------------------------------------------------------------
export async function generateCustomerReportAction(range: {
  from: string;
  to: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getCustomerReport({
      from: new Date(range.from),
      to: new Date(range.to),
    });
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 8. Warranty Claims Report
// ---------------------------------------------------------------------------
export async function generateWarrantyClaimsAction(range: {
  from: string;
  to: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getWarrantyClaimsReport({
      from: new Date(range.from),
      to: new Date(range.to),
    });
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

// ---------------------------------------------------------------------------
// 9. Insurance Receivables Report
// ---------------------------------------------------------------------------
export async function generateInsuranceReceivablesAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role, "reports:view"))
    return { success: false, error: "Permission denied" };

  try {
    const data = await reports.getInsuranceReceivablesReport();
    return { success: true, data: data as unknown as Record<string, unknown> };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
    };
  }
}

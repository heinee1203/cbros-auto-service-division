import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import * as analytics from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "analytics:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  const dateRange = { from: new Date(from), to: new Date(to) };

  const [overview, revenue, pipeline, capacity, financial] = await Promise.all([
    analytics.getShopOverview(dateRange),
    analytics.getRevenueBreakdown(dateRange),
    analytics.getJobPipeline(dateRange),
    analytics.getCapacityMetrics(dateRange),
    analytics.getFinancialSummary(dateRange),
  ]);

  return NextResponse.json({ overview, revenue, pipeline, capacity, financial });
}

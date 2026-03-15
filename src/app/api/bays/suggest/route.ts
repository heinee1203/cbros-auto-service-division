import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { suggestBayForJob } from "@/lib/services/scheduler";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:bays_assign")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobOrderId = request.nextUrl.searchParams.get("jobOrderId");
  if (!jobOrderId) {
    return NextResponse.json(
      { error: "jobOrderId param required" },
      { status: 400 }
    );
  }

  const result = await suggestBayForJob(jobOrderId);
  return NextResponse.json(result);
}

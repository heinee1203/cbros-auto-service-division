import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobOrderDetail } from "@/lib/services/job-orders";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const jobOrder = await getJobOrderDetail(id);
  if (!jobOrder) {
    return NextResponse.json({ error: "Job order not found" }, { status: 404 });
  }

  return NextResponse.json(jobOrder);
}

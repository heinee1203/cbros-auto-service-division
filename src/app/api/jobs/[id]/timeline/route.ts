import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobActivities } from "@/lib/services/job-activities";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const limit = parseInt(searchParams.get("limit") || "50");
  const cursor = searchParams.get("cursor") || undefined;
  const type = searchParams.get("type") || undefined;

  const result = await getJobActivities(id, { limit, cursor, type });
  return NextResponse.json(result);
}

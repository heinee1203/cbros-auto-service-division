import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getBayTimeline } from "@/lib/services/scheduler";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end params required" },
      { status: 400 }
    );
  }

  const bays = await getBayTimeline(new Date(start), new Date(end));
  return NextResponse.json(bays);
}

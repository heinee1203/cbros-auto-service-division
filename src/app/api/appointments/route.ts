import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAppointments } from "@/lib/services/scheduler";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const status = searchParams.get("status") || undefined;
  const type = searchParams.get("type") || undefined;

  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const appointments = await getAppointments(
    new Date(start),
    new Date(end),
    { status, type }
  );

  return NextResponse.json(appointments);
}

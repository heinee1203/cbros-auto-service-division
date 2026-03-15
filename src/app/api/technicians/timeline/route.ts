import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAllTechSchedules } from "@/lib/services/scheduler";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:tech_view")) {
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

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  try {
    const techs = await getAllTechSchedules(startDate, endDate);
    return NextResponse.json(techs);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch tech schedules" },
      { status: 500 }
    );
  }
}

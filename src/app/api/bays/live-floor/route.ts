import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLiveFloorData } from "@/lib/services/scheduler";
import type { UserDivision } from "@/types/enums";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const division = (request.nextUrl.searchParams.get("division") || "ALL") as UserDivision;

  try {
    const data = await getLiveFloorData(division);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch live floor data" },
      { status: 500 }
    );
  }
}

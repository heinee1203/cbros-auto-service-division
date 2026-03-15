import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getUpcomingPickUpsByCustomerIds } from "@/lib/services/scheduler";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids =
    request.nextUrl.searchParams
      .get("customerIds")
      ?.split(",")
      .filter(Boolean) || [];
  if (ids.length === 0) return NextResponse.json([]);

  const pickups = await getUpcomingPickUpsByCustomerIds(ids);
  return NextResponse.json(pickups);
}

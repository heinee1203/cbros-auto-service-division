import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getTechnicianPerformance } from "@/lib/services/analytics";

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

  const data = await getTechnicianPerformance({
    from: new Date(from),
    to: new Date(to),
  });
  return NextResponse.json(data);
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchCustomersForSelect } from "@/lib/services/customers";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchCustomersForSelect(q);
  return NextResponse.json(results);
}

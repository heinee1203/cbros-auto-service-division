import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveTechnicians } from "@/lib/services/estimates";
import type { UserDivision } from "@/types/enums";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const division = request.nextUrl.searchParams.get("division") as UserDivision | null;
  const result = await getActiveTechnicians(division || undefined);

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveTechnicians } from "@/lib/services/estimates";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getActiveTechnicians();

  return NextResponse.json(result);
}

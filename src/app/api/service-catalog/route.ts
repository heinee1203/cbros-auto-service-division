import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchServiceCatalog } from "@/lib/services/estimates";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? undefined;

  const result = await searchServiceCatalog(query, category || undefined);

  return NextResponse.json(result);
}

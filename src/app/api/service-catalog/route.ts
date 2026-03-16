import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  searchServiceCatalog,
  getAllActiveServices,
} from "@/lib/services/estimates";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? undefined;

  // If no search query, return all active services (used by intake service select)
  if (!query) {
    const result = await getAllActiveServices(category);
    return NextResponse.json(result);
  }

  const result = await searchServiceCatalog(query, category || undefined);

  return NextResponse.json(result);
}

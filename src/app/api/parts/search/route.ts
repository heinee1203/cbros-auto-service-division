import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchParts } from "@/lib/services/apex-pos";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auth check
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if integration is enabled via settings
  const enabledSetting = await prisma.setting.findUnique({
    where: { key: "apex_pos_enabled" },
  });

  if (enabledSetting?.value !== "true") {
    return NextResponse.json({
      results: [],
      total: 0,
      has_more: false,
      error: "catalog_disabled"
    });
  }

  // Get search params
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const categoryId = searchParams.get("categoryId") || undefined;
  const inStock = searchParams.get("inStock") === "true";

  if (query.length < 2) {
    return NextResponse.json({ results: [], total: 0, has_more: false });
  }

  try {
    const result = await searchParts(query, { limit, categoryId, inStock });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      results: [],
      total: 0,
      has_more: false,
      error: "catalog_offline"
    });
  }
}

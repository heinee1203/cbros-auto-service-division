import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEstimateRequests } from "@/lib/services/estimate-requests";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10))
  );
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder =
    searchParams.get("sortOrder") === "asc" ? "asc" : ("desc" as const);

  const result = await getEstimateRequests({
    page,
    pageSize,
    search: search || undefined,
    status: status || undefined,
    sortBy,
    sortOrder,
  });

  return NextResponse.json(result);
}

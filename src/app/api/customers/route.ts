import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCustomers } from "@/lib/services/customers";

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
  const sortBy = searchParams.get("sortBy") ?? "lastVisit";
  const sortOrder =
    searchParams.get("sortOrder") === "asc" ? "asc" : ("desc" as const);
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : undefined;

  const result = await getCustomers({
    page,
    pageSize,
    search: search || undefined,
    sortBy,
    sortOrder,
    tags,
  });

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEstimateRequestById } from "@/lib/services/estimate-requests";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getEstimateRequestById(id);

  if (!result) {
    return NextResponse.json(
      { error: "Estimate request not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}

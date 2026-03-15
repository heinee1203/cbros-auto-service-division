import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupplementDetail } from "@/lib/services/supplements";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supplement = await getSupplementDetail(id);

  if (!supplement) {
    return NextResponse.json(
      { error: "Supplement not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(supplement);
}

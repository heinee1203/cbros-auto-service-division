import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTasksByJobOrder } from "@/lib/services/tasks";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getTasksByJobOrder(id);
  return NextResponse.json(result);
}

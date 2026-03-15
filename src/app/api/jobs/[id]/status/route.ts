import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateJobOrderStatus } from "@/lib/services/job-orders";
import { JobOrderStatus } from "@/types/enums";

const VALID_STATUSES = Object.values(JobOrderStatus);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 }
    );
  }

  try {
    const updated = await updateJobOrderStatus(id, status, session.user.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update job order status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}

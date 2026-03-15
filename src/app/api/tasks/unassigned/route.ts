import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:tech_manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = await prisma.task.findMany({
      where: {
        assignedTechnicianId: null,
        status: { in: ["QUEUED", "IN_PROGRESS"] },
        deletedAt: null,
        jobOrder: {
          deletedAt: null,
          status: { notIn: ["CANCELLED", "RELEASED"] },
        },
      },
      include: {
        jobOrder: {
          select: {
            id: true,
            jobOrderNumber: true,
            vehicle: { select: { plateNumber: true, make: true, model: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch unassigned tasks" },
      { status: 500 }
    );
  }
}

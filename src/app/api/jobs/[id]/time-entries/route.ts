import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const timeEntries = await prisma.timeEntry.findMany({
    where: { jobOrderId: id, deletedAt: null },
    include: {
      task: { select: { id: true, name: true } },
      technician: { select: { firstName: true, lastName: true } },
    },
    orderBy: { clockIn: "desc" },
  });

  return NextResponse.json(timeEntries);
}

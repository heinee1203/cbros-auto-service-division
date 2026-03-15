import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { customerId: params.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      jobOrders: {
        where: { deletedAt: null },
        select: { id: true, jobOrderNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  return NextResponse.json(vehicles);
}

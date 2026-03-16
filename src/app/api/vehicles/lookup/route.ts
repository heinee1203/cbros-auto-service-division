import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plate = request.nextUrl.searchParams.get("plate");
  if (!plate || plate.length < 3) {
    return NextResponse.json({ error: "Plate number too short" }, { status: 400 });
  }

  // Normalize: strip spaces and dashes, uppercase
  const normalized = plate.replace(/[\s-]/g, "").toUpperCase();

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      plateNumber: {
        contains: normalized,
      },
      deletedAt: null,
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      jobOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          intakeRecord: {
            select: { odometerReading: true },
          },
        },
      },
      _count: {
        select: {
          jobOrders: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  if (!vehicle) {
    return NextResponse.json({ found: false });
  }

  const lastJob = vehicle.jobOrders[0] || null;

  return NextResponse.json({
    found: true,
    vehicle: {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      vin: vehicle.vin,
      lastOdometer: lastJob?.intakeRecord?.odometerReading ?? null,
      lastVisitDate: lastJob?.createdAt ?? null,
      visitCount: vehicle._count.jobOrders,
    },
    customer: vehicle.customer
      ? {
          id: vehicle.customer.id,
          firstName: vehicle.customer.firstName,
          lastName: vehicle.customer.lastName,
          phone: vehicle.customer.phone,
          email: vehicle.customer.email,
        }
      : null,
  });
}

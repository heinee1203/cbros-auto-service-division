import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const searchTerm = `%${query}%`;

  // Search in parallel — plate number weighted highest
  const [vehicles, customers, jobOrders, estimates, invoices] =
    await Promise.all([
      // Vehicles by plate number (highest priority)
      prisma.vehicle.findMany({
        where: {
          OR: [
            { plateNumber: { contains: query } },
            { make: { contains: query } },
            { model: { contains: query } },
          ],
        },
        include: { customer: { select: { firstName: true, lastName: true } } },
        take: 5,
      }),
      // Customers by name or phone
      prisma.customer.findMany({
        where: {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        take: 5,
      }),
      // Job Orders by number
      prisma.jobOrder.findMany({
        where: {
          OR: [{ jobOrderNumber: { contains: query } }],
        },
        include: {
          vehicle: { select: { plateNumber: true, make: true, model: true } },
        },
        take: 5,
      }),
      // Estimates by number
      prisma.estimateRequest.findMany({
        where: {
          OR: [{ requestNumber: { contains: query } }],
        },
        include: {
          vehicle: { select: { plateNumber: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
        take: 3,
      }),
      // Invoices by number
      prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: query } },
            { orNumber: { contains: query } },
          ],
        },
        include: {
          jobOrder: {
            select: {
              jobOrderNumber: true,
              vehicle: { select: { plateNumber: true } },
            },
          },
        },
        take: 3,
      }),
    ]);

  // Build results — vehicles first (plate-number-first per spec)
  const results = [
    ...vehicles.map((v) => ({
      id: v.id,
      type: "vehicle" as const,
      title: `${v.plateNumber} — ${v.make} ${v.model}${v.year ? ` ${v.year}` : ""}`,
      subtitle: `${v.customer.firstName} ${v.customer.lastName}`,
      href: `/vehicles/${v.id}`,
    })),
    ...customers.map((c) => ({
      id: c.id,
      type: "customer" as const,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: c.phone,
      href: `/customers/${c.id}`,
    })),
    ...jobOrders.map((jo) => ({
      id: jo.id,
      type: "job_order" as const,
      title: jo.jobOrderNumber,
      subtitle: `${jo.vehicle.plateNumber} — ${jo.vehicle.make} ${jo.vehicle.model}`,
      href: `/jobs/${jo.id}`,
    })),
    ...estimates.map((er) => ({
      id: er.id,
      type: "estimate" as const,
      title: er.requestNumber,
      subtitle: `${er.customer.firstName} ${er.customer.lastName} — ${er.vehicle.plateNumber}`,
      href: `/estimates/${er.id}`,
    })),
    ...invoices.map((inv) => ({
      id: inv.id,
      type: "invoice" as const,
      title: inv.invoiceNumber,
      subtitle: `${inv.jobOrder.jobOrderNumber} — ${inv.jobOrder.vehicle.plateNumber}`,
      href: `/invoices/${inv.id}`,
    })),
  ];

  return NextResponse.json({ results: results.slice(0, 15) });
}

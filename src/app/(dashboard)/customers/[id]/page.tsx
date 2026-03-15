import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/services/customers";
import { prisma } from "@/lib/prisma";
import { CustomerDetailClient } from "./customer-detail-client";

interface Props {
  params: { id: string };
}

export default async function CustomerDetailPage({ params }: Props) {
  const customer = await getCustomerById(params.id);

  if (!customer) {
    notFound();
  }

  // Map Prisma data to the client component's expected shape
  const mapped = {
    ...customer,
    jobOrders: customer.jobOrders.map((jo) => ({
      id: jo.id,
      joNumber: jo.jobOrderNumber,
      status: jo.status,
      createdAt: jo.createdAt,
      vehicle: jo.vehicle,
    })),
  };

  // Fetch active warranties for this customer
  const warranties = await prisma.warranty.findMany({
    where: { customerId: customer.id, deletedAt: null },
    include: { jobOrder: { select: { jobOrderNumber: true } } },
    orderBy: { endDate: "asc" },
  });

  // Fetch scheduled follow-ups for this customer's jobs
  const customerJobIds = customer.jobOrders.map((jo: any) => jo.id);
  const scheduledFollowUps = await prisma.notification.findMany({
    where: {
      type: { in: ["FOLLOW_UP_SATISFACTION", "FOLLOW_UP_SURVEY", "FOLLOW_UP_MAINTENANCE", "WARRANTY_EXPIRY"] },
      scheduledAt: { gt: new Date() },
      deletedAt: null,
      metadata: { not: null },
    },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });

  // Filter follow-ups to only those related to this customer's jobs
  // Notifications have metadata JSON with jobOrderId
  const relevantFollowUps = scheduledFollowUps.filter((n) => {
    try {
      const meta = JSON.parse(n.metadata || "{}");
      return customerJobIds.includes(meta.jobOrderId);
    } catch {
      return false;
    }
  });

  return (
    <CustomerDetailClient
      customer={mapped}
      warranties={JSON.parse(JSON.stringify(warranties))}
      followUps={JSON.parse(JSON.stringify(relevantFollowUps))}
    />
  );
}

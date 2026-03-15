import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JobDetailLayoutClient } from "./job-detail-layout-client";

export default async function JobDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await prisma.jobOrder.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      jobOrderNumber: true,
      status: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      vehicle: {
        select: {
          plateNumber: true,
          make: true,
          model: true,
        },
      },
    },
  });

  if (!job) {
    notFound();
  }

  return (
    <JobDetailLayoutClient
      jobId={id}
      jobOrderNumber={job.jobOrderNumber}
      status={job.status}
      customerName={`${job.customer.firstName} ${job.customer.lastName}`}
      vehiclePlate={job.vehicle.plateNumber}
      vehicleDesc={[job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ")}
    >
      {children}
    </JobDetailLayoutClient>
  );
}

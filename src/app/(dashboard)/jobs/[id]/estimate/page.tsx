import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import EstimateTabClient from "./estimate-tab-client";

export default async function JobEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;

  const job = await prisma.jobOrder.findUnique({
    where: { id },
    select: {
      id: true,
      jobOrderNumber: true,
      estimates: {
        where: { deletedAt: null },
        include: {
          versions: {
            where: { deletedAt: null },
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              lineItems: {
                where: { deletedAt: null },
                orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
              },
            },
          },
          estimateRequest: {
            select: { requestNumber: true, customerConcern: true, status: true },
          },
        },
      },
      supplementalEstimates: {
        where: { deletedAt: null },
        include: {
          lineItems: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) notFound();

  return (
    <EstimateTabClient
      jobOrderId={id}
      jobOrderNumber={job.jobOrderNumber}
      estimates={JSON.parse(JSON.stringify(job.estimates))}
      supplements={JSON.parse(JSON.stringify(job.supplementalEstimates))}
    />
  );
}

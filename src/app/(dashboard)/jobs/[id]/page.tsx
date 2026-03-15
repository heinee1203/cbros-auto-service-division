import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getJobOrderDetail } from "@/lib/services/job-orders";
import { getJobActivities } from "@/lib/services/job-activities";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getJobProfitability } from "@/lib/services/analytics";
import { OverviewClient } from "./overview-client";

export default async function JobOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobOrder = await getJobOrderDetail(id);

  if (!jobOrder) {
    notFound();
  }

  const [timeEntrySummary, materialsSummary, activeTimers, supplementsSummary, activitiesResult, latestQC, qcAttemptCount, releaseRecord] = await Promise.all([
    prisma.timeEntry.aggregate({
      where: { jobOrderId: id, deletedAt: null },
      _sum: { netMinutes: true, laborCost: true },
    }),
    prisma.materialUsage.aggregate({
      where: { jobOrderId: id, deletedAt: null },
      _sum: { actualCost: true },
    }),
    prisma.timeEntry.findMany({
      where: { jobOrderId: id, clockOut: null, deletedAt: null },
      include: {
        technician: { select: { firstName: true, lastName: true } },
        task: { select: { name: true } },
      },
    }),
    prisma.supplementalEstimate.aggregate({
      where: { jobOrderId: id, deletedAt: null },
      _count: true,
      _sum: { grandTotal: true },
    }),
    getJobActivities(id, { limit: 20 }),
    prisma.qCInspection.findFirst({
      where: { jobOrderId: id, deletedAt: null },
      orderBy: { inspectionDate: "desc" },
      include: {
        inspector: { select: { firstName: true, lastName: true } },
        checklistItems: {
          where: { deletedAt: null },
          select: { status: true, inspectedAt: true, description: true },
        },
      },
    }),
    prisma.qCInspection.count({ where: { jobOrderId: id, deletedAt: null } }),
    prisma.releaseRecord.findUnique({
      where: { jobOrderId: id },
      select: {
        id: true,
        releaseDate: true,
        completionReportToken: true,
        advisorId: true,
        customerSatisfied: true,
      },
    }),
  ]);

  // Look up advisor name if release record has advisorId
  let releaseRecordWithAdvisor = null;
  if (releaseRecord) {
    let advisor: { firstName: string; lastName: string } | null = null;
    if (releaseRecord.advisorId) {
      const advisorUser = await prisma.user.findUnique({
        where: { id: releaseRecord.advisorId },
        select: { firstName: true, lastName: true },
      });
      advisor = advisorUser;
    }
    releaseRecordWithAdvisor = {
      id: releaseRecord.id,
      releaseDate: releaseRecord.releaseDate,
      completionReportToken: releaseRecord.completionReportToken,
      advisor,
      customerSatisfied: releaseRecord.customerSatisfied,
    };
  }

  // Fetch profitability data for Owner/Manager only
  const session = await getSession();
  let profitability = null;
  if (session?.user && can(session.user.role, "analytics:view")) {
    profitability = await getJobProfitability(id);
  }

  return (
    <OverviewClient
      jobOrder={jobOrder}
      timeEntrySummary={{
        totalMinutes: timeEntrySummary._sum.netMinutes || 0,
        totalLaborCost: timeEntrySummary._sum.laborCost || 0,
      }}
      materialsCost={materialsSummary._sum.actualCost || 0}
      activeTimers={JSON.parse(JSON.stringify(activeTimers))}
      supplementsSummary={{
        count: supplementsSummary._count || 0,
        totalAmount: supplementsSummary._sum.grandTotal || 0,
      }}
      activities={JSON.parse(JSON.stringify(activitiesResult))}
      latestQCInspection={latestQC ? JSON.parse(JSON.stringify(latestQC)) : null}
      qcAttemptCount={qcAttemptCount}
      releaseRecord={releaseRecordWithAdvisor ? JSON.parse(JSON.stringify(releaseRecordWithAdvisor)) : null}
      profitability={profitability ? JSON.parse(JSON.stringify(profitability)) : null}
    />
  );
}

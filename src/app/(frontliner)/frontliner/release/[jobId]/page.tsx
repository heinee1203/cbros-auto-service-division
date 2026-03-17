import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getReleaseRecord } from "@/lib/services/release";
import { ReleaseWizard } from "@/components/frontliner/release-wizard";

interface PageProps {
  params: { jobId: string };
}

export default async function FrontlinerReleaseJobPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "release:create")) redirect("/frontliner");

  const { jobId } = params;

  // Fetch job order with intake belongings
  const job = await prisma.jobOrder.findUnique({
    where: { id: jobId },
    include: {
      intakeRecord: {
        include: {
          belongings: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!job) redirect("/frontliner/release");

  // Check for existing release record
  const releaseRecord = await getReleaseRecord(jobId);

  // Extract belongings
  const belongings = (job.intakeRecord?.belongings ?? []).map((b) => ({
    id: b.id,
    description: b.description,
    condition: b.condition,
    isReturned: b.isReturned,
  }));

  return (
    <ReleaseWizard
      jobOrderId={jobId}
      jobOrderNumber={job.jobOrderNumber}
      releaseId={releaseRecord?.id ?? null}
      belongings={belongings}
    />
  );
}

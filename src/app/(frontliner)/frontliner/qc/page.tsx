import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getJobsAwaitingQC } from "@/lib/services/job-orders";
import { CheckCircle } from "lucide-react";

function parseCategories(
  estimates: Array<{
    estimateRequest: { requestedCategories: string } | null;
  }>
): string[] {
  const categories: string[] = [];
  for (const est of estimates) {
    if (est.estimateRequest?.requestedCategories) {
      try {
        const parsed = JSON.parse(est.estimateRequest.requestedCategories);
        if (Array.isArray(parsed)) {
          categories.push(...parsed);
        }
      } catch {
        categories.push(
          ...est.estimateRequest.requestedCategories
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        );
      }
    }
  }
  return Array.from(new Set(categories));
}

export default async function FrontlinerQCQueuePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "qc:inspect")) redirect("/frontliner");

  const jobs = await getJobsAwaitingQC();

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--sch-text)]">QC Queue</h1>
        <p className="text-sm text-[var(--sch-text-muted)]">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} awaiting inspection
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--sch-card)] p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500" />
          <p className="text-[var(--sch-text-muted)]">
            No jobs awaiting QC. All clear!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const categories = parseCategories(job.estimates);

            return (
              <div
                key={job.id}
                className="rounded-xl bg-[var(--sch-card)] p-5"
              >
                <p className="text-xl font-mono font-bold text-[var(--sch-text)]">
                  {job.vehicle.plateNumber}
                </p>
                <p className="text-sm text-[var(--sch-text-muted)]">
                  {job.vehicle.make} {job.vehicle.model}
                </p>
                <p className="font-mono text-sm text-[var(--sch-text-dim)]">
                  {job.jobOrderNumber}
                </p>
                <p className="mt-1 text-sm text-[var(--sch-text)]">
                  {job.customer.firstName} {job.customer.lastName}
                </p>

                {categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-block rounded-full bg-[var(--sch-surface)] px-2 py-0.5 text-xs text-[var(--sch-text-muted)]"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {job.primaryTechnician && (
                  <p className="mt-2 text-xs text-[var(--sch-text-muted)]">
                    Tech: {job.primaryTechnician.firstName}{" "}
                    {job.primaryTechnician.lastName}
                  </p>
                )}

                <Link
                  href={`/frontliner/qc/${job.id}`}
                  className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--sch-accent)] font-semibold text-black transition-colors hover:opacity-90"
                >
                  Start QC &rarr;
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

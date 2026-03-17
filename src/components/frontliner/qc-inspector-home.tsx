"use client";

import Link from "next/link";

interface QCJob {
  id: string;
  jobOrderNumber: string;
  customer: { firstName: string; lastName: string };
  vehicle: { plateNumber: string; make: string; model: string };
  primaryTechnician: { firstName: string; lastName: string } | null;
  estimates: Array<{
    estimateRequest: { requestedCategories: string } | null;
  }>;
}

interface QCInspectorHomeProps {
  firstName: string;
  qcJobs: QCJob[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function parseCategories(estimates: QCJob["estimates"]): string[] {
  const categories: string[] = [];
  for (const est of estimates) {
    if (est.estimateRequest?.requestedCategories) {
      try {
        const parsed = JSON.parse(est.estimateRequest.requestedCategories);
        if (Array.isArray(parsed)) {
          categories.push(...parsed);
        }
      } catch {
        // not valid JSON, try as comma-separated
        categories.push(
          ...est.estimateRequest.requestedCategories
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
      }
    }
  }
  // Dedupe
  return Array.from(new Set(categories));
}

export function QCInspectorHome({ firstName, qcJobs }: QCInspectorHomeProps) {
  return (
    <div className="space-y-6 p-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-[var(--sch-text)]">
        {getGreeting()}, {firstName} {"👋"}
      </h1>

      {/* Queue Count */}
      <div className="rounded-xl bg-[var(--sch-card)] p-5 text-center">
        <p className="font-mono text-4xl font-bold text-[var(--sch-accent)]">
          {qcJobs.length}
        </p>
        <p className="mt-1 text-[var(--sch-text-muted)]">
          {qcJobs.length === 1 ? "job awaiting QC" : "jobs awaiting QC"}
        </p>
      </div>

      {/* QC Queue Cards */}
      {qcJobs.length === 0 ? (
        <div className="rounded-xl bg-[var(--sch-card)] p-6 text-center text-[var(--sch-text-muted)]">
          No jobs awaiting QC. All clear!
        </div>
      ) : (
        <div className="space-y-3">
          {qcJobs.map((job) => {
            const categories = parseCategories(job.estimates);

            return (
              <div
                key={job.id}
                className="rounded-xl bg-[var(--sch-card)] p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-lg font-bold text-[var(--sch-text)]">
                      {job.vehicle.plateNumber}
                    </p>
                    <p className="font-mono text-sm text-[var(--sch-text-muted)]">
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
                  </div>
                  <Link
                    href={`/frontliner/qc/${job.id}`}
                    className="ml-3 flex h-10 min-h-[48px] items-center rounded-lg bg-[var(--sch-accent)] px-4 font-semibold text-black transition-colors hover:opacity-90"
                  >
                    Start QC &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

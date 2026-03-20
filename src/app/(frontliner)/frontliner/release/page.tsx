import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function FrontlinerReleasePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "release:create")) redirect("/frontliner");

  // Fetch jobs that are fully paid OR have a charge invoice (awaiting/partial payment)
  const allJobs = await prisma.jobOrder.findMany({
    where: {
      status: { in: ["FULLY_PAID", "AWAITING_PAYMENT", "PARTIAL_PAYMENT"] },
    },
    include: {
      customer: {
        select: { firstName: true, lastName: true, phone: true },
      },
      vehicle: {
        select: { plateNumber: true, make: true, model: true },
      },
      invoices: {
        where: { isLatest: true, deletedAt: null },
        select: {
          invoiceType: true,
          chargeAccount: { select: { companyName: true } },
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter: FULLY_PAID jobs always show; AWAITING_PAYMENT/PARTIAL_PAYMENT only if charge invoice
  const jobs = allJobs.filter((job) => {
    if (job.status === "FULLY_PAID") return true;
    const latestInvoice = job.invoices[0];
    return latestInvoice?.invoiceType === "CHARGE";
  });

  return (
    <div className="space-y-4 p-4">
      <h1
        className="text-xl font-bold"
        style={{ color: "var(--sch-text)" }}
      >
        Release Queue
      </h1>

      {jobs.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: "var(--sch-card)",
            color: "var(--sch-text-muted)",
          }}
        >
          No vehicles ready for release
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-xl p-4"
              style={{ background: "var(--sch-card)" }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="text-xl font-mono font-bold"
                  style={{ color: "var(--sch-text)" }}
                >
                  {job.vehicle.plateNumber}
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--sch-text-muted)" }}
                >
                  {job.vehicle.make} {job.vehicle.model}
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--sch-text)" }}>
                  {job.customer.firstName} {job.customer.lastName}
                </p>
                {job.customer.phone && (
                  <p
                    className="text-xs font-mono mt-0.5"
                    style={{ color: "var(--sch-text-dim)" }}
                  >
                    {job.customer.phone}
                  </p>
                )}
                {job.invoices[0]?.invoiceType === "CHARGE" && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-900/30 text-amber-300">
                    Charge &mdash; {job.invoices[0].chargeAccount?.companyName}
                  </span>
                )}
              </div>
              <Link
                href={`/frontliner/release/${job.id}`}
                className="ml-3 flex h-12 min-h-[48px] items-center rounded-xl px-4 font-semibold text-black transition-colors hover:opacity-90"
                style={{ background: "var(--sch-accent)" }}
              >
                Begin Release &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

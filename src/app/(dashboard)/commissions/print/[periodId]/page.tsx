import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { getCommissionPeriodDetail } from "@/lib/services/commissions";
import { getSettingValue } from "@/lib/services/settings";
import { formatPeso, formatDate } from "@/lib/utils";
import PrintClient from "./print-client";

type PeriodDetail = NonNullable<Awaited<ReturnType<typeof getCommissionPeriodDetail>>>;
type TechBreakdown = PeriodDetail["techBreakdown"][number];
type EntryRow = TechBreakdown["entries"][number];

export default async function CommissionPrintPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role as UserRole, "commissions:view")) {
    redirect("/");
  }

  const { periodId } = await params;
  const period = await getCommissionPeriodDetail(periodId);
  if (!period) return notFound();

  const shopName = await getSettingValue<string>("shop_name", "AutoServ Pro");
  const shopAddress = await getSettingValue<string>("shop_address", "");
  const shopPhone = await getSettingValue<string>("shop_phone", "");

  const periodRange = `${formatDate(period.periodStart)} \u2014 ${formatDate(period.periodEnd)}`;

  return (
    <div className="max-w-[210mm] mx-auto bg-white print:max-w-none">
      {/* No-print control bar */}
      <PrintClient />

      {/* Print content */}
      <main className="p-8 print:p-0">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">{shopName}</h1>
          {shopAddress && <p className="text-sm text-gray-600">{shopAddress}</p>}
          {shopPhone && <p className="text-sm text-gray-600">{shopPhone}</p>}
          <h2 className="text-lg font-semibold mt-4">Commission Report</h2>
          <p className="text-sm text-gray-500">{periodRange}</p>
          <p className="text-xs text-gray-400 mt-1">
            Status: {period.status} | Generated: {formatDate(period.createdAt)}
          </p>
        </div>

        {/* Summary Table */}
        <table className="w-full text-sm border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-semibold">Technician</th>
              <th className="text-right py-2 font-semibold">Rate</th>
              <th className="text-right py-2 font-semibold">Jobs</th>
              <th className="text-right py-2 font-semibold">Mech. Labor</th>
              <th className="text-right py-2 font-semibold">Gross</th>
              <th className="text-right py-2 font-semibold">SM Ded.</th>
              <th className="text-right py-2 font-semibold">Net</th>
            </tr>
          </thead>
          <tbody>
            {period.techBreakdown.map((tech) => (
              <TechPrintSection key={tech.user.id} tech={tech} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-900 font-bold">
              <td className="py-2">TOTAL</td>
              <td className="py-2" />
              <td className="py-2 text-right font-mono">
                {period.entries.length}
              </td>
              <td className="py-2 text-right font-mono">
                {formatPeso(
                  period.techBreakdown.reduce(
                    (s, t) => s + t.totalLaborBilled,
                    0
                  )
                )}
              </td>
              <td className="py-2 text-right font-mono">
                {formatPeso(period.totalGrossCommission)}
              </td>
              <td className="py-2 text-right font-mono">
                ({formatPeso(period.totalSmDeduction)})
              </td>
              <td className="py-2 text-right font-mono">
                {formatPeso(period.totalNetCommission)}
              </td>
            </tr>
            {period.smPayout > 0 && (
              <tr className="text-sm">
                <td className="py-1 text-gray-600" colSpan={6}>
                  Service Manager Payout
                </td>
                <td className="py-1 text-right font-mono font-semibold">
                  {formatPeso(period.smPayout)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Per-tech Job Breakdown */}
        {period.techBreakdown.map((tech) => (
          <div key={tech.user.id} className="mb-6">
            <h3 className="text-sm font-semibold border-b border-gray-300 pb-1 mb-2">
              {tech.user.firstName}
              {tech.user.lastName !== "." ? ` ${tech.user.lastName}` : ""}
              {tech.cmSelectedOption
                ? ` \u2014 Chief Mechanic (Option ${tech.cmSelectedOption})`
                : ` \u2014 ${tech.commissionRate}%`}
            </h3>
            {tech.cmOptionA != null && tech.cmOptionB != null && (
              <p className="text-xs text-gray-500 mb-2">
                Option A (shop rate): {formatPeso(tech.cmOptionA)} &middot;
                Option B (own labor): {formatPeso(tech.cmOptionB)} &middot;
                Selected: Option {tech.cmSelectedOption}
              </p>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1">JO #</th>
                  <th className="text-left py-1">Vehicle</th>
                  <th className="text-left py-1">Customer</th>
                  <th className="text-right py-1">Labor</th>
                  <th className="text-right py-1">Gross</th>
                  <th className="text-right py-1">SM Ded.</th>
                  <th className="text-right py-1">Net</th>
                </tr>
              </thead>
              <tbody>
                {tech.entries.map((entry: EntryRow) => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="py-1 font-mono">
                      {entry.jobOrder.jobOrderNumber}
                    </td>
                    <td className="py-1">
                      {entry.jobOrder.vehicle.make} {entry.jobOrder.vehicle.model} ({entry.jobOrder.vehicle.plateNumber})
                    </td>
                    <td className="py-1">
                      {entry.jobOrder.customer.firstName} {entry.jobOrder.customer.lastName}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {formatPeso(entry.laborBilled)}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {formatPeso(entry.grossCommission)}
                    </td>
                    <td className="py-1 text-right font-mono">
                      ({formatPeso(entry.smDeduction)})
                    </td>
                    <td className="py-1 text-right font-mono">
                      {formatPeso(entry.netCommission)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="py-1">Subtotal</td>
                  <td className="py-1 text-right font-mono">
                    {formatPeso(tech.totalLaborBilled)}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {formatPeso(tech.totalGrossCommission)}
                  </td>
                  <td className="py-1 text-right font-mono">
                    ({formatPeso(tech.totalSmDeduction)})
                  </td>
                  <td className="py-1 text-right font-mono">
                    {formatPeso(tech.totalNetCommission)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

        {/* Signature Lines */}
        <div className="mt-16 flex justify-between gap-8">
          <div className="flex-1">
            <div className="border-t border-gray-900 pt-2 text-center text-sm">
              Prepared by
            </div>
          </div>
          <div className="flex-1">
            <div className="border-t border-gray-900 pt-2 text-center text-sm">
              Approved by
            </div>
          </div>
        </div>
      </main>

      {/* Print styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 15mm; }
              nav, aside, header, .no-print { display: none !important; }
              main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tech summary row for the main table
// ---------------------------------------------------------------------------
function TechPrintSection({
  tech,
}: {
  tech: TechBreakdown;
}) {
  return (
    <tr className="border-b border-gray-200">
      <td className="py-2">
        {tech.user.firstName}
        {tech.user.lastName !== "." ? ` ${tech.user.lastName}` : ""}
        {tech.cmSelectedOption ? " (CM)" : ""}
      </td>
      <td className="py-2 text-right font-mono">
        {tech.cmSelectedOption ? `Opt ${tech.cmSelectedOption}` : `${tech.commissionRate}%`}
      </td>
      <td className="py-2 text-right font-mono">{tech.entries.length}</td>
      <td className="py-2 text-right font-mono">
        {formatPeso(tech.totalLaborBilled)}
      </td>
      <td className="py-2 text-right font-mono">
        {formatPeso(tech.totalGrossCommission)}
      </td>
      <td className="py-2 text-right font-mono">
        ({formatPeso(tech.totalSmDeduction)})
      </td>
      <td className="py-2 text-right font-mono">
        {formatPeso(tech.totalNetCommission)}
      </td>
    </tr>
  );
}

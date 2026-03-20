import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getARSummary } from "@/lib/services/charge-accounts";
import { formatPeso } from "@/lib/utils";
import { ArrowLeft, TrendingUp } from "lucide-react";

export default async function ARSummaryPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const ar = await getARSummary();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/charge-accounts"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">
                Accounts Receivable
              </h1>
              <p className="text-sm text-surface-400 mt-0.5">
                Outstanding charge invoice summary
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          label="Total Outstanding"
          amount={ar.totalOutstanding}
          color="text-primary"
        />
        <SummaryCard
          label="Current (0-30)"
          amount={ar.current}
          color="text-emerald-600"
        />
        <SummaryCard
          label="31-60 Days"
          amount={ar.thirtyDay}
          color="text-amber-600"
        />
        <SummaryCard
          label="61-90 Days"
          amount={ar.sixtyDay}
          color="text-orange-600"
        />
        <SummaryCard
          label="90+ Days"
          amount={ar.ninetyPlus}
          color="text-red-600"
        />
      </div>

      {/* By Account Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200">
          <h2 className="font-semibold text-primary">By Account</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 text-surface-500 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-3">Company</th>
                <th className="text-right px-6 py-3">Current</th>
                <th className="text-right px-6 py-3">31-60</th>
                <th className="text-right px-6 py-3">61-90</th>
                <th className="text-right px-6 py-3">90+</th>
                <th className="text-right px-6 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {ar.byAccount.map((account) => (
                <tr
                  key={account.id}
                  className="border-t border-surface-100 hover:bg-surface-50 transition-colors"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/charge-accounts/${account.id}`}
                      className="font-medium text-accent-600 hover:text-accent-700 hover:underline"
                    >
                      {account.companyName}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-right font-mono">
                    {formatPeso(account.current)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-amber-600">
                    {formatPeso(account.thirtyDay)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-orange-600">
                    {formatPeso(account.sixtyDay)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-red-600">
                    {formatPeso(account.ninetyPlus)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-semibold">
                    {formatPeso(account.total)}
                  </td>
                </tr>
              ))}
              {ar.byAccount.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-surface-400"
                  >
                    No outstanding charge invoices
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <p className="text-xs text-surface-500 font-medium">{label}</p>
      <p className={`font-mono text-lg font-bold mt-1 ${color}`}>
        {formatPeso(amount)}
      </p>
    </div>
  );
}

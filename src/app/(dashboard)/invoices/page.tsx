import { getInvoices } from "@/lib/services/invoice-list";
import { INVOICE_STATUS_TABS } from "@/lib/constants";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types/enums";
import { formatPeso, formatDate, cn } from "@/lib/utils";
import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import type { PaymentStatus } from "@/types/enums";

// ─── Aging color helper ──────────────────────────────────────────────────────

function agingColor(createdAt: Date): string {
  const days = Math.ceil(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 30) return "text-green-600";
  if (days <= 60) return "text-yellow-600";
  if (days <= 90) return "text-orange-600";
  return "text-red-600 font-bold";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const currentStatus =
    typeof params.status === "string" ? params.status : "ALL";
  const currentPage =
    typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;
  const currentSearch =
    typeof params.search === "string" ? params.search : "";

  const { invoices, total, page, totalPages } = await getInvoices({
    page: currentPage,
    pageSize: 20,
    search: currentSearch || undefined,
    status: currentStatus,
  });

  // Build URL helper
  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams();
    const merged = {
      status: currentStatus,
      page: String(currentPage),
      search: currentSearch,
      ...Object.fromEntries(
        Object.entries(overrides).map(([k, v]) => [k, String(v)])
      ),
    };
    if (merged.status && merged.status !== "ALL") p.set("status", merged.status);
    if (merged.search) p.set("search", merged.search);
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `/invoices${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">Invoices</h1>
            <p className="text-sm text-surface-400 mt-0.5">
              {total.toLocaleString()} invoice{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="border-b border-surface-200">
        <nav className="inline-flex -mb-px gap-6">
          {INVOICE_STATUS_TABS.map((tab) => {
            const isActive = currentStatus === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildUrl({ status: tab.value, page: 1 })}
                className={cn(
                  "pb-2.5 px-1 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-b-2 border-accent-600 text-accent-600"
                    : "text-surface-400 hover:text-surface-600"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Search */}
      <form action="/invoices" method="GET" className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        <input
          type="text"
          name="search"
          placeholder="Search invoice #, customer, or plate..."
          defaultValue={currentSearch}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 transition-colors"
        />
        {/* Preserve current status filter */}
        {currentStatus !== "ALL" && (
          <input type="hidden" name="status" value={currentStatus} />
        )}
      </form>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-white p-12 text-center">
          <Receipt className="mx-auto h-10 w-10 text-surface-300" />
          <h3 className="mt-3 text-sm font-semibold text-primary">
            No invoices found
          </h3>
          <p className="mt-1 text-sm text-surface-400">
            {currentSearch
              ? `No invoices match "${currentSearch}". Try a different search.`
              : "No invoices have been created yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/50">
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Invoice #
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Customer
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Vehicle
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Total
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Paid
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Balance
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Type
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {invoices.map((invoice) => {
                  const status = invoice.paymentStatus as PaymentStatus;
                  const showAging =
                    status === "UNPAID" || status === "PARTIAL";

                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-surface-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/jobs/${invoice.jobOrderId}/invoice`}
                          className="font-medium font-mono text-accent-600 hover:text-accent-700 hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-primary">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {invoice.jobOrder.customer.firstName}{" "}
                          {invoice.jobOrder.customer.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-600">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {invoice.jobOrder.vehicle?.plateNumber ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-primary text-right">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {formatPeso(invoice.grandTotal)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-600 text-right">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {formatPeso(invoice.totalPaid)}
                        </Link>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-mono text-right",
                          showAging
                            ? agingColor(invoice.createdAt)
                            : "text-surface-600"
                        )}
                      >
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {formatPeso(invoice.balanceDue)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              PAYMENT_STATUS_COLORS[status] ??
                                "bg-surface-100 text-surface-600"
                            )}
                          >
                            {PAYMENT_STATUS_LABELS[status] ?? status}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {invoice.invoiceType === "CHARGE" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Charge
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                              Cash
                            </span>
                          )}
                          {invoice.invoiceType === "CHARGE" &&
                            invoice.chargeAccount && (
                              <span className="block text-xs text-surface-400 mt-0.5 truncate max-w-[120px]">
                                {invoice.chargeAccount.companyName}
                              </span>
                            )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-500">
                        <Link href={`/jobs/${invoice.jobOrderId}/invoice`}>
                          {formatDate(invoice.createdAt)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3">
              <p className="text-sm text-surface-400">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: page - 1 })}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - page) <= 1
                  )
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                      acc.push("...");
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 py-1.5 text-sm text-surface-400"
                      >
                        ...
                      </span>
                    ) : (
                      <Link
                        key={p}
                        href={buildUrl({ page: p })}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                          p === page
                            ? "bg-accent-600 text-white"
                            : "border border-surface-200 hover:bg-surface-50"
                        )}
                      >
                        {p}
                      </Link>
                    )
                  )}
                {page < totalPages && (
                  <Link
                    href={buildUrl({ page: page + 1 })}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

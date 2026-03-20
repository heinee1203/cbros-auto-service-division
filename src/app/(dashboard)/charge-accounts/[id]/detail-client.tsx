"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ArrowLeft,
  Pencil,
  RefreshCcw,
  Phone,
  Mail,
  MapPin,
  FileText,
  Users,
  X,
} from "lucide-react";
import { formatPeso, formatDate, cn } from "@/lib/utils";
import { SlideOver } from "@/components/ui/slide-over";
import {
  updateChargeAccountAction,
  recalculateBalanceAction,
} from "@/lib/actions/charge-account-actions";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/types/enums";
import type { PaymentStatus } from "@/types/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgingBreakdown {
  current: number;
  thirtyDay: number;
  sixtyDay: number;
  ninetyPlus: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  balanceDue: number;
  paymentStatus: string;
  dueDate: string | null;
  createdAt: string;
  jobOrder: {
    id: string;
    jobOrderNumber: string;
    customer: { id: string; firstName: string; lastName: string };
    vehicle: {
      id: string;
      make: string;
      model: string;
      year: number | null;
      plateNumber: string | null;
    };
  };
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface ChargeAccountDetail {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tinNumber: string | null;
  creditLimit: number | null;
  creditTerms: string;
  currentBalance: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  invoices: Invoice[];
  customers: Customer[];
  aging: AgingBreakdown;
}

const CREDIT_TERMS_LABELS: Record<string, string> = {
  NET_15: "Net 15",
  NET_30: "Net 30",
  NET_60: "Net 60",
  DUE_ON_RECEIPT: "Due on Receipt",
};

const CREDIT_TERMS_OPTIONS = [
  { value: "NET_15", label: "Net 15" },
  { value: "NET_30", label: "Net 30" },
  { value: "NET_60", label: "Net 60" },
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChargeAccountDetailClient({
  account,
}: {
  account: ChargeAccountDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slideOpen, setSlideOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form
  const [form, setForm] = useState({
    companyName: account.companyName,
    contactPerson: account.contactPerson ?? "",
    phone: account.phone ?? "",
    email: account.email ?? "",
    address: account.address ?? "",
    tinNumber: account.tinNumber ?? "",
    creditTerms: account.creditTerms,
    creditLimit: account.creditLimit
      ? String(account.creditLimit / 100)
      : "",
    notes: account.notes ?? "",
    isActive: account.isActive,
  });

  function handleSave() {
    if (!form.companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateChargeAccountAction(account.id, {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        tinNumber: form.tinNumber.trim() || undefined,
        creditTerms: form.creditTerms,
        creditLimit: form.creditLimit
          ? Math.round(parseFloat(form.creditLimit) * 100)
          : undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      });
      if (result.success) {
        setSlideOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update account");
      }
    });
  }

  function handleRecalculate() {
    startTransition(async () => {
      const result = await recalculateBalanceAction(account.id);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function ageDays(dateStr: string | null): number {
    if (!dateStr) return 0;
    const due = new Date(dateStr);
    return Math.max(
      0,
      Math.ceil((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/charge-accounts"
        className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-accent-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Charge Accounts
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">
                  {account.companyName}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1",
                    account.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-surface-100 text-surface-500"
                  )}
                >
                  {account.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              {account.contactPerson && (
                <p className="text-sm text-surface-600">
                  {account.contactPerson}
                </p>
              )}
              {account.phone && (
                <p className="text-sm text-surface-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {account.phone}
                </p>
              )}
              {account.email && (
                <p className="text-sm text-surface-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {account.email}
                </p>
              )}
              {account.address && (
                <p className="text-sm text-surface-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {account.address}
                </p>
              )}
              {account.tinNumber && (
                <p className="text-sm text-surface-500">
                  TIN: <span className="font-mono">{account.tinNumber}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right side: stats */}
          <div className="text-right space-y-2">
            <div>
              <p className="text-xs text-surface-400 uppercase tracking-wider">
                Credit Terms
              </p>
              <p className="text-sm font-medium text-primary">
                {CREDIT_TERMS_LABELS[account.creditTerms] ??
                  account.creditTerms}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-400 uppercase tracking-wider">
                Credit Limit
              </p>
              <p className="text-sm font-medium text-primary">
                {account.creditLimit
                  ? formatPeso(account.creditLimit)
                  : "No limit"}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-400 uppercase tracking-wider">
                Current Balance
              </p>
              <p
                className={cn(
                  "text-lg font-bold",
                  account.currentBalance > 0
                    ? "text-red-600"
                    : "text-green-600"
                )}
              >
                {formatPeso(account.currentBalance)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                onClick={handleRecalculate}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-accent-600 transition-colors border border-surface-200 px-3 py-1.5 rounded-lg"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Recalculate
              </button>
              <button
                onClick={() => {
                  setError(null);
                  setSlideOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs bg-accent-600 hover:bg-accent-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: "Current",
            value: account.aging.current,
            color: "text-green-600",
          },
          {
            label: "31-60 Days",
            value: account.aging.thirtyDay,
            color: "text-yellow-600",
          },
          {
            label: "61-90 Days",
            value: account.aging.sixtyDay,
            color: "text-orange-600",
          },
          {
            label: "90+ Days",
            value: account.aging.ninetyPlus,
            color: "text-red-600",
          },
          {
            label: "Total Outstanding",
            value: account.aging.total,
            color: "text-primary",
          },
        ].map((bucket) => (
          <div
            key={bucket.label}
            className="bg-white rounded-xl border border-surface-200 p-4"
          >
            <p className="text-xs text-surface-400 uppercase tracking-wider">
              {bucket.label}
            </p>
            <p className={cn("text-lg font-bold mt-1", bucket.color)}>
              {formatPeso(bucket.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Statement of Account */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center gap-2">
          <FileText className="h-4 w-4 text-surface-400" />
          <h2 className="text-lg font-semibold text-primary">
            Statement of Account
          </h2>
          <span className="text-sm text-surface-400 ml-auto">
            {account.invoices.length} invoice
            {account.invoices.length !== 1 ? "s" : ""}
          </span>
        </div>

        {account.invoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-surface-300" />
            <h3 className="mt-3 text-sm font-semibold text-primary">
              No invoices yet
            </h3>
            <p className="mt-1 text-sm text-surface-400">
              Charge invoices for this account will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/50">
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Invoice #
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Vehicle
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Amount
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Balance
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {account.invoices.map((inv) => {
                  const status = inv.paymentStatus as PaymentStatus;
                  const age = inv.dueDate ? ageDays(inv.dueDate) : 0;
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-surface-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/jobs/${inv.jobOrder.id}/invoice`}
                          className="font-medium font-mono text-accent-600 hover:text-accent-700 hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-500">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        {inv.jobOrder.vehicle?.plateNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-primary">
                        {formatPeso(inv.grandTotal)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-mono text-right",
                          inv.balanceDue > 0
                            ? "text-red-600 font-medium"
                            : "text-surface-600"
                        )}
                      >
                        {formatPeso(inv.balanceDue)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            PAYMENT_STATUS_COLORS[status] ??
                              "bg-surface-100 text-surface-600"
                          )}
                        >
                          {PAYMENT_STATUS_LABELS[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-surface-500">
                        {inv.dueDate
                          ? `${age}d`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked Customers */}
      {account.customers.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-surface-400" />
            <h2 className="text-lg font-semibold text-primary">
              Linked Customers
            </h2>
          </div>
          <div className="divide-y divide-surface-100">
            {account.customers.map((cust) => (
              <div key={cust.id} className="px-6 py-3 flex items-center gap-3">
                <div>
                  <Link
                    href={`/customers/${cust.id}`}
                    className="text-sm font-medium text-accent-600 hover:text-accent-700 hover:underline"
                  >
                    {cust.firstName} {cust.lastName}
                  </Link>
                  {cust.phone && (
                    <p className="text-xs text-surface-400">{cust.phone}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit SlideOver */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title="Edit Charge Account"
        description="Update the account details below."
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setSlideOpen(false)}
              className="px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving..." : "Update Account"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 flex items-start gap-2">
              <p className="text-sm text-danger-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-danger-400 hover:text-danger-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Company Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) =>
                setForm((f) => ({ ...f, companyName: e.target.value }))
              }
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Contact Person
            </label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPerson: e.target.value }))
              }
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              TIN Number
            </label>
            <input
              type="text"
              value={form.tinNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, tinNumber: e.target.value }))
              }
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Credit Terms
            </label>
            <select
              value={form.creditTerms}
              onChange={(e) =>
                setForm((f) => ({ ...f, creditTerms: e.target.value }))
              }
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
            >
              {CREDIT_TERMS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Credit Limit (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">
                ₱
              </span>
              <input
                type="number"
                value={form.creditLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, creditLimit: e.target.value }))
                }
                className="w-full pl-7 pr-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                placeholder="Leave blank for no limit"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-medium text-surface-700">
              Active
            </label>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, isActive: !f.isActive }))
              }
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                form.isActive ? "bg-accent-600" : "bg-surface-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  form.isActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

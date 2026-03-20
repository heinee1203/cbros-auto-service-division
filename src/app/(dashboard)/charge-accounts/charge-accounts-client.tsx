"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, Search, Pencil, X, TrendingUp } from "lucide-react";
import { formatPeso, cn } from "@/lib/utils";
import { SlideOver } from "@/components/ui/slide-over";
import {
  createChargeAccountAction,
  updateChargeAccountAction,
} from "@/lib/actions/charge-account-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChargeAccount {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tinNumber: string | null;
  creditTerms: string;
  creditLimit: number | null;
  currentBalance: number;
  isActive: boolean;
  notes: string | null;
}

interface Props {
  accounts: ChargeAccount[];
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

type FilterStatus = "ALL" | "ACTIVE" | "INACTIVE";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChargeAccountsClient({ accounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ACTIVE");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChargeAccount | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    tinNumber: "",
    creditTerms: "NET_30",
    creditLimit: "",
    notes: "",
    isActive: true,
  });

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------
  const filtered = accounts.filter((a) => {
    if (filterStatus === "ACTIVE" && !a.isActive) return false;
    if (filterStatus === "INACTIVE" && a.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.companyName.toLowerCase().includes(q) ||
        (a.contactPerson && a.contactPerson.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  function openCreate() {
    setEditingAccount(null);
    setForm({
      companyName: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      tinNumber: "",
      creditTerms: "NET_30",
      creditLimit: "",
      notes: "",
      isActive: true,
    });
    setError(null);
    setSlideOpen(true);
  }

  function openEdit(account: ChargeAccount) {
    setEditingAccount(account);
    setForm({
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
    setError(null);
    setSlideOpen(true);
  }

  function handleSubmit() {
    if (!form.companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
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
      };

      let result;
      if (editingAccount) {
        result = await updateChargeAccountAction(editingAccount.id, {
          ...payload,
          isActive: form.isActive,
        });
      } else {
        result = await createChargeAccountAction(payload);
      }

      if (result.success) {
        setSlideOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">
              Charge Accounts
            </h1>
            <p className="text-sm text-surface-400 mt-0.5">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/charge-accounts/ar-summary"
            className="flex items-center gap-2 border border-surface-200 hover:bg-surface-50 text-surface-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            AR Summary
          </Link>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Account
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-surface-200 overflow-hidden">
          {(["ACTIVE", "INACTIVE", "ALL"] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors",
                filterStatus === status
                  ? "bg-accent-600 text-white"
                  : "bg-white text-surface-500 hover:bg-surface-50"
              )}
            >
              {status === "ALL"
                ? "All"
                : status === "ACTIVE"
                  ? "Active"
                  : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-surface-300" />
          <h3 className="mt-3 text-sm font-semibold text-primary">
            No accounts found
          </h3>
          <p className="mt-1 text-sm text-surface-400">
            {search
              ? "Try a different search term."
              : "Create your first charge account to get started."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/50">
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Company
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Contact
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Terms
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Credit Limit
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Balance
                  </th>
                  <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-surface-500 uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filtered.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-surface-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/charge-accounts/${account.id}`}
                        className="font-medium text-accent-600 hover:text-accent-700 hover:underline"
                      >
                        {account.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-surface-600">
                      {account.contactPerson || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {CREDIT_TERMS_LABELS[account.creditTerms] ??
                          account.creditTerms}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-surface-600">
                      {account.creditLimit
                        ? formatPeso(account.creditLimit)
                        : "No limit"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-mono text-right",
                        account.currentBalance > 0
                          ? "text-red-600 font-medium"
                          : "text-surface-600"
                      )}
                    >
                      {formatPeso(account.currentBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          account.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-surface-100 text-surface-500"
                        )}
                      >
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(account)}
                        className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-accent-600 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit SlideOver */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editingAccount ? "Edit Charge Account" : "New Charge Account"}
        description={
          editingAccount
            ? "Update the account details below."
            : "Add a new corporate charge account."
        }
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setSlideOpen(false)}
              className="px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {isPending
                ? "Saving..."
                : editingAccount
                  ? "Update Account"
                  : "Create Account"}
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

          {/* Company Name */}
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
              placeholder="e.g. ABC Transport Corp."
            />
          </div>

          {/* Contact Person */}
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
              placeholder="Full name"
            />
          </div>

          {/* Phone + Email */}
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
                placeholder="09XX XXX XXXX"
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
                placeholder="email@company.com"
              />
            </div>
          </div>

          {/* Address */}
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
              placeholder="Street, City, Province"
            />
          </div>

          {/* TIN */}
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
              placeholder="XXX-XXX-XXX-XXX"
            />
          </div>

          {/* Credit Terms */}
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

          {/* Credit Limit */}
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

          {/* Notes */}
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
              placeholder="Internal notes..."
            />
          </div>

          {/* Active toggle (only on edit) */}
          {editingAccount && (
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
          )}
        </div>
      </SlideOver>
    </div>
  );
}

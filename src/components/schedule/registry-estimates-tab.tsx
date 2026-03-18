"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { formatPeso, formatDate } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface EstimateRequest {
  id: string;
  requestNumber: string;
  status: string;
  customerConcern: string | null;
  requestedCategories: string | null;
  createdAt: string;
  customer: { firstName: string; lastName: string; phone: string };
  vehicle: { plateNumber: string; make: string; model: string };
  _count: { estimates: number };
  estimates: Array<{
    versions: Array<{
      grandTotal: number;
      approvalToken: string | null;
      techReviewSignedAt: string | null;
      mgmtApprovalSignedAt: string | null;
    }>;
  }>;
}

interface EstimatesResponse {
  requests: EstimateRequest[];
  total: number;
  pageCount: number;
}

/* -------------------------------------------------------------------------- */
/*  Status config                                                              */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  NEW_INQUIRY: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA", label: "New Inquiry" },
  PENDING_ESTIMATE: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B", label: "Pending" },
  ESTIMATE_SENT: { bg: "rgba(139,92,246,0.15)", text: "#8B5CF6", label: "Sent" },
  ESTIMATE_APPROVED: { bg: "rgba(52,211,153,0.15)", text: "#34D399", label: "Approved" },
  REVISION_REQUESTED: { bg: "rgba(251,146,60,0.15)", text: "#FB923C", label: "Revision" },
};

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "NEW_INQUIRY", label: "New Inquiry" },
  { value: "PENDING_ESTIMATE", label: "Pending" },
  { value: "ESTIMATE_SENT", label: "Sent" },
  { value: "ESTIMATE_APPROVED", label: "Approved" },
  { value: "REVISION_REQUESTED", label: "Revision" },
];

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: "rgba(148,163,184,0.15)", text: "#94A3B8", label: status };
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function RegistryEstimatesTab() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<EstimateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* ---- Fetch ---- */

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
        ...(search && { search }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      const res = await fetch(`/api/estimates?${params}`);
      if (!res.ok) throw new Error("Failed to fetch estimates");
      const data: EstimatesResponse = await res.json();
      setEstimates(data.requests);
      setTotalPages(data.pageCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  /* ---- Debounced search ---- */

  const handleSearchChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  /* ---- Helpers ---- */

  function parseCategories(raw: string | null): string[] {
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function getApprovalInfo(est: EstimateRequest) {
    const version = est.estimates?.[0]?.versions?.[0];
    if (!version) return null;
    const tech = !!version.techReviewSignedAt;
    const mgmt = !!version.mgmtApprovalSignedAt;
    if (tech && mgmt) return { label: "Fully Approved", color: "#34D399", Icon: ShieldCheck };
    if (tech) return { label: "Tech Reviewed", color: "#60A5FA", Icon: ShieldAlert };
    if (mgmt) return { label: "Mgmt Approved", color: "#8B5CF6", Icon: ShieldCheck };
    return null;
  }

  /* ---- Render ---- */

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Search */}
        <div
          className="relative flex-1 min-w-[200px] max-w-md"
        >
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--sch-text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search EST #, customer, plate..."
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
              color: "var(--sch-text)",
            }}
          />
        </div>

        {/* New Estimate button */}
        <Link
          href="/frontliner/estimate"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
          style={{
            background: "var(--sch-accent)",
            color: "#000",
          }}
        >
          <Plus className="h-4 w-4" />
          New Estimate
        </Link>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.value}
            onClick={() => {
              setStatusFilter(sf.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              background:
                statusFilter === sf.value
                  ? "rgba(245,158,11,0.2)"
                  : "var(--sch-surface)",
              color:
                statusFilter === sf.value
                  ? "var(--sch-accent)"
                  : "var(--sch-text-muted)",
              border:
                statusFilter === sf.value
                  ? "1px solid var(--sch-accent)"
                  : "1px solid var(--sch-border)",
            }}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div
          className="p-4 rounded-lg text-center text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
        >
          {error}
          <button
            onClick={fetchEstimates}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div
          className="p-8 text-center text-sm"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Loading estimates...
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && estimates.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <FileText className="h-12 w-12" style={{ color: "var(--sch-text-muted)" }} />
          <p style={{ color: "var(--sch-text-muted)" }} className="text-sm">
            {search || statusFilter !== "ALL"
              ? "No estimates match your filters."
              : "No estimate requests yet."}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && estimates.length > 0 && (
        <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--sch-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--sch-border)" }}>
                {["EST #", "Customer", "Vehicle", "Categories", "Status", "Approval", "Total", "Date"].map(
                  (col, i) => (
                    <th
                      key={col}
                      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider ${
                        i >= 3 && i <= 4 ? "hidden md:table-cell" : ""
                      } ${i >= 6 ? "hidden lg:table-cell" : ""}`}
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {estimates.map((est) => {
                const statusStyle = getStatusStyle(est.status);
                const categories = parseCategories(est.requestedCategories);
                const latestVersion = est.estimates?.[0]?.versions?.[0];
                const approval = getApprovalInfo(est);

                return (
                  <tr
                    key={est.id}
                    onClick={() => router.push(`/schedule/registry/estimate/${est.id}`)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid var(--sch-border)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--sch-surface)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* EST # */}
                    <td className="px-3 py-3">
                      <span
                        className="font-mono text-xs font-semibold"
                        style={{ color: "var(--sch-accent)" }}
                      >
                        {est.requestNumber}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-3 py-3">
                      <div style={{ color: "var(--sch-text)" }} className="font-medium">
                        {est.customer.firstName} {est.customer.lastName}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--sch-text-muted)" }}
                      >
                        {est.customer.phone}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td className="px-3 py-3">
                      <div
                        className="font-mono font-bold text-xs"
                        style={{ color: "var(--sch-text)" }}
                      >
                        {est.vehicle.plateNumber}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--sch-text-muted)" }}
                      >
                        {est.vehicle.make} {est.vehicle.model}
                      </div>
                    </td>

                    {/* Categories */}
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: "rgba(245,158,11,0.12)",
                              color: "#F59E0B",
                            }}
                          >
                            {cat}
                          </span>
                        ))}
                        {categories.length > 3 && (
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--sch-text-muted)" }}
                          >
                            +{categories.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span
                        className="px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
                        style={{
                          background: statusStyle.bg,
                          color: statusStyle.text,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Approval */}
                    <td className="px-3 py-3">
                      {approval ? (
                        <div className="flex items-center gap-1.5">
                          <approval.Icon
                            className="h-3.5 w-3.5"
                            style={{ color: approval.color }}
                          />
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: approval.color }}
                          >
                            {approval.label}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--sch-text-muted)" }}
                        >
                          --
                        </span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--sch-text)" }}
                      >
                        {latestVersion
                          ? formatPeso(latestVersion.grandTotal)
                          : "--"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span
                        className="text-xs"
                        style={{ color: "var(--sch-text-muted)" }}
                      >
                        {formatDate(est.createdAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{
                background: "var(--sch-surface)",
                border: "1px solid var(--sch-border)",
                color: "var(--sch-text)",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{
                background: "var(--sch-surface)",
                border: "1px solid var(--sch-border)",
                color: "var(--sch-text)",
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

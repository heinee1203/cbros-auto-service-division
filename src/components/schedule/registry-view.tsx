"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DARK_STATUS_PILLS } from "./live-floor-types";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */
interface RegistryJob {
  id: string;
  jobOrderNumber: string;
  status: string;
  priority: string;
  createdAt: string;
  targetCompletionDate: string | null;
  daysInShop: number;
  isOverdue: boolean;
  customer: { id: string; firstName: string; lastName: string; phone: string };
  vehicle: { id: string; plateNumber: string; make: string; model: string };
  primaryTechnician: { id: string; firstName: string; lastName: string } | null;
}

interface JobsResponse {
  jobOrders: RegistryJob[];
  total: number;
  pageCount: number;
}

const ALL_STATUSES = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Waitlist" },
  { value: "CHECKED_IN", label: "Waitlist (Checked In)" },
  { value: "IN_PROGRESS", label: "In-Service" },
  { value: "QC_PENDING", label: "QC Review" },
  { value: "QC_PASSED", label: "QC Passed" },
  { value: "QC_FAILED_REWORK", label: "Rework" },
  { value: "AWAITING_PAYMENT", label: "Ready for Pickup" },
  { value: "PARTIAL_PAYMENT", label: "Partial Payment" },
  { value: "FULLY_PAID", label: "Paid" },
  { value: "RELEASED", label: "Done" },
  { value: "CANCELLED", label: "Cancelled" },
];

/* -------------------------------------------------------------------------- */
/*  CSV Export                                                                 */
/* -------------------------------------------------------------------------- */
function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function exportCSV(jobs: RegistryJob[]) {
  const headers = ["JO#", "Date", "Status", "Vehicle", "Plate", "Customer", "Mechanic", "Days"];
  const rows = jobs.map((j) => [
    j.jobOrderNumber,
    new Date(j.createdAt).toLocaleDateString(),
    DARK_STATUS_PILLS[j.status]?.label || j.status,
    `${j.vehicle.make} ${j.vehicle.model}`,
    j.vehicle.plateNumber,
    `${j.customer.firstName} ${j.customer.lastName}`,
    j.primaryTechnician
      ? `${j.primaryTechnician.firstName} ${j.primaryTechnician.lastName}`
      : "Unassigned",
    String(j.daysInShop),
  ]);
  const csv = [headers, ...rows].map((r) => r.map(escapeCsvField).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job-registry-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*  Status Pill                                                                */
/* -------------------------------------------------------------------------- */
function StatusPill({ status }: { status: string }) {
  const pill = DARK_STATUS_PILLS[status] || {
    bg: "rgba(100,116,139,0.2)",
    text: "#94A3B8",
    label: status,
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: pill.bg,
        color: pill.text,
        whiteSpace: "nowrap",
      }}
    >
      {pill.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  RegistryView                                                               */
/* -------------------------------------------------------------------------- */
export function RegistryView() {
  const [jobs, setJobs] = useState<RegistryJob[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchJobs = useCallback(
    async (query: string, statusFilter: string, pg: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pg),
          pageSize: "50",
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        if (query.trim()) params.set("search", query.trim());
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        const res = await fetch(`/api/jobs?${params}`);
        if (!res.ok) throw new Error("Failed to fetch jobs");
        const data: JobsResponse = await res.json();
        setJobs(data.jobOrders);
        setTotal(data.total);
        setPageCount(data.pageCount);
      } catch {
        setJobs([]);
        setTotal(0);
        setPageCount(1);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchJobs("", "ALL", 1);
  }, [fetchJobs]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchJobs(value, status, 1);
    }, 350);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
    fetchJobs(search, value, 1);
  };

  const handlePageChange = (pg: number) => {
    setPage(pg);
    fetchJobs(search, status, pg);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--sch-text)",
            margin: 0,
          }}
        >
          Job Registry
        </h1>
        <button
          onClick={() => exportCSV(jobs)}
          disabled={jobs.length === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 6,
            border: "1px solid var(--sch-border)",
            backgroundColor: "var(--sch-surface)",
            color: "var(--sch-text)",
            fontSize: 13,
            fontWeight: 500,
            cursor: jobs.length === 0 ? "not-allowed" : "pointer",
            opacity: jobs.length === 0 ? 0.5 : 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Search + Filter Row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Search bar */}
        <div style={{ position: "relative", flex: "1 1 300px", minWidth: 200 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--sch-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by plate, JO#, customer name, VIN..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 38px",
              borderRadius: 6,
              border: "1px solid var(--sch-input-border)",
              backgroundColor: "var(--sch-input-bg)",
              color: "var(--sch-text)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 6,
            border: "1px solid var(--sch-input-border)",
            backgroundColor: "var(--sch-input-bg)",
            color: "var(--sch-text)",
            fontSize: 14,
            outline: "none",
            minWidth: 160,
          }}
        >
          {ALL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div style={{ fontSize: 13, color: "var(--sch-text-muted)" }}>
        {loading ? "Loading..." : `${total} job${total !== 1 ? "s" : ""} found`}
      </div>

      {/* Table */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          borderRadius: 8,
          border: "1px solid var(--sch-border)",
          backgroundColor: "var(--sch-surface)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--sch-border)",
                position: "sticky",
                top: 0,
                backgroundColor: "var(--sch-surface)",
                zIndex: 1,
              }}
            >
              {["JO#", "Date", "Status", "Vehicle", "Plate", "Customer", "Mechanic", "Days"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--sch-text-muted)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {!loading && jobs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--sch-text-dim)",
                  }}
                >
                  No jobs found
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => window.open(`/jobs/${job.id}`, "_blank")}
                style={{
                  borderBottom: "1px solid var(--sch-border)",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--sch-surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <td
                  style={{
                    padding: "10px 12px",
                    fontWeight: 600,
                    color: "var(--sch-accent)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.jobOrderNumber}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: "var(--sch-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <StatusPill status={job.status} />
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: "var(--sch-text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.vehicle.make} {job.vehicle.model}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: "var(--sch-text-muted)",
                    fontFamily: "monospace",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.vehicle.plateNumber}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: "var(--sch-text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.customer.firstName} {job.customer.lastName}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: job.primaryTechnician
                      ? "var(--sch-text)"
                      : "var(--sch-text-dim)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.primaryTechnician
                    ? `${job.primaryTechnician.firstName} ${job.primaryTechnician.lastName}`
                    : "Unassigned"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    color: job.isOverdue ? "#F87171" : "var(--sch-text-muted)",
                    fontWeight: job.isOverdue ? 600 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.daysInShop}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingBottom: 8,
          }}
        >
          <button
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--sch-border)",
              backgroundColor: "var(--sch-surface)",
              color: "var(--sch-text)",
              fontSize: 13,
              cursor: page <= 1 ? "not-allowed" : "pointer",
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "var(--sch-text-muted)", padding: "0 8px" }}>
            Page {page} of {pageCount}
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => handlePageChange(page + 1)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--sch-border)",
              backgroundColor: "var(--sch-surface)",
              color: "var(--sch-text)",
              fontSize: 13,
              cursor: page >= pageCount ? "not-allowed" : "pointer",
              opacity: page >= pageCount ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

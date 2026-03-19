"use client";

import { useState, useEffect, useCallback } from "react";
import { LayoutList, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { formatPeso } from "@/lib/utils";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SerializedJob {
  id: string;
  jobOrderNumber: string;
  status: string;
  createdAt: string;
  actualCompletionDate: string | null;
  incompleteIntake: boolean;
  customer: { firstName: string; lastName: string; phone: string };
  vehicle: {
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
  };
  primaryTechnician: { firstName: string; lastName: string } | null;
  bay: string | null;
  checkedInAt: string | null;
  serviceStartedAt: string | null;
  estimateTotal: number | null;
  estimateRequestId: string | null;
  latestVersionId: string | null;
}

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------
const FILTERS = [
  {
    key: "active",
    label: "Active Jobs",
    match: (j: SerializedJob) =>
      !["RELEASED", "CANCELLED"].includes(j.status),
  },
  {
    key: "waitlist",
    label: "Waitlist",
    match: (j: SerializedJob) =>
      ["CHECKED_IN", "PENDING", "PENDING_ESTIMATE"].includes(j.status),
  },
  {
    key: "in-service",
    label: "In-Service",
    match: (j: SerializedJob) => j.status === "IN_PROGRESS",
  },
  {
    key: "pickup",
    label: "Pickup",
    match: (j: SerializedJob) =>
      ["QC_PASSED", "AWAITING_RELEASE"].includes(j.status),
  },
  {
    key: "done",
    label: "Done",
    match: (j: SerializedJob) => j.status === "RELEASED",
  },
];

function getStatusConfig(status: string) {
  const label = JOB_STATUS_LABELS[status] || status;
  const colors = JOB_STATUS_COLORS[status] || { bg: "rgba(156,163,175,0.2)", text: "#9CA3AF" };
  return { label, ...colors };
}

function getDetailHref(job: SerializedJob) {
  return job.estimateRequestId
    ? `/schedule/registry/estimate/${job.estimateRequestId}`
    : `/jobs/${job.id}`;
}

function formatQueueNum(jobOrderNumber: string) {
  return jobOrderNumber
    .replace("JO-", "")
    .replace(/^(\d{4})(\d{2})(\d{2})-(\d{4})$/, "$2$3-$4");
}

// ---------------------------------------------------------------------------
// JobQueue — main exported component
// ---------------------------------------------------------------------------
export function JobQueue() {
  const [jobs, setJobs] = useState<SerializedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "board">("list");
  const [filter, setFilter] = useState<string>("active");

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/floor-queue");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setJobs(data.jobs);
    } catch {
      toast.error("Failed to load job queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const filteredJobs = jobs.filter(activeFilter.match);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--sch-text)" }}
          >
            Job Queue
          </h2>
          <span
            className="text-sm font-mono px-2 py-0.5 rounded-full"
            style={{
              background: "var(--sch-surface)",
              color: "var(--sch-text-muted)",
            }}
          >
            {filteredJobs.length}
          </span>
        </div>
        {/* View toggle */}
        <div
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--sch-border)" }}
        >
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background:
                view === "list" ? "var(--sch-accent)" : "var(--sch-surface)",
              color: view === "list" ? "#1A1A2E" : "var(--sch-text-muted)",
            }}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setView("board")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background:
                view === "board" ? "var(--sch-accent)" : "var(--sch-surface)",
              color: view === "board" ? "#1A1A2E" : "var(--sch-text-muted)",
            }}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Board
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {FILTERS.map((f) => {
          const count = jobs.filter(f.match).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-[var(--sch-accent)]/20 text-[var(--sch-accent)] border border-[var(--sch-accent)]/40"
                  : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)] border border-[var(--sch-border)]"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div
          className="flex items-center justify-center py-12"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Loading job queue...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <p style={{ color: "var(--sch-text-muted)" }}>
            No jobs in this category
          </p>
        </div>
      ) : view === "list" ? (
        <JobQueueList jobs={filteredJobs} />
      ) : (
        <JobQueueBoard jobs={filteredJobs} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------
function JobQueueList({ jobs }: { jobs: SerializedJob[] }) {
  return (
    <div
      className="overflow-x-auto rounded-xl border"
      style={{ borderColor: "var(--sch-border)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--sch-surface)" }}>
            {["Queue #", "Intake", "Status", "Vehicle", "Customer", "Mechanic", "Total"].map(
              (header) => (
                <th
                  key={header}
                  className={`${header === "Total" ? "text-right" : "text-left"} px-4 py-3 text-xs font-medium uppercase tracking-wider`}
                  style={{ color: "var(--sch-text-muted)" }}
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <JobQueueRow key={job.id} job={job} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------
function JobQueueRow({ job }: { job: SerializedJob }) {
  const queueNum = formatQueueNum(job.jobOrderNumber);
  const sc = getStatusConfig(job.status);
  const detailHref = getDetailHref(job);

  return (
    <tr
      className="border-t cursor-pointer hover:bg-[var(--sch-surface)]/50 transition-colors"
      style={{ borderColor: "var(--sch-border)" }}
      onClick={() => (window.location.href = detailHref)}
    >
      <td className="px-4 py-3">
        <span
          className="font-mono font-medium"
          style={{ color: "var(--sch-accent)" }}
        >
          {queueNum}
        </span>
      </td>
      <td className="px-4 py-3">
        {job.checkedInAt ? (
          <div
            className="font-mono text-xs"
            style={{ color: "var(--sch-text-muted)" }}
          >
            <div>
              {new Date(job.checkedInAt).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
              })}
            </div>
            <div>
              {new Date(job.checkedInAt).toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ) : (
          <span className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            —
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: sc.bg, color: sc.text }}
        >
          {sc.label}
        </span>
        {job.incompleteIntake && (
          <span className="ml-1 text-xs text-amber-400" title="Incomplete intake">
            ⚠
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium" style={{ color: "var(--sch-text)" }}>
          {[job.vehicle.year, job.vehicle.make, job.vehicle.model]
            .filter(Boolean)
            .join(" ")}
        </div>
        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[var(--sch-accent)]/10 text-[var(--sch-accent)]">
          {job.vehicle.plateNumber}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm" style={{ color: "var(--sch-text)" }}>
          {job.customer.firstName} {job.customer.lastName}
        </div>
        <div className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
          {job.customer.phone}
        </div>
      </td>
      <td className="px-4 py-3">
        {job.primaryTechnician ? (
          <span className="text-sm" style={{ color: "var(--sch-text)" }}>
            {job.primaryTechnician.firstName}
          </span>
        ) : (
          <span className="text-xs text-red-400">⚠ Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {job.estimateTotal ? (
          <span
            className="font-mono text-sm font-medium"
            style={{ color: "var(--sch-text)" }}
          >
            {formatPeso(job.estimateTotal)}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            —
          </span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Board View
// ---------------------------------------------------------------------------
const BOARD_COLUMNS = [
  {
    key: "waitlist",
    label: "Waitlist",
    statuses: ["PENDING", "CHECKED_IN", "PENDING_ESTIMATE"],
    color: "#FBBF24",
  },
  {
    key: "in-service",
    label: "In-Service",
    statuses: ["IN_PROGRESS"],
    color: "#34D399",
  },
  { key: "qc", label: "QC", statuses: ["QC_PENDING"], color: "#A78BFA" },
  {
    key: "pickup",
    label: "Pickup",
    statuses: ["QC_PASSED", "AWAITING_RELEASE"],
    color: "#FB923C",
  },
  { key: "done", label: "Done", statuses: ["RELEASED"], color: "#60A5FA" },
];

function JobQueueBoard({ jobs }: { jobs: SerializedJob[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => col.statuses.includes(j.status));
        return (
          <div key={col.key} className="shrink-0 w-56">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: col.color }}
              />
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--sch-text-muted)" }}
              >
                {col.label}
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: "var(--sch-text-muted)" }}
              >
                ({colJobs.length})
              </span>
            </div>
            <div className="space-y-2">
              {colJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => (window.location.href = getDetailHref(job))}
                  className="p-3 rounded-xl cursor-pointer transition-colors hover:opacity-80"
                  style={{
                    background: "var(--sch-surface)",
                    border: "1px solid var(--sch-border)",
                  }}
                >
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-[var(--sch-accent)]/10 text-[var(--sch-accent)]">
                    {job.vehicle.plateNumber}
                  </span>
                  <p
                    className="text-sm font-medium mt-2 truncate"
                    style={{ color: "var(--sch-text)" }}
                  >
                    {[job.vehicle.make, job.vehicle.model]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    {job.customer.firstName} {job.customer.lastName}
                  </p>
                  {job.primaryTechnician ? (
                    <p
                      className="text-xs mt-1 truncate"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      🔧 {job.primaryTechnician.firstName}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-red-400">⚠ Unassigned</p>
                  )}
                </div>
              ))}
              {colJobs.length === 0 && (
                <div
                  className="p-4 text-center rounded-xl border border-dashed"
                  style={{ borderColor: "var(--sch-border)" }}
                >
                  <p
                    className="text-xs"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    No jobs
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

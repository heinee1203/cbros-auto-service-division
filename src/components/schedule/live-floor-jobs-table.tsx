"use client";

import { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { LiveFloorJob } from "./live-floor-types";
import { DARK_STATUS_PILLS } from "./live-floor-types";

const FILTER_TABS = [
  { key: "all", label: "Active Jobs" },
  { key: "CHECKED_IN", label: "Waitlist" },
  { key: "IN_PROGRESS", label: "In-Service" },
  { key: "qc", label: "QC" },
  { key: "pickup", label: "Pickup" },
  { key: "done", label: "Done" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function matchesFilter(status: string, filter: FilterKey): boolean {
  if (filter === "all") return !["CANCELLED", "RELEASED"].includes(status);
  if (filter === "qc") return ["QC_PENDING", "QC_PASSED", "QC_FAILED_REWORK"].includes(status);
  if (filter === "pickup") return ["AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"].includes(status);
  if (filter === "done") return status === "RELEASED";
  return status === filter;
}

export function LiveFloorJobsTable({ jobs }: { jobs: LiveFloorJob[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const filtered = useMemo(() => jobs.filter((j) => matchesFilter(j.status, filter)), [jobs, filter]);

  return (
    <div>
      <div className="flex gap-1 mb-4 overflow-x-auto" style={{ background: "var(--sch-surface)", borderRadius: 8, padding: 4 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors`}
            style={{
              ...(filter === tab.key
                ? { background: 'var(--sch-surface-hover)', color: 'var(--sch-text)' }
                : { color: 'var(--sch-text-muted)' }),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto" style={{ background: "var(--sch-surface)", borderRadius: 12, border: "1px solid var(--sch-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--sch-border)' }}>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--sch-text-muted)' }}>Queue #</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--sch-text-muted)' }}>Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--sch-text-muted)' }}>Vehicle</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--sch-text-muted)' }}>Customer</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--sch-text-muted)' }}>Mechanic</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: 'var(--sch-text-dim)' }}>
                  No jobs match this filter
                </td>
              </tr>
            ) : (
              filtered.map((job) => {
                const pill = DARK_STATUS_PILLS[job.status] || DARK_STATUS_PILLS.PENDING;
                return (
                  <tr key={job.id} className="border-b hover:opacity-80" style={{ borderColor: 'var(--sch-border)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--sch-text)' }}>{job.jobOrderNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: pill.bg, color: pill.text }}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--sch-text)' }}>{job.vehicle.make} {job.vehicle.model}</div>
                      <div className="text-xs" style={{ color: 'var(--sch-text-dim)' }}>{job.vehicle.plateNumber}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--sch-text-muted)' }}>
                      {job.customer.firstName} {job.customer.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {job.primaryTechnician ? (
                        <span style={{ color: 'var(--sch-text-muted)' }}>{job.primaryTechnician.firstName}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Unassigned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

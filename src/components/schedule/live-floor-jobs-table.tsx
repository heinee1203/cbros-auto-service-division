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
      <div className="flex gap-1 mb-4 overflow-x-auto" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 4 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              filter === tab.key
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Queue #</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Vehicle</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Mechanic</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  No jobs match this filter
                </td>
              </tr>
            ) : (
              filtered.map((job) => {
                const pill = DARK_STATUS_PILLS[job.status] || DARK_STATUS_PILLS.PENDING;
                return (
                  <tr key={job.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-mono text-xs">{job.jobOrderNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: pill.bg, color: pill.text }}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{job.vehicle.make} {job.vehicle.model}</div>
                      <div className="text-xs text-slate-500">{job.vehicle.plateNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {job.customer.firstName} {job.customer.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {job.primaryTechnician ? (
                        <span className="text-slate-300">{job.primaryTechnician.firstName}</span>
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

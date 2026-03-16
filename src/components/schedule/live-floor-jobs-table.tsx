"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { LiveFloorJob } from "./live-floor-types";
import { DARK_STATUS_PILLS } from "./live-floor-types";
import { markDonePaidAction, quickAssignTechAction } from "@/lib/actions/job-status-actions";

const FILTER_TABS = [
  { key: "all", label: "Active Jobs" },
  { key: "unassigned", label: "Unassigned" },
  { key: "CHECKED_IN", label: "Waitlist" },
  { key: "IN_PROGRESS", label: "In-Service" },
  { key: "qc", label: "QC" },
  { key: "pickup", label: "Pickup" },
  { key: "done", label: "Done" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function matchesFilter(job: LiveFloorJob, filter: FilterKey): boolean {
  const status = job.status;
  if (filter === "all") return !["CANCELLED", "RELEASED"].includes(status);
  if (filter === "unassigned")
    return !["CANCELLED", "RELEASED"].includes(status) && job.primaryTechnician === null;
  if (filter === "qc") return ["QC_PENDING", "QC_PASSED", "QC_FAILED_REWORK"].includes(status);
  if (filter === "pickup")
    return ["AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"].includes(status);
  if (filter === "done") return status === "RELEASED";
  return status === filter;
}

const DONE_PAID_STATUSES = ["QC_PASSED", "AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"];

interface TechOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function LiveFloorJobsTable({
  jobs,
  onRefresh,
}: {
  jobs: LiveFloorJob[];
  onRefresh?: () => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [technicians, setTechnicians] = useState<TechOption[]>([]);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => jobs.filter((j) => matchesFilter(j, filter)), [jobs, filter]);

  // Fetch technicians for quick-assign dropdown
  useEffect(() => {
    fetch("/api/users/by-role?role=TECHNICIAN")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TechOption[]) => setTechnicians(data))
      .catch(() => setTechnicians([]));
  }, []);

  function handleQuickAssign(jobId: string, techId: string) {
    if (!techId) return;
    startTransition(async () => {
      const result = await quickAssignTechAction(jobId, techId);
      if (result.success) {
        toast.success("Technician assigned");
        onRefresh?.();
      } else {
        toast.error(result.error || "Failed to assign technician");
      }
    });
  }

  function handleDonePaid(jobId: string) {
    startTransition(async () => {
      const result = await markDonePaidAction(jobId);
      if (result.success) {
        toast.success("Status advanced");
        onRefresh?.();
      } else {
        toast.error(result.error || "Failed to advance status");
      }
    });
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div
        className="flex gap-1 mb-4 overflow-x-auto"
        style={{ background: "var(--sch-surface)", borderRadius: 8, padding: 4 }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors"
            style={
              filter === tab.key
                ? { background: "var(--sch-surface-hover)", color: "var(--sch-text)" }
                : { color: "var(--sch-text-muted)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto"
        style={{
          background: "var(--sch-surface)",
          borderRadius: 12,
          border: "1px solid var(--sch-border)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--sch-border)" }}>
              {["Queue #", "Status", "Vehicle", "Customer", "Bay", "Mechanic", "Services", "Actions"].map(
                (header) => (
                  <th
                    key={header}
                    className="text-left px-4 py-3 text-xs font-medium"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8" style={{ color: "var(--sch-text-dim)" }}>
                  No jobs match this filter
                </td>
              </tr>
            ) : (
              filtered.map((job) => {
                const pill = DARK_STATUS_PILLS[job.status] || DARK_STATUS_PILLS.PENDING;
                const showDonePaid = DONE_PAID_STATUSES.includes(job.status);

                return (
                  <tr
                    key={job.id}
                    className="border-b hover:opacity-80"
                    style={{ borderColor: "var(--sch-border)" }}
                  >
                    {/* Queue # */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {job.incompleteIntake && (
                          <span title="Incomplete intake" className="flex-shrink-0">
                            <AlertTriangle
                              className="h-3.5 w-3.5"
                              style={{ color: "#F59E0B" }}
                            />
                          </span>
                        )}
                        <div>
                          <div className="font-mono text-xs font-medium" style={{ color: "var(--sch-text)" }}>
                            {job.jobOrderNumber}
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--sch-text-dim)" }}>
                            {new Date(job.createdAt).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: pill.bg, color: pill.text }}
                      >
                        {pill.label}
                      </span>
                    </td>

                    {/* Vehicle */}
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--sch-text)" }}>
                        {job.vehicle.make} {job.vehicle.model}
                      </div>
                      <div className="text-xs" style={{ color: "var(--sch-text-dim)" }}>
                        {job.vehicle.plateNumber}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3" style={{ color: "var(--sch-text-muted)" }}>
                      {job.customer.firstName} {job.customer.lastName}
                    </td>

                    {/* Bay */}
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--sch-text-muted)" }}>
                      {job.bayName || "\u2014"}
                    </td>

                    {/* Mechanic / Quick-assign */}
                    <td className="px-4 py-3">
                      {job.primaryTechnician ? (
                        <span className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
                          {job.primaryTechnician.firstName}
                        </span>
                      ) : (
                        <select
                          className="text-xs rounded px-1.5 py-1 border-none outline-none cursor-pointer"
                          style={{
                            background: "var(--sch-surface-hover)",
                            color: "var(--sch-text-muted)",
                            maxWidth: 120,
                          }}
                          defaultValue=""
                          disabled={isPending}
                          onChange={(e) => handleQuickAssign(job.id, e.target.value)}
                        >
                          <option value="" disabled>
                            Assign...
                          </option>
                          {technicians.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.firstName} {tech.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Services */}
                    <td className="px-4 py-3">
                      <div
                        className="text-xs truncate max-w-[180px]"
                        style={{ color: "var(--sch-text-dim)" }}
                        title={job.services.join(", ")}
                      >
                        {job.services.length > 0 ? job.services.join(", ") : "\u2014"}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {showDonePaid && (
                        <button
                          onClick={() => handleDonePaid(job.id)}
                          disabled={isPending}
                          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-opacity disabled:opacity-50"
                          style={{
                            background: "rgba(16,185,129,0.2)",
                            color: "#34D399",
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Done/Paid
                        </button>
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

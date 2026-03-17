"use client";

import {
  JOB_ORDER_STATUS_LABELS,
  JOB_ORDER_STATUS_COLORS,
  type JobOrderStatus,
} from "@/types/enums";

interface JobCardProps {
  job: {
    id: string;
    jobOrderNumber: string;
    status: string;
    customer: { firstName: string; lastName: string };
    vehicle: { plateNumber: string; make: string; model: string };
    primaryTechnician: { firstName: string; lastName: string } | null;
    bayName: string | null;
  };
  onTap: () => void;
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case "PENDING":
    case "CHECKED_IN":
      return "border-l-amber-500";
    case "IN_PROGRESS":
      return "border-l-emerald-500";
    case "QC_PENDING":
    case "QC_PASSED":
    case "QC_FAILED_REWORK":
      return "border-l-blue-500";
    case "AWAITING_PAYMENT":
    case "PARTIAL_PAYMENT":
      return "border-l-orange-500";
    case "FULLY_PAID":
      return "border-l-[var(--sch-border)]";
    default:
      return "border-l-[var(--sch-border)]";
  }
}

export function JobCard({ job, onTap }: JobCardProps) {
  const borderColor = getStatusBorderColor(job.status);
  const statusLabel =
    JOB_ORDER_STATUS_LABELS[job.status as JobOrderStatus] || job.status;
  const statusColor =
    JOB_ORDER_STATUS_COLORS[job.status as JobOrderStatus] || "";

  return (
    <button
      onClick={onTap}
      className={`w-full text-left rounded-xl p-4 border-l-4 cursor-pointer transition-colors hover:opacity-90 ${borderColor}`}
      style={{ background: "var(--sch-card)" }}
    >
      {/* Plate */}
      <p
        className="text-xl font-mono font-bold"
        style={{ color: "var(--sch-text)" }}
      >
        {job.vehicle.plateNumber}
      </p>

      {/* Make/model */}
      <p className="text-sm" style={{ color: "var(--sch-text-muted)" }}>
        {job.vehicle.make} {job.vehicle.model}
      </p>

      {/* Customer */}
      <p className="text-sm mt-1" style={{ color: "var(--sch-text)" }}>
        {job.customer.firstName} {job.customer.lastName}
      </p>

      {/* Status badge */}
      <div className="mt-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Bay + tech */}
      <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--sch-text-dim)" }}>
        {job.bayName && <span>{job.bayName}</span>}
        {job.bayName && job.primaryTechnician && <span>&middot;</span>}
        {job.primaryTechnician && (
          <span>
            {job.primaryTechnician.firstName} {job.primaryTechnician.lastName}
          </span>
        )}
      </div>
    </button>
  );
}

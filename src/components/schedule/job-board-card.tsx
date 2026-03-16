"use client";

import { Wrench, AlertTriangle } from "lucide-react";
import type { LiveFloorJob } from "./live-floor-types";
import { DARK_STATUS_PILLS } from "./live-floor-types";

interface JobBoardCardProps {
  job: LiveFloorJob;
  borderColor: string;
}

export function JobBoardCard({ job, borderColor }: JobBoardCardProps) {
  const pill = DARK_STATUS_PILLS[job.status] || DARK_STATUS_PILLS.PENDING;

  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{
        background: "var(--sch-card)",
        borderLeft: `3px solid ${borderColor}`,
        border: "1px solid var(--sch-border)",
        borderLeftColor: borderColor,
        borderLeftWidth: 3,
      }}
    >
      {/* Header: JO number + status pill */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className="text-xs font-mono font-medium"
          style={{ color: "var(--sch-text)" }}
        >
          {job.jobOrderNumber}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: pill.bg, color: pill.text }}
        >
          {pill.label}
        </span>
      </div>

      {/* Vehicle */}
      <div
        className="text-sm font-medium truncate"
        style={{ color: "var(--sch-text)" }}
      >
        {job.vehicle.make} {job.vehicle.model}
      </div>

      {/* Plate */}
      <div
        className="text-xs truncate mt-0.5"
        style={{ color: "var(--sch-text-muted)" }}
      >
        {job.vehicle.plateNumber}
      </div>

      {/* Technician */}
      <div className="flex items-center gap-1 mt-2 text-xs">
        {job.primaryTechnician ? (
          <>
            <Wrench className="h-3 w-3" style={{ color: "var(--sch-text-dim)" }} />
            <span style={{ color: "var(--sch-text-muted)" }}>
              {job.primaryTechnician.firstName}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-red-400">Unassigned</span>
          </>
        )}
      </div>

      {/* Customer */}
      <div
        className="text-xs mt-1 truncate"
        style={{ color: "var(--sch-text-dim)" }}
      >
        {job.customer.firstName} {job.customer.lastName}
      </div>
    </div>
  );
}

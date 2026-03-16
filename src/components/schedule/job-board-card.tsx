"use client";

import { useState, useTransition } from "react";
import { Wrench, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { LiveFloorJob } from "./live-floor-types";
import { DARK_STATUS_PILLS } from "./live-floor-types";
import { advanceJobStatusAction, markDonePaidAction } from "@/lib/actions/job-status-actions";

const DONE_PAID_STATUSES = ["QC_PASSED", "AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"];

interface JobBoardCardProps {
  job: LiveFloorJob;
  borderColor: string;
  onRefresh?: () => void;
}

export function JobBoardCard({ job, borderColor, onRefresh }: JobBoardCardProps) {
  const pill = DARK_STATUS_PILLS[job.status] || DARK_STATUS_PILLS.PENDING;
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleAdvance = (direction: "forward" | "backward") => {
    startTransition(async () => {
      const result = await advanceJobStatusAction(job.id, direction);
      if (result.success) {
        onRefresh?.();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  };

  const handleDonePaid = () => {
    startTransition(async () => {
      const result = await markDonePaidAction(job.id);
      if (result.success) {
        onRefresh?.();
      } else {
        toast.error(result.error || "Failed to advance");
      }
    });
  };

  return (
    <div
      className="rounded-lg p-3 mb-2 transition-opacity"
      style={{
        background: "var(--sch-card)",
        borderLeft: `3px solid ${borderColor}`,
        border: "1px solid var(--sch-border)",
        borderLeftColor: borderColor,
        borderLeftWidth: 3,
        opacity: isPending ? 0.6 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header: JO number + bay badge + status pill + chevron */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-xs font-mono font-medium"
            style={{ color: "var(--sch-text)" }}
          >
            {job.jobOrderNumber}
          </span>
          {job.bayName && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: "rgba(59,130,246,0.2)", color: "#60A5FA" }}
            >
              {job.bayName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {job.incompleteIntake && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: "rgba(249,115,22,0.2)", color: "#FB923C" }}
            >
              INCOMPLETE
            </span>
          )}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: pill.bg, color: pill.text }}
          >
            {pill.label}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--sch-text-dim)" }}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
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

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {/* Technician */}
          <div className="flex items-center gap-1 text-xs">
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
            className="text-xs truncate"
            style={{ color: "var(--sch-text-dim)" }}
          >
            {job.customer.firstName} {job.customer.lastName}
          </div>

          {/* Services */}
          {job.services && job.services.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {job.services.map((svc, i) => (
                <span
                  key={i}
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--sch-text-muted)",
                  }}
                >
                  {svc}
                </span>
              ))}
            </div>
          )}

          {/* Done/Paid button */}
          {DONE_PAID_STATUSES.includes(job.status) && (
            <button
              onClick={handleDonePaid}
              disabled={isPending}
              className="flex items-center gap-1 w-full justify-center mt-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:brightness-110"
              style={{ background: "rgba(16,185,129,0.2)", color: "#34D399" }}
            >
              <CheckCircle className="h-3 w-3" />
              {job.status === "FULLY_PAID" ? "Release" : "Done / Paid"}
            </button>
          )}
        </div>
      )}

      {/* Status arrows on hover */}
      {hovered && (
        <div className="flex items-center justify-between mt-2 pt-1.5" style={{ borderTop: "1px solid var(--sch-border)" }}>
          <button
            onClick={() => handleAdvance("backward")}
            disabled={isPending}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium hover:bg-white/10 transition-colors"
            style={{ color: "var(--sch-text-dim)" }}
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </button>
          <button
            onClick={() => handleAdvance("forward")}
            disabled={isPending}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium hover:bg-white/10 transition-colors"
            style={{ color: "var(--sch-text-dim)" }}
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

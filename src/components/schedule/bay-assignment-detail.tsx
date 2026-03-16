"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SlideOver } from "@/components/ui/slide-over";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  updateBayAssignmentAction,
  releaseFromBayAction,
} from "@/lib/actions/scheduler-actions";
import { formatDate } from "@/lib/utils";
import type { TimelineAssignment } from "./bay-timeline-types";
import { toast } from "sonner";
import {
  ExternalLink,
  ArrowRightLeft,
  Calendar,
  LogOut,
  Car,
  User,
  Wrench,
  FileText,
  StickyNote,
} from "lucide-react";

// ── Props ──────────────────────────────────────────────────────────────────
interface BayAssignmentDetailProps {
  open: boolean;
  onClose: () => void;
  assignment: TimelineAssignment | null;
  bayName: string;
  bayColor: string;
  allBays: { id: string; name: string }[];
  onUpdated: () => void;
}

type ActionMode = "none" | "moveBay" | "reschedule";

export function BayAssignmentDetail({
  open,
  onClose,
  assignment,
  bayName,
  bayColor,
  allBays,
  onUpdated,
}: BayAssignmentDetailProps) {
  const router = useRouter();
  const [actionMode, setActionMode] = useState<ActionMode>("none");
  const [loading, setLoading] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  // Move bay state
  const [selectedBayId, setSelectedBayId] = useState("");

  // Reschedule state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Reset form state when assignment changes
  useEffect(() => {
    setActionMode("none");
    setSelectedBayId("");
    setStartDate("");
    setEndDate("");
    setReleaseDialogOpen(false);
  }, [assignment?.id]);

  if (!assignment) return null;

  const { jobOrder } = assignment;

  const resetState = () => {
    setActionMode("none");
    setSelectedBayId("");
    setStartDate("");
    setEndDate("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── Move Bay handler ────────────────────────────────────────────────────
  const handleMoveBay = async () => {
    if (!selectedBayId) {
      toast.error("Please select a bay");
      return;
    }
    setLoading(true);
    const result = await updateBayAssignmentAction(assignment.id, {
      bayId: selectedBayId,
    });
    if (result.success) {
      toast.success("Assignment moved to new bay");
      onUpdated();
      handleClose();
    } else {
      toast.error(result.error || "Failed to move bay");
    }
    setLoading(false);
  };

  // ── Reschedule handler ──────────────────────────────────────────────────
  const handleReschedule = async () => {
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }
    setLoading(true);
    const result = await updateBayAssignmentAction(assignment.id, {
      startDate,
      endDate: endDate || null,
    });
    if (result.success) {
      toast.success("Assignment rescheduled");
      onUpdated();
      handleClose();
    } else {
      toast.error(result.error || "Failed to reschedule");
    }
    setLoading(false);
  };

  // ── Release handler ─────────────────────────────────────────────────────
  const handleRelease = async () => {
    setLoading(true);
    const result = await releaseFromBayAction(assignment.id);
    if (result.success) {
      toast.success("Job released from bay");
      onUpdated();
      handleClose();
    } else {
      toast.error(result.error || "Failed to release");
    }
    setLoading(false);
    setReleaseDialogOpen(false);
  };

  // ── Initiate move bay ───────────────────────────────────────────────────
  const startMoveBay = () => {
    setActionMode("moveBay");
    setSelectedBayId("");
  };

  // ── Initiate reschedule ─────────────────────────────────────────────────
  const startReschedule = () => {
    setActionMode("reschedule");
    setStartDate(assignment.startDate.split("T")[0]);
    setEndDate(assignment.endDate ? assignment.endDate.split("T")[0] : "");
  };

  const iconClass = "w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0";

  // ── Footer actions ──────────────────────────────────────────────────────
  const renderFooter = () => {
    // Move Bay inline form
    if (actionMode === "moveBay") {
      const otherBays = allBays.filter((b) => b.id !== assignment.bayId);
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: 'var(--sch-text)' }}>Move to Bay</p>
          <select
            value={selectedBayId}
            onChange={(e) => setSelectedBayId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            style={{ backgroundColor: 'var(--sch-input-bg)', borderColor: 'var(--sch-input-border)', color: 'var(--sch-text)' }}
          >
            <option value="">Select a bay...</option>
            {otherBays.map((bay) => (
              <option key={bay.id} value={bay.id}>
                {bay.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setActionMode("none")}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium border rounded-xl disabled:opacity-50" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleMoveBay}
              disabled={loading || !selectedBayId}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl disabled:opacity-50"
            >
              {loading ? "Moving..." : "Confirm Move"}
            </button>
          </div>
        </div>
      );
    }

    // Reschedule inline form
    if (actionMode === "reschedule") {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: 'var(--sch-text)' }}>Reschedule</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent" style={{ backgroundColor: 'var(--sch-input-bg)', borderColor: 'var(--sch-input-border)', color: 'var(--sch-text)' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent" style={{ backgroundColor: 'var(--sch-input-bg)', borderColor: 'var(--sch-input-border)', color: 'var(--sch-text)' }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActionMode("none")}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium border rounded-xl disabled:opacity-50" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleReschedule}
              disabled={loading || !startDate}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl disabled:opacity-50"
            >
              {loading ? "Saving..." : "Confirm Dates"}
            </button>
          </div>
        </div>
      );
    }

    // Default action buttons
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => router.push(`/jobs/${jobOrder.id}`)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl"
        >
          <ExternalLink className="w-4 h-4" />
          View Job
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={startMoveBay}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Move Bay
          </button>
          <button
            onClick={startReschedule}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl" style={{ borderColor: 'var(--sch-border)', color: 'var(--sch-text-muted)' }}
          >
            <Calendar className="w-4 h-4" />
            Reschedule
          </button>
        </div>
        <button
          onClick={() => setReleaseDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl"
        >
          <LogOut className="w-4 h-4" />
          Release
        </button>
      </div>
    );
  };

  return (
    <>
      <SlideOver
        open={open}
        onClose={handleClose}
        title="Bay Assignment"
        description={jobOrder.jobOrderNumber}
        footer={renderFooter()}
      >
        <div className="space-y-4" style={{ background: 'var(--sch-bg)', margin: '-24px', padding: '24px' }}>
          {/* Bay info */}
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
              style={{ backgroundColor: bayColor }}
            />
            <div>
              <p className="text-xs text-slate-400">Bay</p>
              <p className="text-sm font-medium" style={{ color: 'var(--sch-text)' }}>{bayName}</p>
            </div>
          </div>

          {/* Vehicle */}
          <div className="flex items-start gap-3">
            <Car className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Vehicle</p>
              {jobOrder.vehicle ? (
                <>
                  <p className="text-sm font-bold" style={{ color: 'var(--sch-text)' }}>
                    {jobOrder.vehicle.plateNumber}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--sch-text)' }}>
                    {jobOrder.vehicle.make} {jobOrder.vehicle.model}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--sch-text)' }}>
                    {jobOrder.vehicle.color}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No vehicle</p>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="flex items-start gap-3">
            <User className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Customer</p>
              <p className="text-sm" style={{ color: 'var(--sch-text)' }}>
                {jobOrder.customer.firstName} {jobOrder.customer.lastName}
              </p>
            </div>
          </div>

          {/* Technician */}
          <div className="flex items-start gap-3">
            <Wrench className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Technician</p>
              <p className="text-sm" style={{ color: 'var(--sch-text)' }}>
                {jobOrder.primaryTechnician
                  ? `${jobOrder.primaryTechnician.firstName} ${jobOrder.primaryTechnician.lastName}`
                  : "Unassigned"}
              </p>
            </div>
          </div>

          {/* Job */}
          <div className="flex items-start gap-3">
            <FileText className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Job</p>
              <a
                href={`/jobs/${jobOrder.id}`}
                className="text-sm text-accent-600 hover:underline font-medium"
              >
                {jobOrder.jobOrderNumber}
              </a>
              <p className="text-xs text-slate-400 mt-0.5">
                {jobOrder.status} &middot; {jobOrder.priority}
              </p>
            </div>
          </div>

          {/* Schedule */}
          <div className="flex items-start gap-3">
            <Calendar className={iconClass} />
            <div>
              <p className="text-xs text-slate-400">Schedule</p>
              <p className="text-sm" style={{ color: 'var(--sch-text)' }}>
                {formatDate(assignment.startDate)}
              </p>
              <p className="text-sm" style={{ color: 'var(--sch-text)' }}>
                {assignment.endDate
                  ? formatDate(assignment.endDate)
                  : "Ongoing"}
              </p>
            </div>
          </div>

          {/* Notes */}
          {assignment.notes && (
            <div className="flex items-start gap-3">
              <StickyNote className={iconClass} />
              <div>
                <p className="text-xs text-slate-400">Notes</p>
                <p className="text-sm" style={{ color: 'var(--sch-text)' }}>{assignment.notes}</p>
              </div>
            </div>
          )}
        </div>
      </SlideOver>

      {/* Release confirm dialog */}
      <ConfirmDialog
        open={releaseDialogOpen}
        onClose={() => setReleaseDialogOpen(false)}
        onConfirm={handleRelease}
        title="Release from Bay"
        message="Are you sure you want to release this job from the bay? The job will no longer be assigned to this bay."
        confirmLabel="Release"
        variant="danger"
        loading={loading}
      />
    </>
  );
}

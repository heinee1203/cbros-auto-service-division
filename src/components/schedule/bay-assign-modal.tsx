"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SlideOver } from "@/components/ui/slide-over";
import { assignJobToBayAction } from "@/lib/actions/scheduler-actions";
import { toast } from "sonner";
import { Search, X, Loader2 } from "lucide-react";

// ── Props ──────────────────────────────────────────────────────────────────
interface BayAssignModalProps {
  open: boolean;
  onClose: () => void;
  prefilledBayId?: string;
  prefilledDate?: string; // YYYY-MM-DD
  allBays: { id: string; name: string }[];
  onAssigned: () => void;
}

interface JobResult {
  id: string;
  jobOrderNumber: string;
  status: string;
  customer: { firstName: string; lastName: string };
  vehicle: { plateNumber: string; make: string; model: string } | null;
  assignedBayId: string | null;
}

export function BayAssignModal({
  open,
  onClose,
  prefilledBayId,
  prefilledDate,
  allBays,
  onAssigned,
}: BayAssignModalProps) {
  const [bayId, setBayId] = useState(prefilledBayId || "");
  const [startDate, setStartDate] = useState(prefilledDate || "");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Job search state
  const [searchText, setSearchText] = useState("");
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setBayId(prefilledBayId || "");
      setStartDate(prefilledDate || "");
      setEndDate("");
      setNotes("");
      setSearchText("");
      setJobs([]);
      setSelectedJob(null);
      setShowDropdown(false);
    }
  }, [open, prefilledBayId, prefilledDate]);

  // Fetch jobs when search text changes
  const fetchJobs = useCallback(async (query: string) => {
    setLoadingJobs(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "IN_PROGRESS");
      params.append("status", "CHECKED_IN");
      params.set("limit", "20");
      if (query) params.set("search", query);

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const items: JobResult[] = data.jobOrders || [];
        // Filter to only unassigned jobs (no bay currently assigned)
        const unassigned = items.filter(
          (j) => !j.assignedBayId
        );
        setJobs(unassigned);
      } else {
        setJobs([]);
      }
    } catch {
      setJobs([]);
    }
    setLoadingJobs(false);
  }, []);

  useEffect(() => {
    if (!open || selectedJob) return;
    const timer = setTimeout(() => {
      fetchJobs(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, open, selectedJob, fetchJobs]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Submit handler ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!bayId) {
      toast.error("Please select a bay");
      return;
    }
    if (!selectedJob) {
      toast.error("Please select a job");
      return;
    }
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    setSubmitting(true);
    const result = await assignJobToBayAction({
      bayId,
      jobOrderId: selectedJob.id,
      startDate,
      endDate: endDate || null,
      notes: notes || null,
    });
    if (result.success) {
      toast.success("Job assigned to bay");
      onAssigned();
      onClose();
    } else {
      toast.error(result.error || "Failed to assign job");
    }
    setSubmitting(false);
  };

  const footer = (
    <div className="flex gap-2">
      <button
        onClick={onClose}
        disabled={submitting}
        className="flex-1 px-4 py-2.5 text-sm font-medium border border-surface-200 text-surface-600 hover:bg-surface-50 rounded-xl disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={submitting || !bayId || !selectedJob || !startDate}
        className="flex-1 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-xl disabled:opacity-50"
      >
        {submitting ? "Assigning..." : "Assign to Bay"}
      </button>
    </div>
  );

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Assign Job to Bay"
      description="Select a job and bay to create a new assignment"
      footer={footer}
      wide
    >
      <div className="space-y-5">
        {/* Bay select */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Bay
          </label>
          <select
            value={bayId}
            onChange={(e) => setBayId(e.target.value)}
            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          >
            <option value="">Select a bay...</option>
            {allBays.map((bay) => (
              <option key={bay.id} value={bay.id}>
                {bay.name}
              </option>
            ))}
          </select>
        </div>

        {/* Job search */}
        <div ref={searchRef}>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Job
          </label>
          {selectedJob ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent-50 border border-accent-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">
                  {selectedJob.jobOrderNumber}
                </p>
                <p className="text-xs text-surface-400 truncate">
                  {selectedJob.customer.firstName}{" "}
                  {selectedJob.customer.lastName}
                  {selectedJob.vehicle &&
                    ` \u00B7 ${selectedJob.vehicle.plateNumber}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  setSearchText("");
                }}
                className="p-1 rounded hover:bg-accent-100"
              >
                <X className="w-4 h-4 text-accent-600" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search by job number, customer, or plate..."
                  className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                />
                {loadingJobs && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 animate-spin" />
                )}
              </div>

              {/* Dropdown results */}
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-surface-200 rounded-lg shadow-lg">
                  {jobs.length === 0 && !loadingJobs && (
                    <p className="px-3 py-3 text-sm text-surface-400 text-center">
                      No unassigned jobs found
                    </p>
                  )}
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJob(job);
                        setShowDropdown(false);
                        setSearchText("");
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-50 border-b border-surface-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-primary">
                        {job.jobOrderNumber}
                      </p>
                      <p className="text-xs text-surface-400">
                        {job.customer.firstName} {job.customer.lastName}
                        {job.vehicle &&
                          ` \u00B7 ${job.vehicle.plateNumber} \u00B7 ${job.vehicle.make} ${job.vehicle.model}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Start date */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>

        {/* End date */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            End Date{" "}
            <span className="font-normal text-surface-400">(optional)</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
          <p className="text-xs text-surface-400 mt-1">
            Leave blank for ongoing assignment
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Notes{" "}
            <span className="font-normal text-surface-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this assignment..."
            rows={3}
            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
          />
        </div>
      </div>
    </SlideOver>
  );
}

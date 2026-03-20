"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ExternalLink, Loader2, ClipboardList } from "lucide-react";

import { BottomSheet } from "./bottom-sheet";
import { JobCard } from "./job-card";
import { advanceJobStatusAction } from "@/lib/actions/job-status-actions";
import { hasMechanicalWork, isBodyPaintOnly } from "@/lib/constants";
import {
  JOB_ORDER_STATUS_LABELS,
  type JobOrderStatus,
} from "@/types/enums";

type Job = {
  id: string;
  jobOrderNumber: string;
  status: string;
  customer: { firstName: string; lastName: string };
  vehicle: { plateNumber: string; make: string; model: string };
  primaryTechnician: { firstName: string; lastName: string } | null;
  bayName: string | null;
  serviceCategories: string[];
  hasEstimate: boolean;
  latestVersionId: string | null;
  estimateRequestId: string | null;
};

interface JobsClientProps {
  jobs: Job[];
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  CHECKED_IN: ["IN_PROGRESS"],
  IN_PROGRESS: ["CHECKED_IN", "QC_PENDING"],
  QC_PENDING: ["IN_PROGRESS", "QC_PASSED", "QC_FAILED_REWORK"],
  QC_PASSED: ["QC_PENDING", "AWAITING_PAYMENT"],
  QC_FAILED_REWORK: ["IN_PROGRESS"],
  AWAITING_PAYMENT: ["QC_PASSED", "PARTIAL_PAYMENT", "FULLY_PAID"],
  PARTIAL_PAYMENT: ["AWAITING_PAYMENT", "FULLY_PAID"],
  FULLY_PAID: ["PARTIAL_PAYMENT", "RELEASED"],
};

const FILTERS = [
  { label: "All", statuses: null },
  { label: "Waitlist", statuses: ["PENDING", "CHECKED_IN"] },
  { label: "In-Service", statuses: ["IN_PROGRESS"] },
  { label: "QC", statuses: ["QC_PENDING", "QC_PASSED", "QC_FAILED_REWORK"] },
  {
    label: "Pickup",
    statuses: ["AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"],
  },
] as const;

const CATEGORY_GROUPS = [
  { label: "All", value: "ALL" },
  { label: "🔧 Auto Repair", value: "AUTO_REPAIR" },
  { label: "🎨 Body & Paint", value: "BODY_PAINT" },
] as const;

export function JobsClient({ jobs }: JobsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryGroup, setCategoryGroup] = useState("ALL");
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // First filter by category group
  const categoryFilteredJobs = useMemo(() => {
    if (categoryGroup === "AUTO_REPAIR") {
      return jobs.filter((j) => hasMechanicalWork(j.serviceCategories));
    }
    if (categoryGroup === "BODY_PAINT") {
      return jobs.filter((j) => isBodyPaintOnly(j.serviceCategories));
    }
    return jobs;
  }, [jobs, categoryGroup]);

  // Then filter by status
  const filteredJobs = useMemo(() => {
    const filter = FILTERS[selectedFilter];
    if (!filter.statuses) return categoryFilteredJobs;
    return categoryFilteredJobs.filter((j) => (filter.statuses as readonly string[]).includes(j.status));
  }, [categoryFilteredJobs, selectedFilter]);

  const filterCounts = useMemo(() => {
    return FILTERS.map((f) => {
      if (!f.statuses) return categoryFilteredJobs.length;
      return categoryFilteredJobs.filter((j) => (f.statuses as readonly string[]).includes(j.status)).length;
    });
  }, [categoryFilteredJobs]);

  const handleStatusChange = (jobId: string, direction: "forward" | "backward") => {
    startTransition(async () => {
      const res = await advanceJobStatusAction(jobId, direction);
      if (res.success) {
        toast.success("Status updated");
        setSelectedJob(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update status");
      }
    });
  };

  const nextStatuses = selectedJob
    ? VALID_TRANSITIONS[selectedJob.status] || []
    : [];

  return (
    <div className="space-y-4 p-4">
      {/* Category group pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {CATEGORY_GROUPS.map((g) => (
          <button
            key={g.value}
            onClick={() => { setCategoryGroup(g.value); setSelectedFilter(0); }}
            className={`flex-shrink-0 h-10 rounded-xl px-4 text-sm font-medium transition-colors ${
              categoryGroup === g.value
                ? "bg-[var(--sch-text)] text-[var(--sch-bg)]"
                : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)]"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Status filter pills — horizontally scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setSelectedFilter(i)}
            className={`flex-shrink-0 h-12 rounded-xl px-4 text-sm font-medium transition-colors ${
              selectedFilter === i
                ? "bg-[var(--sch-accent)] text-black"
                : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)]"
            }`}
          >
            {f.label} ({filterCounts[i]})
          </button>
        ))}
      </div>

      {/* Job cards */}
      {filteredJobs.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center space-y-4"
          style={{
            background: "var(--sch-card)",
            color: "var(--sch-text-muted)",
          }}
        >
          <p>No active jobs</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/frontliner/intake"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--sch-accent)", color: "#1A1A2E" }}
            >
              New Intake
            </Link>
            <Link
              href="/frontliner/estimate"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--sch-surface)", color: "var(--sch-text)", border: "1px solid var(--sch-border)" }}
            >
              New Estimate
            </Link>
            <Link
              href="/schedule/floor"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Back to Live Floor
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onTap={() => setSelectedJob(job)}
            />
          ))}
        </div>
      )}

      {/* Bottom sheet for selected job */}
      <BottomSheet
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={
          selectedJob
            ? `${selectedJob.vehicle.plateNumber} — ${selectedJob.jobOrderNumber}`
            : ""
        }
      >
        {selectedJob && (
          <div className="space-y-3">
            {/* View full details */}
            <Link
              href={`/jobs/${selectedJob.id}`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl font-medium transition-colors"
              style={{
                background: "var(--sch-surface)",
                color: "var(--sch-text)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <ExternalLink size={16} />
              View Full Details
            </Link>

            {/* Status transitions */}
            {nextStatuses.length > 0 && (
              <div>
                <p
                  className="text-xs font-medium mb-2"
                  style={{ color: "var(--sch-text-muted)" }}
                >
                  Change Status
                </p>
                <div className="space-y-2">
                  {nextStatuses.map((status) => {
                    // Determine if this is forward or backward
                    const transitions = VALID_TRANSITIONS[selectedJob.status] || [];
                    const isForward = transitions.indexOf(status) === transitions.length - 1;

                    return (
                      <button
                        key={status}
                        onClick={() =>
                          handleStatusChange(
                            selectedJob.id,
                            isForward ? "forward" : "backward"
                          )
                        }
                        disabled={isPending}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50"
                        style={{
                          background: isForward
                            ? "var(--sch-accent)"
                            : "var(--sch-surface)",
                          color: isForward ? "#000" : "var(--sch-text)",
                          border: isForward
                            ? "none"
                            : "1px solid var(--sch-border)",
                        }}
                      >
                        {isPending && <Loader2 size={16} className="animate-spin" />}
                        {JOB_ORDER_STATUS_LABELS[status as JobOrderStatus] || status}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Estimate actions */}
            {!selectedJob.hasEstimate && (
              <Link
                href={`/frontliner/estimate/job/${selectedJob.id}`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold mt-2"
                style={{
                  background: "var(--sch-accent)",
                  color: "#1A1A2E",
                }}
              >
                <ClipboardList className="h-4 w-4" />
                Add Pricing
              </Link>
            )}
            {selectedJob.hasEstimate && selectedJob.latestVersionId && (
              <Link
                href={`/frontliner/estimate/${selectedJob.latestVersionId}?returnTo=/frontliner/jobs`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold mt-2"
                style={{
                  background: "var(--sch-surface)",
                  color: "var(--sch-text)",
                  border: "1px solid var(--sch-border)",
                }}
              >
                <ClipboardList className="h-4 w-4" />
                Edit Estimate
              </Link>
            )}
            {selectedJob.hasEstimate && selectedJob.estimateRequestId && (
              <Link
                href={`/schedule/registry/estimate/${selectedJob.estimateRequestId}`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold mt-2"
                style={{
                  background: "var(--sch-surface)",
                  color: "var(--sch-text-muted)",
                  border: "1px solid var(--sch-border)",
                }}
              >
                <ClipboardList className="h-4 w-4" />
                View Estimate
              </Link>
            )}

            {/* Close */}
            <button
              onClick={() => setSelectedJob(null)}
              className="flex h-12 w-full items-center justify-center rounded-xl font-medium transition-colors"
              style={{
                color: "var(--sch-text-muted)",
              }}
            >
              Close
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

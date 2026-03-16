"use client";

import { useMemo } from "react";
import type { LiveFloorJob } from "./live-floor-types";
import { JobBoardCard } from "./job-board-card";

interface BoardColumn {
  key: string;
  label: string;
  color: string;
  statuses: string[];
}

const COLUMNS: BoardColumn[] = [
  {
    key: "waitlist",
    label: "Waitlist",
    color: "#FBBF24",
    statuses: ["CHECKED_IN"],
  },
  {
    key: "in-service",
    label: "In-Service",
    color: "#34D399",
    statuses: ["IN_PROGRESS"],
  },
  {
    key: "qc",
    label: "QC",
    color: "#A78BFA",
    statuses: ["QC_PENDING", "QC_PASSED", "QC_FAILED_REWORK"],
  },
  {
    key: "pickup",
    label: "Pickup",
    color: "#FB923C",
    statuses: ["AWAITING_PAYMENT", "PARTIAL_PAYMENT", "FULLY_PAID"],
  },
  {
    key: "done",
    label: "Done",
    color: "#94A3B8",
    statuses: ["RELEASED"],
  },
];

export function JobBoard({ jobs, onRefresh }: { jobs: LiveFloorJob[]; onRefresh?: () => void }) {
  const columnJobs = useMemo(() => {
    const map: Record<string, LiveFloorJob[]> = {};
    for (const col of COLUMNS) {
      map[col.key] = jobs.filter((j) => col.statuses.includes(j.status));
    }
    return map;
  }, [jobs]);

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2"
      style={{ minHeight: 200 }}
    >
      {COLUMNS.map((col) => {
        const colJobs = columnJobs[col.key] || [];
        return (
          <div
            key={col.key}
            className="flex-shrink-0 flex flex-col rounded-lg"
            style={{
              width: 260,
              minWidth: 220,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--sch-border)",
            }}
          >
            {/* Column header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg"
              style={{
                borderBottom: `2px solid ${col.color}`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: col.color }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--sch-text)" }}
              >
                {col.label}
              </span>
              <span
                className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "var(--sch-text-muted)",
                }}
              >
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 overflow-y-auto" style={{ maxHeight: 500 }}>
              {colJobs.length === 0 ? (
                <div
                  className="text-center py-6 text-xs"
                  style={{ color: "var(--sch-text-dim)" }}
                >
                  No jobs
                </div>
              ) : (
                colJobs.map((job) => (
                  <JobBoardCard
                    key={job.id}
                    job={job}
                    borderColor={col.color}
                    onRefresh={onRefresh}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

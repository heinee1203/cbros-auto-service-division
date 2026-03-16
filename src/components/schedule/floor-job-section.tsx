"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { LiveFloorJob } from "./live-floor-types";
import { JobBoard } from "./job-board";
import { LiveFloorJobsTable } from "./live-floor-jobs-table";

type ViewMode = "board" | "list";

const STORAGE_KEY = "floor-job-view";

export function FloorJobSection({ jobs }: { jobs: LiveFloorJob[] }) {
  const [view, setView] = useState<ViewMode>("board");

  // Restore persisted view preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "board" || saved === "list") {
        setView(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      {/* Toggle header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Job Board
        </h3>
        <div
          className="flex rounded-md overflow-hidden"
          style={{
            border: "1px solid var(--sch-border)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <button
            onClick={() => handleViewChange("board")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: view === "board" ? "rgba(255,255,255,0.15)" : "transparent",
              color: view === "board" ? "var(--sch-text)" : "var(--sch-text-dim)",
            }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            onClick={() => handleViewChange("list")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: view === "list" ? "rgba(255,255,255,0.15)" : "transparent",
              color: view === "list" ? "var(--sch-text)" : "var(--sch-text-dim)",
            }}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {/* View content */}
      {view === "board" ? (
        <JobBoard jobs={jobs} />
      ) : (
        <LiveFloorJobsTable jobs={jobs} />
      )}
    </div>
  );
}

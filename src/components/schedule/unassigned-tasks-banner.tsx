"use client";

import { useState, useEffect } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";

interface UnassignedTasksBannerProps {
  onViewAssign: () => void;
  refreshTrigger?: number; // increment to force re-fetch
}

export default function UnassignedTasksBanner({
  onViewAssign,
  refreshTrigger,
}: UnassignedTasksBannerProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch("/api/tasks/unassigned");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setCount(Array.isArray(data) ? data.length : 0);
        }
      } catch {
        // silently ignore fetch errors
      }
    }

    fetchCount();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  if (count <= 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
      <p className="text-sm text-amber-300 flex-1">
        <span className="font-semibold">
          {count} unassigned task{count !== 1 ? "s" : ""}
        </span>{" "}
        waiting for technician assignment
      </p>
      <button
        onClick={onViewAssign}
        className="flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300"
      >
        View &amp; Assign
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

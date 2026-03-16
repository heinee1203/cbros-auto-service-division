"use client";

import { useState } from "react";
import { Factory, BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";

const LiveFloor = dynamic(() => import("./live-floor"), { ssr: false });
const BayTimeline = dynamic(() => import("./bay-timeline"), { ssr: false });

export function BayViewToggle() {
  const [view, setView] = useState<"floor" | "timeline">("floor");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit" style={{ background: "var(--sch-surface-hover)", borderRadius: 8, padding: 4 }}>
        <button
          onClick={() => setView("floor")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={view === "floor" ? { background: 'var(--sch-surface-hover)', color: 'var(--sch-text)' } : { color: 'var(--sch-text-muted)' }}
        >
          <Factory className="h-4 w-4" /> Live Floor
        </button>
        <button
          onClick={() => setView("timeline")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={view === "timeline" ? { background: 'var(--sch-surface-hover)', color: 'var(--sch-text)' } : { color: 'var(--sch-text-muted)' }}
        >
          <BarChart3 className="h-4 w-4" /> Timeline
        </button>
      </div>

      {view === "floor" ? <LiveFloor /> : <BayTimeline />}
    </div>
  );
}

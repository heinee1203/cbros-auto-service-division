"use client";

import { Clock, Activity, Users, ClipboardList } from "lucide-react";
import Link from "next/link";
import type { LiveFloorStats } from "./live-floor-types";

export function LiveFloorStatsBar({ stats }: { stats: LiveFloorStats }) {
  const metrics = [
    { label: "Queue Length", value: stats.queueLength, icon: Clock, color: "var(--sch-accent)" },
    { label: "Active Services", value: stats.activeServices, icon: Activity, color: "#34D399" },
    {
      label: "Available Mechanics",
      value: `${stats.availableTechs} / ${stats.totalTechs}`,
      icon: Users,
      color: "#60A5FA",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex items-center gap-3 p-4"
          style={{
            background: "var(--sch-surface)",
            border: "1px solid var(--sch-border)",
            borderRadius: 12,
          }}
        >
          <m.icon className="h-5 w-5 shrink-0" style={{ color: m.color }} />
          <div>
            <div className="text-2xl font-bold font-mono" style={{ color: 'var(--sch-text)' }}>{m.value}</div>
            <div className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>{m.label}</div>
          </div>
        </div>
      ))}
      <Link
        href="/schedule/registry"
        className="flex items-center gap-3 rounded-xl px-4 py-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
        style={{ background: "var(--sch-surface)", border: "1px solid var(--sch-border)" }}
      >
        <ClipboardList className="h-5 w-5 shrink-0" style={{ color: "#F59E0B" }} />
        <div className="min-w-0">
          <p className="text-2xl font-bold font-mono" style={{ color: "var(--sch-text)" }}>
            {stats.pendingEstimates}
          </p>
          <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            Pending Estimates
          </p>
        </div>
      </Link>
    </div>
  );
}

"use client";

import { Clock, Activity, Users } from "lucide-react";
import type { LiveFloorStats } from "./live-floor-types";

export function LiveFloorStatsBar({ stats }: { stats: LiveFloorStats }) {
  const metrics = [
    { label: "Queue Length", value: stats.queueLength, icon: Clock, color: "#FBBF24" },
    { label: "Active Services", value: stats.activeServices, icon: Activity, color: "#34D399" },
    {
      label: "Available Mechanics",
      value: `${stats.availableTechs} / ${stats.totalTechs}`,
      icon: Users,
      color: "#60A5FA",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex items-center gap-3 p-4"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
          }}
        >
          <m.icon className="h-5 w-5 shrink-0" style={{ color: m.color }} />
          <div>
            <div className="text-2xl font-bold text-white">{m.value}</div>
            <div className="text-xs text-slate-400">{m.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

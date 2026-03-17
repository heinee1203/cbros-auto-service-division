"use client";

import { Wrench } from "lucide-react";
import type { LiveFloorBay } from "./live-floor-types";
import { BAY_STATUS_COLORS } from "./live-floor-types";

interface BayCardProps {
  bay: LiveFloorBay;
  onClick: () => void;
}

export function LiveFloorBayCard({ bay, onClick }: BayCardProps) {
  const assignment = bay.assignments[0];
  const isOccupied = !!assignment;

  if (!isOccupied) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-2 p-4 min-w-[160px] min-h-[120px] opacity-60 hover:opacity-80 transition-opacity cursor-pointer text-left"
        style={{
          background: "var(--sch-surface)",
          border: "1px solid var(--sch-border)",
          borderRadius: 12,
        }}
      >
        <span className="text-sm font-bold" style={{ color: 'var(--sch-text-dim)' }}>{bay.name}</span>
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--sch-text-dim)' }}>Available</span>
      </button>
    );
  }

  const jo = assignment.jobOrder;
  const borderColor = BAY_STATUS_COLORS[jo.status] || BAY_STATUS_COLORS.DEFAULT;

  const techNames = new Set<string>();
  if (jo.primaryTechnician) techNames.add(jo.primaryTechnician.firstName);
  jo.tasks.forEach((t) => {
    if (t.assignedTechnician) techNames.add(t.assignedTechnician.firstName);
  });
  const mechDisplay = techNames.size > 0 ? Array.from(techNames).join(" & ") : "Unassigned";

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 p-4 min-w-[160px] min-h-[120px] transition-all hover:brightness-110 cursor-pointer text-left"
      style={{
        background: "var(--sch-surface)",
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
      }}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm font-bold" style={{ color: 'var(--sch-text)' }}>{bay.name}</span>
        <span
          className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full"
          style={{ background: `${borderColor}30`, color: borderColor }}
        >
          {jo.jobOrderNumber}
        </span>
      </div>
      <div className="text-sm font-bold truncate w-full" style={{ color: 'var(--sch-text)' }}>
        {jo.vehicle.make} {jo.vehicle.model}
      </div>
      <div className="text-xs font-mono" style={{ color: 'var(--sch-text-muted)' }}>{jo.vehicle.plateNumber}</div>
      <div className="flex items-center gap-1 text-xs mt-auto" style={{ color: 'var(--sch-text-muted)' }}>
        <Wrench className="h-3 w-3" />
        <span className={techNames.size === 0 ? "text-red-400" : ""}>
          {techNames.size === 0 ? "⚠ Unassigned" : mechDisplay}
        </span>
      </div>
    </button>
  );
}

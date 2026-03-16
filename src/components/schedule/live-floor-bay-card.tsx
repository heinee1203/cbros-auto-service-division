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
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
        }}
      >
        <span className="text-sm font-bold text-white/50">{bay.name}</span>
        <span className="text-xs text-white/30 uppercase tracking-wider">Available</span>
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
        background: "rgba(255,255,255,0.05)",
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
      }}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm font-bold text-white">{bay.name}</span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${borderColor}30`, color: borderColor }}
        >
          {jo.jobOrderNumber}
        </span>
      </div>
      <div className="text-sm font-bold text-white truncate w-full">
        {jo.vehicle.make} {jo.vehicle.model}
      </div>
      <div className="text-xs text-slate-400">{jo.vehicle.plateNumber}</div>
      <div className="flex items-center gap-1 text-xs text-slate-400 mt-auto">
        <Wrench className="h-3 w-3" />
        <span className={techNames.size === 0 ? "text-red-400" : ""}>
          {techNames.size === 0 ? "⚠ Unassigned" : mechDisplay}
        </span>
      </div>
    </button>
  );
}

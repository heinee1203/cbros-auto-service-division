"use client";

import { type TechTimelineTech, calcTechCapacity } from "./tech-timeline-types";
import { Users, Clock, AlertTriangle } from "lucide-react";

interface TechCapacityBarProps {
  techs: TechTimelineTech[];
  startDate: Date;
  days: number;
}

function Divider() {
  return <div className="h-8 w-px bg-surface-200" />;
}

export default function TechCapacityBar({ techs, startDate, days }: TechCapacityBarProps) {
  let totalAvailableHours = 0;
  let totalScheduledHours = 0;
  let totalActualHours = 0;
  let overloadedCount = 0;

  for (const tech of techs) {
    const cap = calcTechCapacity(tech, startDate, days);
    totalAvailableHours += cap.availableHours;
    totalScheduledHours += cap.scheduledHours;
    totalActualHours += cap.actualHours;
    if (cap.loadPercent > 100) overloadedCount++;
  }

  const shopUtilization =
    totalAvailableHours > 0
      ? Math.round((totalScheduledHours / totalAvailableHours) * 100)
      : 0;

  const utilizationColor =
    shopUtilization >= 100
      ? "bg-red-500"
      : shopUtilization >= 80
        ? "bg-amber-500"
        : "bg-green-500";

  const committedWarning = totalScheduledHours > totalAvailableHours;

  return (
    <div className="bg-white border border-surface-200 rounded-lg px-4 py-3 flex items-center gap-6 flex-wrap">
      {/* Technicians */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-surface-400">Technicians</p>
        <p className="text-sm font-semibold text-primary flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {techs.length}
        </p>
      </div>

      <Divider />

      {/* Available */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-surface-400">Available</p>
        <p className="text-sm font-semibold text-primary flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {Math.round(totalAvailableHours)} hrs
        </p>
      </div>

      <Divider />

      {/* Committed */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-surface-400">Committed</p>
        <p className={`text-sm font-semibold flex items-center gap-1 ${committedWarning ? "text-amber-600" : "text-primary"}`}>
          {Math.round(totalScheduledHours)} hrs
        </p>
      </div>

      <Divider />

      {/* Logged */}
      <div className="flex flex-col items-center">
        <p className="text-xs text-surface-400">Logged</p>
        <p className="text-sm font-semibold text-primary">
          {totalActualHours.toFixed(1)} hrs
        </p>
      </div>

      <Divider />

      {/* Utilization */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-surface-400">Utilization</p>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${utilizationColor}`}
              style={{ width: `${Math.min(shopUtilization, 100)}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-primary">{shopUtilization}%</p>
        </div>
      </div>

      {/* Overloaded (only show if > 0) */}
      {overloadedCount > 0 && (
        <>
          <Divider />
          <div className="flex flex-col items-center">
            <p className="text-xs text-surface-400">Overloaded</p>
            <p className="text-sm font-semibold text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overloadedCount}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

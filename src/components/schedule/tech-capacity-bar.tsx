"use client";

import { type TechTimelineTech, calcTechCapacity } from "./tech-timeline-types";
import { Users, Clock, AlertTriangle } from "lucide-react";

interface TechCapacityBarProps {
  techs: TechTimelineTech[];
  startDate: Date;
  days: number;
}

function Divider() {
  return <div className="h-8 w-px" style={{ background: 'var(--sch-border)' }} />;
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
    <div className="border rounded-lg px-4 py-3 flex items-center gap-6 flex-wrap" style={{ background: 'var(--sch-surface)', borderColor: 'var(--sch-border)' }}>
      {/* Technicians */}
      <div className="flex flex-col items-center">
        <p className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>Technicians</p>
        <p className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--sch-text)' }}>
          <Users className="h-3.5 w-3.5" />
          {techs.length}
        </p>
      </div>

      <Divider />

      {/* Available */}
      <div className="flex flex-col items-center">
        <p className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>Available</p>
        <p className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--sch-text)' }}>
          <Clock className="h-3.5 w-3.5" />
          {Math.round(totalAvailableHours)} hrs
        </p>
      </div>

      <Divider />

      {/* Committed */}
      <div className="flex flex-col items-center">
        <p className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>Committed</p>
        <p className={`text-sm font-semibold flex items-center gap-1 ${committedWarning ? "text-amber-400" : ""}`} style={!committedWarning ? { color: 'var(--sch-text)' } : undefined}>
          {Math.round(totalScheduledHours)} hrs
        </p>
      </div>

      <Divider />

      {/* Logged */}
      <div className="flex flex-col items-center">
        <p className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>Logged</p>
        <p className="text-sm font-semibold" style={{ color: 'var(--sch-text)' }}>
          {totalActualHours.toFixed(1)} hrs
        </p>
      </div>

      <Divider />

      {/* Utilization */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>Utilization</p>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: 'var(--sch-surface)' }}>
            <div
              className={`h-full rounded-full ${utilizationColor}`}
              style={{ width: `${Math.min(shopUtilization, 100)}%` }}
            />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--sch-text)' }}>{shopUtilization}%</p>
        </div>
      </div>

      {/* Overloaded (only show if > 0) */}
      {overloadedCount > 0 && (
        <>
          <Divider />
          <div className="flex flex-col items-center">
            <p className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>Overloaded</p>
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

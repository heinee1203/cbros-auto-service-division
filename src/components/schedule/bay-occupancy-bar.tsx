"use client";

import { TimelineBay } from "./bay-timeline-types";

interface BayOccupancyBarProps {
  bays: TimelineBay[];
  onBayClick: (bayId: string) => void;
}

export default function BayOccupancyBar({ bays, onBayClick }: BayOccupancyBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {bays.map((bay) => {
        const ongoingAssignment = bay.assignments.find((a) => a.endDate === null);
        const isOccupied = !!ongoingAssignment;
        const vehicle = ongoingAssignment?.jobOrder.vehicle;

        return (
          <button
            key={bay.id}
            type="button"
            onClick={() => onBayClick(bay.id)}
            className="border rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors"
            style={{ background: 'var(--sch-surface)', borderColor: 'var(--sch-border)' }}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                isOccupied ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--sch-text)' }}>{bay.name}</span>
            {isOccupied && vehicle && (
              <span className="text-xs" style={{ color: 'var(--sch-text-muted)' }}>
                {vehicle.plateNumber} &middot; {vehicle.make} {vehicle.model}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

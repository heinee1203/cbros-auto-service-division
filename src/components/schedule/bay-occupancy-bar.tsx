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
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                isOccupied ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
            <span className="text-sm font-medium text-white">{bay.name}</span>
            {isOccupied && vehicle && (
              <span className="text-xs text-slate-400">
                {vehicle.plateNumber} &middot; {vehicle.make} {vehicle.model}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

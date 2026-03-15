"use client";

import {
  type TimelineAssignment,
  hexToRgba,
  isOngoing,
} from "./bay-timeline-types";

interface BayAssignmentBlockProps {
  assignment: TimelineAssignment;
  bayColor: string;
  onClick: () => void;
  startCol: number;
  colSpan: number;
}

export function BayAssignmentBlock({
  assignment,
  bayColor,
  onClick,
  startCol,
  colSpan,
}: BayAssignmentBlockProps) {
  const { jobOrder } = assignment;
  const vehicle = jobOrder.vehicle;
  const tech = jobOrder.primaryTechnician;
  const techInitials = tech
    ? `${tech.firstName[0]}${tech.lastName[0]}`
    : null;
  const narrow = colSpan <= 2;
  const ongoing = isOngoing(assignment);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-md cursor-pointer text-left"
      style={{
        gridColumn: `${startCol} / span ${colSpan}`,
        background: hexToRgba(bayColor, 0.15),
        borderLeft: `3px solid ${bayColor}`,
        minHeight: "48px",
        padding: "4px 8px",
      }}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <span className="text-xs font-bold truncate">
          {vehicle?.plateNumber ?? jobOrder.jobOrderNumber}
        </span>
        {!narrow && techInitials && (
          <span className="text-[10px] text-surface-400 flex-shrink-0">
            {techInitials}
          </span>
        )}
      </div>
      {!narrow && vehicle && (
        <div className="text-[10px] text-surface-500 truncate">
          {vehicle.make} {vehicle.model}
        </div>
      )}

      {/* Ongoing stripe overlay */}
      {ongoing && (
        <div
          className="absolute top-0 right-0 bottom-0 w-4 animate-pulse"
          style={{
            background: `repeating-linear-gradient(135deg, transparent, transparent 4px, ${hexToRgba(bayColor, 0.3)} 4px, ${hexToRgba(bayColor, 0.3)} 8px)`,
          }}
        />
      )}
    </button>
  );
}

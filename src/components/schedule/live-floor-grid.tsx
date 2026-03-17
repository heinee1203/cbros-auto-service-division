"use client";

import { ArrowUp, Wrench } from "lucide-react";
import type { LiveFloorBay } from "./live-floor-types";
import { LiveFloorBayCard } from "./live-floor-bay-card";

interface LiveFloorGridProps {
  bays: LiveFloorBay[];
  onBayClick: (bay: LiveFloorBay) => void;
}

export function LiveFloorGrid({ bays, onBayClick }: LiveFloorGridProps) {
  const lifterBays = bays.filter((b) => b.name.startsWith("Lifter"));
  const nonLifterBays = bays.filter((b) => b.name.startsWith("Non-Lifter"));
  const otherBays = bays.filter(
    (b) => !b.name.startsWith("Lifter") && !b.name.startsWith("Non-Lifter")
  );

  const countOccupied = (bayList: LiveFloorBay[]) =>
    bayList.filter((b) => b.assignments.length > 0).length;

  return (
    <div className="space-y-6">
      {lifterBays.length > 0 && (
        <BaySection
          icon={<ArrowUp className="h-4 w-4" />}
          label="LIFTER BAYS"
          occupied={countOccupied(lifterBays)}
          total={lifterBays.length}
          bays={lifterBays}
          onBayClick={onBayClick}
        />
      )}
      {nonLifterBays.length > 0 && (
        <BaySection
          icon={<Wrench className="h-4 w-4" />}
          label="NON-LIFTER BAYS"
          occupied={countOccupied(nonLifterBays)}
          total={nonLifterBays.length}
          bays={nonLifterBays}
          onBayClick={onBayClick}
          gridCols="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        />
      )}
      {otherBays.length > 0 && (
        <BaySection
          icon={<Wrench className="h-4 w-4" />}
          label="OTHER BAYS"
          occupied={countOccupied(otherBays)}
          total={otherBays.length}
          bays={otherBays}
          onBayClick={onBayClick}
        />
      )}
    </div>
  );
}

function BaySection({
  icon,
  label,
  occupied,
  total,
  bays,
  onBayClick,
  gridCols,
}: {
  icon: React.ReactNode;
  label: string;
  occupied: number;
  total: number;
  bays: LiveFloorBay[];
  onBayClick: (bay: LiveFloorBay) => void;
  gridCols?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--sch-text-dim)' }}>{icon}</span>
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: 'var(--sch-text)' }}>
          {label}
        </h3>
        <span className="text-sm font-semibold font-mono" style={{ color: 'var(--sch-text-dim)' }}>
          {occupied} / {total}
        </span>
      </div>
      <div
        className={`grid gap-3 ${
          gridCols || "grid-cols-2 sm:grid-cols-4 md:grid-cols-7"
        }`}
      >
        {bays.map((bay) => (
          <LiveFloorBayCard key={bay.id} bay={bay} onClick={() => onBayClick(bay)} />
        ))}
      </div>
    </div>
  );
}

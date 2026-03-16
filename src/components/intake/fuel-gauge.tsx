"use client";

import { Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import { FuelLevel, FUEL_LEVEL_LABELS } from "@/types/enums";

interface FuelGaugeProps {
  value: string;
  onChange: (value: string) => void;
  darkMode?: boolean;
}

const FUEL_LEVELS = [
  FuelLevel.EMPTY,
  FuelLevel.QUARTER,
  FuelLevel.HALF,
  FuelLevel.THREE_QUARTER,
  FuelLevel.FULL,
] as const;

export function FuelGauge({ value, onChange, darkMode }: FuelGaugeProps) {
  const selectedIndex = FUEL_LEVELS.indexOf(value as FuelLevel);

  return (
    <div className="flex items-center gap-2">
      <Fuel
        className={darkMode ? "w-5 h-5 shrink-0" : "w-5 h-5 text-surface-400 shrink-0"}
        style={darkMode ? { color: "var(--sch-text-dim)" } : undefined}
      />
      <div className="flex flex-1">
        {FUEL_LEVELS.map((level, index) => {
          const isSelected = level === value;
          const isFilled = selectedIndex >= 0 && index <= selectedIndex;
          const isFirst = index === 0;
          const isLast = index === FUEL_LEVELS.length - 1;

          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              className={cn(
                "flex-1 min-h-touch flex items-center justify-center text-sm font-medium transition-colors border",
                !darkMode && "border-surface-200",
                isFirst && "rounded-l-lg",
                isLast && "rounded-r-lg",
                !isFirst && "-ml-px",
                !darkMode && isSelected && "bg-accent text-white font-bold border-accent z-10 relative",
                !darkMode && !isSelected && isFilled && "bg-accent-50 text-accent-600 border-accent-200",
                !darkMode && !isFilled && "bg-white text-surface-400",
                darkMode && isSelected && "font-bold z-10 relative",
              )}
              style={darkMode ? {
                borderColor: isSelected ? "var(--sch-accent)" : "var(--sch-border)",
                background: isSelected
                  ? "var(--sch-accent)"
                  : isFilled
                  ? "rgba(245,158,11,0.15)"
                  : "var(--sch-surface)",
                color: isSelected
                  ? "white"
                  : isFilled
                  ? "var(--sch-accent)"
                  : "var(--sch-text-dim)",
              } : undefined}
            >
              {FUEL_LEVEL_LABELS[level]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

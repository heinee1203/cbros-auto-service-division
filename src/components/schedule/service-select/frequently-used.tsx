"use client";

import { Star, CheckCircle2 } from "lucide-react";
import type { CatalogService } from "./types";

interface FrequentlyUsedProps {
  services: CatalogService[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}

export function FrequentlyUsed({
  services,
  selectedIds,
  onToggle,
  disabled,
}: FrequentlyUsedProps) {
  if (services.length === 0) return null;

  return (
    <div className="mb-4">
      <div
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 px-1"
        style={{ color: "var(--sch-accent)" }}
      >
        <Star className="w-3 h-3" />
        Frequently Used
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
      >
        {services.map((svc) => {
          const checked = selectedIds.has(svc.id);
          return (
            <button
              key={svc.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(svc.id)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors"
              style={{
                background: checked
                  ? "rgba(245,158,11,0.10)"
                  : "var(--sch-surface)",
                border: `1px solid ${checked ? "var(--sch-accent)" : "var(--sch-border)"}`,
                opacity: disabled ? 0.4 : 1,
                pointerEvents: disabled ? "none" : "auto",
              }}
            >
              <span
                className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
                style={{
                  background: checked ? "var(--sch-accent)" : "var(--sch-input-bg)",
                  border: checked ? "none" : "1.5px solid var(--sch-input-border)",
                }}
              >
                {checked && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#000" }} />}
              </span>
              <span
                className="text-xs font-medium leading-tight truncate"
                style={{ color: "var(--sch-text)" }}
              >
                {svc.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

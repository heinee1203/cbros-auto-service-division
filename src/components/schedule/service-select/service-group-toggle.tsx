"use client";

import type { ServiceGroupName } from "@/lib/constants";

interface ServiceGroupToggleProps {
  activeGroup: ServiceGroupName;
  onGroupChange: (group: ServiceGroupName) => void;
}

const GROUPS: { key: ServiceGroupName; icon: string; label: string }[] = [
  { key: "Body & Paint", icon: "🎨", label: "Body & Paint" },
  { key: "Auto Service", icon: "🔧", label: "Auto Service" },
  { key: "Other", icon: "📦", label: "Other" },
];

export function ServiceGroupToggle({
  activeGroup,
  onGroupChange,
}: ServiceGroupToggleProps) {
  return (
    <div className="flex gap-2">
      {GROUPS.map(({ key, icon, label }) => {
        const isActive = activeGroup === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onGroupChange(key)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{
              background: isActive
                ? "rgba(245,158,11,0.15)"
                : "var(--sch-surface)",
              border: `1px solid ${isActive ? "var(--sch-accent)" : "var(--sch-border)"}`,
              color: isActive ? "var(--sch-accent)" : "var(--sch-text-muted)",
            }}
          >
            <span className="text-base">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

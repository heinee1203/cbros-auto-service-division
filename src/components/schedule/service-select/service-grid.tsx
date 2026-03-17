"use client";

import { useCallback, useEffect, useRef, Fragment } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import type { CatalogService } from "./types";

interface ServiceGridProps {
  grouped: [string, CatalogService[]][];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
  scrollToCategory: string | null;
  onScrollComplete: () => void;
  collapsedCategories: Set<string>;
  onToggleCollapse: (category: string) => void;
  selectedCounts: Record<string, number>;
  searchQuery: string;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: "var(--sch-accent)" }}>{part}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function ServiceGrid({
  grouped,
  selectedIds,
  onToggle,
  disabled,
  scrollToCategory,
  onScrollComplete,
  collapsedCategories,
  onToggleCollapse,
  selectedCounts,
  searchQuery,
}: ServiceGridProps) {
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setSectionRef = useCallback(
    (cat: string) => (el: HTMLDivElement | null) => {
      if (el) sectionRefs.current.set(cat, el);
      else sectionRefs.current.delete(cat);
    },
    [],
  );

  useEffect(() => {
    if (!scrollToCategory) return;
    const el = sectionRefs.current.get(scrollToCategory);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onScrollComplete();
  }, [scrollToCategory, onScrollComplete]);

  return (
    <>
      {grouped.map(([category, items]) => {
        const isCollapsed = collapsedCategories.has(category);
        const count = selectedCounts[category] ?? 0;

        return (
          <div key={category} ref={setSectionRef(category)} className="mb-4">
            <button
              type="button"
              onClick={() => onToggleCollapse(category)}
              className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 px-1 py-1 rounded transition-colors"
              style={{ color: "var(--sch-text-muted)" }}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="flex-1 text-left">{category}</span>
              {count > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    color: "var(--sch-accent)",
                  }}
                >
                  {count} selected
                </span>
              )}
            </button>

            {!isCollapsed && (
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                }}
              >
                {items.map((svc) => {
                  const checked = selectedIds.has(svc.id);
                  return (
                    <label
                      key={svc.id}
                      className="flex items-start gap-2.5 rounded-md px-3 py-2.5 cursor-pointer transition-colors"
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
                        className="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center"
                        style={{
                          background: checked ? "var(--sch-accent)" : "var(--sch-input-bg)",
                          border: checked ? "none" : "1.5px solid var(--sch-input-border)",
                        }}
                      >
                        {checked && (
                          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                        )}
                      </span>

                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(svc.id)}
                      />

                      <div className="min-w-0">
                        <div
                          className="text-sm font-medium leading-tight"
                          style={{ color: "var(--sch-text)" }}
                        >
                          <HighlightMatch text={svc.name} query={searchQuery} />
                        </div>
                        {svc.description && (
                          <div
                            className="text-xs mt-0.5 leading-snug"
                            style={{ color: "var(--sch-text-dim)" }}
                          >
                            <HighlightMatch text={svc.description} query={searchQuery} />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

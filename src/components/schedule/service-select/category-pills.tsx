"use client";

import { useCallback, useEffect, useRef } from "react";
import { CATEGORY_SHORT_LABELS } from "@/lib/constants";

interface CategoryPillsProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryTap: (category: string) => void;
  selectedCounts: Record<string, number>;
}

export function CategoryPills({
  categories,
  activeCategory,
  onCategoryTap,
  selectedCounts,
}: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!activeCategory) return;
    const el = pillRefs.current.get(activeCategory);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategory]);

  const setPillRef = useCallback(
    (cat: string) => (el: HTMLButtonElement | null) => {
      if (el) pillRefs.current.set(cat, el);
      else pillRefs.current.delete(cat);
    },
    [],
  );

  if (categories.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      {categories.map((cat) => {
        const isActive = activeCategory === cat;
        const count = selectedCounts[cat] ?? 0;
        const label = CATEGORY_SHORT_LABELS[cat] ?? cat;

        return (
          <button
            key={cat}
            ref={setPillRef(cat)}
            type="button"
            onClick={() => onCategoryTap(cat)}
            className="flex-shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              background: isActive
                ? "rgba(245,158,11,0.15)"
                : "var(--sch-surface)",
              border: `1px solid ${isActive ? "var(--sch-accent)" : "var(--sch-border)"}`,
              color: isActive ? "var(--sch-accent)" : "var(--sch-text-muted)",
            }}
          >
            {label}
            {count > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                style={{
                  background: "var(--sch-accent)",
                  color: "#000",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

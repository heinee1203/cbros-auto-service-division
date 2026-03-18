# Service Selection UX — Three-Layer Navigation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign 148-service selection from flat scroll into search + group toggle + category pills + collapsible grid with frequently-used section.

**Architecture:** Replace single `intake-service-select.tsx` with `service-select/` folder containing 6 focused components. All state lives in orchestrator `index.tsx`. Same API, same props interface — parent `IntakeWizard` only needs an import path change.

**Tech Stack:** React 18, Next.js 14 App Router, CSS variables (`--sch-*`), lucide-react icons

---

### Task 1: Add constants for groups, short labels, frequently used

**Files:**
- Modify: `src/lib/constants.ts` (append after line 105, after `SERVICE_CATEGORIES`)

**Step 1: Add the three new constant blocks**

After the `SERVICE_CATEGORIES` array (line 105), add:

```typescript
// Service group → categories mapping for the three-layer navigation
export const SERVICE_GROUPS = {
  "Body & Paint": [
    "Collision Repair",
    "Painting & Refinishing",
    "Buffing & Paint Correction",
    "Car Detailing",
    "Undercoating & Rust Protection",
    "Car Restoration",
  ],
  "Auto Service": [
    "Preventive Maintenance Service (PMS)",
    "Brake System",
    "Suspension & Steering",
    "Engine & Drivetrain",
    "Electrical & Diagnostics",
    "Tires & Wheels",
    "Air Conditioning",
  ],
  "Other": [
    "Accessories & Add-ons",
    "Diagnostics & Inspection",
  ],
} as const;

export type ServiceGroupName = keyof typeof SERVICE_GROUPS;

// Short labels for category pills (horizontal scrollable nav)
export const CATEGORY_SHORT_LABELS: Record<string, string> = {
  "Collision Repair": "Collision",
  "Painting & Refinishing": "Paint",
  "Buffing & Paint Correction": "Buffing",
  "Car Detailing": "Detailing",
  "Undercoating & Rust Protection": "Undercoating",
  "Car Restoration": "Restoration",
  "Accessories & Add-ons": "Accessories",
  "Preventive Maintenance Service (PMS)": "PMS",
  "Brake System": "Brakes",
  "Suspension & Steering": "Suspension",
  "Engine & Drivetrain": "Engine",
  "Electrical & Diagnostics": "Electrical",
  "Tires & Wheels": "Tires",
  "Air Conditioning": "A/C",
  "Diagnostics & Inspection": "Diagnostics",
};

// Frequently used services — shown as quick picks at top of grid
// These are matched by exact service name (not ID, since seed IDs can change)
export const FREQUENTLY_USED_SERVICE_NAMES = [
  "PMS Basic (Oil, Filter, Inspect)",
  "Brake Pad Replacement (Front)",
  "Oil Change Only",
  "Full Repaint (Single Stage)",
  "Spot Painting / Touch-Up (per panel)",
  "A/C Recharge / Refrigerant Refill",
  "Wheel Alignment (4-Wheel)",
  "Engine Tune-Up (Spark Plugs, Filters, Timing)",
];
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds (constants are just data, no component changes yet)

**Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add service group, short label, and frequently-used constants"
```

---

### Task 2: Create shared types file

**Files:**
- Create: `src/components/schedule/service-select/types.ts`

**Step 1: Create the types file**

```typescript
export interface CatalogService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultEstimatedHours: number;
}
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/types.ts
git commit -m "feat: add shared CatalogService type for service-select components"
```

---

### Task 3: Create ServiceSearchBar component

**Files:**
- Create: `src/components/schedule/service-select/service-search-bar.tsx`

**Step 1: Create the search bar component**

```tsx
"use client";

import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

interface ServiceSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function ServiceSearchBar({ value, onChange }: ServiceSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: "var(--sch-text-dim)" }}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Search services… e.g. "brake pad", "oil change"'
        className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm outline-none transition-colors"
        style={{
          background: "var(--sch-input-bg)",
          border: "1px solid var(--sch-input-border)",
          color: "var(--sch-text)",
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-colors"
          style={{ color: "var(--sch-text-muted)" }}
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/service-search-bar.tsx
git commit -m "feat: add ServiceSearchBar with clear button"
```

---

### Task 4: Create ServiceGroupToggle component

**Files:**
- Create: `src/components/schedule/service-select/service-group-toggle.tsx`

**Step 1: Create the group toggle component**

```tsx
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
            <span className="hidden xs:inline">{label}</span>
            <span className="xs:hidden">{label.split(" ")[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/service-group-toggle.tsx
git commit -m "feat: add ServiceGroupToggle (Body & Paint / Auto Service / Other)"
```

---

### Task 5: Create CategoryPills component

**Files:**
- Create: `src/components/schedule/service-select/category-pills.tsx`

**Step 1: Create the category pills component**

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { CATEGORY_SHORT_LABELS } from "@/lib/constants";

interface CategoryPillsProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryTap: (category: string) => void;
  /** Count of selected services per category */
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

  // Auto-scroll active pill into view
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
      style={{ WebkitOverflowScrolling: "touch" }}
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
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/category-pills.tsx
git commit -m "feat: add CategoryPills with scroll, active state, and selected counts"
```

---

### Task 6: Create FrequentlyUsed component

**Files:**
- Create: `src/components/schedule/service-select/frequently-used.tsx`

**Step 1: Create the frequently-used component**

```tsx
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
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/frequently-used.tsx
git commit -m "feat: add FrequentlyUsed quick-pick section"
```

---

### Task 7: Create ServiceGrid component (collapsible sections + highlight)

**Files:**
- Create: `src/components/schedule/service-select/service-grid.tsx`

**Step 1: Create the service grid component**

```tsx
"use client";

import { useCallback, useEffect, useRef, Fragment } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import type { CatalogService } from "./types";

interface ServiceGridProps {
  grouped: [string, CatalogService[]][];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
  /** Category to scroll to (set by pill tap) */
  scrollToCategory: string | null;
  onScrollComplete: () => void;
  /** Collapsed category set */
  collapsedCategories: Set<string>;
  onToggleCollapse: (category: string) => void;
  /** Selected count per category */
  selectedCounts: Record<string, number>;
  /** Active search query for highlighting */
  searchQuery: string;
}

/** Bold matching substrings in a service name */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
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

  // Scroll to category when pill is tapped
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
            {/* Category header — clickable to collapse */}
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

            {/* Service cards */}
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
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/service-grid.tsx
git commit -m "feat: add ServiceGrid with collapsible sections, counts, and search highlighting"
```

---

### Task 8: Create orchestrator index.tsx (main component)

This is the core file that composes all sub-components, manages state, and preserves the exact same `IntakeServiceSelectProps` interface so the parent wizard needs no logic changes.

**Files:**
- Create: `src/components/schedule/service-select/index.tsx`

**Step 1: Create the orchestrator**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ArrowUpCircle,
  Stethoscope,
  Loader2,
} from "lucide-react";
import {
  getIntakeLevel,
  INTAKE_LEVEL_LABELS,
  type IntakeLevel,
} from "@/lib/intake-levels";
import {
  SERVICE_GROUPS,
  FREQUENTLY_USED_SERVICE_NAMES,
  type ServiceGroupName,
} from "@/lib/constants";

import type { CatalogService } from "./types";
import { ServiceSearchBar } from "./service-search-bar";
import { ServiceGroupToggle } from "./service-group-toggle";
import { CategoryPills } from "./category-pills";
import { FrequentlyUsed } from "./frequently-used";
import { ServiceGrid } from "./service-grid";

/* ------------------------------------------------------------------ */
/*  Props — identical to the old component                             */
/* ------------------------------------------------------------------ */

export interface IntakeServiceSelectProps {
  onComplete: (
    serviceIds: string[],
    categories: string[],
    intakeLevel: IntakeLevel,
  ) => void;
  preselectedServiceIds?: string[];
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CHECK_UP_SERVICE_NAME = "Check-Up Only";
const CHECK_UP_CATEGORY = "Diagnostics & Inspection";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function IntakeServiceSelect({
  onComplete,
  preselectedServiceIds = [],
  onBack,
}: IntakeServiceSelectProps) {
  /* ---- data ---- */
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- selection ---- */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preselectedServiceIds),
  );
  const [checkUpOnly, setCheckUpOnly] = useState(false);
  const [manualLevel, setManualLevel] = useState<IntakeLevel | null>(null);

  /* ---- navigation layers ---- */
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [activeGroup, setActiveGroup] = useState<ServiceGroupName>("Auto Service");
  const [scrollToCategory, setScrollToCategory] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  /* ---- fetch services ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/service-catalog");
        if (!res.ok) throw new Error("Failed to load services");
        const data: CatalogService[] = await res.json();
        if (!cancelled) {
          setServices(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- check-up service ---- */
  const checkUpService = useMemo(
    () => services.find(
      (s) => s.name === CHECK_UP_SERVICE_NAME && s.category === CHECK_UP_CATEGORY,
    ),
    [services],
  );

  /* ---- frequently used services ---- */
  const frequentlyUsedServices = useMemo(
    () => {
      const nameSet = new Set(FREQUENTLY_USED_SERVICE_NAMES);
      return services.filter((s) => nameSet.has(s.name));
    },
    [services],
  );

  /* ---- search active? ---- */
  const isSearching = deferredSearch.length >= 2;

  /* ---- filtered + grouped services ---- */
  const grouped = useMemo(() => {
    let filtered = services;

    if (isSearching) {
      const q = deferredSearch.toLowerCase();
      filtered = services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.category.toLowerCase().includes(q),
      );
    } else {
      // Filter by active group
      const allowedCategories = new Set(SERVICE_GROUPS[activeGroup]);
      filtered = services.filter((s) => allowedCategories.has(s.category));
    }

    const map = new Map<string, CatalogService[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries());
  }, [services, isSearching, deferredSearch, activeGroup]);

  /* ---- visible categories (for pills) ---- */
  const visibleCategories = useMemo(
    () => grouped.map(([cat]) => cat),
    [grouped],
  );

  /* ---- selected counts per category ---- */
  const selectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of services) {
      if (selectedIds.has(s.id)) {
        counts[s.category] = (counts[s.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [services, selectedIds]);

  /* ---- selected categories & level ---- */
  const selectedCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of services) {
      if (selectedIds.has(s.id)) cats.add(s.category);
    }
    return Array.from(cats);
  }, [services, selectedIds]);

  const detectedLevel = useMemo(
    () => getIntakeLevel(selectedCategories),
    [selectedCategories],
  );

  const effectiveLevel: IntakeLevel =
    manualLevel && manualLevel > detectedLevel ? manualLevel : detectedLevel;

  const levelMeta = INTAKE_LEVEL_LABELS[effectiveLevel];

  /* ---- handlers ---- */
  const toggleService = useCallback(
    (id: string) => {
      if (checkUpOnly) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setManualLevel(null);
    },
    [checkUpOnly],
  );

  const handleCheckUpToggle = useCallback(() => {
    setCheckUpOnly((prev) => {
      const next = !prev;
      if (next && checkUpService) {
        setSelectedIds(new Set([checkUpService.id]));
      } else {
        setSelectedIds(new Set());
      }
      setManualLevel(null);
      return next;
    });
  }, [checkUpService]);

  const handleUpgrade = useCallback(() => {
    const next: IntakeLevel = effectiveLevel < 3 ? ((effectiveLevel + 1) as IntakeLevel) : 3;
    setManualLevel(next);
  }, [effectiveLevel]);

  const handleContinue = useCallback(() => {
    if (checkUpOnly) {
      const ids = checkUpService ? [checkUpService.id] : [];
      const cats = checkUpService ? [CHECK_UP_CATEGORY] : [];
      onComplete(ids, cats, 1 as IntakeLevel);
      return;
    }
    onComplete(Array.from(selectedIds), selectedCategories, effectiveLevel);
  }, [checkUpOnly, checkUpService, selectedIds, selectedCategories, effectiveLevel, onComplete]);

  const handleCategoryTap = useCallback((category: string) => {
    // Ensure the section is expanded
    setCollapsedCategories((prev) => {
      if (!prev.has(category)) return prev;
      const next = new Set(prev);
      next.delete(category);
      return next;
    });
    setScrollToCategory(category);
  }, []);

  const handleScrollComplete = useCallback(() => {
    setScrollToCategory(null);
  }, []);

  const handleToggleCollapse = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  /* ---- render: loading/error ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "var(--sch-text-muted)" }}>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading services...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  /* ---- render: main ---- */
  return (
    <div className="flex flex-col h-full">
      {/* ── Search Bar ── */}
      <div className="mb-3">
        <ServiceSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* ── Group Toggle + Check-Up (hidden during search) ── */}
      {!isSearching && (
        <>
          <div className="mb-3">
            <ServiceGroupToggle
              activeGroup={activeGroup}
              onGroupChange={setActiveGroup}
            />
          </div>

          {/* Check-Up Only toggle */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg mb-3 cursor-pointer select-none"
            style={{
              background: checkUpOnly ? "rgba(245,158,11,0.15)" : "var(--sch-surface)",
              border: `1px solid ${checkUpOnly ? "var(--sch-accent)" : "var(--sch-border)"}`,
            }}
            onClick={handleCheckUpToggle}
            role="switch"
            aria-checked={checkUpOnly}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCheckUpToggle();
              }
            }}
          >
            <Stethoscope
              className="w-5 h-5 flex-shrink-0"
              style={{ color: checkUpOnly ? "var(--sch-accent)" : "var(--sch-text-muted)" }}
            />
            <div className="flex-1">
              <div
                className="text-sm font-semibold"
                style={{ color: checkUpOnly ? "var(--sch-accent)" : "var(--sch-text)" }}
              >
                CHECK-UP ONLY
              </div>
              <div className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
                Quick diagnostic inspection — no repairs
              </div>
            </div>
            <div
              className="w-10 h-5 rounded-full relative transition-colors"
              style={{ background: checkUpOnly ? "var(--sch-accent)" : "var(--sch-input-border)" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                style={{ background: "#fff", left: checkUpOnly ? 21 : 2 }}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Category Pills (hidden during search) ── */}
      {!isSearching && !checkUpOnly && (
        <div className="mb-3">
          <CategoryPills
            categories={visibleCategories}
            activeCategory={null}
            onCategoryTap={handleCategoryTap}
            selectedCounts={selectedCounts}
          />
        </div>
      )}

      {/* ── Scrollable Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
        {/* Frequently Used (only when not searching and not check-up) */}
        {!isSearching && !checkUpOnly && (
          <FrequentlyUsed
            services={frequentlyUsedServices}
            selectedIds={selectedIds}
            onToggle={toggleService}
            disabled={checkUpOnly}
          />
        )}

        {/* Category sections */}
        <ServiceGrid
          grouped={grouped}
          selectedIds={selectedIds}
          onToggle={toggleService}
          disabled={checkUpOnly}
          scrollToCategory={scrollToCategory}
          onScrollComplete={handleScrollComplete}
          collapsedCategories={collapsedCategories}
          onToggleCollapse={handleToggleCollapse}
          selectedCounts={selectedCounts}
          searchQuery={isSearching ? deferredSearch : ""}
        />

        {/* No results message */}
        {grouped.length === 0 && isSearching && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ color: "var(--sch-text-muted)" }}
          >
            <p className="text-sm">No services match &ldquo;{deferredSearch}&rdquo;</p>
            <p className="text-xs mt-1" style={{ color: "var(--sch-text-dim)" }}>
              Try a shorter search term
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom Bar (identical to original) ── */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{
          background: "var(--sch-card)",
          borderTop: "1px solid var(--sch-border)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm px-3 py-2 rounded-md transition-colors"
          style={{
            color: "var(--sch-text-muted)",
            background: "var(--sch-surface)",
            border: "1px solid var(--sch-border)",
          }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <span className="text-sm" style={{ color: "var(--sch-text-muted)" }}>
          {checkUpOnly
            ? "Check-up only"
            : `${selectedIds.size} service${selectedIds.size !== 1 ? "s" : ""} selected`}
        </span>

        {(checkUpOnly || selectedIds.size > 0) && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(245,158,11,0.15)", color: "var(--sch-accent)" }}
          >
            Level {effectiveLevel} &mdash; {levelMeta.name} ({levelMeta.time})
          </span>
        )}

        {(checkUpOnly || selectedIds.size > 0) && effectiveLevel < 3 && (
          <button
            type="button"
            onClick={handleUpgrade}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
              color: "var(--sch-text)",
            }}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            Upgrade
          </button>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleContinue}
          disabled={!checkUpOnly && selectedIds.size === 0}
          className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          style={{
            background: checkUpOnly || selectedIds.size > 0 ? "var(--sch-accent)" : "var(--sch-surface)",
            color: checkUpOnly || selectedIds.size > 0 ? "#000" : "var(--sch-text-dim)",
            cursor: checkUpOnly || selectedIds.size > 0 ? "pointer" : "not-allowed",
            opacity: checkUpOnly || selectedIds.size > 0 ? 1 : 0.5,
          }}
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/schedule/service-select/index.tsx
git commit -m "feat: add service-select orchestrator with search, groups, pills, grid"
```

---

### Task 9: Update IntakeWizard import and delete old file

**Files:**
- Modify: `src/components/schedule/intake-wizard.tsx` (line 16)
- Delete: `src/components/schedule/intake-service-select.tsx`

**Step 1: Update the import in intake-wizard.tsx**

Change line 16 from:
```typescript
import { IntakeServiceSelect } from "./intake-service-select";
```
to:
```typescript
import { IntakeServiceSelect } from "./service-select";
```

**Step 2: Check for any other imports of the old file**

Run: `grep -rn "intake-service-select" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the old file itself and possibly the wizard. Update any other imports found.

**Step 3: Delete the old file**

```bash
rm src/components/schedule/intake-service-select.tsx
```

**Step 4: Verify build**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds with 0 errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace intake-service-select.tsx with service-select/ folder"
```

---

### Task 10: Visual verification in browser

**Step 1: Start dev server and navigate to intake wizard**

Navigate to `/schedule/floor/intake` and proceed to the services step.

**Step 2: Verify checklist**

- [ ] Search bar visible at top — type "brake" → only brake-related services shown
- [ ] Clear search (X) → full grid returns
- [ ] Group toggle visible: Body & Paint | Auto Service | Other — tap each, categories change
- [ ] Auto Service is default selected
- [ ] Category pills show short labels, scroll horizontally
- [ ] Tap a pill → grid scrolls to that category section
- [ ] Frequently Used section shows ~8 services at top
- [ ] Category sections have collapse/expand chevrons
- [ ] Collapsed section hides its service cards
- [ ] Selected count badge appears on category headers when services are checked
- [ ] Multi-select works across categories
- [ ] CHECK-UP ONLY toggle still works (disables grid, enables continue)
- [ ] Bottom bar shows correct count, level, upgrade button
- [ ] Continue button works with selections → advances to next wizard step

**Step 3: Fix any issues found during visual testing**

Address any layout, styling, or behavior issues.

**Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: polish service selection UX after visual testing"
```

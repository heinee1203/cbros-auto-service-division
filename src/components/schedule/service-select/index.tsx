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
import { useDivision } from "@/components/division-provider";
import { divisionToServiceGroup, getDivisionCategories } from "@/lib/division";

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
  const { activeDivision } = useDivision();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [activeGroup, setActiveGroup] = useState<ServiceGroupName>(() => divisionToServiceGroup(activeDivision));
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

  /* ---- division-filtered services ---- */
  const allowedDivisionCategories = useMemo(
    () => getDivisionCategories(activeDivision),
    [activeDivision],
  );

  const divisionServices = useMemo(() => {
    if (!allowedDivisionCategories) return services; // ALL — no filter
    const allowed = new Set(allowedDivisionCategories);
    // Always include "Other" group categories (Accessories, Diagnostics)
    for (const cat of SERVICE_GROUPS["Other"]) allowed.add(cat);
    return services.filter((s) => allowed.has(s.category));
  }, [services, allowedDivisionCategories]);

  /* ---- check-up service ---- */
  const checkUpService = useMemo(
    () => divisionServices.find(
      (s) => s.name === CHECK_UP_SERVICE_NAME && s.category === CHECK_UP_CATEGORY,
    ),
    [divisionServices],
  );

  /* ---- frequently used services ---- */
  const frequentlyUsedServices = useMemo(
    () => {
      const nameSet = new Set(FREQUENTLY_USED_SERVICE_NAMES);
      return divisionServices.filter((s) => nameSet.has(s.name));
    },
    [divisionServices],
  );

  /* ---- search active? ---- */
  const isSearching = deferredSearch.length >= 2;

  /* ---- filtered + grouped services ---- */
  const grouped = useMemo(() => {
    let filtered = divisionServices;

    if (isSearching) {
      const q = deferredSearch.toLowerCase();
      filtered = divisionServices.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.category.toLowerCase().includes(q),
      );
    } else if (activeDivision === "ALL") {
      // ALL users: filter by active group toggle
      const allowedCategories = new Set<string>(SERVICE_GROUPS[activeGroup]);
      filtered = divisionServices.filter((s) => allowedCategories.has(s.category));
    }
    // Single-division users: show all divisionServices (already filtered by division)

    const map = new Map<string, CatalogService[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries());
  }, [divisionServices, isSearching, deferredSearch, activeGroup, activeDivision]);

  /* ---- visible categories (for pills) ---- */
  const visibleCategories = useMemo(
    () => grouped.map(([cat]) => cat),
    [grouped],
  );

  /* ---- selected counts per category ---- */
  const selectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of divisionServices) {
      if (selectedIds.has(s.id)) {
        counts[s.category] = (counts[s.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [divisionServices, selectedIds]);

  /* ---- selected categories & level ---- */
  const selectedCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of divisionServices) {
      if (selectedIds.has(s.id)) cats.add(s.category);
    }
    return Array.from(cats);
  }, [divisionServices, selectedIds]);

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
      {/* -- Search Bar -- */}
      <div className="flex-shrink-0 mb-3">
        <ServiceSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* -- Group Toggle + Check-Up (hidden during search) -- */}
      {!isSearching && (
        <>
          {activeDivision === "ALL" && (
            <div className="mb-3">
              <ServiceGroupToggle
                activeGroup={activeGroup}
                onGroupChange={setActiveGroup}
              />
            </div>
          )}

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

      {/* -- Category Pills (hidden during search) -- */}
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

      {/* -- Scrollable Content + Footer -- */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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

        {/* -- Bottom Bar (inside scroll, sticky to bottom) -- */}
        <div
          className="sticky bottom-0 px-4 py-3 flex items-center gap-3 flex-wrap mt-auto"
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
    </div>
  );
}

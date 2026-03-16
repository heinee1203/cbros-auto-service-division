"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CatalogService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultEstimatedHours: number;
}

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
  /* ---- state ---- */
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preselectedServiceIds),
  );
  const [checkUpOnly, setCheckUpOnly] = useState(false);
  const [manualLevel, setManualLevel] = useState<IntakeLevel | null>(null);

  /* ---- fetch services on mount ---- */
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
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- derived: group services by category ---- */
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogService[]>();
    for (const s of services) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries()); // preserves API sort order
  }, [services]);

  /* ---- derived: check-up service id ---- */
  const checkUpService = useMemo(
    () =>
      services.find(
        (s) =>
          s.name === CHECK_UP_SERVICE_NAME &&
          s.category === CHECK_UP_CATEGORY,
      ),
    [services],
  );

  /* ---- derived: selected categories & detected level ---- */
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
    manualLevel && manualLevel > detectedLevel
      ? manualLevel
      : detectedLevel;

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
      // Reset manual level when selection changes
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
    const ids = Array.from(selectedIds);
    onComplete(ids, selectedCategories, effectiveLevel);
  }, [selectedIds, selectedCategories, effectiveLevel, onComplete]);

  /* ---- render ---- */
  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        style={{ color: "var(--sch-text-muted)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading services...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center py-20 text-sm"
        style={{ color: "#EF4444" }}
      >
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ---- CHECK-UP ONLY TOGGLE ---- */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg mb-4 cursor-pointer select-none"
        style={{
          background: checkUpOnly
            ? "rgba(245,158,11,0.15)"
            : "var(--sch-surface)",
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
          style={{
            color: checkUpOnly ? "var(--sch-accent)" : "var(--sch-text-muted)",
          }}
        />
        <div className="flex-1">
          <div
            className="text-sm font-semibold"
            style={{
              color: checkUpOnly ? "var(--sch-accent)" : "var(--sch-text)",
            }}
          >
            CHECK-UP ONLY
          </div>
          <div
            className="text-xs"
            style={{ color: "var(--sch-text-muted)" }}
          >
            Quick diagnostic inspection — no repairs
          </div>
        </div>
        {/* toggle pill */}
        <div
          className="w-10 h-5 rounded-full relative transition-colors"
          style={{
            background: checkUpOnly
              ? "var(--sch-accent)"
              : "var(--sch-input-border)",
          }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
            style={{
              background: "#fff",
              left: checkUpOnly ? 21 : 2,
            }}
          />
        </div>
      </div>

      {/* ---- SERVICE GRID ---- */}
      <div
        className="flex-1 overflow-y-auto pr-1"
        style={{ paddingBottom: 100 }}
      >
        {grouped.map(([category, items]) => (
          <div key={category} className="mb-5">
            {/* Category header */}
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
              style={{ color: "var(--sch-text-muted)" }}
            >
              {category}
            </div>

            {/* 3-col / 2-col / 1-col grid */}
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {items.map((svc) => {
                const checked = selectedIds.has(svc.id);
                const disabled =
                  checkUpOnly &&
                  !(
                    svc.name === CHECK_UP_SERVICE_NAME &&
                    svc.category === CHECK_UP_CATEGORY
                  );

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
                    {/* Custom checkbox */}
                    <span
                      className="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center"
                      style={{
                        background: checked
                          ? "var(--sch-accent)"
                          : "var(--sch-input-bg)",
                        border: checked
                          ? "none"
                          : "1.5px solid var(--sch-input-border)",
                      }}
                    >
                      {checked && (
                        <CheckCircle2
                          className="w-3.5 h-3.5"
                          style={{ color: "#000" }}
                        />
                      )}
                    </span>

                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleService(svc.id)}
                    />

                    <div className="min-w-0">
                      <div
                        className="text-sm font-medium leading-tight"
                        style={{ color: "var(--sch-text)" }}
                      >
                        {svc.name}
                      </div>
                      {svc.description && (
                        <div
                          className="text-xs mt-0.5 leading-snug"
                          style={{ color: "var(--sch-text-dim)" }}
                        >
                          {svc.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ---- STICKY BOTTOM BAR ---- */}
      <div
        className="sticky bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{
          background: "var(--sch-card)",
          borderTop: "1px solid var(--sch-border)",
        }}
      >
        {/* Back button */}
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

        {/* Service count */}
        <span
          className="text-sm"
          style={{ color: "var(--sch-text-muted)" }}
        >
          {selectedIds.size} service{selectedIds.size !== 1 ? "s" : ""}{" "}
          selected
        </span>

        {/* Level badge */}
        {selectedIds.size > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(245,158,11,0.15)",
              color: "var(--sch-accent)",
            }}
          >
            Level {effectiveLevel} &mdash; {levelMeta.name} ({levelMeta.time})
          </span>
        )}

        {/* Upgrade button */}
        {selectedIds.size > 0 && effectiveLevel < 3 && (
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          style={{
            background:
              selectedIds.size > 0
                ? "var(--sch-accent)"
                : "var(--sch-surface)",
            color:
              selectedIds.size > 0 ? "#000" : "var(--sch-text-dim)",
            cursor:
              selectedIds.size > 0 ? "pointer" : "not-allowed",
            opacity: selectedIds.size > 0 ? 1 : 0.5,
          }}
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

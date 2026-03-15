"use client";

import { useState, useMemo } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

type PresetKey =
  | "today"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "last_month"
  | "last_quarter"
  | "last_year"
  | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "last_month", label: "Last Month" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

function getPresetRange(key: PresetKey): DateRange | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case "today":
      return { from: new Date(y, m, d), to: new Date(y, m, d, 23, 59, 59) };
    case "this_week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(y, m, d - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { from: monday, to: new Date(y, m, d, 23, 59, 59) };
    }
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m, d, 23, 59, 59) };
    case "this_quarter": {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { from: qStart, to: new Date(y, m, d, 23, 59, 59) };
    }
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y, m, d, 23, 59, 59) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) };
    case "last_quarter": {
      const lqStart = new Date(y, Math.floor(m / 3) * 3 - 3, 1);
      const lqEnd = new Date(y, Math.floor(m / 3) * 3, 0, 23, 59, 59);
      return { from: lqStart, to: lqEnd };
    }
    case "last_year":
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59) };
    default:
      return null;
  }
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const displayLabel = useMemo(() => {
    const preset = PRESETS.find((p) => p.key === activePreset);
    if (preset && activePreset !== "custom") return preset.label;
    const fromStr = value.from.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    const toStr = value.to.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    return `${fromStr} – ${toStr}`;
  }, [activePreset, value]);

  function handlePreset(key: PresetKey) {
    setActivePreset(key);
    if (key === "custom") return;
    const range = getPresetRange(key);
    if (range) {
      onChange(range);
      setOpen(false);
    }
  }

  function handleCustomApply() {
    if (customFrom && customTo) {
      onChange({
        from: new Date(customFrom),
        to: new Date(customTo + "T23:59:59"),
      });
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-surface-200 bg-white hover:bg-surface-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-surface-400" />
        {displayLabel}
        <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-surface-200 shadow-lg p-3 w-72">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.filter((p) => p.key !== "custom").map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset.key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-left",
                    activePreset === preset.key
                      ? "bg-accent text-white"
                      : "hover:bg-surface-50 text-surface-600"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t border-surface-100 mt-3 pt-3">
              <p className="text-xs font-medium text-surface-500 mb-2">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setActivePreset("custom"); }}
                  className="px-2 py-1.5 text-xs border border-surface-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-300"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => { setCustomTo(e.target.value); setActivePreset("custom"); }}
                  className="px-2 py-1.5 text-xs border border-surface-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-300"
                />
              </div>
              <button
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
                className="mt-2 w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

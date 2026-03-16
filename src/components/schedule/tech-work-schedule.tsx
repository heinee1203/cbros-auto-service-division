"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { updateWorkScheduleAction } from "@/lib/actions/scheduler-actions";
import {
  type WorkSchedule,
  type DaySchedule,
  DAY_KEYS,
  DEFAULT_WORK_SCHEDULE,
  parseWorkSchedule,
} from "./tech-timeline-types";
import { toast } from "sonner";
import { Clock, RotateCcw, Copy, Loader2 } from "lucide-react";

interface TechScheduleEntry {
  id: string;
  firstName: string;
  lastName: string;
  workSchedule: WorkSchedule;
}

const DAY_LABELS: Record<string, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

/** Generate time options from startHour to endHour in 30-min increments */
function generateTimeOptions(startHour: number, endHour: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 30]) {
      if (h === endHour && m === 30) break;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

const START_TIME_OPTIONS = generateTimeOptions(6, 12);
const END_TIME_OPTIONS = generateTimeOptions(12, 22);

function DayColumn({
  dayKey,
  schedule,
  onChange,
}: {
  dayKey: string;
  schedule: DaySchedule;
  onChange: (updated: DaySchedule) => void;
}) {
  const isOff = !!schedule.off;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium uppercase text-surface-600">
        {DAY_LABELS[dayKey]}
      </span>

      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={isOff}
          onChange={(e) =>
            onChange({ ...schedule, off: e.target.checked })
          }
          className="w-3.5 h-3.5 rounded border-surface-300 text-accent-600 focus:ring-accent-500"
        />
        <span className="text-[10px] text-surface-500">Off</span>
      </label>

      <select
        value={schedule.start}
        disabled={isOff}
        onChange={(e) => onChange({ ...schedule, start: e.target.value })}
        className={`w-full text-[11px] border border-surface-300 rounded px-1 py-1 focus:ring-1 focus:ring-accent-500 focus:border-accent-500 ${
          isOff ? "bg-surface-100 text-surface-400 cursor-not-allowed" : "bg-white"
        }`}
      >
        {START_TIME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={schedule.end}
        disabled={isOff}
        onChange={(e) => onChange({ ...schedule, end: e.target.value })}
        className={`w-full text-[11px] border border-surface-300 rounded px-1 py-1 focus:ring-1 focus:ring-accent-500 focus:border-accent-500 ${
          isOff ? "bg-surface-100 text-surface-400 cursor-not-allowed" : "bg-white"
        }`}
      >
        {END_TIME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TechWorkSchedule() {
  const [techs, setTechs] = useState<TechScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fetch technicians on mount
  useEffect(() => {
    async function fetchTechs() {
      try {
        const res = await fetch(
          "/api/technicians/timeline?start=2020-01-01T00:00:00.000Z&end=2020-01-02T00:00:00.000Z"
        );
        if (!res.ok) throw new Error("Failed to fetch technicians");
        const data = await res.json();
        const entries: TechScheduleEntry[] = (data as any[]).map((t) => ({
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          workSchedule: parseWorkSchedule(t.workSchedule) ?? { ...DEFAULT_WORK_SCHEDULE },
        }));
        setTechs(entries);
      } catch (err) {
        toast.error("Failed to load technicians");
      } finally {
        setLoading(false);
      }
    }
    fetchTechs();
  }, []);

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const saveSchedule = useCallback(
    async (techId: string, schedule: WorkSchedule) => {
      setSavingIds((prev) => new Set(prev).add(techId));
      try {
        const result = await updateWorkScheduleAction({
          technicianId: techId,
          workSchedule: JSON.stringify(schedule),
        });
        if (result.success) {
          toast.success("Schedule saved");
        } else {
          toast.error(result.error || "Failed to save schedule");
        }
      } catch {
        toast.error("Failed to save schedule");
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(techId);
          return next;
        });
      }
    },
    []
  );

  const debouncedSave = useCallback(
    (techId: string, schedule: WorkSchedule) => {
      const existing = debounceTimers.current.get(techId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        saveSchedule(techId, schedule);
        debounceTimers.current.delete(techId);
      }, 800);
      debounceTimers.current.set(techId, timer);
    },
    [saveSchedule]
  );

  const handleDayChange = useCallback(
    (techIndex: number, dayKey: string, updated: DaySchedule) => {
      setTechs((prev) => {
        const next = [...prev];
        const tech = { ...next[techIndex] };
        tech.workSchedule = { ...tech.workSchedule, [dayKey]: updated };
        next[techIndex] = tech;
        debouncedSave(tech.id, tech.workSchedule);
        return next;
      });
    },
    [debouncedSave]
  );

  const handleApplyToAll = useCallback(
    (sourceTechIndex: number) => {
      setTechs((prev) => {
        const sourceSchedule = prev[sourceTechIndex].workSchedule;
        const next = prev.map((tech, i) => {
          if (i === sourceTechIndex) return tech;
          const updated = { ...tech, workSchedule: { ...sourceSchedule } };
          debouncedSave(updated.id, updated.workSchedule);
          return updated;
        });
        toast.success("Schedule applied to all technicians");
        return next;
      });
    },
    [debouncedSave]
  );

  const handleResetToDefault = useCallback(
    (techIndex: number) => {
      setTechs((prev) => {
        const next = [...prev];
        const tech = { ...next[techIndex] };
        tech.workSchedule = { ...DEFAULT_WORK_SCHEDULE };
        next[techIndex] = tech;
        debouncedSave(tech.id, tech.workSchedule);
        toast.success("Schedule reset to default");
        return next;
      });
    },
    [debouncedSave]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="flex items-center gap-2 text-surface-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading technician schedules...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-surface-600" />
          <h3 className="text-lg font-semibold text-surface-900">
            Technician Work Schedules
          </h3>
        </div>
        <p className="text-sm text-surface-500">
          Configure weekly work schedules for each technician
        </p>
      </div>

      {techs.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-8">
          No technicians found.
        </p>
      ) : (
        <div className="space-y-4">
          {techs.map((tech, techIndex) => {
            const isSaving = savingIds.has(tech.id);
            return (
              <div
                key={tech.id}
                className="bg-white border border-surface-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-primary">
                      {tech.firstName} {tech.lastName}
                    </p>
                    {isSaving && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-surface-400" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      title="Apply to All"
                      onClick={() => handleApplyToAll(techIndex)}
                      className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      title="Reset to Default"
                      onClick={() => handleResetToDefault(techIndex)}
                      className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {DAY_KEYS.map((dayKey) => (
                    <DayColumn
                      key={dayKey}
                      dayKey={dayKey}
                      schedule={
                        tech.workSchedule[dayKey] ?? {
                          start: "08:00",
                          end: "17:00",
                        }
                      }
                      onChange={(updated) =>
                        handleDayChange(techIndex, dayKey, updated)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

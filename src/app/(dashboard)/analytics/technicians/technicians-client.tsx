"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { formatPeso } from "@/lib/utils";
import type { TechPerformance } from "@/lib/services/analytics";

type SortKey = keyof Pick<
  TechPerformance,
  | "name"
  | "jobsWorked"
  | "hoursLogged"
  | "efficiencyScore"
  | "utilizationRate"
  | "reworkRate"
  | "revenueGenerated"
  | "onTimeRate"
>;

interface TechniciansClientProps {
  initialData: TechPerformance[];
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "jobsWorked", label: "Jobs" },
  { key: "hoursLogged", label: "Hours Logged" },
  { key: "efficiencyScore", label: "Efficiency Score" },
  { key: "utilizationRate", label: "Utilization %" },
  { key: "reworkRate", label: "Rework Rate %" },
  { key: "revenueGenerated", label: "Revenue" },
  { key: "onTimeRate", label: "On-Time Rate %" },
];

function efficiencyColor(score: number): string {
  if (score > 1.1) return "text-green-600";
  if (score >= 0.9) return "text-amber-600";
  return "text-red-600";
}

export function TechniciansClient({ initialData }: TechniciansClientProps) {
  const router = useRouter();
  const [data, setData] = useState<TechPerformance[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("efficiencyScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const now = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  });

  const handleDateChange = useCallback(async (range: DateRange) => {
    setDateRange(range);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/technicians?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "name" ? "asc" : "desc");
      }
    },
    [sortKey]
  );

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const numA = aVal as number;
      const numB = bVal as number;
      return sortDir === "asc" ? numA - numB : numB - numA;
    });
    return sorted;
  }, [data, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/analytics")}
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-surface-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary">
              Technician Performance
            </h1>
            <p className="text-sm text-surface-400">
              Compare efficiency, utilization, and output across technicians
            </p>
          </div>
        </div>
        <DateRangePicker value={dateRange} onChange={handleDateChange} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        {loading && (
          <div className="px-5 py-3 bg-accent-50 text-accent text-sm font-medium">
            Loading...
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left font-semibold text-surface-500 cursor-pointer select-none hover:text-primary transition-colors whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        <span className="text-accent">
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      ) : (
                        <span className="text-surface-300">▲</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-12 text-center"
                  >
                    <Users className="w-10 h-10 text-surface-300 mx-auto mb-2" />
                    <p className="text-surface-400 font-medium">
                      No technician data for this period
                    </p>
                  </td>
                </tr>
              ) : (
                sortedData.map((tech) => (
                  <tr
                    key={tech.id}
                    onClick={() =>
                      router.push(`/analytics/technicians/${tech.id}`)
                    }
                    className="hover:bg-surface-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-primary">
                      {tech.name}
                    </td>
                    <td className="px-4 py-3 font-mono">{tech.jobsWorked}</td>
                    <td className="px-4 py-3 font-mono">
                      {tech.hoursLogged.toFixed(1)}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono font-semibold ${efficiencyColor(tech.efficiencyScore)}`}
                    >
                      {tech.efficiencyScore.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {tech.utilizationRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {tech.reworkRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatPeso(tech.revenueGenerated)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {tech.onTimeRate.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

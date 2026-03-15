"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Gauge, TrendingUp, DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { formatPeso } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/types/enums";
import type { TechDetail } from "@/lib/services/analytics";
import type { UserRole } from "@/types/enums";

interface TechDetailClientProps {
  initialData: TechDetail;
}

function efficiencyColor(score: number): string {
  if (score > 1.1) return "text-green-600";
  if (score >= 0.9) return "text-amber-600";
  return "text-red-600";
}

export function TechDetailClient({ initialData }: TechDetailClientProps) {
  const router = useRouter();
  const [data, setData] = useState<TechDetail>(initialData);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  });

  const handleDateChange = useCallback(
    async (range: DateRange) => {
      setDateRange(range);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/analytics/technicians/${data.id}?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } finally {
        setLoading(false);
      }
    },
    [data.id]
  );

  const roleLabel =
    USER_ROLE_LABELS[data.role as UserRole] ?? data.role;

  const metricCards = [
    {
      label: "Hours Logged",
      value: `${data.hoursLogged.toFixed(1)} hrs`,
      icon: Clock,
      color: "text-blue-600",
    },
    {
      label: "Efficiency Score",
      value: data.efficiencyScore.toFixed(2),
      icon: Gauge,
      color: efficiencyColor(data.efficiencyScore),
    },
    {
      label: "Utilization %",
      value: `${data.utilizationRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-600",
    },
    {
      label: "Revenue Generated",
      value: formatPeso(data.revenueGenerated),
      icon: DollarSign,
      color: "text-green-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/analytics/technicians")}
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-surface-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary">{data.name}</h1>
            <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-accent-100 text-accent-700">
              {roleLabel}
            </span>
          </div>
        </div>
        <DateRangePicker value={dateRange} onChange={handleDateChange} />
      </div>

      {loading && (
        <div className="px-5 py-3 bg-accent-50 text-accent text-sm font-medium rounded-xl">
          Loading...
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-surface-200 p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs font-medium text-surface-400">
                {card.label}
              </span>
            </div>
            <p className={`text-2xl font-bold font-mono ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Efficiency Trend */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">
            Efficiency Trend
          </h2>
          {data.taskBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={data.taskBreakdown.map((t, i) => ({
                  index: i + 1,
                  efficiency: Number(t.efficiency.toFixed(2)),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="index"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Task #",
                    position: "insideBottom",
                    offset: -2,
                    fontSize: 12,
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="efficiency"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Efficiency"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-surface-400 text-sm">
              No task data available for efficiency trend
            </div>
          )}
        </div>

        {/* Daily Hours */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">
            Daily Hours
          </h2>
          {data.dailyHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailyHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return `${dt.getMonth() + 1}/${dt.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Hours",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  labelFormatter={(d) => {
                    const dt = new Date(String(d));
                    return dt.toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  formatter={(val) => [`${Number(val).toFixed(1)} hrs`, "Hours"]}
                />
                <Bar
                  dataKey="hours"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Hours"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-surface-400 text-sm">
              No daily hours data available
            </div>
          )}
        </div>
      </div>

      {/* Task Breakdown Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200">
          <h2 className="text-sm font-semibold text-primary">
            Task Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                <th className="px-4 py-3 text-left font-semibold text-surface-500">
                  JO#
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-500">
                  Task Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-500">
                  Est Hours
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-500">
                  Actual Hours
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-500">
                  Efficiency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.taskBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-surface-400">
                    No tasks found for this period
                  </td>
                </tr>
              ) : (
                data.taskBreakdown.map((task, i) => (
                  <tr key={i} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-surface-500">
                      {task.jobOrderNumber}
                    </td>
                    <td className="px-4 py-3 text-primary">{task.taskName}</td>
                    <td className="px-4 py-3 font-mono">
                      {task.estimatedHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {task.actualHours.toFixed(1)}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono font-semibold ${efficiencyColor(task.efficiency)}`}
                    >
                      {task.efficiency.toFixed(2)}
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

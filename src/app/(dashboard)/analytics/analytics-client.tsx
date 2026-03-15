"use client";

import { useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  Clock,
  Gauge,
  Users,
  Receipt,
  Activity,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/ui/date-range-picker";
import { formatPeso } from "@/lib/utils";
import type {
  ShopOverview,
  RevenueBreakdown,
  JobPipeline,
  CapacityMetrics,
  FinancialSummary,
} from "@/lib/services/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatAxisPeso = (value: number) => {
  const pesos = value / 100;
  if (pesos >= 1000000) return `₱${(pesos / 1000000).toFixed(1)}M`;
  if (pesos >= 1000) return `₱${(pesos / 1000).toFixed(0)}K`;
  return `₱${pesos.toFixed(0)}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pesoFormatter = (value: any) =>
  formatPeso(typeof value === "number" ? value : 0);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
  change,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
  change?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <div className="flex items-start justify-between">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>
        {change !== undefined && change !== 0 && (
          <div
            className={`flex items-center gap-0.5 text-xs font-medium ${
              change > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="font-mono text-xl font-bold text-primary mt-2">{value}</p>
      <p className="text-xs text-surface-400 mt-0.5">{label}</p>
      {subValue && (
        <p className="text-xs text-surface-500 mt-1">{subValue}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5">
      <h3 className="text-sm font-semibold text-primary mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface AnalyticsClientProps {
  initialOverview: ShopOverview;
  initialRevenue: RevenueBreakdown;
  initialPipeline: JobPipeline;
  initialCapacity: CapacityMetrics;
  initialFinancial: FinancialSummary;
}

export function AnalyticsClient({
  initialOverview,
  initialRevenue,
  initialPipeline,
  initialCapacity,
  initialFinancial,
}: AnalyticsClientProps) {
  const now = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    ),
  });
  const [overview, setOverview] = useState(initialOverview);
  const [revenue, setRevenue] = useState(initialRevenue);
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [financial, setFinancial] = useState(initialFinancial);
  const [loading, setLoading] = useState(false);

  const handleDateRangeChange = useCallback(async (range: DateRange) => {
    setDateRange(range);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setOverview(data.overview);
        setRevenue(data.revenue);
        setPipeline(data.pipeline);
        setCapacity(data.capacity);
        setFinancial(data.financial);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute active jobs total from Record
  const activeJobsTotal = Object.values(overview.activeJobs).reduce(
    (sum, count) => sum + count,
    0
  );

  // Efficiency color
  const effColor =
    overview.avgEfficiencyRatio >= 1.0
      ? "text-green-600"
      : overview.avgEfficiencyRatio >= 0.8
        ? "text-amber-600"
        : "text-red-600";

  // Chart data transforms
  const revenueTrendData = revenue.byMonth.map((m) => ({
    name: m.month,
    Revenue: m.total,
  }));

  const revenueByCategoryData = revenue.byGroup.filter((g) => g.total > 0);

  const pipelineData = pipeline.byStatus;

  const capacityData = [
    {
      name: "Hours",
      Available: capacity.totalAvailableHours,
      Committed: capacity.committedHours,
      Logged: capacity.loggedHours,
    },
  ];

  const receivablesAgingData = [
    {
      name: "Current",
      Insurance: financial.receivablesAging.current.insurance,
      Customer: financial.receivablesAging.current.customer,
    },
    {
      name: "30+ Days",
      Insurance: financial.receivablesAging.over30.insurance,
      Customer: financial.receivablesAging.over30.customer,
    },
    {
      name: "60+ Days",
      Insurance: financial.receivablesAging.over60.insurance,
      Customer: financial.receivablesAging.over60.customer,
    },
    {
      name: "90+ Days",
      Insurance: financial.receivablesAging.over90.insurance,
      Customer: financial.receivablesAging.over90.customer,
    },
  ];

  const topServicesData = revenue.topServices.slice(0, 10);

  return (
    <div className={loading ? "opacity-60 pointer-events-none" : ""}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Shop Analytics</h1>
        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <MetricCard
          label="Total Revenue"
          value={formatPeso(overview.totalRevenue)}
          icon={DollarSign}
          color="bg-blue-50 text-blue-600"
          change={overview.revenueChangePercent}
        />
        <MetricCard
          label="Jobs Completed"
          value={String(overview.jobsCompleted)}
          icon={Briefcase}
          color="bg-green-50 text-green-600"
        />
        <MetricCard
          label="Avg Ticket"
          value={formatPeso(overview.avgTicketValue)}
          icon={Receipt}
          color="bg-purple-50 text-purple-600"
        />
        <MetricCard
          label="Cycle Time"
          value={`${overview.avgCycleTimeDays.toFixed(1)} days`}
          icon={Clock}
          color="bg-amber-50 text-amber-600"
        />
        <MetricCard
          label="Efficiency"
          value={overview.avgEfficiencyRatio.toFixed(2)}
          icon={Gauge}
          color={
            overview.avgEfficiencyRatio >= 1.0
              ? "bg-green-50 text-green-600"
              : overview.avgEfficiencyRatio >= 0.8
                ? "bg-amber-50 text-amber-600"
                : "bg-red-50 text-red-600"
          }
        />
        <MetricCard
          label="Utilization"
          value={`${capacity.utilizationRate.toFixed(1)}%`}
          icon={Activity}
          color="bg-cyan-50 text-cyan-600"
        />
        <MetricCard
          label="Receivables"
          value={formatPeso(financial.outstandingReceivables)}
          icon={BarChart3}
          color="bg-rose-50 text-rose-600"
        />
        <MetricCard
          label="Active Jobs"
          value={String(activeJobsTotal)}
          icon={Users}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue Trend */}
        <ChartCard title="Revenue Trend">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatAxisPeso} tick={{ fontSize: 12 }} />
              <Tooltip formatter={pesoFormatter} />
              <Legend />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Revenue by Category */}
        <ChartCard title="Revenue by Category">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByCategoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatAxisPeso} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="group"
                tick={{ fontSize: 12 }}
                width={90}
              />
              <Tooltip formatter={pesoFormatter} />
              <Bar dataKey="total" name="Revenue" radius={[0, 4, 4, 0]}>
                {revenueByCategoryData.map((_, index) => (
                  <Cell
                    key={`cat-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Job Pipeline */}
        <ChartCard title="Job Pipeline">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="status"
                tick={{ fontSize: 12 }}
                width={120}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Jobs"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Capacity Overview */}
        <ChartCard title="Capacity Overview">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={capacityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="Available"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Committed"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="Logged" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Receivables Aging */}
        <ChartCard title="Receivables Aging">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={receivablesAgingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatAxisPeso} tick={{ fontSize: 12 }} />
              <Tooltip formatter={pesoFormatter} />
              <Legend />
              <Bar
                dataKey="Insurance"
                stackId="a"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="Customer"
                stackId="a"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 6: Top Services */}
        <ChartCard title="Top Services">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topServicesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatAxisPeso} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="description"
                tick={{ fontSize: 11 }}
                width={150}
              />
              <Tooltip formatter={pesoFormatter} />
              <Bar
                dataKey="total"
                name="Revenue"
                fill="#8b5cf6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

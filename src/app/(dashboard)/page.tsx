import { getSession } from "@/lib/auth";
import {
  Wrench,
  ClipboardList,
  Clock,
  Receipt,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  const userName = session?.user?.firstName ?? "User";

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Good {getGreeting()}, {userName}
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Here&apos;s what&apos;s happening at the shop today.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          icon={Wrench}
          label="Active Jobs"
          value="—"
          color="text-blue-600 bg-blue-50"
        />
        <MetricCard
          icon={ClipboardList}
          label="Pending Estimates"
          value="—"
          color="text-accent-600 bg-accent-50"
        />
        <MetricCard
          icon={Clock}
          label="Techs Clocked In"
          value="—"
          color="text-emerald-600 bg-emerald-50"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Overdue Jobs"
          value="—"
          color="text-danger bg-danger-50"
        />
        <MetricCard
          icon={Receipt}
          label="Unpaid Invoices"
          value="—"
          color="text-purple-600 bg-purple-50"
        />
        <MetricCard
          icon={TrendingUp}
          label="Today's Revenue"
          value="—"
          color="text-success bg-success-50"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <h2 className="font-semibold text-primary mb-4">
            Recent Job Orders
          </h2>
          <p className="text-sm text-surface-400">
            Job orders will appear here once created. Coming in Phase 3.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <h2 className="font-semibold text-primary mb-4">
            Activity Feed
          </h2>
          <p className="text-sm text-surface-400">
            Real-time activity will appear here. Coming in Phase 5.
          </p>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-primary">{value}</p>
          <p className="text-xs text-surface-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import {
  Wrench,
  ClipboardList,
  Clock,
  Calendar,
  AlertTriangle,
  Receipt,
  TrendingUp,
  Car,
  Plus,
  BarChart3,
  PlayCircle,
  Search,
  FileText,
  CheckCircle2,
  User,
  Gauge,
} from "lucide-react";
import { formatPeso, formatDateTime } from "@/lib/utils";
import {
  JOB_ORDER_STATUS_LABELS,
  JOB_ORDER_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  type JobOrderStatus,
  type TaskStatus,
} from "@/types/enums";
import { TodaysAppointmentsWidget } from "@/components/schedule/todays-appointments-widget";
import type {
  DashboardMetrics,
  MyDashboardTechnician,
  MyDashboardAdvisor,
} from "@/lib/services/analytics";

interface DashboardClientProps {
  userName: string;
  userRole: string;
  isManager: boolean;
  data: DashboardMetrics | MyDashboardTechnician | MyDashboardAdvisor | null;
  todaysAppointments?: Array<{
    id: string;
    type: string;
    scheduledTime: string;
    status: string;
    customer: { firstName: string; lastName: string };
    vehicle?: { plateNumber: string; make: string; model: string } | null;
  }>;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ============================================================================
// Metric Card
// ============================================================================

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border ${alert ? "border-red-200" : "border-surface-200"} p-4`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p
            className={`font-mono text-xl font-bold ${alert ? "text-red-600" : "text-primary"}`}
          >
            {value}
          </p>
          <p className="text-xs text-surface-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Owner / Manager Dashboard
// ============================================================================

function ManagerDashboard({
  userName,
  data,
  todaysAppointments,
}: {
  userName: string;
  data: DashboardMetrics;
  todaysAppointments?: DashboardClientProps["todaysAppointments"];
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Good {getGreeting()}, {userName}
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Here&apos;s what&apos;s happening at the shop today.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-4">
        <MetricCard
          icon={Wrench}
          label="Active Jobs"
          value={data.activeJobs}
          color="text-blue-600 bg-blue-50"
        />
        <MetricCard
          icon={ClipboardList}
          label="Pending Estimates"
          value={data.pendingEstimates}
          color="text-accent-600 bg-accent-50"
        />
        <MetricCard
          icon={Clock}
          label="Techs Clocked In"
          value={data.clockedIn}
          color="text-emerald-600 bg-emerald-50"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Overdue Jobs"
          value={data.overdueCount}
          color={
            data.overdueCount > 0
              ? "text-red-600 bg-red-50"
              : "text-surface-400 bg-surface-50"
          }
          alert={data.overdueCount > 0}
        />
        <MetricCard
          icon={Receipt}
          label="Unpaid Invoices"
          value={data.unpaidInvoices}
          color="text-purple-600 bg-purple-50"
        />
        <MetricCard
          icon={TrendingUp}
          label="Today's Revenue"
          value={formatPeso(data.todayRevenue)}
          color="text-green-600 bg-green-50"
        />
        <MetricCard
          icon={Calendar}
          label="Today's Appts"
          value={todaysAppointments?.length || 0}
          color="text-indigo-600 bg-indigo-50"
        />
      </div>

      {/* Today's Snapshot */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <p className="text-sm text-surface-600">
          <span className="font-semibold text-primary">
            {data.checkedInToday}
          </span>{" "}
          checked in today{" "}
          <span className="text-surface-300 mx-1">&middot;</span>
          <span className="font-semibold text-primary">
            {data.releasedToday}
          </span>{" "}
          released today{" "}
          <span className="text-surface-300 mx-1">&middot;</span>
          <span className="font-semibold text-primary">
            {formatPeso(data.todayRevenue)}
          </span>{" "}
          received today
        </p>
      </div>

      {/* Overdue Alert */}
      {data.overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-medium text-red-700">
              {data.overdueCount} overdue job{data.overdueCount !== 1 ? "s" : ""}{" "}
              need{data.overdueCount === 1 ? "s" : ""} attention
            </p>
          </div>
          <button
            onClick={() => router.push("/jobs")}
            className="text-sm font-medium text-red-700 hover:text-red-800 underline"
          >
            View Jobs
          </button>
        </div>
      )}

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <h2 className="font-semibold text-primary mb-4">Recent Activity</h2>
          {data.recentActivities.length === 0 ? (
            <p className="text-sm text-surface-400">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {data.recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-surface-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-surface-700">
                      <span className="font-medium text-primary">
                        {activity.user.firstName} {activity.user.lastName}
                      </span>{" "}
                      {activity.title}
                    </p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {activity.jobOrder.jobOrderNumber} &middot;{" "}
                      {timeAgo(activity.createdAt as unknown as string)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <h2 className="font-semibold text-primary mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push("/estimates/new")}
              className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-50 flex items-center justify-center">
                <Plus className="w-4 h-4 text-accent-600" />
              </div>
              <span className="text-sm font-medium text-primary">
                New Inquiry
              </span>
            </button>
            <button
              onClick={() => router.push("/vehicles")}
              className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Search className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-primary">
                Search Vehicle
              </span>
            </button>
            <button
              onClick={() => router.push("/analytics")}
              className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-primary">
                View Analytics
              </span>
            </button>
            <button
              onClick={() => router.push("/jobs")}
              className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-primary">
                View Jobs
              </span>
            </button>
          </div>
        </div>

        {/* Today's Appointments */}
        <TodaysAppointmentsWidget appointments={todaysAppointments || []} />
      </div>
    </div>
  );
}

// ============================================================================
// Technician Dashboard
// ============================================================================

function TechnicianDashboard({
  userName,
  data,
}: {
  userName: string;
  data: MyDashboardTechnician;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Good {getGreeting()}, {userName}
        </h1>
      </div>

      {/* Clock Status */}
      {data.clockStatus.isClockedIn && data.clockStatus.currentEntry ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Currently clocked in to{" "}
                <span className="font-semibold">
                  {data.clockStatus.currentEntry.taskName}
                </span>{" "}
                on{" "}
                <span className="font-semibold">
                  {data.clockStatus.currentEntry.jobOrderNumber}
                </span>
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Since{" "}
                {formatDateTime(
                  data.clockStatus.currentEntry.clockIn as unknown as string
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-surface-400" />
              </div>
              <p className="text-sm text-surface-500">Not clocked in</p>
            </div>
            <button
              onClick={() => router.push("/clock")}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Clock
            </button>
          </div>
        </div>
      )}

      {/* My Tasks */}
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <h2 className="font-semibold text-primary mb-4">My Tasks</h2>
        {data.myTasks.length === 0 ? (
          <p className="text-sm text-surface-400">
            No active tasks assigned to you.
          </p>
        ) : (
          <div className="space-y-2">
            {(() => {
              // Group tasks by jobOrderNumber
              const grouped: Record<
                string,
                typeof data.myTasks
              > = {};
              for (const task of data.myTasks) {
                if (!grouped[task.jobOrderNumber]) {
                  grouped[task.jobOrderNumber] = [];
                }
                grouped[task.jobOrderNumber].push(task);
              }
              return Object.entries(grouped).map(([joNumber, tasks]) => (
                <div key={joNumber} className="border border-surface-100 rounded-lg overflow-hidden">
                  <div className="bg-surface-50 px-4 py-2">
                    <span className="text-xs font-mono font-semibold text-surface-600">
                      {joNumber}
                    </span>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => {
                          // Find any task to get its JO - navigate to tasks page
                          // We need the job ID, but we only have jobOrderNumber
                          // Navigate to jobs list as fallback
                          router.push("/jobs");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors text-left"
                      >
                        <span className="text-sm text-primary">
                          {task.name}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            TASK_STATUS_COLORS[task.status as TaskStatus] ??
                            "bg-surface-100 text-surface-600"
                          }`}
                        >
                          {TASK_STATUS_LABELS[task.status as TaskStatus] ??
                            task.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          icon={Clock}
          label="My Hours This Week"
          value={`${data.weekHours.toFixed(1)} hrs`}
          color="text-blue-600 bg-blue-50"
        />
        <MetricCard
          icon={Gauge}
          label="Efficiency This Month"
          value={`${(data.monthEfficiency * 100).toFixed(0)}%`}
          color={
            data.monthEfficiency >= 1
              ? "text-green-600 bg-green-50"
              : data.monthEfficiency >= 0.8
                ? "text-yellow-600 bg-yellow-50"
                : "text-red-600 bg-red-50"
          }
        />
      </div>
    </div>
  );
}

// ============================================================================
// Advisor Dashboard
// ============================================================================

function AdvisorDashboard({
  userName,
  data,
}: {
  userName: string;
  data: MyDashboardAdvisor;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Good {getGreeting()}, {userName}
        </h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          icon={ClipboardList}
          label="Pending Customer Approval"
          value={data.pendingApprovals}
          color="text-accent-600 bg-accent-50"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Ready for Release"
          value={data.readyForRelease}
          color="text-emerald-600 bg-emerald-50"
        />
      </div>

      {/* My Active Jobs */}
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <h2 className="font-semibold text-primary mb-4">My Active Jobs</h2>
        {data.myJobs.length === 0 ? (
          <p className="text-sm text-surface-400">No active jobs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase">
                    JO#
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase">
                    Customer
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase">
                    Vehicle
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-surface-400 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.myJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="hover:bg-surface-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold text-primary">
                      {job.jobOrderNumber}
                    </td>
                    <td className="py-2.5 px-3 text-surface-700">
                      {job.customerName}
                    </td>
                    <td className="py-2.5 px-3 text-surface-600">
                      {job.vehiclePlate}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          JOB_ORDER_STATUS_COLORS[
                            job.status as JobOrderStatus
                          ] ?? "bg-surface-100 text-surface-600"
                        }`}
                      >
                        {JOB_ORDER_STATUS_LABELS[
                          job.status as JobOrderStatus
                        ] ?? job.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <h2 className="font-semibold text-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/estimates/new")}
            className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-50 flex items-center justify-center">
              <Plus className="w-4 h-4 text-accent-600" />
            </div>
            <span className="text-sm font-medium text-primary">
              New Inquiry
            </span>
          </button>
          <button
            onClick={() => router.push("/jobs")}
            className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-primary">View Jobs</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Default / Fallback Dashboard
// ============================================================================

function DefaultDashboard({ userName }: { userName: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Good {getGreeting()}, {userName}
        </h1>
        <p className="text-sm text-surface-500 mt-1">Welcome to AutoServ Pro.</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Dashboard Client
// ============================================================================

export function DashboardClient({
  userName,
  userRole,
  isManager,
  data,
  todaysAppointments,
}: DashboardClientProps) {
  if (isManager && data) {
    return (
      <ManagerDashboard userName={userName} data={data as DashboardMetrics} todaysAppointments={todaysAppointments} />
    );
  }

  if (userRole === "TECHNICIAN" && data) {
    return (
      <TechnicianDashboard
        userName={userName}
        data={data as MyDashboardTechnician}
      />
    );
  }

  if (userRole === "ADVISOR" && data) {
    return (
      <AdvisorDashboard userName={userName} data={data as MyDashboardAdvisor} />
    );
  }

  return <DefaultDashboard userName={userName} />;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Car,
  DollarSign,
  Calendar,
  Clock,
  Wrench,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Timer,
  FileText,
  ListChecks,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { JobTimeline } from "@/components/jobs/job-timeline";
import { JobProfitabilityCard } from "@/components/jobs/job-profitability";
import { formatPeso, formatDate, formatPlateNumber, formatPhone } from "@/lib/utils";
import { JOB_STAGES } from "@/lib/constants";
import {
  JOB_ORDER_STATUS_LABELS,
  type JobOrderStatus,
} from "@/types/enums";
import type { getJobOrderDetail } from "@/lib/services/job-orders";

type JobOrderDetail = NonNullable<Awaited<ReturnType<typeof getJobOrderDetail>>>;

interface OverviewClientProps {
  jobOrder: JobOrderDetail;
  timeEntrySummary?: { totalMinutes: number; totalLaborCost: number };
  materialsCost?: number;
  activeTimers?: Array<{
    id: string;
    clockIn: string;
    technician: { firstName: string; lastName: string };
    task: { name: string };
  }>;
  supplementsSummary?: { count: number; totalAmount: number };
  activities?: { activities: Array<any>; nextCursor: string | null };
  latestQCInspection?: {
    id: string;
    overallResult: string;
    inspectionDate: string;
    inspector: { firstName: string; lastName: string };
    checklistItems: Array<{ status: string; inspectedAt: string | null; description: string }>;
  } | null;
  qcAttemptCount?: number;
  releaseRecord?: {
    id: string;
    releaseDate: string;
    completionReportToken: string | null;
    advisor: { firstName: string; lastName: string } | null;
    customerSatisfied: boolean;
  } | null;
  profitability?: {
    revenue: number;
    laborCost: number;
    materialsCost: number;
    subletCost: number;
    totalCost: number;
    grossProfit: number;
    marginPercent: number;
    estimateTotal: number;
    varianceAmount: number;
    variancePercent: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentStageIndex(status: string): number {
  for (let i = 0; i < JOB_STAGES.length; i++) {
    if ((JOB_STAGES[i].statuses as readonly string[]).includes(status)) {
      return i;
    }
  }
  return -1; // PENDING or CANCELLED — not in pipeline
}

function getDaysInShop(createdAt: Date | string, actualCompletionDate: Date | string | null): number {
  const start = new Date(createdAt);
  const end = actualCompletionDate ? new Date(actualCompletionDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function getEstimateGrandTotal(jobOrder: JobOrderDetail): number {
  if (!jobOrder.estimates?.length) return 0;
  // Get the latest estimate's latest version
  for (const estimate of jobOrder.estimates) {
    if (estimate.versions?.length) {
      return estimate.versions[0].grandTotal;
    }
  }
  return 0;
}

function getEstimatedHours(jobOrder: JobOrderDetail): number {
  if (!jobOrder.tasks?.length) return 0;
  return jobOrder.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
}

function getStatusActionLabel(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "Work in Progress";
    case "QC_PENDING":
      return "Awaiting QC Review";
    case "QC_PASSED":
      return "QC Passed";
    case "QC_FAILED_REWORK":
      return "Rework Required";
    case "AWAITING_PAYMENT":
      return "Awaiting Payment";
    case "PARTIAL_PAYMENT":
      return "Partial Payment Received";
    case "FULLY_PAID":
      return "Fully Paid";
    case "RELEASED":
      return "Vehicle Released";
    case "CANCELLED":
      return "Cancelled";
    default:
      return JOB_ORDER_STATUS_LABELS[status as JobOrderStatus] || status;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverviewClient({
  jobOrder,
  timeEntrySummary = { totalMinutes: 0, totalLaborCost: 0 },
  materialsCost = 0,
  activeTimers = [],
  supplementsSummary = { count: 0, totalAmount: 0 },
  activities,
  latestQCInspection = null,
  qcAttemptCount = 0,
  releaseRecord = null,
  profitability = null,
}: OverviewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentStageIndex = getCurrentStageIndex(jobOrder.status);
  const grandTotal = getEstimateGrandTotal(jobOrder);
  const estimatedHours = getEstimatedHours(jobOrder);
  const daysInShop = getDaysInShop(jobOrder.createdAt, jobOrder.actualCompletionDate);
  const actualHours = timeEntrySummary.totalMinutes / 60;
  const actualCost = timeEntrySummary.totalLaborCost + materialsCost;
  const efficiency = estimatedHours > 0 && actualHours > 0 ? (estimatedHours / actualHours) * 100 : 0;
  const totalTasks = jobOrder.tasks?.length ?? 0;
  const completedTasks = jobOrder.tasks?.filter((t: any) => t.status === "COMPLETED").length ?? 0;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  async function handleStartWork() {
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start work");
    }
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Status Pipeline */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          {JOB_STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;
            const isFuture = currentStageIndex < idx;
            const isLast = idx === JOB_STAGES.length - 1;

            return (
              <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                {/* Stage circle + label */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                      transition-all duration-300
                      ${isCompleted ? "bg-green-500 text-white" : ""}
                      ${isCurrent ? "bg-amber-500 text-white animate-pulse" : ""}
                      ${isFuture || currentStageIndex === -1 ? "bg-surface-200 text-surface-400" : ""}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center whitespace-nowrap
                      ${isCompleted ? "text-green-600" : ""}
                      ${isCurrent ? "text-amber-600" : ""}
                      ${isFuture || currentStageIndex === -1 ? "text-surface-400" : ""}
                    `}
                  >
                    {stage.label}
                  </span>
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={`
                      flex-1 h-0.5 mx-2 mt-[-1.25rem]
                      ${isCompleted ? "bg-green-500" : "bg-surface-200"}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Key Info Cards */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Customer & Vehicle */}
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3 md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <User className="w-4 h-4" />
            Customer & Vehicle
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-primary">
              {jobOrder.customer.firstName} {jobOrder.customer.lastName}
            </p>
            {jobOrder.customer.phone && (
              <p className="text-sm text-surface-500">
                {formatPhone(jobOrder.customer.phone)}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Car className="w-4 h-4 text-surface-400" />
              <span className="text-sm font-medium text-primary">
                {formatPlateNumber(jobOrder.vehicle.plateNumber)}
              </span>
            </div>
            <p className="text-sm text-surface-500">
              {jobOrder.vehicle.year && `${jobOrder.vehicle.year} `}
              {jobOrder.vehicle.make} {jobOrder.vehicle.model}
              {jobOrder.vehicle.color && (
                <span className="text-surface-400"> &middot; {jobOrder.vehicle.color}</span>
              )}
            </p>
          </div>
        </div>

        {/* Estimate Total */}
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <DollarSign className="w-4 h-4" />
            Estimate Total
          </div>
          <p className="text-lg font-semibold text-primary">
            {grandTotal > 0 ? formatPeso(grandTotal) : "No estimate"}
          </p>
        </div>

        {/* Assigned Technician */}
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <Wrench className="w-4 h-4" />
            Assigned Technician
          </div>
          <p className="text-lg font-semibold text-primary">
            {jobOrder.primaryTechnician
              ? `${jobOrder.primaryTechnician.firstName} ${jobOrder.primaryTechnician.lastName}`
              : "Unassigned"}
          </p>
        </div>

        {/* Target Date */}
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <Calendar className="w-4 h-4" />
            Target Date
          </div>
          <p className="text-lg font-semibold text-primary">
            {jobOrder.targetCompletionDate
              ? formatDate(jobOrder.targetCompletionDate)
              : "Not set"}
          </p>
        </div>

        {/* Priority */}
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <AlertTriangle className="w-4 h-4" />
            Priority
          </div>
          <div>
            <PriorityBadge priority={jobOrder.priority} />
          </div>
        </div>

        {/* Days in Shop */}
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <Clock className="w-4 h-4" />
            Days in Shop
          </div>
          <p className="text-lg font-semibold text-primary">
            {daysInShop} {daysInShop === 1 ? "day" : "days"}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick Stats Row */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <Timer className="w-4 h-4" />
            Estimated Hours
          </div>
          <p className="text-lg font-semibold text-primary">
            {estimatedHours > 0 ? `${estimatedHours.toFixed(1)} hrs` : "0 hrs"}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <Clock className="w-4 h-4" />
            Actual Hours
          </div>
          <p className={`text-lg font-semibold ${actualHours > 0 ? "text-primary" : "text-surface-400"}`}>
            {actualHours > 0 ? `${actualHours.toFixed(1)} hrs` : "0 hrs"}
          </p>
          {estimatedHours > 0 && actualHours > 0 && (
            <p className={`text-xs ${actualHours <= estimatedHours ? "text-green-600" : "text-amber-600"}`}>
              {actualHours <= estimatedHours ? "On track" : `${(actualHours - estimatedHours).toFixed(1)} hrs over estimate`}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <DollarSign className="w-4 h-4" />
            Actual Cost
          </div>
          <p className={`text-lg font-semibold ${actualCost > 0 ? "text-primary" : "text-surface-400"}`}>
            {actualCost > 0 ? formatPeso(actualCost) : formatPeso(0)}
          </p>
          {grandTotal > 0 && actualCost > 0 && (
            <p className={`text-xs ${actualCost <= grandTotal ? "text-green-600" : "text-amber-600"}`}>
              {actualCost <= grandTotal
                ? `${((actualCost / grandTotal) * 100).toFixed(0)}% of estimate`
                : `${formatPeso(actualCost - grandTotal)} over estimate`}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
            <Shield className="w-4 h-4" />
            Efficiency
          </div>
          {efficiency > 0 ? (
            <>
              <p className={`text-lg font-semibold ${efficiency >= 100 ? "text-green-600" : efficiency >= 80 ? "text-amber-600" : "text-red-600"}`}>
                {efficiency.toFixed(0)}%
              </p>
              <p className="text-xs text-surface-400">
                {efficiency >= 100 ? "Ahead of schedule" : "Behind schedule"}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-surface-400">&mdash;</p>
              <p className="text-xs text-surface-400">Available when time tracking is active</p>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tasks Progress */}
      {/* ------------------------------------------------------------------ */}
      {totalTasks > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-surface-500 font-medium">
              <ListChecks className="w-4 h-4" />
              Tasks Progress
            </div>
            <span className="text-sm font-semibold text-primary">
              {completedTasks} of {totalTasks} complete
            </span>
          </div>
          <div className="w-full bg-surface-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                taskProgress === 100 ? "bg-green-500" : "bg-amber-500"
              }`}
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* QC Summary */}
      {/* ------------------------------------------------------------------ */}
      {!latestQCInspection ? (
        <div className="bg-surface-50 border border-surface-200 rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-100">
              <Clock className="w-5 h-5 text-surface-400" />
            </div>
            <p className="text-sm font-semibold text-surface-500">QC Not Started</p>
          </div>
        </div>
      ) : latestQCInspection.overallResult === "PENDING" ? (
        (() => {
          const totalItems = latestQCInspection.checklistItems.length;
          const inspectedItems = latestQCInspection.checklistItems.filter((item) => item.inspectedAt !== null).length;
          const inspectionProgress = totalItems > 0 ? (inspectedItems / totalItems) * 100 : 0;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    QC In Progress — Inspection #{qcAttemptCount}
                  </p>
                  <p className="text-xs text-amber-600">
                    Inspector: {latestQCInspection.inspector.firstName} {latestQCInspection.inspector.lastName}
                  </p>
                </div>
              </div>
              {totalItems > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-amber-700">
                    <span>{inspectedItems} of {totalItems} items inspected</span>
                    <span>{inspectionProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-amber-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${inspectionProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : latestQCInspection.overallResult === "PASS" ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">
                QC Passed
              </p>
              <p className="text-xs text-green-600">
                {latestQCInspection.inspector.firstName} {latestQCInspection.inspector.lastName}
                {" — "}
                {formatDate(latestQCInspection.inspectionDate)}
                {(qcAttemptCount ?? 0) > 1 && (
                  <span className="ml-2 text-green-500">Attempt #{qcAttemptCount}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : latestQCInspection.overallResult === "FAIL" ? (
        (() => {
          const failedItems = latestQCInspection.checklistItems.filter((item) => item.status === "FAIL");
          return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    QC Failed — {failedItems.length} {failedItems.length === 1 ? "item needs" : "items need"} rework
                  </p>
                  <p className="text-xs text-red-600">
                    {latestQCInspection.inspector.firstName} {latestQCInspection.inspector.lastName}
                    {" — "}
                    {formatDate(latestQCInspection.inspectionDate)}
                  </p>
                </div>
              </div>
              {failedItems.length > 0 && (
                <ul className="ml-13 space-y-1">
                  {failedItems.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="text-xs text-red-700 flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                      {item.description}
                    </li>
                  ))}
                  {failedItems.length > 5 && (
                    <li className="text-xs text-red-500">
                      ...and {failedItems.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })()
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Release Summary */}
      {/* ------------------------------------------------------------------ */}
      {releaseRecord ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Vehicle Released
                </p>
                <p className="text-xs text-green-600">
                  {formatDate(releaseRecord.releaseDate)}
                  {releaseRecord.advisor && (
                    <> · {releaseRecord.advisor.firstName} {releaseRecord.advisor.lastName}</>
                  )}
                </p>
              </div>
            </div>
            {releaseRecord.completionReportToken && (
              <button
                onClick={() => router.push(`/jobs/${jobOrder.id}/release/report`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                View Report
              </button>
            )}
          </div>
        </div>
      ) : jobOrder.status === "FULLY_PAID" ? (
        <div className="bg-surface-50 border border-surface-200 rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-100">
              <Clock className="w-5 h-5 text-surface-400" />
            </div>
            <p className="text-sm font-semibold text-surface-500">Pending Release</p>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Job Profitability (Owner/Manager only) */}
      {/* ------------------------------------------------------------------ */}
      {profitability && (
        <JobProfitabilityCard data={profitability} />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Active Timers */}
      {/* ------------------------------------------------------------------ */}
      {activeTimers.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            Work In Progress
          </div>
          <div className="space-y-2">
            {activeTimers.map((timer) => (
              <div key={timer.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-green-800">
                  {timer.technician.firstName} {timer.technician.lastName}
                </span>
                <span className="text-green-600">on</span>
                <span className="font-medium text-green-800">{timer.task.name}</span>
                <span className="text-green-500 text-xs">
                  since {new Date(timer.clockIn).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Supplemental Estimates */}
      {/* ------------------------------------------------------------------ */}
      {supplementsSummary.count > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-800">
                {supplementsSummary.count} supplemental {supplementsSummary.count === 1 ? "estimate" : "estimates"}
              </p>
              <p className="text-sm text-purple-600">
                {formatPeso(supplementsSummary.totalAmount)} total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Action Buttons */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        {error && (
          <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {jobOrder.status === "CHECKED_IN" ? (
          <button
            onClick={handleStartWork}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-60"
          >
            <PlayCircle className="w-4 h-4" />
            {isPending ? "Starting..." : "Start Work"}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-lg bg-surface-100 px-5 py-2.5 text-sm font-medium text-surface-600">
            <CheckCircle2 className="w-4 h-4" />
            {getStatusActionLabel(jobOrder.status)}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Activity Timeline */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-surface-400" />
          Activity Timeline
        </h3>
        <JobTimeline
          jobOrderId={jobOrder.id}
          initialActivities={activities?.activities}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    NORMAL: { bg: "bg-surface-100", text: "text-surface-600", label: "Normal" },
    RUSH: { bg: "bg-amber-100", text: "text-amber-700", label: "Rush" },
    INSURANCE: { bg: "bg-blue-100", text: "text-blue-700", label: "Insurance" },
  };

  const { bg, text, label } = config[priority] || config.NORMAL;

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Coins,
  ChevronDown,
  ChevronRight,
  Printer,
  Download,
  AlertTriangle,
} from "lucide-react";
import { formatPeso, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  COMMISSION_PERIOD_STATUS_LABELS,
  COMMISSION_PERIOD_STATUS_COLORS,
  type CommissionPeriodStatus,
} from "@/types/enums";
import {
  previewCommissionAction,
  createCommissionPeriodAction,
  finalizeCommissionPeriodAction,
  markCommissionPaidAction,
  setCommissionRateAction,
} from "@/lib/actions/commission-actions";
import { SlideOver } from "@/components/ui/slide-over";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TechJobEntry {
  jobOrderId: string;
  jobNumber: string;
  vehicle: string;
  customerName: string;
  laborBilled: number;
  commissionRate: number;
  commissionAmount: number;
  completedDate: string;
}

interface TechCommission {
  user: { id: string; name: string; nickname: string };
  jobs: TechJobEntry[];
  totalLaborBilled: number;
  commissionRate: number;
  totalCommission: number;
}

interface PreviewData {
  entries: TechCommission[];
  unassignedLabor: number;
  grandTotalLabor: number;
  grandTotalCommission: number;
  periodStart: string;
  periodEnd: string;
}

interface Period {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalCommission: number;
  notes: string | null;
  finalizedAt: string | null;
  createdAt: string;
  _count: { entries: number };
}

interface RateEntry {
  user: { id: string; firstName: string; lastName: string; username: string };
  rate: number;
  effectiveFrom: string | null;
}

interface CommissionsClientProps {
  initialPeriods: Period[];
  initialRates: RateEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getWeekRange(offset: number = 0): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function formatPeriodRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sMonth = s.toLocaleDateString("en-PH", { month: "short", timeZone: "Asia/Manila" });
  const eMonth = e.toLocaleDateString("en-PH", { month: "short", timeZone: "Asia/Manila" });
  const sDay = s.getDate();
  const eDay = e.getDate();
  const eYear = e.getFullYear();
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay}-${eDay}, ${eYear}`;
  }
  return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${eYear}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CommissionsClient({
  initialPeriods,
  initialRates,
}: CommissionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Calculator state
  const thisWeek = getWeekRange(0);
  const [periodStart, setPeriodStart] = useState(thisWeek.start);
  const [periodEnd, setPeriodEnd] = useState(thisWeek.end);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Period list
  const [periods] = useState(initialPeriods);

  // Expand/collapse tech rows
  const [expandedTechs, setExpandedTechs] = useState<Set<string>>(new Set());

  // Confirm dialogs
  const [confirmFinalize, setConfirmFinalize] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<string | null>(null);

  // Rate edit
  const [editRate, setEditRate] = useState<RateEntry | null>(null);
  const [rateValue, setRateValue] = useState("");
  const [rateNotes, setRateNotes] = useState("");
  const [showRates, setShowRates] = useState(false);

  // Quick select
  const handleQuickSelect = useCallback(
    (offset: number) => {
      const range = getWeekRange(offset);
      setPeriodStart(range.start);
      setPeriodEnd(range.end);
      setPreview(null);
    },
    []
  );

  // Preview
  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await previewCommissionAction({
        periodStart: new Date(periodStart + "T00:00:00").toISOString(),
        periodEnd: new Date(periodEnd + "T23:59:59").toISOString(),
      });
      if (result.success && result.data) {
        setPreview(result.data as unknown as PreviewData);
        setExpandedTechs(new Set());
      } else {
        toast.error(result.error || "Failed to calculate");
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [periodStart, periodEnd]);

  // Generate & Save
  const handleGenerate = useCallback(() => {
    startTransition(async () => {
      const result = await createCommissionPeriodAction({
        periodStart: new Date(periodStart + "T00:00:00").toISOString(),
        periodEnd: new Date(periodEnd + "T23:59:59").toISOString(),
      });
      if (result.success) {
        toast.success("Commission period created");
        setPreview(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create period");
      }
    });
  }, [periodStart, periodEnd, router]);

  // Finalize
  const handleFinalize = useCallback(
    (periodId: string) => {
      startTransition(async () => {
        const result = await finalizeCommissionPeriodAction(periodId);
        if (result.success) {
          toast.success("Period finalized");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to finalize");
        }
        setConfirmFinalize(null);
      });
    },
    [router]
  );

  // Mark Paid
  const handleMarkPaid = useCallback(
    (periodId: string) => {
      startTransition(async () => {
        const result = await markCommissionPaidAction(periodId);
        if (result.success) {
          toast.success("Period marked as paid");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to mark paid");
        }
        setConfirmPaid(null);
      });
    },
    [router]
  );

  // Toggle tech row
  const toggleTech = useCallback((techId: string) => {
    setExpandedTechs((prev) => {
      const next = new Set(prev);
      if (next.has(techId)) next.delete(techId);
      else next.add(techId);
      return next;
    });
  }, []);

  // Save rate
  const handleSaveRate = useCallback(() => {
    if (!editRate) return;
    startTransition(async () => {
      const result = await setCommissionRateAction({
        userId: editRate.user.id,
        rate: parseFloat(rateValue),
        notes: rateNotes || null,
      });
      if (result.success) {
        toast.success(`Rate updated for ${editRate.user.firstName}`);
        setEditRate(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update rate");
      }
    });
  }, [editRate, rateValue, rateNotes, router]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (!preview) return;
    const rows = [
      ["Technician", "Rate %", "Jobs", "Labor Billed", "Commission"],
    ];
    for (const tech of preview.entries) {
      rows.push([
        tech.user.nickname,
        tech.commissionRate.toString(),
        tech.jobs.length.toString(),
        (tech.totalLaborBilled / 100).toFixed(2),
        (tech.totalCommission / 100).toFixed(2),
      ]);
      for (const job of tech.jobs) {
        rows.push([
          `  ${job.jobNumber}`,
          "",
          job.vehicle,
          (job.laborBilled / 100).toFixed(2),
          (job.commissionAmount / 100).toFixed(2),
        ]);
      }
    }
    rows.push([]);
    rows.push([
      "TOTAL",
      "",
      "",
      (preview.grandTotalLabor / 100).toFixed(2),
      (preview.grandTotalCommission / 100).toFixed(2),
    ]);

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions-${periodStart}-to-${periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preview, periodStart, periodEnd]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-surface-900">Commissions</h1>
        </div>
        <button
          onClick={() => setShowRates(!showRates)}
          className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
        >
          {showRates ? "Hide Rates" : "Commission Rates"}
        </button>
      </div>

      {/* Commission Rates Panel */}
      {showRates && (
        <div className="rounded-lg border border-surface-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Commission Rates
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-surface-500">
                  <th className="pb-2 font-medium">Technician</th>
                  <th className="pb-2 font-medium text-right">Current Rate</th>
                  <th className="pb-2 font-medium">Since</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {initialRates.map((r) => (
                  <tr key={r.user.id}>
                    <td className="py-2.5 font-medium text-surface-900">
                      {r.user.firstName}
                      {r.user.lastName !== "." ? ` ${r.user.lastName}` : ""}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {r.rate}%
                    </td>
                    <td className="py-2.5 text-surface-500">
                      {r.effectiveFrom
                        ? formatDate(r.effectiveFrom)
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => {
                          setEditRate(r);
                          setRateValue(r.rate.toString());
                          setRateNotes("");
                        }}
                        className="text-sm font-medium text-primary hover:text-primary/80"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calculator */}
      <div className="rounded-lg border border-surface-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-surface-900 mb-4">
          Commission Calculator
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">
              Period Start
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-surface-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">
              Period End
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-surface-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickSelect(0)}
              className="rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
            >
              This Week
            </button>
            <button
              onClick={() => handleQuickSelect(-1)}
              className="rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
            >
              Last Week
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={previewLoading || isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {previewLoading ? "Calculating..." : "Preview Commission"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-primary hover:bg-accent/90 disabled:opacity-50"
            >
              Generate & Save
            </button>
          </div>
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="rounded-lg border border-surface-200 bg-white">
          <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-surface-900">
              Commission Preview:{" "}
              {formatPeriodRange(preview.periodStart, preview.periodEnd)}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 rounded-lg border border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {preview.unassignedLabor > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 px-5 py-3 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <span>
                {formatPeso(preview.unassignedLabor)} in labor has no
                technician assigned
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-surface-500">
                  <th className="px-5 py-3 font-medium w-8" />
                  <th className="px-3 py-3 font-medium">Technician</th>
                  <th className="px-3 py-3 font-medium text-right">Rate</th>
                  <th className="px-3 py-3 font-medium text-right">Jobs</th>
                  <th className="px-3 py-3 font-medium text-right">
                    Labor Billed
                  </th>
                  <th className="px-5 py-3 font-medium text-right">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {preview.entries.map((tech) => (
                  <TechRow
                    key={tech.user.id}
                    tech={tech}
                    expanded={expandedTechs.has(tech.user.id)}
                    onToggle={() => toggleTech(tech.user.id)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-300 bg-surface-50 font-semibold">
                  <td className="px-5 py-3" />
                  <td className="px-3 py-3 text-surface-900">TOTAL</td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 text-right font-mono text-surface-900">
                    {preview.entries.reduce(
                      (s, e) => s + e.jobs.length,
                      0
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-surface-900">
                    {formatPeso(preview.grandTotalLabor)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-surface-900">
                    {formatPeso(preview.grandTotalCommission)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Saved Periods */}
      <div className="rounded-lg border border-surface-200 bg-white">
        <div className="border-b border-surface-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-surface-900">
            Commission Periods
          </h2>
        </div>

        {periods.length === 0 ? (
          <div className="px-5 py-12 text-center text-surface-500">
            No commission periods yet. Use the calculator above to generate one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-surface-500">
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-right">
                    Total Commission
                  </th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-medium text-surface-900">
                      {formatPeriodRange(p.periodStart, p.periodEnd)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          COMMISSION_PERIOD_STATUS_COLORS[
                            p.status as CommissionPeriodStatus
                          ] ?? ""
                        }`}
                      >
                        {COMMISSION_PERIOD_STATUS_LABELS[
                          p.status as CommissionPeriodStatus
                        ] ?? p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-surface-900">
                      {formatPeso(p.totalCommission)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/commissions/print/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:text-primary/80"
                        >
                          <Printer className="w-4 h-4 inline mr-1" />
                          Print
                        </a>
                        {p.status === "DRAFT" && (
                          <button
                            onClick={() => setConfirmFinalize(p.id)}
                            disabled={isPending}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            Finalize
                          </button>
                        )}
                        {p.status === "FINALIZED" && (
                          <button
                            onClick={() => setConfirmPaid(p.id)}
                            disabled={isPending}
                            className="text-sm font-medium text-green-600 hover:text-green-700"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rate Edit SlideOver */}
      <SlideOver
        open={!!editRate}
        onClose={() => setEditRate(null)}
        title={`Edit Commission Rate — ${editRate?.user.firstName ?? ""}`}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setEditRate(null)}
              className="flex-1 rounded-lg border border-surface-300 px-4 py-2.5 text-sm font-medium text-surface-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRate}
              disabled={isPending}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Rate"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-5">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Commission Rate (%)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={rateNotes}
              onChange={(e) => setRateNotes(e.target.value)}
              placeholder="e.g., Promoted to senior"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
            />
          </div>
          {editRate && (
            <p className="text-xs text-surface-500">
              Current rate: {editRate.rate}%
              {editRate.effectiveFrom && (
                <> since {formatDate(editRate.effectiveFrom)}</>
              )}
            </p>
          )}
        </div>
      </SlideOver>

      {/* Confirm Finalize */}
      <ConfirmDialog
        open={!!confirmFinalize}
        onClose={() => setConfirmFinalize(null)}
        onConfirm={() => confirmFinalize && handleFinalize(confirmFinalize)}
        title="Finalize Commission Period"
        message="This will lock the commission amounts. No further edits can be made. Proceed?"
        confirmLabel="Finalize"
        variant="warning"
        loading={isPending}
      />

      {/* Confirm Mark Paid */}
      <ConfirmDialog
        open={!!confirmPaid}
        onClose={() => setConfirmPaid(null)}
        onConfirm={() => confirmPaid && handleMarkPaid(confirmPaid)}
        title="Mark as Paid"
        message="This records that commission payouts have been made. Proceed?"
        confirmLabel="Mark Paid"
        variant="warning"
        loading={isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tech Row (expandable)
// ---------------------------------------------------------------------------
function TechRow({
  tech,
  expanded,
  onToggle,
}: {
  tech: TechCommission;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-surface-50"
        onClick={onToggle}
      >
        <td className="px-5 py-3 text-surface-400">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
        <td className="px-3 py-3 font-medium text-surface-900">
          {tech.user.nickname}
        </td>
        <td className="px-3 py-3 text-right font-mono">
          {tech.commissionRate === -1 ? "Mixed" : `${tech.commissionRate}%`}
        </td>
        <td className="px-3 py-3 text-right font-mono">
          {tech.jobs.length}
        </td>
        <td className="px-3 py-3 text-right font-mono">
          {formatPeso(tech.totalLaborBilled)}
        </td>
        <td className="px-5 py-3 text-right font-mono font-semibold">
          {formatPeso(tech.totalCommission)}
        </td>
      </tr>
      {expanded &&
        tech.jobs.map((job, i) => (
          <tr
            key={`${tech.user.id}-${job.jobOrderId}-${i}`}
            className="bg-surface-50"
          >
            <td className="px-5 py-2" />
            <td className="px-3 py-2 text-surface-500 text-xs" colSpan={2}>
              <span className="font-mono">{job.jobNumber}</span>
              <span className="ml-2">{job.vehicle}</span>
              <span className="ml-2 text-surface-400">{job.customerName}</span>
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right font-mono text-xs text-surface-600">
              {formatPeso(job.laborBilled)}
            </td>
            <td className="px-5 py-2 text-right font-mono text-xs text-surface-600">
              {formatPeso(job.commissionAmount)}
            </td>
          </tr>
        ))}
    </>
  );
}

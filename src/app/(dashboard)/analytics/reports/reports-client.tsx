"use client";

import { useState, useCallback } from "react";
import {
  DollarSign,
  Clock,
  BarChart3,
  Users,
  TrendingUp,
  Package,
  UserCheck,
  Shield,
  Building2,
  FileDown,
  Printer,
  Loader2,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { cn, formatPeso, formatDate } from "@/lib/utils";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import {
  generateDailySalesAction,
  generateReceivablesAgingAction,
  generateJobStatusAction,
  generateTechUtilizationAction,
  generateServiceRevenueAction,
  generatePartsUsageAction,
  generateCustomerReportAction,
  generateWarrantyClaimsAction,
  generateInsuranceReceivablesAction,
} from "@/lib/actions/report-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportType =
  | "daily_sales"
  | "receivables_aging"
  | "job_status"
  | "tech_utilization"
  | "service_revenue"
  | "parts_usage"
  | "customer"
  | "warranty_claims"
  | "insurance_receivables";

interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  hasDateRange: boolean;
  hasDatePicker: boolean;
  supportsCsv: boolean;
}

const REPORT_DEFINITIONS: ReportDefinition[] = [
  { type: "daily_sales", title: "Daily Sales", description: "All payments received for a specific day", icon: DollarSign, hasDateRange: false, hasDatePicker: true, supportsCsv: true },
  { type: "receivables_aging", title: "Receivables Aging", description: "Unpaid invoices grouped by age", icon: Clock, hasDateRange: false, hasDatePicker: false, supportsCsv: true },
  { type: "job_status", title: "Job Status Summary", description: "Jobs per stage with overdue list", icon: BarChart3, hasDateRange: true, hasDatePicker: false, supportsCsv: false },
  { type: "tech_utilization", title: "Technician Utilization", description: "Hours and utilization per technician", icon: Users, hasDateRange: true, hasDatePicker: false, supportsCsv: true },
  { type: "service_revenue", title: "Service Revenue", description: "Revenue by service category", icon: TrendingUp, hasDateRange: true, hasDatePicker: false, supportsCsv: true },
  { type: "parts_usage", title: "Parts Usage", description: "Top parts by cost and frequency", icon: Package, hasDateRange: true, hasDatePicker: false, supportsCsv: true },
  { type: "customer", title: "Customer Report", description: "Top customers by spend", icon: UserCheck, hasDateRange: true, hasDatePicker: false, supportsCsv: true },
  { type: "warranty_claims", title: "Warranty Claims", description: "Claims filed within period", icon: Shield, hasDateRange: true, hasDatePicker: false, supportsCsv: false },
  { type: "insurance_receivables", title: "Insurance Receivables", description: "Outstanding insurance payments", icon: Building2, hasDateRange: false, hasDatePicker: false, supportsCsv: true },
];

// ---------------------------------------------------------------------------
// CSV Export Helper
// ---------------------------------------------------------------------------

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ReportsClient() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any>(null);
  const [reportMeta, setReportMeta] = useState<{ title: string; dateInfo: string } | null>(null);

  // Date parameters
  const [singleDate, setSingleDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    };
  });

  const selectedDef = REPORT_DEFINITIONS.find((r) => r.type === selectedReport) ?? null;

  // ---------------------------------------------------------------------------
  // Generate Report
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!selectedReport || !selectedDef) return;
    setLoading(true);
    setError(null);
    setReportData(null);
    setReportMeta(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: { success: boolean; data?: any; error?: string };

      switch (selectedReport) {
        case "daily_sales":
          result = await generateDailySalesAction(singleDate);
          break;
        case "receivables_aging":
          result = await generateReceivablesAgingAction();
          break;
        case "job_status":
          result = await generateJobStatusAction({ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() });
          break;
        case "tech_utilization":
          result = await generateTechUtilizationAction({ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() });
          break;
        case "service_revenue":
          result = await generateServiceRevenueAction({ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() });
          break;
        case "parts_usage":
          result = await generatePartsUsageAction({ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() });
          break;
        case "customer":
          result = await generateCustomerReportAction({ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() });
          break;
        case "warranty_claims":
          result = await generateWarrantyClaimsAction({ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() });
          break;
        case "insurance_receivables":
          result = await generateInsuranceReceivablesAction();
          break;
        default:
          result = { success: false, error: "Unknown report type" };
      }

      if (!result.success) {
        setError(result.error ?? "Failed to generate report");
      } else {
        setReportData(result.data);
        // Build meta
        let dateInfo = "";
        if (selectedDef.hasDatePicker) {
          dateInfo = formatDate(new Date(singleDate));
        } else if (selectedDef.hasDateRange) {
          dateInfo = `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
        } else {
          dateInfo = `As of ${formatDate(new Date())}`;
        }
        setReportMeta({ title: selectedDef.title, dateInfo });
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedReport, selectedDef, singleDate, dateRange]);

  // ---------------------------------------------------------------------------
  // CSV Export
  // ---------------------------------------------------------------------------

  const handleExportCSV = useCallback(() => {
    if (!reportData || !selectedDef) return;
    const filename = `${selectedDef.type}_${new Date().toISOString().slice(0, 10)}.csv`;

    // Flatten report data into rows for CSV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: Record<string, unknown>[] = [];

    switch (selectedReport) {
      case "daily_sales":
        rows = (reportData.payments ?? []).map((p: Record<string, unknown>) => ({
          Time: p.time,
          "Invoice #": p.invoiceNumber,
          Customer: p.customerName,
          Vehicle: p.vehicle,
          Method: p.method,
          Amount: typeof p.amount === "number" ? formatPeso(p.amount) : p.amount,
          "Received By": p.receivedBy,
        }));
        break;
      case "receivables_aging":
        rows = (reportData.invoices ?? []).map((inv: Record<string, unknown>) => ({
          "Invoice #": inv.invoiceNumber,
          Customer: inv.customerName,
          Vehicle: inv.vehicle,
          Date: inv.date,
          Total: typeof inv.total === "number" ? formatPeso(inv.total) : inv.total,
          Paid: typeof inv.paid === "number" ? formatPeso(inv.paid) : inv.paid,
          Balance: typeof inv.balance === "number" ? formatPeso(inv.balance) : inv.balance,
          "Age (days)": inv.ageDays,
          Type: inv.type,
        }));
        break;
      case "tech_utilization":
        rows = (reportData.technicians ?? []).map((t: Record<string, unknown>) => ({
          Name: t.name,
          Role: t.role,
          "Available Hrs": t.availableHours,
          "Logged Hrs": t.loggedHours,
          "Utilization %": t.utilizationPct,
          "Overtime Hrs": t.overtimeHours,
        }));
        break;
      case "service_revenue":
        rows = (reportData.categories ?? []).map((c: Record<string, unknown>) => ({
          Category: c.category,
          Revenue: typeof c.revenue === "number" ? formatPeso(c.revenue) : c.revenue,
          Jobs: c.jobCount,
          "Avg Price": typeof c.avgPrice === "number" ? formatPeso(c.avgPrice) : c.avgPrice,
        }));
        break;
      case "parts_usage":
        rows = (reportData.parts ?? []).map((p: Record<string, unknown>) => ({
          Description: p.description,
          "Part #": p.partNumber,
          Qty: p.quantity,
          "Total Cost": typeof p.totalCost === "number" ? formatPeso(p.totalCost) : p.totalCost,
          "Times Used": p.timesUsed,
        }));
        break;
      case "customer":
        rows = (reportData.customers ?? []).map((c: Record<string, unknown>) => ({
          Customer: c.name,
          Jobs: c.jobCount,
          "Total Spend": typeof c.totalSpend === "number" ? formatPeso(c.totalSpend) : c.totalSpend,
          Type: c.customerType,
        }));
        break;
      case "insurance_receivables":
        rows = (reportData.receivables ?? []).map((r: Record<string, unknown>) => ({
          Company: r.company,
          "Invoice #": r.invoiceNumber,
          Customer: r.customerName,
          Total: typeof r.total === "number" ? formatPeso(r.total) : r.total,
          Paid: typeof r.paid === "number" ? formatPeso(r.paid) : r.paid,
          Balance: typeof r.balance === "number" ? formatPeso(r.balance) : r.balance,
          "Age (days)": r.ageDays,
        }));
        break;
    }

    downloadCSV(rows, filename);
  }, [reportData, selectedDef, selectedReport]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; max-width: 100% !important; }
          body { font-size: 12px; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print">
        <h1 className="text-2xl font-bold text-surface-900">Reports</h1>
        <p className="text-sm text-surface-500 mt-1">Generate and export business reports</p>
      </div>

      {/* Report Selector Grid */}
      <div className="no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_DEFINITIONS.map((def) => {
            const Icon = def.icon;
            const isSelected = selectedReport === def.type;
            return (
              <button
                key={def.type}
                onClick={() => {
                  setSelectedReport(def.type);
                  setReportData(null);
                  setReportMeta(null);
                  setError(null);
                }}
                className={cn(
                  "bg-white rounded-xl border p-4 cursor-pointer hover:border-accent-300 transition-colors text-left",
                  isSelected
                    ? "border-accent ring-2 ring-accent-200"
                    : "border-surface-200"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-accent-50 text-accent" : "bg-surface-50 text-surface-400"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{def.title}</h3>
                    <p className="text-xs text-surface-500 mt-0.5">{def.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameters Bar */}
      {selectedDef && (
        <div className="no-print bg-white rounded-xl border border-surface-200 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Single date picker */}
            {selectedDef.hasDatePicker && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-surface-400" />
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-300"
                />
              </div>
            )}

            {/* Date range picker */}
            {selectedDef.hasDateRange && (
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
              />
            )}

            {/* No date parameters needed */}
            {!selectedDef.hasDatePicker && !selectedDef.hasDateRange && (
              <span className="text-sm text-surface-500">No date parameters required</span>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="ml-auto px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Report
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Report Output */}
      {reportMeta && reportData && (
        <div className="bg-white rounded-xl border border-surface-200 print-full">
          {/* Report Header */}
          <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-surface-900">{reportMeta.title}</h2>
              <p className="text-xs text-surface-500 mt-0.5">{reportMeta.dateInfo}</p>
            </div>
            <div className="no-print flex items-center gap-2">
              {selectedDef?.supportsCsv && (
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors flex items-center gap-1.5"
                >
                  <FileDown className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="p-6">
            <ReportTable type={selectedReport!} data={reportData} />
          </div>
        </div>
      )}

      {/* Empty state when no report selected */}
      {!selectedReport && (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-surface-300 mx-auto" />
          <p className="mt-3 text-sm text-surface-500">Select a report type above to get started</p>
        </div>
      )}

      {/* Selected but not yet generated */}
      {selectedReport && !reportData && !loading && !error && (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <ArrowLeft className="w-8 h-8 text-surface-300 mx-auto rotate-90" />
          <p className="mt-3 text-sm text-surface-500">
            Set your parameters and click &quot;Generate Report&quot;
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
          <p className="mt-3 text-sm text-surface-500">Generating report...</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Table Component
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReportTable({ type, data }: { type: ReportType; data: any }) {
  switch (type) {
    case "daily_sales":
      return <DailySalesTable data={data} />;
    case "receivables_aging":
      return <ReceivablesAgingTable data={data} />;
    case "job_status":
      return <JobStatusTable data={data} />;
    case "tech_utilization":
      return <TechUtilizationTable data={data} />;
    case "service_revenue":
      return <ServiceRevenueTable data={data} />;
    case "parts_usage":
      return <PartsUsageTable data={data} />;
    case "customer":
      return <CustomerReportTable data={data} />;
    case "warranty_claims":
      return <WarrantyClaimsTable data={data} />;
    case "insurance_receivables":
      return <InsuranceReceivablesTable data={data} />;
    default:
      return <p className="text-sm text-surface-500">Unknown report type</p>;
  }
}

// ---------------------------------------------------------------------------
// Shared table helpers
// ---------------------------------------------------------------------------

const thClass = "px-4 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider";
const thClassRight = "px-4 py-3 text-right text-xs font-semibold text-surface-400 uppercase tracking-wider";
const tdClass = "px-4 py-3 text-sm text-surface-700";
const tdClassRight = "px-4 py-3 text-sm text-surface-700 text-right";
const tfClass = "px-4 py-3 text-sm font-semibold text-surface-900";
const tfClassRight = "px-4 py-3 text-sm font-semibold text-surface-900 text-right";

function EmptyRows() {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-8 text-center text-sm text-surface-400">
        No data found for the selected parameters
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Daily Sales
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DailySalesTable({ data }: { data: any }) {
  const payments: {
    time: string;
    invoiceNumber: string;
    customerName: string;
    vehicle: string;
    method: string;
    amount: number;
    receivedBy: string;
  }[] = data.payments ?? [];

  const methodTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const p of payments) {
    methodTotals[p.method] = (methodTotals[p.method] ?? 0) + p.amount;
    grandTotal += p.amount;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100">
              <th className={thClass}>Time</th>
              <th className={thClass}>Invoice #</th>
              <th className={thClass}>Customer</th>
              <th className={thClass}>Vehicle</th>
              <th className={thClass}>Method</th>
              <th className={thClassRight}>Amount</th>
              <th className={thClass}>Received By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-50">
            {payments.length === 0 ? (
              <EmptyRows />
            ) : (
              payments.map((p, i) => (
                <tr key={i} className="hover:bg-surface-50">
                  <td className={tdClass}>{p.time}</td>
                  <td className={tdClass}>{p.invoiceNumber}</td>
                  <td className={tdClass}>{p.customerName}</td>
                  <td className={tdClass}>{p.vehicle}</td>
                  <td className={tdClass}>{p.method}</td>
                  <td className={tdClassRight}>{formatPeso(p.amount)}</td>
                  <td className={tdClass}>{p.receivedBy}</td>
                </tr>
              ))
            )}
          </tbody>
          {payments.length > 0 && (
            <tfoot className="border-t-2 border-surface-200">
              {Object.entries(methodTotals).map(([method, total]) => (
                <tr key={method}>
                  <td colSpan={5} className={tfClass}>{method}</td>
                  <td className={tfClassRight}>{formatPeso(total)}</td>
                  <td />
                </tr>
              ))}
              <tr className="bg-surface-50">
                <td colSpan={5} className={tfClass}>Grand Total</td>
                <td className={tfClassRight}>{formatPeso(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receivables Aging
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReceivablesAgingTable({ data }: { data: any }) {
  const invoices: {
    invoiceNumber: string;
    customerName: string;
    vehicle: string;
    date: string;
    total: number;
    paid: number;
    balance: number;
    ageDays: number;
    type: string;
  }[] = data.invoices ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            <th className={thClass}>Invoice #</th>
            <th className={thClass}>Customer</th>
            <th className={thClass}>Vehicle</th>
            <th className={thClass}>Date</th>
            <th className={thClassRight}>Total</th>
            <th className={thClassRight}>Paid</th>
            <th className={thClassRight}>Balance</th>
            <th className={thClassRight}>Age (days)</th>
            <th className={thClass}>Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50">
          {invoices.length === 0 ? (
            <EmptyRows />
          ) : (
            invoices.map((inv, i) => (
              <tr key={i} className="hover:bg-surface-50">
                <td className={tdClass}>{inv.invoiceNumber}</td>
                <td className={tdClass}>{inv.customerName}</td>
                <td className={tdClass}>{inv.vehicle}</td>
                <td className={tdClass}>{inv.date}</td>
                <td className={tdClassRight}>{formatPeso(inv.total)}</td>
                <td className={tdClassRight}>{formatPeso(inv.paid)}</td>
                <td className={tdClassRight}>{formatPeso(inv.balance)}</td>
                <td className={tdClassRight}>{inv.ageDays}</td>
                <td className={tdClass}>{inv.type}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Status Summary
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobStatusTable({ data }: { data: any }) {
  const stages: { stage: string; count: number; percentage: number }[] = data.stages ?? [];
  const overdueJobs: {
    jobNumber: string;
    customerName: string;
    vehicle: string;
    stage: string;
    daysOverdue: number;
  }[] = data.overdueJobs ?? [];

  return (
    <div className="space-y-8">
      {/* Jobs by Stage */}
      <div>
        <h3 className="text-sm font-semibold text-surface-900 mb-3">Jobs by Stage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100">
                <th className={thClass}>Stage</th>
                <th className={thClassRight}>Count</th>
                <th className={thClassRight}>%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {stages.length === 0 ? (
                <EmptyRows />
              ) : (
                stages.map((s, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className={tdClass}>{s.stage}</td>
                    <td className={tdClassRight}>{s.count}</td>
                    <td className={tdClassRight}>{s.percentage.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue Jobs */}
      <div>
        <h3 className="text-sm font-semibold text-surface-900 mb-3">
          Overdue Jobs ({overdueJobs.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100">
                <th className={thClass}>JO #</th>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Vehicle</th>
                <th className={thClass}>Stage</th>
                <th className={thClassRight}>Days Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {overdueJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-surface-400">
                    No overdue jobs
                  </td>
                </tr>
              ) : (
                overdueJobs.map((j, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className={tdClass}>{j.jobNumber}</td>
                    <td className={tdClass}>{j.customerName}</td>
                    <td className={tdClass}>{j.vehicle}</td>
                    <td className={tdClass}>{j.stage}</td>
                    <td className={cn(tdClassRight, j.daysOverdue > 7 ? "text-red-600 font-medium" : "")}>
                      {j.daysOverdue}
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

// ---------------------------------------------------------------------------
// Technician Utilization
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TechUtilizationTable({ data }: { data: any }) {
  const technicians: {
    name: string;
    role: string;
    availableHours: number;
    loggedHours: number;
    utilizationPct: number;
    overtimeHours: number;
  }[] = data.technicians ?? [];

  const totals = technicians.reduce(
    (acc, t) => ({
      availableHours: acc.availableHours + t.availableHours,
      loggedHours: acc.loggedHours + t.loggedHours,
      overtimeHours: acc.overtimeHours + t.overtimeHours,
    }),
    { availableHours: 0, loggedHours: 0, overtimeHours: 0 }
  );
  const totalUtilization = totals.availableHours > 0
    ? (totals.loggedHours / totals.availableHours) * 100
    : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            <th className={thClass}>Name</th>
            <th className={thClass}>Role</th>
            <th className={thClassRight}>Available Hrs</th>
            <th className={thClassRight}>Logged Hrs</th>
            <th className={thClassRight}>Utilization %</th>
            <th className={thClassRight}>Overtime Hrs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50">
          {technicians.length === 0 ? (
            <EmptyRows />
          ) : (
            technicians.map((t, i) => (
              <tr key={i} className="hover:bg-surface-50">
                <td className={tdClass}>{t.name}</td>
                <td className={tdClass}>{t.role}</td>
                <td className={tdClassRight}>{t.availableHours.toFixed(1)}</td>
                <td className={tdClassRight}>{t.loggedHours.toFixed(1)}</td>
                <td className={cn(
                  tdClassRight,
                  t.utilizationPct >= 90 ? "text-green-600 font-medium" :
                  t.utilizationPct < 60 ? "text-amber-600 font-medium" : ""
                )}>
                  {t.utilizationPct.toFixed(1)}%
                </td>
                <td className={cn(tdClassRight, t.overtimeHours > 0 ? "text-red-600" : "")}>
                  {t.overtimeHours.toFixed(1)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {technicians.length > 0 && (
          <tfoot className="border-t-2 border-surface-200 bg-surface-50">
            <tr>
              <td colSpan={2} className={tfClass}>Shop Totals</td>
              <td className={tfClassRight}>{totals.availableHours.toFixed(1)}</td>
              <td className={tfClassRight}>{totals.loggedHours.toFixed(1)}</td>
              <td className={tfClassRight}>{totalUtilization.toFixed(1)}%</td>
              <td className={tfClassRight}>{totals.overtimeHours.toFixed(1)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Revenue
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ServiceRevenueTable({ data }: { data: any }) {
  const categories: {
    category: string;
    revenue: number;
    jobCount: number;
    avgPrice: number;
  }[] = data.categories ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            <th className={thClass}>Category</th>
            <th className={thClassRight}>Revenue</th>
            <th className={thClassRight}>Jobs</th>
            <th className={thClassRight}>Avg Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50">
          {categories.length === 0 ? (
            <EmptyRows />
          ) : (
            categories.map((c, i) => (
              <tr key={i} className="hover:bg-surface-50">
                <td className={tdClass}>{c.category}</td>
                <td className={tdClassRight}>{formatPeso(c.revenue)}</td>
                <td className={tdClassRight}>{c.jobCount}</td>
                <td className={tdClassRight}>{formatPeso(c.avgPrice)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts Usage
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PartsUsageTable({ data }: { data: any }) {
  const parts: {
    description: string;
    partNumber: string;
    quantity: number;
    totalCost: number;
    timesUsed: number;
  }[] = data.parts ?? [];

  const totalCost = parts.reduce((sum, p) => sum + p.totalCost, 0);
  const totalQty = parts.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            <th className={thClass}>Description</th>
            <th className={thClass}>Part #</th>
            <th className={thClassRight}>Qty</th>
            <th className={thClassRight}>Total Cost</th>
            <th className={thClassRight}>Times Used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50">
          {parts.length === 0 ? (
            <EmptyRows />
          ) : (
            parts.map((p, i) => (
              <tr key={i} className="hover:bg-surface-50">
                <td className={tdClass}>{p.description}</td>
                <td className={tdClass}>{p.partNumber}</td>
                <td className={tdClassRight}>{p.quantity}</td>
                <td className={tdClassRight}>{formatPeso(p.totalCost)}</td>
                <td className={tdClassRight}>{p.timesUsed}</td>
              </tr>
            ))
          )}
        </tbody>
        {parts.length > 0 && (
          <tfoot className="border-t-2 border-surface-200 bg-surface-50">
            <tr>
              <td colSpan={2} className={tfClass}>Totals</td>
              <td className={tfClassRight}>{totalQty}</td>
              <td className={tfClassRight}>{formatPeso(totalCost)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer Report
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomerReportTable({ data }: { data: any }) {
  const customers: {
    name: string;
    jobCount: number;
    totalSpend: number;
    customerType: string;
  }[] = data.customers ?? [];

  const summary = data.summary ?? {};

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-surface-500">Total Customers</p>
            <p className="text-lg font-bold text-surface-900">{summary.totalCustomers ?? 0}</p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-surface-500">New Customers</p>
            <p className="text-lg font-bold text-surface-900">{summary.newCustomers ?? 0}</p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-surface-500">Returning Customers</p>
            <p className="text-lg font-bold text-surface-900">{summary.returningCustomers ?? 0}</p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-surface-500">Total Revenue</p>
            <p className="text-lg font-bold text-surface-900">
              {formatPeso(summary.totalRevenue ?? 0)}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100">
              <th className={thClass}>Customer</th>
              <th className={thClassRight}>Jobs</th>
              <th className={thClassRight}>Total Spend</th>
              <th className={thClass}>Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-50">
            {customers.length === 0 ? (
              <EmptyRows />
            ) : (
              customers.map((c, i) => (
                <tr key={i} className="hover:bg-surface-50">
                  <td className={tdClass}>{c.name}</td>
                  <td className={tdClassRight}>{c.jobCount}</td>
                  <td className={tdClassRight}>{formatPeso(c.totalSpend)}</td>
                  <td className={tdClass}>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      c.customerType === "New"
                        ? "bg-green-50 text-green-700"
                        : "bg-blue-50 text-blue-700"
                    )}>
                      {c.customerType}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warranty Claims
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WarrantyClaimsTable({ data }: { data: any }) {
  const claims: {
    date: string;
    description: string;
    resolution: string;
    status: string;
    linkedJO: string;
  }[] = data.claims ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            <th className={thClass}>Date</th>
            <th className={thClass}>Description</th>
            <th className={thClass}>Resolution</th>
            <th className={thClass}>Status</th>
            <th className={thClass}>Linked JO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50">
          {claims.length === 0 ? (
            <EmptyRows />
          ) : (
            claims.map((c, i) => (
              <tr key={i} className="hover:bg-surface-50">
                <td className={tdClass}>{c.date}</td>
                <td className={tdClass}>{c.description}</td>
                <td className={tdClass}>{c.resolution}</td>
                <td className={tdClass}>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    c.status === "RESOLVED"
                      ? "bg-green-50 text-green-700"
                      : c.status === "PENDING"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-surface-100 text-surface-600"
                  )}>
                    {c.status}
                  </span>
                </td>
                <td className={tdClass}>{c.linkedJO}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insurance Receivables
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InsuranceReceivablesTable({ data }: { data: any }) {
  const receivables: {
    company: string;
    invoiceNumber: string;
    customerName: string;
    total: number;
    paid: number;
    balance: number;
    ageDays: number;
  }[] = data.receivables ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            <th className={thClass}>Company</th>
            <th className={thClass}>Invoice #</th>
            <th className={thClass}>Customer</th>
            <th className={thClassRight}>Total</th>
            <th className={thClassRight}>Paid</th>
            <th className={thClassRight}>Balance</th>
            <th className={thClassRight}>Age (days)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-50">
          {receivables.length === 0 ? (
            <EmptyRows />
          ) : (
            receivables.map((r, i) => (
              <tr key={i} className="hover:bg-surface-50">
                <td className={tdClass}>{r.company}</td>
                <td className={tdClass}>{r.invoiceNumber}</td>
                <td className={tdClass}>{r.customerName}</td>
                <td className={tdClassRight}>{formatPeso(r.total)}</td>
                <td className={tdClassRight}>{formatPeso(r.paid)}</td>
                <td className={tdClassRight}>{formatPeso(r.balance)}</td>
                <td className={cn(
                  tdClassRight,
                  r.ageDays > 60 ? "text-red-600 font-medium" :
                  r.ageDays > 30 ? "text-amber-600 font-medium" : ""
                )}>
                  {r.ageDays}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FileText, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SupplementList } from "@/components/jobs/supplement-list";
import {
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
  ESTIMATE_REQUEST_STATUS_LABELS,
  ESTIMATE_REQUEST_STATUS_COLORS,
} from "@/types/enums";
import type {
  EstimateLineItemGroup,
  EstimateRequestStatus,
} from "@/types/enums";
import { formatPeso } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  id: string;
  group: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  notes: string | null;
}

interface EstimateVersion {
  id: string;
  versionNumber: number;
  versionLabel: string;
  subtotalLabor: number;
  subtotalParts: number;
  subtotalMaterials: number;
  subtotalPaint: number;
  subtotalSublet: number;
  subtotalOther: number;
  vatAmount: number;
  grandTotal: number;
  isApproved: boolean;
  lineItems: LineItem[];
}

interface EstimateData {
  id: string;
  versions: EstimateVersion[];
  estimateRequest?: {
    requestNumber: string;
    customerConcern: string;
    status: string;
  } | null;
}

interface SupplementSummary {
  id: string;
  supplementNumber: string;
  status: string;
  description: string;
  grandTotal: number;
  lineItems: Array<{ id: string }>;
  createdAt: string;
  approvedAt: string | null;
}

interface EstimateTabClientProps {
  jobOrderId: string;
  jobOrderNumber: string;
  estimates: EstimateData[];
  supplements: SupplementSummary[];
}

// ---------------------------------------------------------------------------
// Group ordering for display
// ---------------------------------------------------------------------------

const GROUP_ORDER: EstimateLineItemGroup[] = [
  "LABOR",
  "PARTS",
  "MATERIALS",
  "PAINT",
  "SUBLET",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstimateTabClient({
  jobOrderId,
  jobOrderNumber,
  estimates,
  supplements,
}: EstimateTabClientProps) {
  const router = useRouter();

  function handleSupplementUpdate() {
    router.refresh();
  }

  // Get the primary estimate (first one linked to this job)
  const estimate = estimates.length > 0 ? estimates[0] : null;
  const latestVersion =
    estimate && estimate.versions.length > 0 ? estimate.versions[0] : null;

  return (
    <div className="space-y-8">
      {/* Original Estimate Section */}
      <section>
        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent" />
          Original Estimate
        </h2>

        {!estimate || !latestVersion ? (
          <EmptyState
            icon={FileText}
            title="No Estimate Attached"
            description="This job order does not have an approved estimate linked yet."
            className="py-10"
          />
        ) : (
          <div className="space-y-4">
            {/* Estimate Header */}
            <div className="bg-white rounded-xl border border-surface-200 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-primary">
                      {estimate.estimateRequest?.requestNumber ?? "Estimate"}
                    </span>
                    {estimate.estimateRequest?.status && (
                      <Badge
                        className={
                          ESTIMATE_REQUEST_STATUS_COLORS[
                            estimate.estimateRequest
                              .status as EstimateRequestStatus
                          ] ?? ""
                        }
                      >
                        {ESTIMATE_REQUEST_STATUS_LABELS[
                          estimate.estimateRequest
                            .status as EstimateRequestStatus
                        ] ?? estimate.estimateRequest.status}
                      </Badge>
                    )}
                    {latestVersion.isApproved && (
                      <Badge className="bg-success-100 text-success-600">
                        Approved
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-surface-400">
                    Version {latestVersion.versionNumber} &middot;{" "}
                    {latestVersion.versionLabel}
                  </p>
                  {estimate.estimateRequest?.customerConcern && (
                    <p className="text-sm text-surface-500 mt-2">
                      {estimate.estimateRequest.customerConcern}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-surface-400 block">
                    Grand Total
                  </span>
                  <span className="font-mono text-lg font-bold text-primary">
                    {formatPeso(latestVersion.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items by Group */}
            <div className="space-y-3">
              {GROUP_ORDER.map((group) => {
                const items = latestVersion.lineItems.filter(
                  (li) => li.group === group
                );
                if (items.length === 0) return null;

                const groupSubtotal = items.reduce(
                  (sum, li) => sum + li.subtotal,
                  0
                );

                return (
                  <div
                    key={group}
                    className="bg-white rounded-xl border border-surface-200 overflow-hidden"
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-surface-50 border-b border-surface-200">
                      <span className="text-sm font-semibold text-primary">
                        {ESTIMATE_LINE_ITEM_GROUP_LABELS[group]}
                      </span>
                      <span className="font-mono text-sm font-medium text-primary">
                        {formatPeso(groupSubtotal)}
                      </span>
                    </div>

                    {/* Items Table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-100 text-xs text-surface-400">
                          <th className="text-left px-4 py-2 font-medium">
                            Description
                          </th>
                          <th className="text-center px-2 py-2 font-medium w-20">
                            Qty
                          </th>
                          <th className="text-right px-2 py-2 font-medium w-24">
                            Unit Cost
                          </th>
                          <th className="text-right px-4 py-2 font-medium w-28">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-surface-50 last:border-b-0 hover:bg-surface-50/50"
                          >
                            <td className="px-4 py-2.5 text-primary">
                              {item.description}
                              {item.notes && (
                                <span className="block text-xs text-surface-400 mt-0.5">
                                  {item.notes}
                                </span>
                              )}
                            </td>
                            <td className="text-center px-2 py-2.5 font-mono text-surface-600">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="text-right px-2 py-2.5 font-mono text-surface-600">
                              {formatPeso(item.unitCost)}
                            </td>
                            <td className="text-right px-4 py-2.5 font-mono font-medium text-primary">
                              {formatPeso(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Totals Summary */}
            <div className="bg-surface-50 rounded-xl border border-surface-200 p-4">
              <h4 className="text-sm font-semibold text-primary mb-3">
                Cost Summary
              </h4>
              <div className="space-y-1.5 text-sm">
                {[
                  { label: "Labor", value: latestVersion.subtotalLabor },
                  { label: "Parts & Materials", value: latestVersion.subtotalParts },
                  { label: "Paint & Consumables", value: latestVersion.subtotalMaterials },
                  { label: "Paint", value: latestVersion.subtotalPaint },
                  { label: "Sublet / Outsourced", value: latestVersion.subtotalSublet },
                  { label: "Other", value: latestVersion.subtotalOther },
                ]
                  .filter((row) => row.value > 0)
                  .map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-surface-500">{row.label}</span>
                      <span className="font-mono text-primary">
                        {formatPeso(row.value)}
                      </span>
                    </div>
                  ))}

                <div className="border-t border-surface-200 pt-1.5 mt-1.5" />
                <div className="flex justify-between">
                  <span className="text-surface-500">Subtotal</span>
                  <span className="font-mono text-primary">
                    {formatPeso(
                      latestVersion.subtotalLabor +
                        latestVersion.subtotalParts +
                        latestVersion.subtotalMaterials +
                        latestVersion.subtotalPaint +
                        latestVersion.subtotalSublet +
                        latestVersion.subtotalOther
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">VAT (12%)</span>
                  <span className="font-mono text-primary">
                    {formatPeso(latestVersion.vatAmount)}
                  </span>
                </div>
                <div className="border-t border-surface-200 pt-1.5 mt-1.5" />
                <div className="flex justify-between font-semibold">
                  <span className="text-primary">Grand Total</span>
                  <span className="font-mono text-primary">
                    {formatPeso(latestVersion.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-surface-200" />

      {/* Supplemental Estimates Section */}
      <section>
        <SupplementList
          jobOrderId={jobOrderId}
          supplements={supplements}
          onUpdate={handleSupplementUpdate}
        />
      </section>
    </div>
  );
}

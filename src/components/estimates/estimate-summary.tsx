"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle, ClipboardCheck, Printer, CalendarPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppointmentForm } from "@/components/schedule/appointment-form";
import {
  updateVersionDetailsAction,
  updateEstimateStatusAction,
} from "@/lib/actions/estimate-actions";
import { beginIntakeAction } from "@/lib/actions/intake-actions";
import { formatPeso, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  vatRate: number;
  vatAmount: number;
  discountType: string | null;
  discountValue: number;
  discountReason: string | null;
  grandTotal: number;
  termsAndConditions: string | null;
  estimatedDays: number | null;
}

interface Props {
  estimateRequestId: string;
  version: EstimateVersion;
  status: string;
  approvalToken?: string | null;
  customerId?: string;
  vehicleId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EstimateSummary({ estimateRequestId, version, status, approvalToken, customerId, vehicleId }: Props) {
  const router = useRouter();

  // Discount state
  const [discountType, setDiscountType] = useState(
    version.discountType ?? "none"
  );
  const [discountValue, setDiscountValue] = useState(
    version.discountType === "flat"
      ? String(version.discountValue / 100)
      : String(version.discountValue)
  );
  const [discountReason, setDiscountReason] = useState(
    version.discountReason ?? ""
  );
  const [estimatedDays, setEstimatedDays] = useState(
    version.estimatedDays != null ? String(version.estimatedDays) : ""
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    version.termsAndConditions ?? ""
  );

  const [savingDiscount, setSavingDiscount] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [beginningIntake, setBeginningIntake] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Calculate subtotal from groups
  const rawSubtotal =
    version.subtotalLabor +
    version.subtotalParts +
    version.subtotalMaterials +
    version.subtotalPaint +
    version.subtotalSublet +
    version.subtotalOther;

  // Compute discount display
  let discountAmount = 0;
  if (version.discountType === "flat") {
    discountAmount = version.discountValue;
  } else if (version.discountType === "percentage") {
    discountAmount = Math.round(
      rawSubtotal * (version.discountValue / 10000)
    );
  }
  const afterDiscount = rawSubtotal - discountAmount;

  async function handleDiscountSave() {
    setSavingDiscount(true);
    const result = await updateVersionDetailsAction(version.id, {
      discountType: discountType === "none" ? null : discountType,
      discountValue:
        discountType === "none" ? 0 : parseFloat(discountValue) || 0,
      discountReason: discountReason || null,
    });
    if (result.success) {
      toast.success("Discount updated.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update discount.");
    }
    setSavingDiscount(false);
  }

  async function handleDetailsSave() {
    setSavingDetails(true);
    const result = await updateVersionDetailsAction(version.id, {
      discountValue: discountType === "none" ? 0 : parseFloat(discountValue) || 0,
      estimatedDays: estimatedDays ? parseInt(estimatedDays) : null,
      termsAndConditions: termsAndConditions || null,
    });
    if (result.success) {
      toast.success("Details updated.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update.");
    }
    setSavingDetails(false);
  }

  async function handleStatusChange(status: string) {
    setStatusLoading(status);
    const result = await updateEstimateStatusAction(
      estimateRequestId,
      status
    );
    if (result.success) {
      toast.success(
        status === "ESTIMATE_SENT"
          ? "Estimate marked as sent."
          : "Estimate approved!"
      );
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update status.");
    }
    setStatusLoading(null);
    setConfirmAction(null);
  }

  async function handleBeginIntake() {
    setBeginningIntake(true);
    const result = await beginIntakeAction(estimateRequestId);
    if (result.success && result.data?.jobOrderId) {
      toast.success("Intake started — redirecting to check-in wizard.");
      router.push("/jobs/" + result.data.jobOrderId + "/intake");
    } else {
      toast.error(result.error ?? "Failed to begin intake.");
      setBeginningIntake(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-primary">Estimate Summary</h3>

      {/* Group Subtotals — hide zero-amount rows */}
      <div className="space-y-2 text-sm">
        {version.subtotalLabor > 0 && (
          <SummaryRow label="Labor" amount={version.subtotalLabor} />
        )}
        {version.subtotalParts > 0 && (
          <SummaryRow label="Parts & Materials" amount={version.subtotalParts} />
        )}
        {(version.subtotalPaint + version.subtotalMaterials) > 0 && (
          <SummaryRow label="Paint & Consumables" amount={version.subtotalPaint + version.subtotalMaterials} />
        )}
        {version.subtotalSublet > 0 && (
          <SummaryRow label="Sublet / Outsourced" amount={version.subtotalSublet} />
        )}
        {version.subtotalOther > 0 && (
          <SummaryRow label="Other" amount={version.subtotalOther} />
        )}

        <div className="border-t border-surface-200 pt-2">
          <SummaryRow label="Subtotal" amount={rawSubtotal} bold />
        </div>
      </div>

      {/* Discount Section */}
      <div className="space-y-2 border-t border-surface-200 pt-3">
        <label className="block text-xs font-medium text-surface-500">
          Discount
        </label>
        <div className="flex items-center gap-2">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
          >
            <option value="none">None</option>
            <option value="flat">Flat Amount (₱)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
          {discountType !== "none" && (
            <input
              type="number"
              step={discountType === "percentage" ? "0.5" : "0.01"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "flat" ? "₱0.00" : "0%"}
              className="w-20 px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
            />
          )}
        </div>
        {discountType !== "none" && (
          <input
            type="text"
            placeholder="Reason (optional)"
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
          />
        )}
        {discountType !== "none" && (
          <button
            onClick={handleDiscountSave}
            disabled={savingDiscount}
            className="text-xs font-medium text-accent hover:text-accent-600 transition-colors disabled:opacity-50"
          >
            {savingDiscount ? "Saving..." : "Apply Discount"}
          </button>
        )}

        {discountAmount > 0 && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-danger">
              <span>Discount</span>
              <span className="font-mono">-{formatPeso(discountAmount)}</span>
            </div>
            <SummaryRow label="After Discount" amount={afterDiscount} bold />
          </div>
        )}
      </div>

      {/* Total (VAT-inclusive) */}
      <div className="space-y-2 border-t border-surface-200 pt-3">
        <div className="border-t-2 border-primary pt-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-primary">Total</span>
            <span className="font-mono font-bold text-lg text-primary">
              {formatPeso(version.grandTotal)}
            </span>
          </div>
        </div>
        <p className="text-xs text-surface-400 italic">*Prices are VAT-inclusive</p>
      </div>

      {/* Estimated Days */}
      <div className="border-t border-surface-200 pt-3 space-y-2">
        <label className="block text-xs font-medium text-surface-500">
          Estimated Days
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={estimatedDays}
          onChange={(e) => setEstimatedDays(e.target.value)}
          placeholder="—"
          className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
        />
      </div>

      {/* Terms & Conditions */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-surface-500">
          Terms & Conditions
        </label>
        <textarea
          rows={3}
          value={termsAndConditions}
          onChange={(e) => setTermsAndConditions(e.target.value)}
          placeholder="Enter terms and conditions..."
          className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 resize-none"
        />
        <button
          onClick={handleDetailsSave}
          disabled={savingDetails}
          className="text-xs font-medium text-accent hover:text-accent-600 transition-colors disabled:opacity-50"
        >
          {savingDetails ? "Saving..." : "Save Details"}
        </button>
      </div>

      {/* Schedule Drop-Off — shown only when estimate is approved */}
      {status === "ESTIMATE_APPROVED" && (
        <div className="border-t border-surface-200 pt-3">
          <button
            onClick={() => setScheduleOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent-200 text-accent-600 hover:bg-accent-50 text-sm font-semibold transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Schedule Drop-Off
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-surface-200 pt-3 space-y-2">
        {approvalToken && (
          <a
            href={`/view/estimate/${approvalToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / View Estimate
          </a>
        )}
        <button
          onClick={() => setConfirmAction("ESTIMATE_SENT")}
          disabled={statusLoading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {statusLoading === "ESTIMATE_SENT" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Mark as Sent
        </button>
        <button
          onClick={() => setConfirmAction("ESTIMATE_APPROVED")}
          disabled={statusLoading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent-600 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {statusLoading === "ESTIMATE_APPROVED" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Mark as Approved
        </button>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmAction === "ESTIMATE_SENT"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleStatusChange("ESTIMATE_SENT")}
        title="Mark as Sent"
        message="This will update the status to Sent. The customer should have received the estimate."
        confirmLabel="Mark as Sent"
        variant="warning"
        loading={statusLoading === "ESTIMATE_SENT"}
      />
      <ConfirmDialog
        open={confirmAction === "ESTIMATE_APPROVED"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleStatusChange("ESTIMATE_APPROVED")}
        title="Mark as Approved"
        message="This will mark the estimate as approved by the customer. This usually means you can proceed with the job order."
        confirmLabel="Approve Estimate"
        variant="warning"
        loading={statusLoading === "ESTIMATE_APPROVED"}
      />

      {/* Begin Intake / Check-In — shown only when estimate is approved */}
      {status === "ESTIMATE_APPROVED" && (
        <div className="border-t-2 border-emerald-200 pt-4 space-y-2">
          <p className="text-xs text-emerald-700 font-medium">
            Vehicle is approved. Ready to begin the intake process.
          </p>
          <button
            onClick={handleBeginIntake}
            disabled={beginningIntake}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {beginningIntake ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ClipboardCheck className="w-4 h-4" />
            )}
            {beginningIntake ? "Starting Intake..." : "Begin Intake / Check-In"}
          </button>
        </div>
      )}

      {/* Schedule Drop-Off Appointment Form */}
      <AppointmentForm
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        defaultType="DROP_OFF"
        customerId={customerId}
        vehicleId={vehicleId}
        estimateId={estimateRequestId}
        onSaved={() => setScheduleOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Row Helper
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  amount,
  bold,
}: {
  label: string;
  amount: number;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span
        className={cn("text-surface-500", bold && "font-semibold text-primary")}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-surface-600",
          bold && "font-semibold text-primary"
        )}
      >
        {formatPeso(amount)}
      </span>
    </div>
  );
}

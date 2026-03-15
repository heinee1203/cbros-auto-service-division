"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Smartphone,
  Building2,
  CreditCard,
  FileText,
  Shield,
} from "lucide-react";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { centavosToPesos, cn } from "@/lib/utils";
import { recordPaymentAction } from "@/lib/actions/payment-actions";

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote,
  Smartphone,
  Building2,
  CreditCard,
  FileText,
  Shield,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentFormProps {
  invoiceId: string;
  jobOrderId: string;
  balanceDue: number; // centavos
  onPaymentRecorded?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PaymentForm({
  invoiceId,
  jobOrderId,
  balanceDue,
  onPaymentRecorded,
}: PaymentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState(centavosToPesos(balanceDue));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [last4Digits, setLast4Digits] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [checkBank, setCheckBank] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setMethod(null);
    setAmount(centavosToPesos(balanceDue));
    setReferenceNumber("");
    setLast4Digits("");
    setApprovalCode("");
    setCheckBank("");
    setCheckDate("");
    setNotes("");
    setError(null);
  }

  function handleSubmit() {
    if (!method || !amount || parseFloat(amount) <= 0) return;
    setError(null);

    const formData: Record<string, unknown> = {
      method,
      amount: parseFloat(amount),
      notes: notes || undefined,
    };

    // Add conditional fields based on method
    if (
      method === "GCASH" ||
      method === "MAYA" ||
      method === "BANK_TRANSFER"
    ) {
      formData.referenceNumber = referenceNumber || undefined;
    }
    if (method === "CREDIT_CARD" || method === "DEBIT_CARD") {
      formData.last4Digits = last4Digits || undefined;
      formData.approvalCode = approvalCode || undefined;
    }
    if (method === "CHECK") {
      formData.checkBank = checkBank || undefined;
      formData.checkDate = checkDate || undefined;
    }
    if (method === "INSURANCE_DIRECT") {
      formData.referenceNumber = referenceNumber || undefined;
    }

    startTransition(async () => {
      const result = await recordPaymentAction(invoiceId, jobOrderId, formData);
      if (result.success) {
        setSuccess(true);
        resetForm();
        onPaymentRecorded?.();
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error ?? "Failed to record payment");
      }
    });
  }

  const isValid = method !== null && !!amount && parseFloat(amount) > 0;

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Banknote className="h-5 w-5 text-accent-600" />
        <h3 className="text-lg font-semibold text-primary">Record Payment</h3>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 rounded-lg bg-success-50 border border-success-200 p-3 text-sm text-success-700">
          Payment recorded successfully!
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {/* Payment method selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-surface-700 mb-2">
          Payment Method
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PAYMENT_METHOD_OPTIONS.map((opt) => {
            const IconComp = ICON_MAP[opt.icon];
            const isSelected = method === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMethod(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                  isSelected
                    ? "border-accent-600 bg-accent-50 text-accent-700"
                    : "border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50"
                )}
              >
                {IconComp && (
                  <IconComp
                    className={cn(
                      "h-5 w-5",
                      isSelected ? "text-accent-600" : "text-surface-400"
                    )}
                  />
                )}
                <span className="text-xs">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional fields */}
      {method && (
        <div className="space-y-4 mb-6">
          {/* Amount field — always shown */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Amount (&#8369;)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
              placeholder="0.00"
            />
          </div>

          {/* Reference number for digital payments */}
          {(method === "GCASH" ||
            method === "MAYA" ||
            method === "BANK_TRANSFER" ||
            method === "INSURANCE_DIRECT") && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                {method === "INSURANCE_DIRECT"
                  ? "Reference / Claim Number"
                  : "Reference Number"}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
                placeholder={
                  method === "INSURANCE_DIRECT"
                    ? "e.g., CLM-2026-0001"
                    : "e.g., TXN123456"
                }
              />
            </div>
          )}

          {/* Card fields */}
          {(method === "CREDIT_CARD" || method === "DEBIT_CARD") && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Last 4 Digits
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={last4Digits}
                  onChange={(e) =>
                    setLast4Digits(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
                  placeholder="1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Approval Code
                </label>
                <input
                  type="text"
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
                  placeholder="e.g., APR-001"
                />
              </div>
            </>
          )}

          {/* Check fields */}
          {method === "CHECK" && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={checkBank}
                  onChange={(e) => setCheckBank(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
                  placeholder="e.g., BDO, BPI"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Check Date
                </label>
                <input
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none resize-none"
              placeholder="Additional payment notes..."
            />
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid || isPending}
        className="w-full bg-accent-600 hover:bg-accent-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Recording..." : "Record Payment"}
      </button>
    </div>
  );
}

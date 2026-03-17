"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt, X } from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@/types/enums";
import type { PaymentMethod } from "@/types/enums";
import { formatPeso, formatDateTime, cn } from "@/lib/utils";
import { voidPaymentAction } from "@/lib/actions/payment-actions";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payment {
  id: string;
  amount: number; // centavos
  method: string;
  referenceNumber: string | null;
  last4Digits: string | null;
  approvalCode: string | null;
  checkBank: string | null;
  notes: string | null;
  orNumber: string | null;
  paidAt: string;
  createdByUser?: { firstName: string; lastName: string } | null;
}

interface PaymentHistoryProps {
  payments: Payment[];
  invoiceGrandTotal: number; // centavos
  totalPaid: number; // centavos
  balanceDue: number; // centavos
  jobOrderId: string;
  canVoid: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReferenceDisplay(payment: Payment): string {
  if (payment.referenceNumber) return payment.referenceNumber;
  if (payment.last4Digits) return `****${payment.last4Digits}`;
  if (payment.checkBank) return payment.checkBank;
  return "-";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PaymentHistory({
  payments,
  invoiceGrandTotal,
  totalPaid,
  balanceDue,
  jobOrderId,
  canVoid,
}: PaymentHistoryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleVoid(paymentId: string) {
    setError(null);
    setVoidingId(paymentId);
    startTransition(async () => {
      const result = await voidPaymentAction(paymentId, jobOrderId);
      if (result.success) {
        setConfirmVoidId(null);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to void payment");
      }
      setVoidingId(null);
    });
  }

  const isOverpaid = balanceDue < 0;

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="h-5 w-5 text-accent-600" />
        <h3 className="text-lg font-semibold text-primary">Payment History</h3>
      </div>

      {/* Balance summary bar */}
      <div className="bg-surface-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Invoice Total</p>
            <p className="text-sm font-mono font-semibold text-primary">
              {formatPeso(invoiceGrandTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Paid</p>
            <p className="text-sm font-mono font-semibold text-primary">
              {formatPeso(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 mb-0.5">
              {isOverpaid ? "Credit" : "Balance"}
            </p>
            <p
              className={cn(
                "text-sm font-mono font-semibold",
                isOverpaid
                  ? "text-success-600"
                  : balanceDue === 0
                    ? "text-success-600"
                    : "text-danger-600"
              )}
            >
              {formatPeso(Math.abs(balanceDue))}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {/* Payments table */}
      {payments.length === 0 ? (
        <div className="text-center py-8 text-sm text-surface-400">
          No payments recorded yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500 uppercase">
                  Date
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500 uppercase">
                  Method
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500 uppercase">
                  Reference
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-surface-500 uppercase">
                  Amount
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-surface-500 uppercase">
                  Recorded By
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-surface-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-surface-50">
                  <td className="px-3 py-2 font-mono text-surface-700 whitespace-nowrap">
                    {formatDateTime(payment.paidAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-700">
                      {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
                        payment.method}
                    </span>
                    {payment.orNumber && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-xs font-mono font-medium text-accent-700">
                        {payment.orNumber}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-surface-600">
                    {getReferenceDisplay(payment)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-primary">
                    {formatPeso(payment.amount)}
                  </td>
                  <td className="px-3 py-2 text-surface-600">
                    {payment.createdByUser
                      ? `${payment.createdByUser.firstName} ${payment.createdByUser.lastName}`
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Receipt link */}
                      <Link
                        href={`/jobs/${jobOrderId}/invoice/receipt/${payment.id}`}
                        target="_blank"
                        className="text-accent-600 hover:text-accent-700"
                        title="View Receipt"
                      >
                        <Receipt className="h-4 w-4" />
                      </Link>

                      {/* Void button */}
                      {canVoid && (
                        <>
                          {confirmVoidId === payment.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleVoid(payment.id)}
                                disabled={isPending && voidingId === payment.id}
                                className="text-xs text-danger-600 hover:text-danger-700 font-medium disabled:opacity-50"
                              >
                                {voidingId === payment.id
                                  ? "Voiding..."
                                  : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmVoidId(null)}
                                className="text-surface-400 hover:text-surface-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmVoidId(payment.id)}
                              className="text-xs text-danger-500 hover:text-danger-700 font-medium"
                            >
                              Void
                            </button>
                          )}
                        </>
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
  );
}

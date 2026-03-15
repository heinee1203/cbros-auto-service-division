"use client";

import { formatPeso, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/types/enums";
import type { PaymentMethod } from "@/types/enums";

interface ReceiptData {
  shopInfo: {
    name: string;
    address: string;
    phone: string;
    tin: string;
  };
  payment: {
    id: string;
    amount: number;
    method: string;
    referenceNumber: string | null;
    paidAt: string | Date;
    notes: string | null;
  };
  invoice: {
    invoiceNumber: string;
    grandTotal: number;
    orNumber: string | null;
  };
  customer: {
    firstName: string;
    lastName: string;
    company: string | null;
  };
  totalPaidUpToThis: number;
  runningBalance: number;
}

export function ReceiptContent({ data }: { data: ReceiptData }) {
  const { shopInfo, payment, invoice, customer, totalPaidUpToThis, runningBalance } = data;

  const customerName = customer.company
    ? customer.company
    : `${customer.firstName} ${customer.lastName}`;

  return (
    <>
      {/* Print-only styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: 80mm auto; margin: 0; }
              body { background: white !important; }
              .no-print { display: none !important; }
              nav, aside, header, [data-sidebar], [data-topbar] { display: none !important; }
              main { padding: 0 !important; margin: 0 !important; }
            }
          `,
        }}
      />

      <div className="receipt-container mx-auto max-w-[80mm] p-4 font-mono text-xs bg-white">
        {/* Print / Close buttons */}
        <div className="no-print mb-4 flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
          >
            Print Receipt
          </button>
          <button
            onClick={() => window.history.back()}
            className="rounded border border-surface-300 bg-white px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface-50"
          >
            Back
          </button>
        </div>

        {/* Shop Header */}
        <div className="text-center mb-2">
          <p className="font-bold text-sm">{shopInfo.name}</p>
          {shopInfo.address && <p>{shopInfo.address}</p>}
          {shopInfo.phone && <p>{shopInfo.phone}</p>}
          {shopInfo.tin && <p>TIN: {shopInfo.tin}</p>}
        </div>

        <hr className="border-dashed border-surface-400 my-2" />

        {/* Receipt Title */}
        <p className="text-center font-bold">OFFICIAL RECEIPT</p>
        {invoice.orNumber && <p className="text-center">{invoice.orNumber}</p>}
        <p className="text-center text-[10px]">
          {formatDateTime(payment.paidAt)}
        </p>

        <hr className="border-dashed border-surface-400 my-2" />

        {/* Customer & Invoice */}
        <p>Customer: {customerName}</p>
        <p>Invoice: {invoice.invoiceNumber}</p>

        <hr className="border-dashed border-surface-400 my-2" />

        {/* Payment Details */}
        <div className="flex justify-between">
          <span>Method:</span>
          <span>
            {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}
          </span>
        </div>
        {payment.referenceNumber && (
          <div className="flex justify-between">
            <span>Ref #:</span>
            <span>{payment.referenceNumber}</span>
          </div>
        )}
        <div className="flex justify-between font-bold mt-1">
          <span>Amount Paid:</span>
          <span>{formatPeso(payment.amount)}</span>
        </div>

        <hr className="border-dashed border-surface-400 my-2" />

        {/* Running Balance */}
        <div className="flex justify-between">
          <span>Invoice Total:</span>
          <span>{formatPeso(invoice.grandTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Paid:</span>
          <span>{formatPeso(totalPaidUpToThis)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Balance After:</span>
          <span>{formatPeso(runningBalance)}</span>
        </div>

        <hr className="border-dashed border-surface-400 my-2" />

        <p className="text-center mt-2">Thank you!</p>
        <p className="text-center text-[10px] mt-1">
          This serves as your official receipt.
        </p>
      </div>
    </>
  );
}

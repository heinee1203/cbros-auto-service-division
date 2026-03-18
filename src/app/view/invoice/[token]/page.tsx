import { notFound } from "next/navigation";
import { getInvoiceByToken } from "@/lib/services/invoices";
import { prisma } from "@/lib/prisma";
import { formatPeso, formatDate } from "@/lib/utils";
import {
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/types/enums";
import type { EstimateLineItemGroup, PaymentStatus } from "@/types/enums";
import { PrintButton } from "./print-button";

interface PublicInvoicePageProps {
  params: { token: string };
}

export default async function PublicInvoicePage({ params }: PublicInvoicePageProps) {
  const invoice = await getInvoiceByToken(params.token);

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Invoice Not Found</h1>
          <p className="mt-2 text-surface-500">
            This invoice link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  // Fetch shop settings
  const settingKeys = [
    "shop_name",
    "shop_address",
    "shop_phone",
    "shop_email",
    "shop_tin",
  ];
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys } },
  });
  const shopInfo: Record<string, string> = {};
  for (const s of settings) {
    shopInfo[s.key] = s.value;
  }

  const customer = invoice.jobOrder.customer;
  const vehicle = invoice.jobOrder.vehicle;
  const customerName = customer.company
    ? customer.company
    : `${customer.firstName} ${customer.lastName}`;

  // Group line items
  const groupOrder: string[] = [
    "LABOR",
    "PARTS",
    "MATERIALS",
    "PAINT",
    "SUBLET",
    "OTHER",
  ];
  const groupedItems = new Map<string, typeof invoice.lineItems>();
  for (const group of groupOrder) {
    const items = invoice.lineItems.filter((li) => li.group === group);
    if (items.length > 0) {
      groupedItems.set(group, items);
    }
  }

  // Calculate pre-discount total for display
  const preDiscountTotal =
    invoice.subtotalLabor +
    invoice.subtotalParts +
    invoice.subtotalMaterials +
    invoice.subtotalPaint +
    invoice.subtotalSublet +
    invoice.subtotalOther;

  const hasDiscount =
    invoice.discountType && invoice.discountValue > 0;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 20mm; }
              .no-print { display: none !important; }
            }
          `,
        }}
      />

      <div className="min-h-screen bg-surface-100 py-8 px-4">
        <div className="mx-auto max-w-[800px] bg-white shadow-sm rounded-lg overflow-hidden">
          {/* Shop Header */}
          <div className="border-b border-surface-200 px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-primary">
              {shopInfo.shop_name || "AutoServ Pro"}
            </h1>
            {shopInfo.shop_address && (
              <p className="mt-1 text-sm text-surface-500">
                {shopInfo.shop_address}
              </p>
            )}
            <div className="mt-1 flex items-center justify-center gap-4 text-sm text-surface-500">
              {shopInfo.shop_phone && <span>{shopInfo.shop_phone}</span>}
              {shopInfo.shop_email && <span>{shopInfo.shop_email}</span>}
            </div>
            {shopInfo.shop_tin && (
              <p className="mt-1 text-xs text-surface-400">
                TIN: {shopInfo.shop_tin}
              </p>
            )}
          </div>

          {/* Invoice heading */}
          <div className="border-b border-surface-200 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">INVOICE</h2>
                <p className="text-sm font-medium text-surface-600">
                  {invoice.invoiceNumber}
                </p>
              </div>
              <div className="text-right text-sm text-surface-500">
                <p>
                  Date:{" "}
                  <span className="font-medium text-primary">
                    {formatDate(invoice.createdAt)}
                  </span>
                </p>
                {invoice.dueDate && (
                  <p>
                    Due:{" "}
                    <span className="font-medium text-primary">
                      {formatDate(invoice.dueDate)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bill To + Vehicle */}
          <div className="border-b border-surface-200 px-8 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Bill To
                </h3>
                <p className="mt-1 font-medium text-primary">{customerName}</p>
                {customer.address && (
                  <p className="text-sm text-surface-500">{customer.address}</p>
                )}
                {customer.phone && (
                  <p className="text-sm text-surface-500">{customer.phone}</p>
                )}
                {customer.email && (
                  <p className="text-sm text-surface-500">{customer.email}</p>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Vehicle
                </h3>
                {vehicle && (
                  <>
                    <p className="mt-1 font-medium text-primary">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    {vehicle.plateNumber && (
                      <p className="text-sm text-surface-500">
                        Plate: {vehicle.plateNumber}
                      </p>
                    )}
                    {vehicle.color && (
                      <p className="text-sm text-surface-500">
                        Color: {vehicle.color}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="px-8 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs font-semibold uppercase tracking-wide text-surface-400">
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4 text-center">Qty</th>
                  <th className="pb-2 pr-4 text-center">Unit</th>
                  <th className="pb-2 pr-4 text-right">Unit Price</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(groupedItems.entries()).map(([group, items]) => {
                  const groupTotal = items.reduce(
                    (sum, item) => sum + item.subtotal,
                    0
                  );
                  return (
                    <GroupSection
                      key={group}
                      group={group}
                      items={items}
                      groupTotal={groupTotal}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-surface-200 px-8 py-4">
            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Subtotal</span>
                <span className="font-medium">
                  {formatPeso(preDiscountTotal)}
                </span>
              </div>

              {hasDiscount && (
                <div className="flex justify-between text-danger-600">
                  <span>
                    Discount
                    {invoice.discountType === "percentage"
                      ? ` (${(invoice.discountValue / 100).toFixed(0)}%)`
                      : ""}
                  </span>
                  <span>
                    -{formatPeso(preDiscountTotal - invoice.vatableAmount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t border-surface-300 pt-2 text-base font-bold">
                <span>Total Amount Due</span>
                <span>{formatPeso(invoice.grandTotal)}</span>
              </div>

              {/* BIR VAT Breakdown (backed out from inclusive price) */}
              {invoice.vatAmount > 0 && (
                <div className="space-y-0.5 pt-2 border-t border-dashed border-surface-200 text-xs text-surface-500">
                  <div className="flex justify-between">
                    <span>VATable Sales</span>
                    <span>{formatPeso(invoice.vatableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>12% VAT</span>
                    <span>{formatPeso(invoice.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT-Exempt Sales</span>
                    <span>{formatPeso(0)}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-surface-400 italic mt-1">*Prices are VAT-inclusive</p>

              {invoice.insurancePays > 0 && (
                <>
                  <div className="flex justify-between text-surface-500">
                    <span>Insurance Pays</span>
                    <span>{formatPeso(invoice.insurancePays)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Customer Copay</span>
                    <span>{formatPeso(invoice.customerCopay)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment Status */}
          <div className="border-t border-surface-200 px-8 py-4 flex items-center justify-between">
            <span className="text-sm text-surface-500">Payment Status</span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                PAYMENT_STATUS_COLORS[invoice.paymentStatus as PaymentStatus] ??
                "bg-surface-200 text-surface-600"
              }`}
            >
              {PAYMENT_STATUS_LABELS[invoice.paymentStatus as PaymentStatus] ??
                invoice.paymentStatus}
            </span>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t border-surface-200 px-8 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                Notes
              </h3>
              <p className="mt-1 text-sm text-surface-600 whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-surface-200 px-8 py-4 text-center text-xs text-surface-400">
            <p>Thank you for choosing {shopInfo.shop_name || "AutoServ Pro"}!</p>
            <p className="mt-1">
              This is a computer-generated invoice. No signature required.
            </p>
          </div>
        </div>
      </div>

      <PrintButton />
    </>
  );
}

// ---- Group Section sub-component ----

function GroupSection({
  group,
  items,
  groupTotal,
}: {
  group: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
  }>;
  groupTotal: number;
}) {
  const label =
    ESTIMATE_LINE_ITEM_GROUP_LABELS[group as EstimateLineItemGroup] ?? group;

  return (
    <>
      {/* Group header */}
      <tr className="bg-surface-50">
        <td
          colSpan={5}
          className="py-2 px-2 text-xs font-semibold uppercase tracking-wide text-surface-500"
        >
          {label}
        </td>
      </tr>

      {/* Items */}
      {items.map((item) => (
        <tr key={item.id} className="border-b border-surface-100">
          <td className="py-2 pr-4 text-primary">{item.description}</td>
          <td className="py-2 pr-4 text-center text-surface-600">
            {item.quantity}
          </td>
          <td className="py-2 pr-4 text-center text-surface-600">
            {item.unit}
          </td>
          <td className="py-2 pr-4 text-right text-surface-600">
            {formatPeso(item.unitCost)}
          </td>
          <td className="py-2 text-right font-medium">
            {formatPeso(item.subtotal)}
          </td>
        </tr>
      ))}

      {/* Group subtotal */}
      <tr className="border-b border-surface-200">
        <td colSpan={4} className="py-1 pr-4 text-right text-xs text-surface-400">
          {label} Subtotal
        </td>
        <td className="py-1 text-right text-sm font-medium">
          {formatPeso(groupTotal)}
        </td>
      </tr>
    </>
  );
}

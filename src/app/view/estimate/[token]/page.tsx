import { getEstimateVersionByToken } from "@/lib/services/estimates";
import { prisma } from "@/lib/prisma";
import { formatPeso, formatDate } from "@/lib/utils";
import {
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
} from "@/types/enums";
import type { EstimateLineItemGroup } from "@/types/enums";
import { PrintButton } from "./print-button";

interface PublicEstimatePageProps {
  params: { token: string };
}

export default async function PublicEstimatePage({ params }: PublicEstimatePageProps) {
  const version = await getEstimateVersionByToken(params.token);

  if (!version) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Estimate Not Found</h1>
          <p className="mt-2 text-surface-500">
            This estimate link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  // Fetch shop settings
  const settingKeys = ["shop_name", "shop_address", "shop_phone", "shop_email", "shop_tin", "estimate_terms"];
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys } },
  });
  const shopInfo: Record<string, string> = {};
  for (const s of settings) {
    shopInfo[s.key] = s.value;
  }

  const customer = version.estimate.estimateRequest.customer;
  const vehicle = version.estimate.estimateRequest.vehicle;
  const customerName = customer.company
    ? customer.company
    : `${customer.firstName} ${customer.lastName}`;

  // Group line items
  const groupOrder: string[] = ["LABOR", "PARTS", "MATERIALS", "PAINT", "SUBLET", "OTHER"];
  const groupedItems = new Map<string, typeof version.lineItems>();
  for (const group of groupOrder) {
    const items = version.lineItems.filter((li) => li.group === group);
    if (items.length > 0) {
      groupedItems.set(group, items);
    }
  }

  // Calculate pre-discount total
  const preDiscountTotal =
    version.subtotalLabor +
    version.subtotalParts +
    version.subtotalMaterials +
    version.subtotalPaint +
    version.subtotalSublet +
    version.subtotalOther;

  const hasDiscount = version.discountType && version.discountValue > 0;

  // Compute discount amount
  let discountAmount = 0;
  if (version.discountType === "flat") {
    discountAmount = version.discountValue;
  } else if (version.discountType === "percentage") {
    discountAmount = Math.round(preDiscountTotal * (version.discountValue / 10000));
  }
  const afterDiscount = preDiscountTotal - discountAmount;

  // Determine terms text
  const termsText = version.termsAndConditions || shopInfo.estimate_terms || null;

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
              <p className="mt-1 text-sm text-surface-500">{shopInfo.shop_address}</p>
            )}
            <div className="mt-1 flex items-center justify-center gap-4 text-sm text-surface-500">
              {shopInfo.shop_phone && <span>{shopInfo.shop_phone}</span>}
              {shopInfo.shop_email && <span>{shopInfo.shop_email}</span>}
            </div>
            {shopInfo.shop_tin && (
              <p className="mt-1 text-xs text-surface-400">TIN: {shopInfo.shop_tin}</p>
            )}
          </div>

          {/* Estimate Heading */}
          <div className="border-b border-surface-200 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">ESTIMATE</h2>
                <p className="text-sm font-medium text-surface-600">
                  {version.versionLabel}
                </p>
              </div>
              <div className="text-right text-sm text-surface-500">
                <p>
                  Date:{" "}
                  <span className="font-medium text-primary">
                    {formatDate(version.createdAt)}
                  </span>
                </p>
                {version.estimatedDays && (
                  <p>
                    Est. Duration:{" "}
                    <span className="font-medium text-primary">
                      {version.estimatedDays} working day{version.estimatedDays !== 1 ? "s" : ""}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer + Vehicle */}
          <div className="border-b border-surface-200 px-8 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Customer
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
                      <p className="text-sm text-surface-500">Plate: {vehicle.plateNumber}</p>
                    )}
                    {vehicle.color && (
                      <p className="text-sm text-surface-500">Color: {vehicle.color}</p>
                    )}
                    {vehicle.vin && (
                      <p className="text-sm text-surface-500">VIN: {vehicle.vin}</p>
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
                  const groupTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
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
                <span className="font-medium">{formatPeso(preDiscountTotal)}</span>
              </div>

              {hasDiscount && (
                <div className="flex justify-between text-danger-600">
                  <span>
                    Discount
                    {version.discountType === "percentage"
                      ? ` (${(version.discountValue / 100).toFixed(0)}%)`
                      : ""}
                  </span>
                  <span>-{formatPeso(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-surface-300 pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatPeso(version.grandTotal)}</span>
              </div>
              <p className="text-xs text-surface-400 italic mt-1">*Prices are VAT-inclusive</p>
            </div>
          </div>

          {/* Terms & Conditions */}
          {termsText && (
            <div className="border-t border-surface-200 px-8 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                Terms & Conditions
              </h3>
              <p className="mt-1 text-sm text-surface-600 whitespace-pre-wrap">{termsText}</p>
            </div>
          )}

          {/* Signature Sections */}
          <div className="border-t border-surface-200 px-8 py-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Prepared By
                </p>
                <div className="mt-8 border-t border-surface-300 pt-1">
                  <p className="text-xs text-surface-400">Signature over Printed Name</p>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-surface-400">Date: _______________</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Customer Approval
                </p>
                <div className="mt-8 border-t border-surface-300 pt-1">
                  <p className="text-xs text-surface-400">Signature over Printed Name</p>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-surface-400">Date: _______________</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-surface-200 px-8 py-4 text-center text-xs text-surface-400">
            <p>Thank you for choosing {shopInfo.shop_name || "AutoServ Pro"}!</p>
            <p className="mt-1">
              This estimate is valid for 30 days from the date of issue.
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
      <tr className="bg-surface-50">
        <td
          colSpan={5}
          className="py-2 px-2 text-xs font-semibold uppercase tracking-wide text-surface-500"
        >
          {label}
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.id} className="border-b border-surface-100">
          <td className="py-2 pr-4 text-primary">{item.description}</td>
          <td className="py-2 pr-4 text-center text-surface-600">{item.quantity}</td>
          <td className="py-2 pr-4 text-center text-surface-600">{item.unit}</td>
          <td className="py-2 pr-4 text-right text-surface-600">{formatPeso(item.unitCost)}</td>
          <td className="py-2 text-right font-medium">{formatPeso(item.subtotal)}</td>
        </tr>
      ))}
      <tr className="border-b border-surface-200">
        <td colSpan={4} className="py-1 pr-4 text-right text-xs text-surface-400">
          {label} Subtotal
        </td>
        <td className="py-1 text-right text-sm font-medium">{formatPeso(groupTotal)}</td>
      </tr>
    </>
  );
}

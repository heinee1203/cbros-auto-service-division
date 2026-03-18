import { getSupplementByToken } from "@/lib/services/supplements";
import { formatPeso, formatDate } from "@/lib/utils";
import {
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
  SUPPLEMENT_STATUS_LABELS,
} from "@/types/enums";
import type { EstimateLineItemGroup } from "@/types/enums";
import { ApprovalForm } from "./approval-form";

// This page is public -- no authentication required
export default async function SupplementApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supplement = await getSupplementByToken(token);

  if (!supplement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Link Expired or Invalid
          </h1>
          <p className="text-gray-500">
            This approval link has expired or is no longer valid. Please contact
            the shop for a new link.
          </p>
        </div>
      </div>
    );
  }

  const { jobOrder } = supplement;
  const customer = jobOrder.customer;
  const vehicle = jobOrder.vehicle;

  // Group line items by category
  const grouped: Record<string, typeof supplement.lineItems> = {};
  for (const item of supplement.lineItems) {
    if (!grouped[item.group]) grouped[item.group] = [];
    grouped[item.group].push(item);
  }

  const subtotal =
    supplement.subtotalLabor +
    supplement.subtotalParts +
    supplement.subtotalMaterials +
    supplement.subtotalOther;

  const isSubmitted = supplement.status === "SUBMITTED";
  const isApproved = supplement.status === "APPROVED";
  const isDenied = supplement.status === "DENIED";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Shop Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            C-Bros Auto Painting
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Supplemental Estimate for Approval
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Status Banner */}
          {isApproved && (
            <div className="bg-green-50 border-b border-green-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-800">
                    Already Approved
                  </p>
                  <p className="text-sm text-green-600">
                    This supplement was approved on{" "}
                    {supplement.approvedAt
                      ? formatDate(supplement.approvedAt)
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isDenied && (
            <div className="bg-red-50 border-b border-red-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-red-800">
                    Supplement Declined
                  </p>
                  <p className="text-sm text-red-600">
                    This supplemental estimate was declined by the customer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Job Order
                </p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {jobOrder.jobOrderNumber}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Supplement No.
                </p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {supplement.supplementNumber}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Customer
                </p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {customer.firstName} {customer.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Vehicle
                </p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                  {vehicle.color ? ` (${vehicle.color})` : ""}
                </p>
                <p className="text-xs text-gray-400">{vehicle.plateNumber}</p>
              </div>
            </div>
          </div>

          {/* Description + Reason */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Additional Work Required
            </h3>
            <p className="text-sm text-gray-600">{supplement.description}</p>
            {supplement.reason && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Reason
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {supplement.reason}
                </p>
              </div>
            )}
          </div>

          {/* Line Items by Group */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Line Items
            </h3>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-4 last:mb-0">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {ESTIMATE_LINE_ITEM_GROUP_LABELS[
                    group as EstimateLineItemGroup
                  ] ?? group}
                </h4>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 font-medium text-gray-500">
                          Description
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-500 text-center w-20">
                          Qty
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-500 text-right w-24">
                          Unit Cost
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-500 text-right w-24">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                        >
                          <td className="px-3 py-2 text-gray-900">
                            {item.description}
                            {item.notes && (
                              <span className="block text-xs text-gray-400 mt-0.5">
                                {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 font-mono">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 font-mono">
                            {formatPeso(item.unitCost)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 font-mono">
                            {formatPeso(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="max-w-xs ml-auto space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatPeso(subtotal)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 mt-1.5" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-gray-900">Total</span>
                <span className="font-mono text-gray-900">
                  {formatPeso(supplement.grandTotal)}
                </span>
              </div>
              <p className="text-xs text-gray-400 italic mt-1">*Prices are VAT-inclusive</p>
            </div>
          </div>

          {/* Approval Form or Status */}
          {isSubmitted && (
            <div className="px-6 py-6">
              <ApprovalForm token={token} />
            </div>
          )}

          {isApproved && supplement.customerSignature && (
            <div className="px-6 py-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Customer Signature
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={supplement.customerSignature}
                alt="Customer signature"
                className="border border-gray-200 rounded-lg max-h-24"
              />
              {supplement.customerComments && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Comments
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {supplement.customerComments}
                  </p>
                </div>
              )}
            </div>
          )}

          {isDenied && supplement.customerComments && (
            <div className="px-6 py-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Customer Comments
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {supplement.customerComments}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          C-Bros Auto Painting Division &middot; Supplemental Estimate Approval
        </p>
      </div>
    </div>
  );
}

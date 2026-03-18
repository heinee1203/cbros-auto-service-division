"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Wrench,
  Pencil,
  Printer,
  Send,
  Lock,
  CheckCircle,
  Package,
} from "lucide-react";
import { formatPeso } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { generateApprovalTokenAction } from "@/lib/actions/frontliner-estimate-actions";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  id: string;
  group: string;
  description: string;
  serviceCatalogId: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  sortOrder: number;
}

interface VersionData {
  id: string;
  approvalToken: string | null;
  subtotalLabor: number;
  subtotalParts: number;
  subtotalMaterials: number;
  subtotalPaint: number;
  subtotalSublet: number;
  subtotalOther: number;
  discountType: string | null;
  discountValue: number;
  grandTotal: number;
  customerSignature: string | null;
  customerComments: string | null;
  lineItems: LineItem[];
}

interface ApprovalStatusData {
  isCheckUpOnly: boolean;
  techReview: {
    signed: boolean;
    signedByName: string | null;
    signedByRole: string | null;
    signedAt: string | null;
  };
  mgmtApproval: {
    signed: boolean;
    signedByName: string | null;
    signedByRole: string | null;
    signedAt: string | null;
  };
  canStartWork: boolean;
  canPrintOrSend: boolean;
  requiresTechReview: boolean;
  requiresMgmtApproval: boolean;
}

interface EstimateDetailData {
  requestId: string;
  requestNumber: string;
  status: string;
  customerConcern: string | null;
  createdAt: string;
  customer: { name: string; phone: string } | null;
  vehicle: {
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
  } | null;
  version: VersionData | null;
  approvalStatus: ApprovalStatusData | null;
  currentUserRole: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ServiceCardData {
  serviceCatalogId: string;
  serviceName: string;
  laborItem: LineItem | null;
  partItems: LineItem[];
}

function groupLineItems(items: LineItem[]): {
  serviceCards: ServiceCardData[];
  otherItems: LineItem[];
} {
  const serviceMap = new Map<
    string,
    { serviceName: string; laborItem: LineItem | null; partItems: LineItem[] }
  >();
  const otherItems: LineItem[] = [];

  for (const item of items) {
    if (!item.serviceCatalogId) {
      otherItems.push(item);
      continue;
    }

    if (!serviceMap.has(item.serviceCatalogId)) {
      serviceMap.set(item.serviceCatalogId, {
        serviceName: "",
        laborItem: null,
        partItems: [],
      });
    }

    const entry = serviceMap.get(item.serviceCatalogId)!;

    if (item.group === "LABOR") {
      entry.laborItem = item;
      entry.serviceName = item.description;
    } else if (item.group === "PARTS") {
      entry.partItems.push(item);
    } else {
      entry.partItems.push(item);
    }

    if (!entry.serviceName && !entry.laborItem) {
      entry.serviceName = item.description;
    }
  }

  const serviceCards: ServiceCardData[] = Array.from(
    serviceMap.entries()
  ).map(([serviceCatalogId, entry]) => ({
    serviceCatalogId,
    serviceName: entry.serviceName || "Unnamed Service",
    laborItem: entry.laborItem,
    partItems: entry.partItems,
  }));

  return { serviceCards, otherItems };
}

function calculateCardTotal(card: ServiceCardData): number {
  let total = 0;
  if (card.laborItem) total += card.laborItem.subtotal;
  for (const part of card.partItems) total += part.subtotal;
  return total;
}

function calculateDiscount(
  rawTotal: number,
  discountType: string | null,
  discountValue: number
): number {
  if (!discountType || discountType === "none") return 0;
  if (discountType === "flat") return discountValue;
  if (discountType === "percentage")
    return Math.round(rawTotal * (discountValue / 10000));
  return 0;
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  NEW_INQUIRY: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA", label: "New Inquiry" },
  PENDING_ESTIMATE: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B", label: "Pending" },
  ESTIMATE_SENT: { bg: "rgba(139,92,246,0.15)", text: "#8B5CF6", label: "Sent" },
  ESTIMATE_APPROVED: { bg: "rgba(52,211,153,0.15)", text: "#34D399", label: "Approved" },
  REVISION_REQUESTED: { bg: "rgba(251,146,60,0.15)", text: "#FB923C", label: "Revision" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || {
    bg: "rgba(148,163,184,0.15)",
    text: "#94A3B8",
    label: status,
  };
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Link Copy Modal
// ---------------------------------------------------------------------------

function LinkCopyModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-sm rounded-xl p-5"
        style={{
          background: "var(--sch-surface)",
          border: "1px solid var(--sch-border)",
        }}
      >
        <h4
          className="font-semibold mb-2"
          style={{ color: "var(--sch-text)" }}
        >
          Approval Link
        </h4>
        <p
          className="text-sm mb-3"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Share this link with the customer for approval.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            readOnly
            value={url}
            className="flex-1 h-10 rounded-lg px-3 text-xs font-mono truncate"
            style={{
              background: "var(--sch-bg)",
              border: "1px solid var(--sch-border)",
              color: "var(--sch-text)",
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="h-10 px-3 rounded-lg text-sm font-semibold flex-shrink-0"
            style={{ background: "var(--sch-accent)", color: "#000" }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-lg text-sm"
          style={{
            border: "1px solid var(--sch-border)",
            color: "var(--sch-text-muted)",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RegistryEstimateDetail({ data }: { data: EstimateDetailData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);

  const version = data.version;
  const approvalStatus = data.approvalStatus;
  const canPrintOrSend = !approvalStatus || approvalStatus.canPrintOrSend;

  // Group line items
  const lineItems = version?.lineItems ?? [];
  const { serviceCards, otherItems } = groupLineItems(lineItems);

  // Compute totals
  const rawSubtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = version
    ? calculateDiscount(rawSubtotal, version.discountType, version.discountValue)
    : 0;

  // Send to customer handler
  const handleSendToCustomer = () => {
    if (!version) return;
    startTransition(async () => {
      const result = await generateApprovalTokenAction(version.id);
      if (result.success && result.data) {
        const url = `${window.location.origin}/view/estimate/${result.data.token}`;
        setApprovalUrl(url);
      } else {
        toast.error(result.error || "Failed to generate approval link");
      }
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Header                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--sch-border)" }}
      >
        <Link
          href="/schedule/registry"
          className="inline-flex items-center gap-1 text-sm mb-3"
          style={{ color: "var(--sch-text-muted)" }}
        >
          <ChevronLeft className="h-4 w-4" /> Back to Registry
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <p
              className="font-mono text-lg font-bold"
              style={{ color: "var(--sch-accent)" }}
            >
              {data.requestNumber}
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--sch-text)" }}
            >
              {data.customer?.name}
            </p>
            <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
              {[data.vehicle?.year, data.vehicle?.make, data.vehicle?.model]
                .filter(Boolean)
                .join(" ")}{" "}
              — {data.vehicle?.plateNumber} — {data.vehicle?.color}
            </p>
          </div>
          <StatusBadge status={data.status} />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Services & Pricing (read-only cards)                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="px-4 space-y-3">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Services & Pricing
        </h3>

        {serviceCards.map((card) => {
          const cardTotal = calculateCardTotal(card);
          return (
            <div
              key={card.serviceCatalogId}
              className="rounded-xl p-4"
              style={{
                background: "var(--sch-surface)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wrench
                    className="h-4 w-4"
                    style={{ color: "var(--sch-accent)" }}
                  />
                  <span
                    className="font-medium"
                    style={{ color: "var(--sch-text)" }}
                  >
                    {card.serviceName}
                  </span>
                </div>
                <span
                  className="font-mono font-bold"
                  style={{ color: "var(--sch-text)" }}
                >
                  {formatPeso(cardTotal)}
                </span>
              </div>

              {/* Labor */}
              {card.laborItem && (
                <div
                  className="flex items-center justify-between text-sm py-1"
                  style={{ color: "var(--sch-text-muted)" }}
                >
                  <span>
                    Labor: {card.laborItem.quantity} {card.laborItem.unit} x{" "}
                    {formatPeso(card.laborItem.unitCost)}
                  </span>
                  <span className="font-mono">
                    {formatPeso(card.laborItem.subtotal)}
                  </span>
                </div>
              )}

              {/* Parts */}
              {card.partItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    Parts ({card.partItems.length})
                  </p>
                  {card.partItems.map((part) => (
                    <div
                      key={part.id}
                      className="flex items-center justify-between text-sm pl-2"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      <span>
                        {part.description} ({part.quantity} x{" "}
                        {formatPeso(part.unitCost)})
                      </span>
                      <span className="font-mono">
                        {formatPeso(part.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Other items without serviceCatalogId */}
        {otherItems.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package
                  className="h-4 w-4"
                  style={{ color: "var(--sch-text-muted)" }}
                />
                <span
                  className="font-medium"
                  style={{ color: "var(--sch-text)" }}
                >
                  Other Items
                </span>
              </div>
              <span
                className="font-mono font-bold"
                style={{ color: "var(--sch-text)" }}
              >
                {formatPeso(
                  otherItems.reduce((sum, item) => sum + item.subtotal, 0)
                )}
              </span>
            </div>
            {otherItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm py-1 pl-2"
                style={{ color: "var(--sch-text-muted)" }}
              >
                <span>
                  {item.description} ({item.quantity} x{" "}
                  {formatPeso(item.unitCost)})
                </span>
                <span className="font-mono">{formatPeso(item.subtotal)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {serviceCards.length === 0 && otherItems.length === 0 && (
          <div
            className="text-center py-8 rounded-xl"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
              color: "var(--sch-text-muted)",
            }}
          >
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No line items yet</p>
          </div>
        )}

        {/* Summary */}
        {version && lineItems.length > 0 && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <div
              className="flex justify-between text-sm"
              style={{ color: "var(--sch-text-muted)" }}
            >
              <span>Subtotal</span>
              <span className="font-mono">{formatPeso(rawSubtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div
                className="flex justify-between text-sm"
                style={{ color: "#F87171" }}
              >
                <span>Discount</span>
                <span className="font-mono">-{formatPeso(discountAmount)}</span>
              </div>
            )}
            <div
              className="flex justify-between pt-2"
              style={{ borderTop: "1px solid var(--sch-border)" }}
            >
              <span
                className="font-bold"
                style={{ color: "var(--sch-text)" }}
              >
                Total
              </span>
              <span
                className="font-mono font-bold text-lg"
                style={{ color: "var(--sch-accent)" }}
              >
                {formatPeso(version.grandTotal)}
              </span>
            </div>
            <p
              className="text-xs italic"
              style={{ color: "var(--sch-text-muted)" }}
            >
              *Prices are VAT-inclusive
            </p>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Approval Status                                                */}
      {/* ----------------------------------------------------------------- */}
      {approvalStatus && version && (
        <div className="px-4 space-y-3">
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--sch-text-muted)" }}
          >
            Approval Status
          </h3>

          {/* Tech Review */}
          {approvalStatus.requiresTechReview && (
            <div
              className="rounded-xl p-3 flex items-center justify-between"
              style={{
                background: "var(--sch-surface)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <div className="flex items-center gap-2">
                {approvalStatus.techReview.signed ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : (
                  <div
                    className="h-5 w-5 rounded-full border-2"
                    style={{ borderColor: "var(--sch-text-muted)" }}
                  />
                )}
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--sch-text)" }}
                  >
                    Technical Review
                  </p>
                  {approvalStatus.techReview.signed ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      {approvalStatus.techReview.signedByName} &mdash;{" "}
                      {new Date(
                        approvalStatus.techReview.signedAt!
                      ).toLocaleDateString()}
                    </p>
                  ) : (
                    <p
                      className="text-xs"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      Requires Service Manager or Chief Mechanic
                    </p>
                  )}
                </div>
              </div>
              {!approvalStatus.techReview.signed &&
                can(
                  data.currentUserRole as UserRole,
                  "estimate:tech_review"
                ) && (
                  <Link
                    href={`/frontliner/estimate/${version.id}/approve`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: "rgba(52,211,153,0.15)",
                      color: "#34D399",
                    }}
                  >
                    Sign
                  </Link>
                )}
            </div>
          )}

          {/* Mgmt Approval */}
          {approvalStatus.requiresMgmtApproval && (
            <div
              className="rounded-xl p-3 flex items-center justify-between"
              style={{
                background: "var(--sch-surface)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <div className="flex items-center gap-2">
                {approvalStatus.mgmtApproval.signed ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : (
                  <div
                    className="h-5 w-5 rounded-full border-2"
                    style={{ borderColor: "var(--sch-text-muted)" }}
                  />
                )}
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--sch-text)" }}
                  >
                    Management Approval
                  </p>
                  {approvalStatus.mgmtApproval.signed ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      {approvalStatus.mgmtApproval.signedByName} &mdash;{" "}
                      {new Date(
                        approvalStatus.mgmtApproval.signedAt!
                      ).toLocaleDateString()}
                    </p>
                  ) : !approvalStatus.techReview.signed ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      Pending technical review
                    </p>
                  ) : (
                    <p
                      className="text-xs"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      Requires GM or Operations Manager
                    </p>
                  )}
                </div>
              </div>
              {!approvalStatus.mgmtApproval.signed &&
                approvalStatus.techReview.signed &&
                can(
                  data.currentUserRole as UserRole,
                  "estimate:mgmt_approve"
                ) && (
                  <Link
                    href={`/frontliner/estimate/${version.id}/approve`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: "rgba(52,211,153,0.15)",
                      color: "#34D399",
                    }}
                  >
                    Sign
                  </Link>
                )}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. Actions                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="px-4 space-y-3">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Actions
        </h3>

        {/* Edit Estimate */}
        {version && (
          <Link
            href={`/frontliner/estimate/${version.id}?returnTo=${encodeURIComponent(`/schedule/registry/estimate/${data.requestId}`)}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--sch-surface)",
              color: "var(--sch-text)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <Pencil className="h-4 w-4" /> Edit Estimate
          </Link>
        )}

        {/* Print Estimate */}
        {version?.approvalToken &&
          (canPrintOrSend ? (
            <a
              href={`/view/estimate/${version.approvalToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--sch-surface)",
                color: "var(--sch-text)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <Printer className="h-4 w-4" /> Print Estimate
            </a>
          ) : (
            <div
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold opacity-40 cursor-not-allowed"
              style={{
                background: "var(--sch-surface)",
                color: "var(--sch-text-muted)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <Lock className="h-4 w-4" /> Print (Requires management approval)
            </div>
          ))}

        {/* Send to Customer */}
        {version &&
          (canPrintOrSend ? (
            <button
              onClick={handleSendToCustomer}
              disabled={isPending}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{
                background: "rgba(245,158,11,0.15)",
                color: "var(--sch-accent)",
                border: "1px solid var(--sch-accent)",
              }}
            >
              <Send className="h-4 w-4" />{" "}
              {isPending ? "Generating..." : "Send to Customer"}
            </button>
          ) : (
            <div
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold opacity-40 cursor-not-allowed"
              style={{
                background: "var(--sch-surface)",
                color: "var(--sch-text-muted)",
                border: "1px solid var(--sch-border)",
              }}
            >
              <Lock className="h-4 w-4" /> Send (Requires management approval)
            </div>
          ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. Customer Approval                                              */}
      {/* ----------------------------------------------------------------- */}
      {data.status === "ESTIMATE_SENT" && (
        <div className="px-4">
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--sch-text-muted)" }}>
              Awaiting customer response
            </p>
          </div>
        </div>
      )}
      {data.status === "ESTIMATE_APPROVED" && version?.customerSignature && (
        <div className="px-4">
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "#34D399" }}>
              Customer Approved
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={version.customerSignature}
              alt="Customer signature"
              className="h-12 mt-2"
            />
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. Notes / Concerns                                               */}
      {/* ----------------------------------------------------------------- */}
      {data.customerConcern && (
        <div className="px-4 space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--sch-text-muted)" }}
          >
            Customer Concern
          </h3>
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: "var(--sch-text)" }}
            >
              {data.customerConcern}
            </p>
          </div>
        </div>
      )}

      {/* Approval URL Modal */}
      {approvalUrl && (
        <LinkCopyModal
          url={approvalUrl}
          onClose={() => setApprovalUrl(null)}
        />
      )}
    </div>
  );
}

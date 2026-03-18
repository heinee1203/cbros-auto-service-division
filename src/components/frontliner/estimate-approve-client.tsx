"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  Shield,
  ShieldCheck,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { SignaturePad } from "@/components/ui/signature-pad";
import {
  signTechReviewAction,
  signMgmtApprovalAction,
} from "@/lib/actions/estimate-actions";
import { can } from "@/lib/permissions";
import { type UserRole } from "@/types/enums";
import { formatPeso } from "@/lib/utils";

interface LineItem {
  description: string;
  group: string;
  subtotal: number;
}

interface ApprovalLevel {
  signed: boolean;
  signedByName: string | null;
  signedByRole: string | null;
  signedAt: string | null;
}

interface ApprovalStatus {
  isCheckUpOnly: boolean;
  techReview: ApprovalLevel;
  mgmtApproval: ApprovalLevel;
  canStartWork: boolean;
  canPrintOrSend: boolean;
  requiresTechReview: boolean;
  requiresMgmtApproval: boolean;
}

interface ApproveData {
  versionId: string;
  customerName: string;
  vehiclePlate: string;
  vehicleDesc: string;
  grandTotal: number;
  lineItems: LineItem[];
  approvalStatus: ApprovalStatus;
  currentUserRole: string;
}

interface Props {
  data: ApproveData;
}

const GROUP_LABELS: Record<string, string> = {
  LABOR: "Labor",
  PARTS: "Parts",
  MATERIALS: "Materials",
  PAINT: "Paint",
  SUBLET: "Sublet",
  OTHER: "Other",
};

export function FrontlinerApproveClient({ data }: Props) {
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const signatureRef = useRef<string | null>(null);

  const role = data.currentUserRole as UserRole;
  const { approvalStatus } = data;

  // Determine which level the user can sign
  let canSignLevel: 1 | 2 | null = null;
  if (
    !approvalStatus.techReview.signed &&
    can(role, "estimate:tech_review")
  ) {
    canSignLevel = 1;
  } else if (
    approvalStatus.techReview.signed &&
    !approvalStatus.mgmtApproval.signed &&
    can(role, "estimate:mgmt_approve")
  ) {
    canSignLevel = 2;
  }

  const handleSign = async () => {
    if (!signatureRef.current || !canSignLevel) return;

    setSigning(true);
    try {
      const action =
        canSignLevel === 1 ? signTechReviewAction : signMgmtApprovalAction;
      const result = await action(data.versionId, signatureRef.current);

      if (result.success) {
        toast.success(
          canSignLevel === 1
            ? "Technical review signed"
            : "Management approval signed"
        );
        router.push("/frontliner/jobs");
      } else {
        toast.error(result.error || "Failed to sign");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--sch-bg)", color: "var(--sch-text)" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 h-14 shrink-0"
        style={{
          borderBottom: "1px solid var(--sch-border)",
          background: "var(--sch-surface)",
        }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-lg"
          style={{ color: "var(--sch-text-muted)" }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold" style={{ color: "var(--sch-text)" }}>
          Approve Estimate
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Customer / Vehicle / Total */}
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            background: "var(--sch-surface)",
            border: "1px solid var(--sch-border)",
          }}
        >
          <div>
            <p
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Customer
            </p>
            <p className="text-sm font-medium">{data.customerName}</p>
          </div>
          <div>
            <p
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Vehicle
            </p>
            <p className="text-sm font-medium">
              {data.vehiclePlate}
              {data.vehicleDesc ? ` \u2014 ${data.vehicleDesc}` : ""}
            </p>
          </div>
          <div>
            <p
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Total
            </p>
            <p className="text-lg font-bold">{formatPeso(data.grandTotal)}</p>
          </div>
        </div>

        {/* Line items */}
        {data.lineItems.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Services
            </p>
            <div className="space-y-2">
              {data.lineItems.map((li, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{li.description}</p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--sch-text-muted)" }}
                    >
                      {GROUP_LABELS[li.group] || li.group}
                    </p>
                  </div>
                  <p className="text-sm font-medium ml-3 shrink-0">
                    {formatPeso(li.subtotal)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval status */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--sch-surface)",
            border: "1px solid var(--sch-border)",
          }}
        >
          <p
            className="text-xs uppercase tracking-wide mb-3"
            style={{ color: "var(--sch-text-muted)" }}
          >
            Approval Status
          </p>
          <div className="space-y-3">
            {/* Tech review */}
            <div className="flex items-center gap-3">
              {approvalStatus.techReview.signed ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Shield
                  className="w-5 h-5 shrink-0"
                  style={{ color: "var(--sch-text-muted)" }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Technical Review</p>
                {approvalStatus.techReview.signed ? (
                  <p
                    className="text-xs"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    Signed by {approvalStatus.techReview.signedByName}
                  </p>
                ) : (
                  <p
                    className="text-xs"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    {approvalStatus.requiresTechReview
                      ? "Awaiting signature"
                      : "Not required"}
                  </p>
                )}
              </div>
            </div>

            {/* Management approval */}
            <div className="flex items-center gap-3">
              {approvalStatus.mgmtApproval.signed ? (
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Shield
                  className="w-5 h-5 shrink-0"
                  style={{ color: "var(--sch-text-muted)" }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Management Approval</p>
                {approvalStatus.mgmtApproval.signed ? (
                  <p
                    className="text-xs"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    Signed by {approvalStatus.mgmtApproval.signedByName}
                  </p>
                ) : (
                  <p
                    className="text-xs"
                    style={{ color: "var(--sch-text-muted)" }}
                  >
                    {approvalStatus.requiresMgmtApproval
                      ? approvalStatus.techReview.signed
                        ? "Awaiting signature"
                        : "Pending tech review"
                      : "Not required"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Signature pad (only if user can sign) */}
        {canSignLevel !== null && (
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: "var(--sch-text-muted)" }}
            >
              {canSignLevel === 1
                ? "Sign Technical Review"
                : "Sign Management Approval"}
            </p>
            <SignaturePad
              onSave={(dataUrl) => {
                signatureRef.current = dataUrl;
              }}
              width={320}
              height={150}
              label="Sign here"
              disabled={signing}
            />
            <button
              onClick={handleSign}
              disabled={signing}
              className="mt-4 h-12 w-full rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: signing ? "#6b7280" : "#059669" }}
            >
              {signing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing...
                </span>
              ) : (
                "Confirm & Sign"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

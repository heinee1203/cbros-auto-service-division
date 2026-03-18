"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { SignaturePad } from "@/components/ui/signature-pad";
import {
  signTechReviewAction,
  signMgmtApprovalAction,
} from "@/lib/actions/estimate-actions";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { formatDate } from "@/lib/utils";

interface ApprovalStatus {
  isCheckUpOnly: boolean;
  techReview: {
    signed: boolean;
    signedByName: string | null;
    signedByRole: string | null;
    signedAt: Date | string | null;
  };
  mgmtApproval: {
    signed: boolean;
    signedByName: string | null;
    signedByRole: string | null;
    signedAt: Date | string | null;
  };
  canStartWork: boolean;
  canPrintOrSend: boolean;
  requiresTechReview: boolean;
  requiresMgmtApproval: boolean;
}

interface EstimateApprovalPanelProps {
  versionId: string;
  approvalStatus: ApprovalStatus;
  currentUserRole: string;
}

export function EstimateApprovalPanel({
  versionId,
  approvalStatus,
  currentUserRole,
}: EstimateApprovalPanelProps) {
  const router = useRouter();
  const [signingLevel, setSigningLevel] = useState<1 | 2 | null>(null);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    isCheckUpOnly,
    techReview,
    mgmtApproval,
    requiresTechReview,
    requiresMgmtApproval,
  } = approvalStatus;

  // If check-up only and neither review nor approval is required, show nothing
  if (isCheckUpOnly && !requiresTechReview && !requiresMgmtApproval) {
    return null;
  }

  // If neither is required, show nothing
  if (!requiresTechReview && !requiresMgmtApproval) {
    return null;
  }

  const role = currentUserRole as UserRole;
  const canTechReview = can(role, "estimate:tech_review");
  const canMgmtApprove = can(role, "estimate:mgmt_approve");
  const fullyApproved =
    (!requiresTechReview || techReview.signed) &&
    (!requiresMgmtApproval || mgmtApproval.signed);

  function handleOpenSign(level: 1 | 2) {
    setPendingSignature(null);
    setSigningLevel(level);
  }

  function handleCloseSign() {
    setSigningLevel(null);
    setPendingSignature(null);
  }

  function handleConfirmSign() {
    if (!pendingSignature || !signingLevel) return;

    startTransition(async () => {
      const action =
        signingLevel === 1 ? signTechReviewAction : signMgmtApprovalAction;
      const result = await action(versionId, pendingSignature);

      if (result.success) {
        toast.success(
          signingLevel === 1
            ? "Technical review signed"
            : "Management approval signed"
        );
        handleCloseSign();
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to sign");
      }
    });
  }

  return (
    <>
      <div className="rounded-xl border border-surface-200 bg-white p-4">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-700">
          {fullyApproved ? (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700">Fully Approved</span>
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 text-surface-500" />
              <span>Approval Status</span>
            </>
          )}
        </div>

        {/* Level 1: Technical Review */}
        {requiresTechReview && (
          <div className="flex items-start gap-3 rounded-lg border border-surface-100 bg-surface-50 px-3 py-2.5 mb-2">
            {techReview.signed ? (
              <>
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-800">
                    Technical Review
                  </p>
                  <p className="text-xs text-surface-500">
                    Signed by: {techReview.signedByName}{" "}
                    ({techReview.signedByRole})
                  </p>
                  {techReview.signedAt && (
                    <p className="text-xs text-surface-400">
                      {formatDate(techReview.signedAt as Date | string)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-800">
                    Technical Review
                  </p>
                  <p className="text-xs text-surface-500">
                    Requires Service Manager or Chief Mechanic
                  </p>
                </div>
                {canTechReview && (
                  <button
                    type="button"
                    onClick={() => handleOpenSign(1)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Sign Review ✍
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Level 2: Management Approval */}
        {requiresMgmtApproval && (
          <div className="flex items-start gap-3 rounded-lg border border-surface-100 bg-surface-50 px-3 py-2.5">
            {mgmtApproval.signed ? (
              <>
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-800">
                    Management Approval
                  </p>
                  <p className="text-xs text-surface-500">
                    Signed by: {mgmtApproval.signedByName}{" "}
                    ({mgmtApproval.signedByRole})
                  </p>
                  {mgmtApproval.signedAt && (
                    <p className="text-xs text-surface-400">
                      {formatDate(mgmtApproval.signedAt as Date | string)}
                    </p>
                  )}
                </div>
              </>
            ) : requiresTechReview && !techReview.signed ? (
              <>
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-surface-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-400">
                    Management Approval
                  </p>
                  <p className="text-xs text-surface-400">
                    Pending technical review
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-800">
                    Management Approval
                  </p>
                  {!canMgmtApprove && (
                    <p className="text-xs text-surface-500">
                      Requires GM or Operations Manager
                    </p>
                  )}
                </div>
                {canMgmtApprove && (
                  <button
                    type="button"
                    onClick={() => handleOpenSign(2)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Sign Approval ✍
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Sign Modal */}
      {signingLevel !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-surface-800">
              {signingLevel === 1
                ? "Sign Technical Review"
                : "Sign Management Approval"}
            </h3>
            <p className="mb-4 text-sm text-surface-500">
              {signingLevel === 1
                ? "By signing, you confirm you have reviewed the estimate and approve the pricing."
                : "By signing, you confirm management approval of this estimate."}
            </p>

            <SignaturePad
              onSave={(dataUrl) => setPendingSignature(dataUrl)}
              width={350}
              height={150}
              label="Sign here"
            />

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseSign}
                disabled={isPending}
                className="px-6 py-3 text-surface-500 hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSign}
                disabled={!pendingSignature || isPending}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm &amp; Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEstimateRequestById } from "@/lib/services/estimate-requests";
import { getApprovalStatus } from "@/lib/services/estimate-approvals";
import { EstimateDetailClient } from "@/components/estimates/estimate-detail-client";

interface Props {
  params: { id: string };
}

export default async function EstimateDetailPage({ params }: Props) {
  const [estimateRequest, session] = await Promise.all([
    getEstimateRequestById(params.id),
    getServerSession(authOptions),
  ]);

  if (!estimateRequest) {
    notFound();
  }

  // Get latest version for approval status
  const version =
    estimateRequest.estimates.length > 0 &&
    estimateRequest.estimates[0].versions.length > 0
      ? estimateRequest.estimates[0].versions[0]
      : null;

  const approvalStatus = version ? await getApprovalStatus(version.id) : null;

  return (
    <EstimateDetailClient
      estimateRequest={estimateRequest}
      approvalStatus={
        approvalStatus
          ? {
              ...approvalStatus,
              techReview: {
                ...approvalStatus.techReview,
                signedAt:
                  approvalStatus.techReview.signedAt?.toISOString() ?? null,
              },
              mgmtApproval: {
                ...approvalStatus.mgmtApproval,
                signedAt:
                  approvalStatus.mgmtApproval.signedAt?.toISOString() ?? null,
              },
            }
          : null
      }
      currentUserRole={session?.user?.role ?? "ADVISOR"}
    />
  );
}

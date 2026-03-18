import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import type { UserRole as UserRoleType } from "@/types/enums";

/**
 * Sign the Level 1 technical review on an estimate version.
 */
export async function signTechReview(
  versionId: string,
  userId: string,
  signature: string
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (!can(user.role as UserRoleType, "estimate:tech_review")) {
    throw new Error("You do not have permission to sign the technical review");
  }

  const version = await prisma.estimateVersion.findUniqueOrThrow({
    where: { id: versionId },
  });

  if (version.techReviewSignedAt) {
    throw new Error("Already signed");
  }

  await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      techReviewSignature: signature,
      techReviewSignedBy: userId,
      techReviewSignedAt: new Date(),
      techReviewRole: user.role,
    },
  });
}

/**
 * Sign the Level 2 management approval on an estimate version.
 */
export async function signMgmtApproval(
  versionId: string,
  userId: string,
  signature: string
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (!can(user.role as UserRoleType, "estimate:mgmt_approve")) {
    throw new Error(
      "You do not have permission to sign the management approval"
    );
  }

  const version = await prisma.estimateVersion.findUniqueOrThrow({
    where: { id: versionId },
  });

  if (!version.techReviewSignedAt) {
    throw new Error("Technical review must be completed first");
  }

  if (version.mgmtApprovalSignedAt) {
    throw new Error("Already signed");
  }

  await prisma.estimateVersion.update({
    where: { id: versionId },
    data: {
      mgmtApprovalSignature: signature,
      mgmtApprovalSignedBy: userId,
      mgmtApprovalSignedAt: new Date(),
      mgmtApprovalRole: user.role,
    },
  });
}

/**
 * Get the full approval status for an estimate version, including
 * whether tech review and management approval are required based
 * on system settings, line items, and bypass thresholds.
 */
export async function getApprovalStatus(versionId: string) {
  const version = await prisma.estimateVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: {
      lineItems: {
        where: { deletedAt: null },
        include: { serviceCatalog: true },
      },
    },
  });

  // Detect check-up only: all non-deleted line items are "Check-Up Only"
  const isCheckUpOnly =
    version.lineItems.length > 0 &&
    version.lineItems.every(
      (item) =>
        item.serviceCatalog?.name === "Check-Up Only" &&
        item.serviceCatalog?.category === "Diagnostics & Inspection"
    );

  // Fetch approval settings
  const [
    requireTechSetting,
    requireMgmtSetting,
    techBypassSetting,
    mgmtBypassSetting,
  ] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: "estimate_require_tech_review" },
    }),
    prisma.setting.findUnique({
      where: { key: "estimate_require_mgmt_approval" },
    }),
    prisma.setting.findUnique({
      where: { key: "estimate_tech_review_bypass_below" },
    }),
    prisma.setting.findUnique({
      where: { key: "estimate_mgmt_approval_bypass_below" },
    }),
  ]);

  const requireTechReview = requireTechSetting?.value !== "false";
  const requireMgmtApproval = requireMgmtSetting?.value !== "false";
  const techBypassBelow = parseInt(techBypassSetting?.value ?? "0", 10);
  const mgmtBypassBelow = parseInt(mgmtBypassSetting?.value ?? "0", 10);

  // Determine if review/approval is actually required
  const techReviewRequired =
    requireTechReview &&
    !isCheckUpOnly &&
    (techBypassBelow === 0 || version.grandTotal >= techBypassBelow);
  const mgmtApprovalRequired =
    requireMgmtApproval &&
    !isCheckUpOnly &&
    (mgmtBypassBelow === 0 || version.grandTotal >= mgmtBypassBelow);

  // Fetch signer names if signed
  let techSignerName: string | null = null;
  let mgmtSignerName: string | null = null;

  if (version.techReviewSignedBy) {
    const signer = await prisma.user.findUnique({
      where: { id: version.techReviewSignedBy },
    });
    if (signer) techSignerName = `${signer.firstName} ${signer.lastName}`;
  }
  if (version.mgmtApprovalSignedBy) {
    const signer = await prisma.user.findUnique({
      where: { id: version.mgmtApprovalSignedBy },
    });
    if (signer) mgmtSignerName = `${signer.firstName} ${signer.lastName}`;
  }

  const techSigned = !!version.techReviewSignedAt;
  const mgmtSigned = !!version.mgmtApprovalSignedAt;

  return {
    isCheckUpOnly,
    techReview: {
      signed: techSigned,
      signedByName: techSignerName,
      signedByRole: version.techReviewRole,
      signedAt: version.techReviewSignedAt,
    },
    mgmtApproval: {
      signed: mgmtSigned,
      signedByName: mgmtSignerName,
      signedByRole: version.mgmtApprovalRole,
      signedAt: version.mgmtApprovalSignedAt,
    },
    canStartWork: !techReviewRequired || techSigned,
    canPrintOrSend: !mgmtApprovalRequired || mgmtSigned,
    requiresTechReview: techReviewRequired,
    requiresMgmtApproval: mgmtApprovalRequired,
  };
}

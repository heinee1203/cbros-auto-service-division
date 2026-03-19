import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEstimateRequestById } from "@/lib/services/estimate-requests";
import { getApprovalStatus } from "@/lib/services/estimate-approvals";
import dynamic from "next/dynamic";

const EstimateDetailClient = dynamic(
  () =>
    import("@/components/schedule/registry-estimate-detail").then((m) => ({
      default: m.RegistryEstimateDetail,
    })),
  { ssr: false }
);

export default async function RegistryEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const request = await getEstimateRequestById(id);
  if (!request) notFound();

  // Find the latest estimate version
  const estimate = request.estimates?.[0];
  const latestVersion = estimate?.versions?.sort(
    (a: { versionNumber: number }, b: { versionNumber: number }) =>
      b.versionNumber - a.versionNumber
  )[0];

  let approvalStatus = null;
  if (latestVersion) {
    const status = await getApprovalStatus(latestVersion.id);
    approvalStatus = {
      ...status,
      techReview: {
        ...status.techReview,
        signedAt: status.techReview.signedAt?.toISOString() ?? null,
      },
      mgmtApproval: {
        ...status.mgmtApproval,
        signedAt: status.mgmtApproval.signedAt?.toISOString() ?? null,
      },
    };
  }

  // Serialize data for client
  const data = {
    requestId: request.id,
    requestNumber: request.requestNumber,
    status: request.status,
    vehiclePresent: request.vehiclePresent,
    customerConcern: request.customerConcern,
    createdAt: request.createdAt.toISOString(),
    customer: request.customer
      ? {
          name: `${request.customer.firstName} ${request.customer.lastName}`,
          phone: request.customer.phone,
        }
      : null,
    vehicle: request.vehicle
      ? {
          plateNumber: request.vehicle.plateNumber,
          make: request.vehicle.make,
          model: request.vehicle.model,
          year: request.vehicle.year,
          color: request.vehicle.color,
        }
      : null,
    version: latestVersion
      ? {
          id: latestVersion.id,
          approvalToken: latestVersion.approvalToken,
          subtotalLabor: latestVersion.subtotalLabor,
          subtotalParts: latestVersion.subtotalParts,
          subtotalMaterials: latestVersion.subtotalMaterials,
          subtotalPaint: latestVersion.subtotalPaint,
          subtotalSublet: latestVersion.subtotalSublet,
          subtotalOther: latestVersion.subtotalOther,
          discountType: latestVersion.discountType,
          discountValue: latestVersion.discountValue,
          grandTotal: latestVersion.grandTotal,
          customerSignature: latestVersion.customerSignature,
          customerComments: latestVersion.customerComments,
          lineItems: (latestVersion.lineItems || [])
            .filter((li) => !li.deletedAt)
            .map((li) => ({
              id: li.id,
              group: li.group,
              description: li.description,
              serviceCatalogId: li.serviceCatalogId,
              quantity: li.quantity,
              unit: li.unit,
              unitCost: li.unitCost,
              subtotal: li.subtotal,
              sortOrder: li.sortOrder,
            })),
        }
      : null,
    approvalStatus,
    currentUserRole: session.user.role,
  };

  return <EstimateDetailClient data={data} />;
}

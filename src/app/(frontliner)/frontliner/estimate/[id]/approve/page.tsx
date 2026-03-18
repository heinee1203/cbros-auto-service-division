import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEstimateVersionById } from "@/lib/services/estimates";
import { getApprovalStatus } from "@/lib/services/estimate-approvals";
import dynamic from "next/dynamic";

const FrontlinerApproveClient = dynamic(
  () =>
    import("@/components/frontliner/estimate-approve-client").then((m) => ({
      default: m.FrontlinerApproveClient,
    })),
  { ssr: false }
);

interface Props {
  params: { id: string };
}

export default async function FrontlinerApprovePage({ params }: Props) {
  const { id } = params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const version = await getEstimateVersionById(id);
  if (!version) notFound();

  const approvalStatus = await getApprovalStatus(id);

  // Extract display data
  const customer = version.estimate?.estimateRequest?.customer;
  const vehicle = version.estimate?.estimateRequest?.vehicle;

  const data = {
    versionId: id,
    customerName: customer
      ? `${customer.firstName} ${customer.lastName}`
      : "Unknown",
    vehiclePlate: vehicle?.plateNumber ?? "",
    vehicleDesc: vehicle
      ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
      : "",
    grandTotal: version.grandTotal,
    lineItems:
      version.lineItems
        ?.filter((li) => !li.deletedAt)
        .map((li) => ({
          description: li.description,
          group: li.group,
          subtotal: li.subtotal,
        })) ?? [],
    approvalStatus: {
      ...approvalStatus,
      techReview: {
        ...approvalStatus.techReview,
        signedAt: approvalStatus.techReview.signedAt?.toISOString() ?? null,
      },
      mgmtApproval: {
        ...approvalStatus.mgmtApproval,
        signedAt: approvalStatus.mgmtApproval.signedAt?.toISOString() ?? null,
      },
    },
    currentUserRole: session.user.role,
  };

  return <FrontlinerApproveClient data={data} />;
}

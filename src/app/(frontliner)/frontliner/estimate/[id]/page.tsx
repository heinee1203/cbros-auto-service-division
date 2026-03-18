import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEstimateVersionById } from "@/lib/services/estimates";
import dynamic from "next/dynamic";

const EstimateEditWrapper = dynamic(
  () =>
    import("@/components/frontliner/estimate-edit-wrapper").then((m) => ({
      default: m.EstimateEditWrapper,
    })),
  { ssr: false }
);

interface Props {
  params: { id: string };
  searchParams: { returnTo?: string };
}

export default async function FrontlinerEditEstimatePage({ params, searchParams }: Props) {
  const { id } = params;
  const returnTo = searchParams.returnTo || "/schedule/registry";
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "estimates:create")) redirect("/frontliner");

  const version = await getEstimateVersionById(id);
  if (!version) notFound();

  // Extract customer/vehicle info for header
  const customer = version.estimate?.estimateRequest?.customer;
  const vehicle = version.estimate?.estimateRequest?.vehicle;
  const customerName = customer
    ? `${customer.firstName} ${customer.lastName}`
    : "";
  const vehiclePlate = vehicle?.plateNumber || "";

  // Serialize line items for client component
  const lineItems = version.lineItems.map((li) => ({
    id: li.id,
    group: li.group,
    description: li.description,
    serviceCatalogId: li.serviceCatalogId,
    quantity: li.quantity,
    unit: li.unit,
    unitCost: li.unitCost,
    markup: li.markup,
    subtotal: li.subtotal,
    notes: li.notes,
    estimatedHours: li.estimatedHours,
    sortOrder: li.sortOrder,
  }));

  const versionSummary = {
    subtotalLabor: version.subtotalLabor,
    subtotalParts: version.subtotalParts,
    subtotalMaterials: version.subtotalMaterials,
    subtotalPaint: version.subtotalPaint,
    subtotalSublet: version.subtotalSublet,
    subtotalOther: version.subtotalOther,
    discountType: version.discountType,
    discountValue: version.discountValue,
    grandTotal: version.grandTotal,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with customer/vehicle info */}
      <div
        className="flex items-center gap-3 px-4 h-14 border-b shrink-0"
        style={{
          borderColor: "var(--sch-border)",
          background: "var(--sch-surface)",
        }}
      >
        <a
          href={returnTo}
          className="p-2 -ml-2 rounded-lg"
          style={{ color: "var(--sch-text-muted)" }}
        >
          &larr;
        </a>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--sch-text)" }}
          >
            {customerName} &mdash; {vehiclePlate}
          </p>
          <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            Edit Estimate
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EstimateEditWrapper
          versionId={id}
          returnTo={returnTo}
          initialLineItems={lineItems}
          initialVersion={versionSummary}
        />
      </div>
    </div>
  );
}

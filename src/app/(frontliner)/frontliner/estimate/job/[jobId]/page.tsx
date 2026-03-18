import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getJobOrderDetail } from "@/lib/services/job-orders";
import dynamic from "next/dynamic";

const EstimateWizard = dynamic(
  () =>
    import("@/components/frontliner/estimate-wizard").then((m) => ({
      default: m.EstimateWizard,
    })),
  { ssr: false }
);

interface Props {
  params: { jobId: string };
}

export default async function FrontlinerJobEstimatePage({ params }: Props) {
  const { jobId } = params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "estimates:create")) redirect("/frontliner");

  const job = await getJobOrderDetail(jobId);
  if (!job) notFound();

  // Check if job already has an estimate with versions
  const existingEstimate = job.estimates?.find(
    (e) => e.versions && e.versions.length > 0
  );
  if (existingEstimate) {
    // Redirect to edit the latest version
    const latestVersion = existingEstimate.versions.sort(
      (a, b) => b.versionNumber - a.versionNumber
    )[0];
    redirect(`/frontliner/estimate/${latestVersion.id}`);
  }

  // Extract service IDs from tasks
  const serviceIds =
    job.tasks
      ?.map((t) => t.serviceCatalogId)
      .filter((id): id is string => id !== null && id !== undefined) || [];

  const customerName = `${job.customer.firstName} ${job.customer.lastName}`;
  const vehiclePlate = job.vehicle.plateNumber;
  const vehicleDesc = [job.vehicle.year, job.vehicle.make, job.vehicle.model]
    .filter(Boolean)
    .join(" ");

  return (
    <EstimateWizard
      prefilledCustomerId={job.customerId}
      prefilledVehicleId={job.vehicleId}
      prefilledServiceIds={serviceIds.length > 0 ? serviceIds : undefined}
      prefilledJobOrderId={jobId}
      customerName={customerName}
      vehiclePlate={vehiclePlate}
      vehicleDesc={vehicleDesc}
    />
  );
}

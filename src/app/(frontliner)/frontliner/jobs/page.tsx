import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getActiveJobsForFloor } from "@/lib/services/job-orders";
import { JobsClient } from "@/components/frontliner/jobs-client";

export default async function FrontlinerJobsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "jobs:view")) redirect("/frontliner");

  const rawJobs = await getActiveJobsForFloor();

  // Shape data for client — extract bayName from bayAssignments
  const jobs = rawJobs.map((jo) => ({
    id: jo.id,
    jobOrderNumber: jo.jobOrderNumber,
    status: jo.status,
    customer: {
      firstName: jo.customer.firstName,
      lastName: jo.customer.lastName,
    },
    vehicle: {
      plateNumber: jo.vehicle.plateNumber,
      make: jo.vehicle.make,
      model: jo.vehicle.model,
    },
    primaryTechnician: jo.primaryTechnician
      ? {
          firstName: jo.primaryTechnician.firstName,
          lastName: jo.primaryTechnician.lastName,
        }
      : null,
    bayName:
      jo.bayAssignments.length > 0 ? jo.bayAssignments[0].bay.name : null,
    hasEstimate:
      jo.estimates.length > 0 && jo.estimates[0].versions.length > 0,
    latestVersionId:
      jo.estimates.length > 0 && jo.estimates[0].versions.length > 0
        ? jo.estimates[0].versions[0].id
        : null,
  }));

  return <JobsClient jobs={jobs} />;
}

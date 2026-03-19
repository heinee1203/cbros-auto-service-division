import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobQueueForFloor } from "@/lib/services/job-orders";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawJobs = await getJobQueueForFloor();

  const jobs = rawJobs.map((jo) => ({
    id: jo.id,
    jobOrderNumber: jo.jobOrderNumber,
    status: jo.status,
    createdAt: jo.createdAt.toISOString(),
    actualCompletionDate: jo.actualCompletionDate?.toISOString() || null,
    incompleteIntake: jo.incompleteIntake,
    customer: {
      firstName: jo.customer.firstName,
      lastName: jo.customer.lastName,
      phone: jo.customer.phone || "",
    },
    vehicle: {
      plateNumber: jo.vehicle.plateNumber,
      make: jo.vehicle.make || "",
      model: jo.vehicle.model || "",
      year: jo.vehicle.year,
      color: jo.vehicle.color,
    },
    primaryTechnician: jo.primaryTechnician
      ? {
          firstName: jo.primaryTechnician.firstName,
          lastName: jo.primaryTechnician.lastName,
        }
      : null,
    bay: jo.bayAssignments?.[0]?.bay?.name || null,
    checkedInAt: jo.intakeRecord?.checkedInAt?.toISOString() || null,
    serviceStartedAt:
      jo.tasks?.find((t) => t.startedAt)?.startedAt?.toISOString() || null,
    estimateTotal: jo.estimates?.[0]?.versions?.[0]?.grandTotal || null,
    estimateRequestId: jo.estimates?.[0]?.estimateRequestId || null,
    latestVersionId: jo.estimates?.[0]?.versions?.[0]?.id || null,
  }));

  return NextResponse.json({ jobs });
}

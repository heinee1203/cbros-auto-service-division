import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTasksForTechnician } from "@/lib/services/tasks";
import { MyTasksClient } from "@/components/frontliner/my-tasks-client";

export default async function FrontlinerMyTasksPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const tasks = await getTasksForTechnician(session.user.id);

  // Shape tasks for client (serialize dates, calculate actual hours from time entries)
  const tasksProp = tasks.map((t) => {
    const totalMinutes = t.timeEntries.reduce((sum, te) => {
      if (te.clockOut) {
        const dur = Math.round(
          (te.clockOut.getTime() - te.clockIn.getTime()) / 60000
        );
        return sum + Math.max(0, dur - te.breakMinutes);
      }
      return sum;
    }, 0);

    return {
      id: t.id,
      name: t.name,
      status: t.status,
      estimatedHours: t.estimatedHours,
      actualHours: parseFloat((totalMinutes / 60).toFixed(2)),
      jobOrder: {
        id: t.jobOrder.id,
        jobOrderNumber: t.jobOrder.jobOrderNumber,
        vehicle: {
          plateNumber: t.jobOrder.vehicle.plateNumber,
          make: t.jobOrder.vehicle.make,
          model: t.jobOrder.vehicle.model,
        },
      },
    };
  });

  return <MyTasksClient tasks={tasksProp} />;
}

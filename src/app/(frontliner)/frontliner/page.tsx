import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getActiveEntry, getDailyEntries } from "@/lib/services/time-entries";
import { getTasksForTechnician } from "@/lib/services/tasks";
import { getJobsAwaitingQC, getActiveJobsForFloor } from "@/lib/services/job-orders";
import { getTodaysAppointments } from "@/lib/services/analytics";
import { getTechnicianCommission } from "@/lib/services/commissions";
import { TechnicianHome } from "@/components/frontliner/technician-home";
import { AdvisorHome } from "@/components/frontliner/advisor-home";
import { QCInspectorHome } from "@/components/frontliner/qc-inspector-home";

export default async function FrontlinerHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { id: userId, role, firstName } = session.user;

  if (role === "TECHNICIAN") {
    const [activeEntry, dailyEntries, tasks, commission] = await Promise.all([
      getActiveEntry(userId),
      getDailyEntries(userId, new Date()),
      getTasksForTechnician(userId),
      getTechnicianCommission(userId),
    ]);

    // Calculate daily hours from completed entries
    const totalMinutes = dailyEntries.reduce((sum, entry) => {
      if (entry.clockOut) {
        const duration = Math.round(
          (entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000
        );
        return sum + Math.max(0, duration - entry.breakMinutes);
      }
      return sum;
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const dailyHours = `${hours}h ${mins.toString().padStart(2, "0")}m`;

    // Check if on break by parsing notes
    let onBreak = false;
    if (activeEntry?.notes) {
      try {
        const parsed = JSON.parse(activeEntry.notes);
        onBreak = !!parsed.breakStartedAt;
      } catch {
        // not JSON
      }
    }

    // Shape activeEntry for client component
    const activeEntryProp = activeEntry
      ? {
          id: activeEntry.id,
          clockIn: activeEntry.clockIn.toISOString(),
          taskId: activeEntry.task.id,
          taskName: activeEntry.task.name,
          jobOrderId: activeEntry.jobOrder.id,
          jobOrderNumber: activeEntry.jobOrder.jobOrderNumber,
          breakMinutes: activeEntry.breakMinutes,
          onBreak,
        }
      : null;

    // Shape tasks for client component
    const tasksProp = tasks.map((t) => {
      const totalEntryMinutes = t.timeEntries.reduce((sum, te) => {
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
        actualHours: parseFloat((totalEntryMinutes / 60).toFixed(2)),
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

    const commissionProp = {
      thisWeek: {
        amount: commission.thisWeek.amount,
        jobs: commission.thisWeek.jobs,
      },
      lastWeek: {
        amount: commission.lastWeek.amount,
        jobs: commission.lastWeek.jobs,
        status: commission.lastWeek.status,
      },
    };

    return (
      <TechnicianHome
        firstName={firstName}
        activeEntry={activeEntryProp}
        dailyHours={dailyHours}
        tasks={tasksProp}
        commission={commissionProp}
      />
    );
  }

  if (role === "QC_INSPECTOR") {
    const qcJobs = await getJobsAwaitingQC();

    const qcJobsProp = qcJobs.map((j) => ({
      id: j.id,
      jobOrderNumber: j.jobOrderNumber,
      customer: {
        firstName: j.customer.firstName,
        lastName: j.customer.lastName,
      },
      vehicle: {
        plateNumber: j.vehicle.plateNumber,
        make: j.vehicle.make,
        model: j.vehicle.model,
      },
      primaryTechnician: j.primaryTechnician
        ? {
            firstName: j.primaryTechnician.firstName,
            lastName: j.primaryTechnician.lastName,
          }
        : null,
      estimates: j.estimates.map((e) => ({
        estimateRequest: e.estimateRequest
          ? { requestedCategories: e.estimateRequest.requestedCategories }
          : null,
      })),
    }));

    return <QCInspectorHome firstName={firstName} qcJobs={qcJobsProp} />;
  }

  // ADVISOR, OWNER, MANAGER, etc.
  const [appointments, activeJobs] = await Promise.all([
    getTodaysAppointments(),
    getActiveJobsForFloor(),
  ]);

  const appointmentsProp = appointments.map((a) => ({
    id: a.id,
    scheduledTime: a.scheduledTime,
    customer: {
      firstName: a.customer.firstName,
      lastName: a.customer.lastName,
    },
    vehicle: a.vehicle
      ? {
          plateNumber: a.vehicle.plateNumber,
          make: a.vehicle.make,
          model: a.vehicle.model,
        }
      : { plateNumber: "N/A", make: "", model: "" },
    serviceType: a.type ?? null,
  }));

  const activeJobsProp = activeJobs.map((j) => ({
    id: j.id,
    jobOrderNumber: j.jobOrderNumber,
    status: j.status,
    customer: {
      id: j.customer.id,
      firstName: j.customer.firstName,
      lastName: j.customer.lastName,
      phone: j.customer.phone,
    },
    vehicle: {
      id: j.vehicle.id,
      plateNumber: j.vehicle.plateNumber,
      make: j.vehicle.make,
      model: j.vehicle.model,
    },
    primaryTechnician: j.primaryTechnician
      ? {
          id: j.primaryTechnician.id,
          firstName: j.primaryTechnician.firstName,
          lastName: j.primaryTechnician.lastName,
        }
      : null,
    bayAssignments: j.bayAssignments.map((ba) => ({
      bay: { name: ba.bay.name },
    })),
  }));

  return (
    <AdvisorHome
      firstName={firstName}
      appointments={appointmentsProp}
      activeJobs={activeJobsProp}
    />
  );
}

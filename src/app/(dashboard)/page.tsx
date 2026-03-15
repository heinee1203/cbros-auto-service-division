import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDashboardMetrics, getMyDashboard, getTodaysAppointments } from "@/lib/services/analytics";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) {
    return <div className="p-6 text-surface-400">Please log in.</div>;
  }

  const userRole = session.user.role;
  const isManager = can(userRole, "analytics:view"); // OWNER or MANAGER

  let dashboardData;
  let todaysAppointments;

  if (isManager) {
    const [metrics, appointments] = await Promise.all([
      getDashboardMetrics(),
      getTodaysAppointments(),
    ]);
    dashboardData = metrics;
    todaysAppointments = appointments;
  } else {
    dashboardData = await getMyDashboard(session.user.id, userRole);
  }

  return (
    <DashboardClient
      userName={session.user.firstName}
      userRole={userRole}
      isManager={isManager}
      data={JSON.parse(JSON.stringify(dashboardData))}
      todaysAppointments={todaysAppointments ? JSON.parse(JSON.stringify(todaysAppointments)) : undefined}
    />
  );
}

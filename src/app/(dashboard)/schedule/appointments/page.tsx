import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import AppointmentsCalendar from "@/components/schedule/appointments-calendar";
import { ScheduleNav } from "@/components/schedule/schedule-nav";

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div className="space-y-4">
      <ScheduleNav />
      <AppointmentsCalendar canManage={can(session.user.role, "schedule:appointments")} />
    </div>
  );
}

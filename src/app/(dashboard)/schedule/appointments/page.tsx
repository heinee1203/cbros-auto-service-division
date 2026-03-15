import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import AppointmentsCalendar from "@/components/schedule/appointments-calendar";

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return <AppointmentsCalendar canManage={can(session.user.role, "schedule:appointments")} />;
}

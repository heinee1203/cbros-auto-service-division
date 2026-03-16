"use client";

import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";

const AppointmentsCalendar = dynamic(
  () => import("@/components/schedule/appointments-calendar"),
  { ssr: false }
);

export default function CalendarPage() {
  const { data: session } = useSession();
  const canManage = session?.user
    ? can(session.user.role as UserRole, "schedule:appointments")
    : false;

  return <AppointmentsCalendar canManage={canManage} />;
}

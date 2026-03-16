import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { ScheduleNav } from "@/components/schedule/schedule-nav";
import { BayViewToggle } from "@/components/schedule/bay-view-toggle";

export default async function BaySchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div className="space-y-4">
      <ScheduleNav />
      <BayViewToggle />
    </div>
  );
}

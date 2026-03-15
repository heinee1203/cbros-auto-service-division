import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { ScheduleNav } from "@/components/schedule/schedule-nav";
import BayTimeline from "@/components/schedule/bay-timeline";

export default async function BaySchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div className="space-y-4">
      <ScheduleNav />
      <BayTimeline />
    </div>
  );
}

import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";
import TechTimeline from "@/components/schedule/tech-timeline";
import { ScheduleNav } from "@/components/schedule/schedule-nav";

export default async function TechSchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:tech_view"))
    return notFound();

  return (
    <div className="space-y-4">
      <ScheduleNav />
      <TechTimeline />
    </div>
  );
}

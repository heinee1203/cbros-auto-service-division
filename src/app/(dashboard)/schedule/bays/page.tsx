import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound } from "next/navigation";

export default async function BaySchedulePage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) return notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary">Bay Schedule</h1>
      <p className="text-surface-500 mt-1">Bay timeline coming in Phase C.</p>
    </div>
  );
}

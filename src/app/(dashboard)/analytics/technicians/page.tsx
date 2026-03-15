import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getTechnicianPerformance } from "@/lib/services/analytics";
import { TechniciansClient } from "./technicians-client";

export default async function TechniciansAnalyticsPage() {
  const session = await getSession();
  if (!session?.user) return notFound();
  if (!can(session.user.role, "analytics:view")) return notFound();

  const now = new Date();
  const defaultRange = {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };

  const technicians = await getTechnicianPerformance(defaultRange);

  return <TechniciansClient initialData={technicians} />;
}

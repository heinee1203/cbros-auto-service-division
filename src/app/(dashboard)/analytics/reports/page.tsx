import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session?.user) return notFound();
  if (!can(session.user.role, "reports:view")) return notFound();

  return <ReportsClient />;
}

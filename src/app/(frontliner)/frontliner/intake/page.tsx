import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { FrontlinerIntakeClient } from "@/components/frontliner/frontliner-intake-client";

export default async function FrontlinerIntakePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "intake:create")) redirect("/frontliner");

  return <FrontlinerIntakeClient />;
}

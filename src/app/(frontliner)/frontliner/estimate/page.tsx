import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import dynamic from "next/dynamic";

const EstimateWizard = dynamic(
  () =>
    import("@/components/frontliner/estimate-wizard").then((m) => ({
      default: m.EstimateWizard,
    })),
  { ssr: false }
);

export default async function FrontlinerNewEstimatePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "estimates:create")) redirect("/frontliner");

  return <EstimateWizard />;
}

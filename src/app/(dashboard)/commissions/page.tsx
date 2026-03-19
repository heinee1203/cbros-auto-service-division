import { getCommissionPeriods, getAllCommissionRates } from "@/lib/services/commissions";
import { CommissionsClient } from "./commissions-client";

export default async function CommissionsPage() {
  const [periods, rates] = await Promise.all([
    getCommissionPeriods({ limit: 20 }),
    getAllCommissionRates(),
  ]);

  return (
    <CommissionsClient
      initialPeriods={JSON.parse(JSON.stringify(periods))}
      initialRates={JSON.parse(JSON.stringify(rates))}
    />
  );
}

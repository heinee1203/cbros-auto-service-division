import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import * as analytics from "@/lib/services/analytics";

function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-48 bg-surface-200 animate-pulse rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface-200 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 bg-surface-200 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

const AnalyticsClient = dynamic(
  () => import("./analytics-client").then((m) => ({ default: m.AnalyticsClient })),
  { ssr: false, loading: () => <AnalyticsLoading /> }
);

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session?.user) return notFound();
  if (!can(session.user.role, "analytics:view")) return notFound();

  const now = new Date();
  const defaultRange = {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };

  const [overview, revenue, pipeline, capacity, financial] = await Promise.all([
    analytics.getShopOverview(defaultRange),
    analytics.getRevenueBreakdown(defaultRange),
    analytics.getJobPipeline(defaultRange),
    analytics.getCapacityMetrics(defaultRange),
    analytics.getFinancialSummary(defaultRange),
  ]);

  return (
    <AnalyticsClient
      initialOverview={overview}
      initialRevenue={revenue}
      initialPipeline={pipeline}
      initialCapacity={capacity}
      initialFinancial={financial}
    />
  );
}

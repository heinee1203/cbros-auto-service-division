import { SkeletonMetricCards, SkeletonTable } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-48 bg-surface-200 animate-pulse rounded" />
      <SkeletonMetricCards count={6} />
      <SkeletonTable rows={5} />
    </div>
  );
}

import { SkeletonMetricCards } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-surface-200 animate-pulse rounded" />
        <div className="h-10 w-48 bg-surface-200 animate-pulse rounded-lg" />
      </div>
      <SkeletonMetricCards count={8} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

import { SkeletonTable } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-8 w-32 bg-surface-200 animate-pulse rounded" />
        <div className="h-10 w-28 bg-surface-200 animate-pulse rounded-lg" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-surface-200 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="bg-white rounded-lg border border-surface-200 p-4">
        <SkeletonTable rows={8} />
      </div>
    </div>
  );
}

import { SkeletonTable } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-8 w-32 bg-surface-200 animate-pulse rounded" />
        <div className="h-10 w-36 bg-surface-200 animate-pulse rounded-lg" />
      </div>
      <div className="bg-white rounded-lg border border-surface-200 p-4">
        <SkeletonTable rows={8} />
      </div>
    </div>
  );
}

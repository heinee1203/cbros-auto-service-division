"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitQCInspectionAction } from "@/lib/actions/qc-actions";
import { QCChecklistCard } from "./qc-checklist-card";

interface QCChecklistClientProps {
  inspection: {
    id: string;
    attemptNumber: number;
    items: Array<{
      id: string;
      description: string;
      category: string;
      status: string;
      notes: string | null;
      sortOrder: number;
    }>;
  };
  job: {
    id: string;
    jobOrderNumber: string;
    vehicle: { plateNumber: string; make: string; model: string };
  };
}

export function QCChecklistClient({ inspection, job }: QCChecklistClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Track status changes locally for progress counting
  const [statusMap, setStatusMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of inspection.items) {
      map[item.id] = item.status;
    }
    return map;
  });

  const totalItems = inspection.items.length;
  const checkedItems = Object.values(statusMap).filter(
    (s) => s === "PASS" || s === "FAIL"
  ).length;
  const allChecked = inspection.items.every(
    (item) =>
      statusMap[item.id] === "PASS" || statusMap[item.id] === "FAIL"
  );

  // Group items by category
  const grouped: Record<string, typeof inspection.items> = {};
  for (const item of inspection.items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  const sortedCategories = Object.keys(grouped).sort();

  const handleStatusChange = (itemId: string, newStatus: string) => {
    setStatusMap((prev) => ({ ...prev, [itemId]: newStatus }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await submitQCInspectionAction(inspection.id, job.id);

      if (!result.success) {
        toast.error(result.error || "Failed to submit inspection");
        return;
      }

      const data = result.data as { result: string; failedCount: number };

      if (data.result === "PASSED") {
        toast.success("QC Passed! Vehicle is ready for invoicing.");
      } else {
        toast.info(
          `QC Failed - ${data.failedCount} item(s) need rework. Rework tasks created.`
        );
      }

      router.push("/frontliner/qc");
      router.refresh();
    });
  };

  const progressPct = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[var(--sch-bg)] px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-mono font-bold text-[var(--sch-text)]">
              {job.vehicle.plateNumber}
            </p>
            <p className="font-mono text-sm text-[var(--sch-text-dim)]">
              {job.jobOrderNumber}
            </p>
          </div>
          {inspection.attemptNumber > 1 && (
            <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
              Re-inspection #{inspection.attemptNumber}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--sch-text-muted)]">
          {job.vehicle.make} {job.vehicle.model}
        </p>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-[var(--sch-text-muted)]">
            <span>
              <span className="font-mono">{checkedItems}</span> of <span className="font-mono">{totalItems}</span> items checked
            </span>
            <span className="font-mono">{Math.round(progressPct)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--sch-surface)]">
            <div
              className="h-full rounded-full bg-[var(--sch-accent)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items grouped by category */}
      <div className="flex-1 space-y-5 px-4 pb-24">
        {sortedCategories.map((category) => (
          <div key={category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--sch-text-muted)]">
              {category.replace(/_/g, " ")}
            </h3>
            <div className="space-y-2">
              {grouped[category].map((item) => (
                <QCChecklistCard
                  key={item.id}
                  item={{
                    ...item,
                    status: statusMap[item.id] || item.status,
                  }}
                  inspectionId={inspection.id}
                  jobId={job.id}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--sch-border)] bg-[var(--sch-bg)] p-4">
        <button
          type="button"
          disabled={!allChecked || isPending}
          onClick={handleSubmit}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-[var(--sch-accent)] text-lg font-bold text-black transition-colors hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? "Submitting..." : "Submit QC Inspection"}
        </button>
      </div>
    </div>
  );
}

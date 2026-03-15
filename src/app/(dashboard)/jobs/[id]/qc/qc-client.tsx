"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  createQCInspectionAction,
  updateChecklistItemAction,
  submitQCInspectionAction,
} from "@/lib/actions/qc-actions";
import { QC_CHECKLIST_CATEGORIES } from "@/lib/constants";
import {
  QC_RESULT_LABELS,
  QC_RESULT_COLORS,
  JOB_ORDER_STATUS_LABELS,
} from "@/types/enums";
import { formatDate, formatDateTime } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  status: string;
  notes: string | null;
  photoId: string | null;
  inspectedAt: string | null;
  sortOrder: number;
}

interface InspectionSummary {
  id: string;
  inspectionDate: string;
  overallResult: string;
  inspector: { firstName: string; lastName: string };
  _count: { checklistItems: number };
  breakdown: { passed: number; failed: number; pending: number };
}

interface ActiveInspection {
  id: string;
  overallResult: string;
  notes: string | null;
  inspector: { firstName: string; lastName: string };
  checklistItems: ChecklistItem[];
}

interface PhotoItem {
  id: string;
  thumbnailPath: string | null;
  fullSizePath: string;
  category: string | null;
  createdAt?: string;
}

interface QCClientProps {
  jobOrderId: string;
  jobStatus: string;
  inspections: InspectionSummary[];
  activeInspection: ActiveInspection | null;
  intakePhotos: PhotoItem[];
  qcPhotos: PhotoItem[];
  canStartQC: boolean;
  userRole: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CATEGORY_LABELS: Record<string, string> = {};
for (const cat of QC_CHECKLIST_CATEGORIES) {
  CATEGORY_LABELS[cat.id] = cat.label;
}

function getCategoryLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? id;
}

function canInspect(role: string): boolean {
  return can(role as UserRole, "qc:inspect");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function QCClient({
  jobOrderId,
  jobStatus,
  inspections,
  activeInspection,
  intakePhotos,
  qcPhotos,
  canStartQC,
  userRole,
}: QCClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticItems, setOptimisticItems] = useState<Record<string, { status: string; notes: string | null }>>(
    {}
  );
  const [failNotes, setFailNotes] = useState<Record<string, string>>({});
  const [submitNotes, setSubmitNotes] = useState("");
  const [showSubmitNotes, setShowSubmitNotes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasInspectPermission = canInspect(userRole);

  // Merge optimistic updates with server data
  const getItemStatus = useCallback(
    (item: ChecklistItem) => {
      const opt = optimisticItems[item.id];
      if (opt) return opt.status;
      return item.status;
    },
    [optimisticItems]
  );

  const getItemNotes = useCallback(
    (item: ChecklistItem) => {
      const opt = optimisticItems[item.id];
      if (opt) return opt.notes;
      return item.notes;
    },
    [optimisticItems]
  );

  const isItemInspected = useCallback(
    (item: ChecklistItem) => {
      if (optimisticItems[item.id]) return true;
      return item.inspectedAt !== null;
    },
    [optimisticItems]
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function handleStartQC() {
    startTransition(async () => {
      const result = await createQCInspectionAction(jobOrderId);
      if (result.success) {
        toast.success("QC Inspection started");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to start QC inspection");
      }
    });
  }

  function handleSetStatus(item: ChecklistItem, status: string) {
    const notes = status === "FAIL" ? (failNotes[item.id] ?? null) : null;
    // Optimistic update
    setOptimisticItems((prev) => ({
      ...prev,
      [item.id]: { status, notes },
    }));

    startTransition(async () => {
      const result = await updateChecklistItemAction(item.id, jobOrderId, {
        checklistItemId: item.id,
        status,
        notes,
      });
      if (!result.success) {
        // Revert optimistic update
        setOptimisticItems((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        toast.error(result.error ?? "Failed to update item");
      } else {
        router.refresh();
      }
    });
  }

  function handleUpdateFailNotes(item: ChecklistItem, notes: string) {
    setFailNotes((prev) => ({ ...prev, [item.id]: notes }));
    // If already marked as FAIL, update the notes on server too
    if (getItemStatus(item) === "FAIL") {
      setOptimisticItems((prev) => ({
        ...prev,
        [item.id]: { status: "FAIL", notes },
      }));
      startTransition(async () => {
        await updateChecklistItemAction(item.id, jobOrderId, {
          checklistItemId: item.id,
          status: "FAIL",
          notes,
        });
        router.refresh();
      });
    }
  }

  function handleSubmitQC() {
    if (!activeInspection) return;
    startTransition(async () => {
      const result = await submitQCInspectionAction(
        activeInspection.id,
        jobOrderId,
        submitNotes || undefined
      );
      if (result.success) {
        const data = result.data as { result: string; failedCount: number } | undefined;
        if (data?.result === "PASSED") {
          toast.success("QC Inspection passed!");
        } else {
          toast.error(`QC Failed -- ${data?.failedCount ?? 0} items need rework`);
        }
        setShowSubmitNotes(false);
        setSubmitNotes("");
        setOptimisticItems({});
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to submit QC inspection");
      }
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "QC_INSPECTION");
      formData.append("entityId", jobOrderId);
      formData.append("stage", "QC");

      try {
        const res = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        toast.success(`Uploaded ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    router.refresh();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------
  const items = activeInspection?.checklistItems ?? [];
  const totalItems = items.length;
  const inspectedCount = items.filter((i) => isItemInspected(i)).length;
  const allInspected = totalItems > 0 && inspectedCount === totalItems;
  const remainingCount = totalItems - inspectedCount;

  // Group items by category
  const categorizedItems: Record<string, ChecklistItem[]> = {};
  for (const item of items) {
    if (!categorizedItems[item.category]) {
      categorizedItems[item.category] = [];
    }
    categorizedItems[item.category].push(item);
  }

  const latestInspection = inspections.length > 0 ? inspections[0] : null;
  const attemptNumber = activeInspection
    ? inspections.length
    : inspections.length + 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-28">
      <h1 className="text-2xl font-bold text-primary">Quality Control</h1>

      {/* ---- Status Banner ---- */}
      <StatusBanner
        inspections={inspections}
        activeInspection={activeInspection}
        latestInspection={latestInspection}
        canStartQC={canStartQC}
        jobStatus={jobStatus}
        hasPermission={hasInspectPermission}
        isPending={isPending}
        attemptNumber={attemptNumber}
        inspectedCount={inspectedCount}
        totalItems={totalItems}
        onStart={handleStartQC}
      />

      {/* ---- Checklist Section ---- */}
      {activeInspection && activeInspection.overallResult === "PENDING" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary">
            QC Inspection #{inspections.length}
          </h2>

          {Object.entries(categorizedItems).map(([category, catItems]) => (
            <div key={category} className="bg-white rounded-lg border border-surface-200 overflow-hidden">
              <div className="bg-surface-50 px-4 py-2 border-b border-surface-200">
                <h3 className="font-medium text-sm text-surface-600">
                  {getCategoryLabel(category)}
                </h3>
              </div>
              <div className="divide-y divide-surface-100">
                {catItems.map((item) => {
                  const currentStatus = getItemStatus(item);
                  const currentNotes = getItemNotes(item);
                  const inspected = isItemInspected(item);

                  return (
                    <div key={item.id} className="px-4 py-3" style={{ minHeight: 56 }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-primary truncate">
                            {item.description}
                          </p>
                          {inspected && item.inspectedAt && (
                            <p className="text-xs text-surface-400 mt-0.5">
                              {formatDateTime(item.inspectedAt)}
                            </p>
                          )}
                        </div>

                        {hasInspectPermission && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSetStatus(item, "PASS")}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                currentStatus === "PASS"
                                  ? "bg-success-500 text-white"
                                  : "bg-white border border-surface-300 text-surface-500 hover:border-success-300"
                              }`}
                            >
                              Pass
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSetStatus(item, "FAIL")}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                currentStatus === "FAIL"
                                  ? "bg-danger text-white"
                                  : "bg-white border border-surface-300 text-surface-500 hover:border-danger-300"
                              }`}
                            >
                              Fail
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleSetStatus(item, "NA")}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                currentStatus === "NA" && inspected
                                  ? "bg-surface-400 text-white"
                                  : "bg-white border border-surface-300 text-surface-500 hover:border-surface-400"
                              }`}
                            >
                              N/A
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Fail notes input */}
                      {currentStatus === "FAIL" && hasInspectPermission && (
                        <div className="mt-2">
                          <textarea
                            placeholder="Describe the issue..."
                            value={failNotes[item.id] ?? currentNotes ?? ""}
                            onChange={(e) =>
                              setFailNotes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const notes = failNotes[item.id];
                              if (notes !== undefined && notes !== (currentNotes ?? "")) {
                                handleUpdateFailNotes(item, notes);
                              }
                            }}
                            rows={2}
                            className="w-full text-sm border border-surface-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- QC Photos Section ---- */}
      {(intakePhotos.length > 0 || qcPhotos.length > 0 || (activeInspection && hasInspectPermission)) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary">Photos</h2>

          {/* Intake reference photos */}
          {intakePhotos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-surface-500 mb-2">
                Reference Angles (from Intake)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {intakePhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="shrink-0 w-24 h-24 rounded border border-surface-200 overflow-hidden bg-surface-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailPath ?? photo.fullSizePath}
                      alt={photo.category ?? "Intake photo"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload QC photos */}
          {activeInspection && hasInspectPermission && (
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-accent-600 border border-accent-300 rounded-lg hover:bg-accent-50 cursor-pointer transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Upload QC Photos
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Existing QC photos grid */}
          {qcPhotos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-surface-500 mb-2">
                QC Completion Photos
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {qcPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded border border-surface-200 overflow-hidden bg-surface-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailPath ?? photo.fullSizePath}
                      alt={photo.category ?? "QC photo"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- History Section ---- */}
      {inspections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">Inspection History</h2>
          {inspections.map((insp, idx) => {
            const num = inspections.length - idx;
            const total = insp.breakdown.passed + insp.breakdown.failed + insp.breakdown.pending;
            return (
              <div
                key={insp.id}
                className="bg-white rounded-lg border border-surface-200 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      QC Inspection #{num}
                    </p>
                    <p className="text-xs text-surface-400">
                      {formatDate(insp.inspectionDate)} &middot;{" "}
                      {insp.inspector.firstName} {insp.inspector.lastName}
                    </p>
                  </div>
                  <Badge
                    className={QC_RESULT_COLORS[insp.overallResult] ?? ""}
                  >
                    {QC_RESULT_LABELS[insp.overallResult] ?? insp.overallResult}
                  </Badge>
                </div>

                <div className="flex gap-4 text-xs text-surface-500">
                  <span className="text-success-600">
                    {insp.breakdown.passed} passed
                  </span>
                  <span className="text-danger">
                    {insp.breakdown.failed} failed
                  </span>
                  <span className="text-surface-400">
                    {insp.breakdown.pending} N/A
                  </span>
                  <span className="text-surface-400">
                    {total} total
                  </span>
                </div>

                {/* Show failed item descriptions for FAILED inspections */}
                {insp.overallResult === "FAILED" && insp.breakdown.failed > 0 && (
                  <div className="mt-2 text-xs text-danger space-y-0.5">
                    <p className="font-medium">Failed items:</p>
                    {/* We don't have the item descriptions in summary, just counts */}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Sticky Submit Button ---- */}
      {activeInspection &&
        activeInspection.overallResult === "PENDING" &&
        hasInspectPermission && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 p-4 z-30">
            <div className="max-w-3xl mx-auto">
              {showSubmitNotes && (
                <div className="mb-3">
                  <textarea
                    placeholder="Add overall inspection notes (optional)..."
                    value={submitNotes}
                    onChange={(e) => setSubmitNotes(e.target.value)}
                    rows={2}
                    className="w-full text-sm border border-surface-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                {!showSubmitNotes && (
                  <button
                    type="button"
                    onClick={() => setShowSubmitNotes(true)}
                    className="text-sm text-surface-500 hover:text-primary"
                  >
                    Add notes
                  </button>
                )}
                <button
                  type="button"
                  disabled={!allInspected || isPending}
                  onClick={handleSubmitQC}
                  className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    allInspected
                      ? "bg-accent-600 text-white hover:bg-accent-700"
                      : "bg-surface-200 text-surface-400 cursor-not-allowed"
                  }`}
                >
                  {isPending
                    ? "Submitting..."
                    : allInspected
                    ? "Submit QC Inspection"
                    : `${remainingCount} item${remainingCount === 1 ? "" : "s"} remaining`}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Banner Sub-component
// ---------------------------------------------------------------------------
function StatusBanner({
  inspections,
  activeInspection,
  latestInspection,
  canStartQC,
  jobStatus,
  hasPermission,
  isPending,
  attemptNumber,
  inspectedCount,
  totalItems,
  onStart,
}: {
  inspections: InspectionSummary[];
  activeInspection: ActiveInspection | null;
  latestInspection: InspectionSummary | null;
  canStartQC: boolean;
  jobStatus: string;
  hasPermission: boolean;
  isPending: boolean;
  attemptNumber: number;
  inspectedCount: number;
  totalItems: number;
  onStart: () => void;
}) {
  // No inspections yet
  if (inspections.length === 0) {
    if (canStartQC && hasPermission) {
      return (
        <div className="bg-accent-50 border border-accent-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-accent-700">
              Ready for QC Inspection
            </p>
            <p className="text-xs text-accent-500 mt-0.5">
              Start a quality control inspection for this job.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={onStart}
            className="px-4 py-2 bg-accent-600 text-white text-sm font-medium rounded-lg hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Starting..." : "Start QC Inspection"}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-surface-50 border border-surface-200 rounded-lg p-4">
        <p className="text-sm text-surface-500">
          QC not available &mdash; job is in{" "}
          <span className="font-medium">
            {JOB_ORDER_STATUS_LABELS[jobStatus as keyof typeof JOB_ORDER_STATUS_LABELS] ?? jobStatus}
          </span>{" "}
          state
        </p>
      </div>
    );
  }

  // Active PENDING inspection
  if (activeInspection && activeInspection.overallResult === "PENDING") {
    const pct = totalItems > 0 ? Math.round((inspectedCount / totalItems) * 100) : 0;
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-yellow-700">
            QC In Progress &mdash; Inspection #{inspections.length}
          </p>
          <Badge variant="warning">Pending</Badge>
        </div>
        <div className="w-full bg-yellow-100 rounded-full h-2 mb-1">
          <div
            className="bg-yellow-500 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-yellow-600">
          {inspectedCount} of {totalItems} items inspected
        </p>
      </div>
    );
  }

  // Latest passed
  if (latestInspection && latestInspection.overallResult === "PASSED") {
    return (
      <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-success-700">
            QC Passed
          </p>
          <p className="text-xs text-success-500 mt-0.5">
            Inspected by {latestInspection.inspector.firstName}{" "}
            {latestInspection.inspector.lastName} on{" "}
            {formatDate(latestInspection.inspectionDate)}
          </p>
        </div>
        <Badge variant="success">Passed</Badge>
      </div>
    );
  }

  // Latest failed
  if (latestInspection && latestInspection.overallResult === "FAILED") {
    return (
      <div className="space-y-3">
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-danger">
              QC Failed &mdash; {latestInspection.breakdown.failed} item
              {latestInspection.breakdown.failed === 1 ? "" : "s"} need rework
            </p>
            <p className="text-xs text-danger-400 mt-0.5">
              Inspected by {latestInspection.inspector.firstName}{" "}
              {latestInspection.inspector.lastName} on{" "}
              {formatDate(latestInspection.inspectionDate)}
            </p>
          </div>
          <Badge variant="danger">Failed</Badge>
        </div>

        {canStartQC && hasPermission && (
          <button
            type="button"
            disabled={isPending}
            onClick={onStart}
            className="w-full py-2 bg-accent-600 text-white text-sm font-medium rounded-lg hover:bg-accent-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Starting..." : `Start Re-inspection (#${attemptNumber})`}
          </button>
        )}
      </div>
    );
  }

  return null;
}

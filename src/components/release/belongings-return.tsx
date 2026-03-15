"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { returnBelongingAction } from "@/lib/actions/release-actions";

interface Belonging {
  id: string;
  description: string;
  condition: string | null;
  isReturned: boolean;
}

interface BelongingsReturnProps {
  belongings: Belonging[];
  jobOrderId: string;
  onUpdate?: () => void;
}

export function BelongingsReturn({
  belongings,
  jobOrderId,
  onUpdate,
}: BelongingsReturnProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const returnedCount = belongings.filter((b) => b.isReturned).length;
  const totalCount = belongings.length;
  const allReturned = returnedCount === totalCount && totalCount > 0;

  const handleToggle = async (belongingId: string, isReturned: boolean) => {
    startTransition(async () => {
      const result = await returnBelongingAction(jobOrderId, {
        belongingId,
        isReturned,
      });
      if (result.success) {
        router.refresh();
        onUpdate?.();
      } else {
        toast.error(result.error || "Failed to update");
      }
    });
  };

  const handleSaveNotes = async (belongingId: string) => {
    startTransition(async () => {
      const result = await returnBelongingAction(jobOrderId, {
        belongingId,
        isReturned: false,
        notes: notesValue,
      });
      if (result.success) {
        setShowNotesFor(null);
        router.refresh();
        onUpdate?.();
      }
    });
  };

  if (totalCount === 0) {
    return (
      <div className="text-center py-8 text-surface-400">
        <Package className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">No belongings were recorded during intake</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">
          Belongings Return
        </h3>
        {isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
        )}
      </div>

      {/* Summary badge */}
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
          allReturned
            ? "bg-success-100 text-success-600"
            : "bg-yellow-100 text-yellow-700"
        )}
      >
        {allReturned
          ? `All ${totalCount} items returned \u2713`
          : `${returnedCount} of ${totalCount} items returned`}
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {belongings.map((belonging) => (
          <div
            key={belonging.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-surface-200 bg-white"
          >
            <input
              type="checkbox"
              checked={belonging.isReturned}
              onChange={(e) => handleToggle(belonging.id, e.target.checked)}
              disabled={isPending}
              className="mt-1 h-5 w-5 rounded border-surface-300 text-accent-600 focus:ring-accent-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">
                {belonging.description}
              </p>
              {belonging.condition && (
                <p className="text-xs text-surface-400 italic mt-0.5">
                  Intake note: {belonging.condition}
                </p>
              )}
              {!belonging.isReturned && showNotesFor === belonging.id && (
                <div className="mt-2">
                  <textarea
                    placeholder="Reason for not returning..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="w-full text-sm border border-surface-200 rounded-lg p-2 focus:ring-accent-500 focus:border-accent-500"
                    rows={2}
                  />
                  <button
                    onClick={() => handleSaveNotes(belonging.id)}
                    disabled={isPending}
                    className="mt-1 text-xs text-accent-600 hover:underline"
                  >
                    Save Note
                  </button>
                </div>
              )}
            </div>
            <div>
              {belonging.isReturned ? (
                <span className="text-xs text-success-600 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Returned
                </span>
              ) : (
                <button
                  onClick={() => {
                    setShowNotesFor(belonging.id);
                    setNotesValue("");
                  }}
                  className="text-xs text-danger-500 hover:underline"
                >
                  Not returned?
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

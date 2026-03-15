"use client";

import { useState, useEffect } from "react";
import { assignJobToBayAction } from "@/lib/actions/scheduler-actions";
import { toast } from "sonner";
import { Loader2, MapPin, ChevronDown } from "lucide-react";

interface BaySuggestionModalProps {
  open: boolean;
  onClose: () => void;
  jobOrderId: string;
  onAssigned: () => void;
}

interface BayOption {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

interface SuggestResponse {
  suggestedBay: BayOption | null;
  allBays: BayOption[];
}

export function BaySuggestionModal({
  open,
  onClose,
  jobOrderId,
  onAssigned,
}: BaySuggestionModalProps) {
  const [loading, setLoading] = useState(false);
  const [suggestedBay, setSuggestedBay] = useState<BayOption | null>(null);
  const [allBays, setAllBays] = useState<BayOption[]>([]);
  const [selectedBayId, setSelectedBayId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Reset state
    setSuggestedBay(null);
    setAllBays([]);
    setSelectedBayId("");
    setShowOverride(false);
    setLoading(true);

    fetch(`/api/bays/suggest?jobOrderId=${jobOrderId}`)
      .then((res) => res.json())
      .then((data: SuggestResponse) => {
        setSuggestedBay(data.suggestedBay);
        setAllBays(data.allBays || []);
        if (data.suggestedBay) {
          setSelectedBayId(data.suggestedBay.id);
        }
      })
      .catch(() => {
        toast.error("Failed to fetch bay suggestions");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, jobOrderId]);

  async function handleAssign() {
    if (!selectedBayId) {
      toast.error("Please select a bay");
      return;
    }

    setSubmitting(true);
    const result = await assignJobToBayAction({
      bayId: selectedBayId,
      jobOrderId,
      startDate: new Date().toISOString().split("T")[0],
    });

    if (result.success) {
      toast.success("Job assigned to bay");
      onAssigned();
      onClose();
    } else {
      toast.error(result.error || "Failed to assign bay");
    }
    setSubmitting(false);
  }

  if (!open) return null;

  const selectedBay =
    allBays.find((b) => b.id === selectedBayId) || suggestedBay;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-primary">
            Assign to Bay
          </h3>
          <p className="text-sm text-surface-500 mt-1">
            Assign this job to a work bay to begin
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-accent-500 animate-spin" />
            <span className="ml-2 text-sm text-surface-500">
              Finding best bay...
            </span>
          </div>
        )}

        {/* Suggestion result */}
        {!loading && suggestedBay && !showOverride && (
          <div className="space-y-3">
            <p className="text-sm text-surface-600">Suggested bay:</p>
            <div className="flex items-center gap-3 p-3 bg-accent-50 border border-accent-200 rounded-lg">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: suggestedBay.color || "#6366F1",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {suggestedBay.name}
                </p>
                <p className="text-xs text-surface-400">
                  {suggestedBay.type}
                </p>
              </div>
              <MapPin className="w-4 h-4 text-accent-500 flex-shrink-0" />
            </div>
            <button
              type="button"
              onClick={() => setShowOverride(true)}
              className="text-xs text-accent-600 hover:text-accent-700 underline"
            >
              Choose a different bay
            </button>
          </div>
        )}

        {/* No suggestion or override mode */}
        {!loading && (!suggestedBay || showOverride) && (
          <div className="space-y-3">
            {!suggestedBay && (
              <p className="text-sm text-surface-500">
                No available bays found. You can manually select one:
              </p>
            )}
            {showOverride && (
              <p className="text-sm text-surface-600">
                Select a different bay:
              </p>
            )}
            <div className="relative">
              <select
                value={selectedBayId}
                onChange={(e) => setSelectedBayId(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-9 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white"
              >
                <option value="">Select a bay...</option>
                {allBays.map((bay) => (
                  <option key={bay.id} value={bay.id}>
                    {bay.name} ({bay.type})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
            </div>
            {selectedBay && selectedBay.color && (
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedBay.color }}
                />
                {selectedBay.name}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!loading && (
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-surface-200 text-surface-600 hover:bg-surface-50 rounded-lg disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={submitting || !selectedBayId}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-accent-600 text-white hover:bg-accent-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? "Assigning..." : "Assign"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

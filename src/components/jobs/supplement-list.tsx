"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Plus,
  FileText,
  Calendar,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SupplementForm } from "./supplement-form";
import {
  SUPPLEMENT_STATUS_LABELS,
  SUPPLEMENT_STATUS_COLORS,
} from "@/types/enums";
import type { SupplementStatus } from "@/types/enums";
import { formatPeso, formatDate, truncate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupplementSummary {
  id: string;
  supplementNumber: string;
  status: string;
  description: string;
  grandTotal: number;
  lineItems: Array<{ id: string }>;
  createdAt: string;
  approvedAt: string | null;
}

interface SupplementDetail {
  id: string;
  supplementNumber: string;
  status: string;
  description: string;
  reason: string | null;
  subtotalLabor: number;
  subtotalParts: number;
  subtotalMaterials: number;
  subtotalOther: number;
  vatAmount: number;
  grandTotal: number;
  lineItems: Array<{
    id: string;
    group: string;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
    notes: string | null;
    estimatedHours: number | null;
  }>;
}

interface SupplementListProps {
  jobOrderId: string;
  supplements: SupplementSummary[];
  onUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SupplementList({
  jobOrderId,
  supplements,
  onUpdate,
}: SupplementListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSupplement, setSelectedSupplement] =
    useState<SupplementDetail | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleClickSupplement = useCallback(
    async (id: string) => {
      setLoadingId(id);
      try {
        const res = await fetch(`/api/supplements/${id}`);
        if (!res.ok) throw new Error("Failed to fetch supplement");
        const data = await res.json();
        setSelectedSupplement(data);
        setShowEditForm(true);
      } catch {
        toast.error("Failed to load supplement details.");
      } finally {
        setLoadingId(null);
      }
    },
    []
  );

  function handleUpdate() {
    onUpdate();
    // Re-fetch the selected supplement if still open
    if (selectedSupplement) {
      handleClickSupplement(selectedSupplement.id);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Supplemental Estimates
        </h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning-50 text-warning-600 text-sm font-medium hover:bg-warning-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Flag Additional Work
        </button>
      </div>

      {/* List */}
      {supplements.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Supplemental Estimates"
          description="When additional work is discovered during service, create a supplemental estimate for customer approval."
          className="py-8"
        />
      ) : (
        <div className="space-y-2">
          {supplements.map((supp) => (
            <button
              key={supp.id}
              onClick={() => handleClickSupplement(supp.id)}
              disabled={loadingId === supp.id}
              className="w-full text-left bg-white rounded-xl border border-surface-200 p-4 hover:border-accent-200 hover:shadow-sm transition-all disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-primary">
                      {supp.supplementNumber}
                    </span>
                    <Badge
                      className={
                        SUPPLEMENT_STATUS_COLORS[
                          supp.status as SupplementStatus
                        ] ?? ""
                      }
                    >
                      {SUPPLEMENT_STATUS_LABELS[
                        supp.status as SupplementStatus
                      ] ?? supp.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-surface-500 mb-2">
                    {truncate(supp.description, 100)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-surface-400">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {supp.lineItems.length} item
                      {supp.lineItems.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(supp.createdAt)}
                    </span>
                    {supp.approvedAt && (
                      <span className="text-success-600">
                        Approved {formatDate(supp.approvedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {formatPeso(supp.grandTotal)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Form */}
      <SupplementForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        jobOrderId={jobOrderId}
        supplement={null}
        onUpdate={onUpdate}
      />

      {/* Edit Form */}
      <SupplementForm
        open={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          setSelectedSupplement(null);
        }}
        jobOrderId={jobOrderId}
        supplement={selectedSupplement}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Edit2, Trash2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatPeso, centavosToPesos, pesosToCentavos } from "@/lib/utils";
import { LINE_ITEM_UNITS } from "@/lib/constants";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  logMaterialAction,
  updateMaterialAction,
  deleteMaterialAction,
} from "@/lib/actions/material-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MaterialItem {
  id: string;
  itemDescription: string;
  partNumber: string | null;
  quantity: number;
  unit: string;
  actualCost: number; // centavos
  estimatedLineItemId: string | null;
  createdAt: string;
  loggedBy?: { firstName: string; lastName: string } | null;
  task?: { name: string } | null;
  estimatedLineItem?: {
    description: string;
    unitCost: number;
    quantity: number;
  } | null;
}

interface EstimateLineOption {
  id: string;
  description: string;
  group: string;
  unitCost: number;
  quantity: number;
}

export interface MaterialLogProps {
  jobOrderId: string;
  taskId?: string;
  materials: MaterialItem[];
  estimateLineItems?: EstimateLineOption[];
  onUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface FormState {
  itemDescription: string;
  partNumber: string;
  quantity: string;
  unit: string;
  actualCostPesos: string;
  estimatedLineItemId: string;
  taskId?: string;
}

const EMPTY_FORM: FormState = {
  itemDescription: "",
  partNumber: "",
  quantity: "1",
  unit: "pcs",
  actualCostPesos: "",
  estimatedLineItemId: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MaterialLog({
  jobOrderId,
  taskId,
  materials,
  estimateLineItems = [],
  onUpdate,
}: MaterialLogProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter estimate line items to PARTS / MATERIALS groups
  const partsOptions = estimateLineItems.filter(
    (li) => li.group === "PARTS" || li.group === "MATERIALS"
  );

  const totalCost = materials.reduce((sum, m) => sum + m.actualCost, 0);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function openAddForm() {
    setForm({ ...EMPTY_FORM, taskId });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(m: MaterialItem) {
    setForm({
      itemDescription: m.itemDescription,
      partNumber: m.partNumber ?? "",
      quantity: String(m.quantity),
      unit: m.unit,
      actualCostPesos: centavosToPesos(m.actualCost),
      estimatedLineItemId: m.estimatedLineItemId ?? "",
    });
    setEditingId(m.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleEstimateLineSelect(lineItemId: string) {
    const li = partsOptions.find((o) => o.id === lineItemId);
    if (li) {
      setForm((prev) => ({
        ...prev,
        estimatedLineItemId: lineItemId,
        itemDescription: li.description,
        actualCostPesos: centavosToPesos(li.unitCost),
      }));
    } else {
      setForm((prev) => ({ ...prev, estimatedLineItemId: "" }));
    }
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.itemDescription.trim()) {
      toast.error("Item description is required");
      return;
    }

    const payload = {
      itemDescription: form.itemDescription.trim(),
      partNumber: form.partNumber.trim() || null,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      actualCost: pesosToCentavos(form.actualCostPesos),
      estimatedLineItemId: form.estimatedLineItemId || null,
      taskId: taskId ?? null,
    };

    startTransition(async () => {
      let result;
      if (editingId) {
        result = await updateMaterialAction(editingId, jobOrderId, payload);
      } else {
        result = await logMaterialAction(jobOrderId, payload);
      }

      if (result.success) {
        toast.success(editingId ? "Material updated" : "Material logged");
        cancelForm();
        onUpdate();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteMaterialAction(deleteId, jobOrderId);
      if (result.success) {
        toast.success("Material deleted");
        setDeleteId(null);
        onUpdate();
      } else {
        toast.error(result.error ?? "Failed to delete");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Variance helper
  // -------------------------------------------------------------------------
  function renderVariance(m: MaterialItem) {
    if (!m.estimatedLineItem) return null;
    const estimated = m.estimatedLineItem.unitCost * m.estimatedLineItem.quantity;
    const variance = m.actualCost - estimated;
    const pct = estimated > 0 ? Math.round((variance / estimated) * 100) : 0;
    const isOver = Math.abs(pct) > 20;

    return (
      <span className={`text-xs ${isOver ? "text-red-600 font-medium" : "text-gray-500"}`}>
        Est: {formatPeso(estimated)} | Act: {formatPeso(m.actualCost)} |{" "}
        {variance >= 0 ? "+" : ""}
        {formatPeso(Math.abs(variance))} ({variance >= 0 ? "+" : "-"}
        {Math.abs(pct)}%)
      </span>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">
            Materials ({materials.length})
          </h3>
          {totalCost > 0 && (
            <span className="text-sm text-gray-500">
              — Total: {formatPeso(totalCost)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isPending}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Material
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Estimate line item link */}
            {partsOptions.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Link to Estimate Line Item
                </label>
                <select
                  value={form.estimatedLineItemId}
                  onChange={(e) => handleEstimateLineSelect(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— None —</option>
                  {partsOptions.map((li) => (
                    <option key={li.id} value={li.id}>
                      {li.description} ({formatPeso(li.unitCost)} x{li.quantity})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Item Description *
              </label>
              <input
                type="text"
                required
                value={form.itemDescription}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    itemDescription: e.target.value,
                  }))
                }
                list="material-suggestions"
                placeholder="e.g., Primer Surfacer 2K"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {partsOptions.length > 0 && (
                <datalist id="material-suggestions">
                  {partsOptions.map((li) => (
                    <option key={li.id} value={li.description} />
                  ))}
                </datalist>
              )}
            </div>

            {/* Part number */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Part Number
              </label>
              <input
                type="text"
                value={form.partNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, partNumber: e.target.value }))
                }
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quantity */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <select
                  value={form.unit}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, unit: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {LINE_ITEM_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actual cost */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Actual Cost (₱)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.actualCostPesos}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    actualCostPesos: e.target.value,
                  }))
                }
                placeholder="0.00"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Form actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending
                ? "Saving..."
                : editingId
                  ? "Update"
                  : "Log Material"}
            </button>
          </div>
        </form>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No materials logged yet.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between py-3 gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {m.itemDescription}
                  </span>
                  {m.partNumber && (
                    <span className="text-xs text-gray-400">
                      #{m.partNumber}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  <span className="text-sm text-gray-600">
                    {m.quantity} {m.unit} &mdash; {formatPeso(m.actualCost)}
                  </span>
                  {m.task && (
                    <span className="text-xs text-gray-400">
                      Task: {m.task.name}
                    </span>
                  )}
                  {m.loggedBy && (
                    <span className="text-xs text-gray-400">
                      by {m.loggedBy.firstName} {m.loggedBy.lastName}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(m.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {m.estimatedLineItem && (
                  <div className="mt-1 flex items-center gap-1">
                    {Math.abs(
                      m.actualCost -
                        m.estimatedLineItem.unitCost *
                          m.estimatedLineItem.quantity
                    ) /
                      (m.estimatedLineItem.unitCost *
                        m.estimatedLineItem.quantity || 1) >
                      0.2 && (
                      <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    {renderVariance(m)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditForm(m)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Edit"
                  disabled={isPending}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(m.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Material"
        message="Are you sure you want to delete this material entry? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}

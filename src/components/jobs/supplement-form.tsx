"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  Send,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ESTIMATE_LINE_ITEM_GROUP_LABELS,
  SUPPLEMENT_STATUS_LABELS,
  SUPPLEMENT_STATUS_COLORS,
} from "@/types/enums";
import type { EstimateLineItemGroup, SupplementStatus } from "@/types/enums";
import { formatPeso, centavosToPesos, pesosToCentavos, cn } from "@/lib/utils";
import { LINE_ITEM_UNITS } from "@/lib/constants";
import {
  createSupplementAction,
  addSupplementLineItemAction,
  updateSupplementLineItemAction,
  deleteSupplementLineItemAction,
  submitSupplementForApprovalAction,
} from "@/lib/actions/supplement-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  id: string;
  group: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  notes: string | null;
  estimatedHours: number | null;
}

interface Supplement {
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
  lineItems: LineItem[];
}

interface SupplementFormProps {
  open: boolean;
  onClose: () => void;
  jobOrderId: string;
  supplement?: Supplement | null;
  onUpdate: () => void;
}

// Groups for supplements (subset of estimate groups)
const SUPPLEMENT_GROUPS: EstimateLineItemGroup[] = [
  "LABOR",
  "PARTS",
  "MATERIALS",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SupplementForm({
  open,
  onClose,
  jobOrderId,
  supplement,
  onUpdate,
}: SupplementFormProps) {
  const isCreate = !supplement;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={
        isCreate
          ? "Flag Additional Work"
          : `Supplement ${supplement.supplementNumber}`
      }
      description={
        isCreate
          ? "Create a supplemental estimate for additional work discovered"
          : supplement.description
      }
      wide
    >
      {isCreate ? (
        <CreateSupplementForm
          jobOrderId={jobOrderId}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ) : (
        <EditSupplement
          supplement={supplement}
          jobOrderId={jobOrderId}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      )}
    </SlideOver>
  );
}

// ---------------------------------------------------------------------------
// Create Supplement Form
// ---------------------------------------------------------------------------

function CreateSupplementForm({
  jobOrderId,
  onClose,
  onUpdate,
}: {
  jobOrderId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }

    setSaving(true);
    const result = await createSupplementAction(jobOrderId, {
      description: description.trim(),
      reason: reason.trim() || null,
    });

    if (result.success) {
      toast.success("Supplemental estimate created.");
      onUpdate();
      onClose();
    } else {
      toast.error(result.error ?? "Failed to create supplement.");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-primary mb-1">
          Description <span className="text-danger">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the additional work needed..."
          className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary mb-1">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why is this additional work needed? (optional)"
          className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 resize-none"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Draft
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 text-sm text-surface-500 hover:text-surface-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit Supplement (Line Item Editor)
// ---------------------------------------------------------------------------

function EditSupplement({
  supplement,
  jobOrderId,
  onClose,
  onUpdate,
}: {
  supplement: Supplement;
  jobOrderId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const isDraft = supplement.status === "DRAFT";
  const hasLineItems = supplement.lineItems.length > 0;

  // Group line items
  const grouped: Record<string, LineItem[]> = {};
  for (const g of SUPPLEMENT_GROUPS) {
    grouped[g] = [];
  }
  for (const item of supplement.lineItems) {
    if (grouped[item.group]) {
      grouped[item.group].push(item);
    } else {
      if (!grouped["OTHER"]) grouped["OTHER"] = [];
      grouped["OTHER"].push(item);
    }
  }

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  // Compute group subtotals from line items
  function getGroupSubtotal(group: string): number {
    return (grouped[group] ?? []).reduce((sum, item) => sum + item.subtotal, 0);
  }

  async function handleSubmitForApproval() {
    setSubmitting(true);
    const result = await submitSupplementForApprovalAction(
      supplement.id,
      jobOrderId
    );
    if (result.success) {
      toast.success("Supplement submitted for customer approval.");
      onUpdate();
      onClose();
    } else {
      toast.error(result.error ?? "Failed to submit supplement.");
    }
    setSubmitting(false);
    setShowSubmitConfirm(false);
  }

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge
          className={
            SUPPLEMENT_STATUS_COLORS[supplement.status as SupplementStatus] ?? ""
          }
        >
          {SUPPLEMENT_STATUS_LABELS[supplement.status as SupplementStatus] ??
            supplement.status}
        </Badge>
        {supplement.reason && (
          <span className="text-xs text-surface-400">
            Reason: {supplement.reason}
          </span>
        )}
      </div>

      {/* Line Item Groups */}
      <div className="space-y-3">
        {SUPPLEMENT_GROUPS.map((group) => (
          <SupplementLineItemGroup
            key={group}
            group={group}
            items={grouped[group] ?? []}
            supplementId={supplement.id}
            jobOrderId={jobOrderId}
            collapsed={!!collapsedGroups[group]}
            onToggle={() => toggleGroup(group)}
            subtotal={getGroupSubtotal(group)}
            editable={isDraft}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {/* Cost Summary */}
      <div className="bg-surface-50 rounded-xl border border-surface-200 p-4">
        <h4 className="text-sm font-semibold text-primary mb-3">
          Cost Summary
        </h4>
        <div className="space-y-1.5 text-sm">
          {SUPPLEMENT_GROUPS.map((group) => {
            const subtotal = getGroupSubtotal(group);
            if (subtotal === 0) return null;
            return (
              <div key={group} className="flex justify-between">
                <span className="text-surface-500">
                  {ESTIMATE_LINE_ITEM_GROUP_LABELS[group]}
                </span>
                <span className="font-mono text-primary">
                  {formatPeso(subtotal)}
                </span>
              </div>
            );
          })}
          <div className="border-t border-surface-200 pt-1.5 mt-1.5" />
          <div className="flex justify-between">
            <span className="text-surface-500">Subtotal</span>
            <span className="font-mono text-primary">
              {formatPeso(
                supplement.subtotalLabor +
                  supplement.subtotalParts +
                  supplement.subtotalMaterials +
                  supplement.subtotalOther
              )}
            </span>
          </div>
          <div className="border-t border-surface-200 pt-1.5 mt-1.5" />
          <div className="flex justify-between font-semibold">
            <span className="text-primary">Total</span>
            <span className="font-mono text-primary">
              {formatPeso(supplement.grandTotal)}
            </span>
          </div>
          <p className="text-xs text-surface-400 italic mt-1">*Prices are VAT-inclusive</p>
        </div>
      </div>

      {/* Submit for Approval Button */}
      {isDraft && hasLineItems && (
        <div className="pt-2">
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Submit for Customer Approval
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmitForApproval}
        title="Submit for Approval"
        message="This will send an approval link to the customer. They can approve or decline this supplemental estimate. Continue?"
        confirmLabel="Submit"
        variant="warning"
        loading={submitting}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplement Line Item Group
// ---------------------------------------------------------------------------

function SupplementLineItemGroup({
  group,
  items,
  supplementId,
  jobOrderId,
  collapsed,
  onToggle,
  subtotal,
  editable,
  onUpdate,
}: {
  group: string;
  items: LineItem[];
  supplementId: string;
  jobOrderId: string;
  collapsed: boolean;
  onToggle: () => void;
  subtotal: number;
  editable: boolean;
  onUpdate: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const label =
    ESTIMATE_LINE_ITEM_GROUP_LABELS[group as EstimateLineItemGroup] ?? group;

  return (
    <div className="bg-white rounded-xl border border-surface-200">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-surface-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-surface-400" />
          )}
          <span className="text-sm font-semibold text-primary">{label}</span>
          <span className="text-xs text-surface-400">
            ({items.length} item{items.length !== 1 ? "s" : ""})
          </span>
        </div>
        <span className="font-mono text-sm font-medium text-primary">
          {formatPeso(subtotal)}
        </span>
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="border-t border-surface-100">
          {items.length === 0 && !showAddForm && (
            <div className="px-4 py-6 text-center text-sm text-surface-400">
              No items yet
            </div>
          )}

          {items.map((item) => (
            <SupplementLineItemRow
              key={item.id}
              item={item}
              group={group}
              jobOrderId={jobOrderId}
              editable={editable}
              onUpdate={onUpdate}
            />
          ))}

          {/* Add Form */}
          {editable && (
            <>
              {showAddForm ? (
                <AddSupplementLineItemForm
                  group={group}
                  supplementId={supplementId}
                  jobOrderId={jobOrderId}
                  onClose={() => setShowAddForm(false)}
                  onUpdate={onUpdate}
                />
              ) : (
                <div className="px-4 py-2 border-t border-surface-100">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-600 transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add {label} Item
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplement Line Item Row
// ---------------------------------------------------------------------------

function SupplementLineItemRow({
  item,
  group,
  jobOrderId,
  editable,
  onUpdate,
}: {
  item: LineItem;
  group: string;
  jobOrderId: string;
  editable: boolean;
  onUpdate: () => void;
}) {
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function saveField(field: string, value: string) {
    const updateData: Record<string, unknown> = {};

    switch (field) {
      case "description":
        if (!value.trim()) return;
        updateData.description = value.trim();
        break;
      case "quantity":
        updateData.quantity = parseFloat(value) || 1;
        break;
      case "unitCost":
        updateData.unitCost = parseFloat(value) || 0;
        break;
      case "estimatedHours":
        updateData.estimatedHours = value ? parseFloat(value) || null : null;
        break;
    }

    const result = await updateSupplementLineItemAction(
      item.id,
      jobOrderId,
      updateData
    );
    if (result.success) {
      onUpdate();
    } else {
      toast.error(result.error ?? "Failed to update.");
    }
    setEditField(null);
  }

  function startEdit(field: string, currentValue: string) {
    if (!editable) return;
    setEditField(field);
    setEditValue(currentValue);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteSupplementLineItemAction(item.id, jobOrderId);
    if (result.success) {
      toast.success("Item deleted.");
      onUpdate();
    } else {
      toast.error(result.error ?? "Failed to delete.");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  }

  return (
    <>
      <div className="px-4 py-2.5 border-t border-surface-100 hover:bg-surface-50/50 transition-colors">
        <div className="flex items-center gap-3">
          {/* Description */}
          <div className="flex-1 min-w-0">
            {editField === "description" ? (
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveField("description", editValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveField("description", editValue);
                  if (e.key === "Escape") setEditField(null);
                }}
                className="w-full px-2 py-1 text-sm bg-white border border-accent-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            ) : (
              <button
                onClick={() => startEdit("description", item.description)}
                className={cn(
                  "text-sm text-primary text-left truncate w-full transition-colors",
                  editable && "hover:text-accent cursor-pointer"
                )}
                title={item.description}
                disabled={!editable}
              >
                {item.description}
              </button>
            )}
          </div>

          {/* Quantity */}
          <div className="w-16 text-center">
            {editField === "quantity" ? (
              <input
                autoFocus
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveField("quantity", editValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveField("quantity", editValue);
                  if (e.key === "Escape") setEditField(null);
                }}
                className="w-full px-1 py-1 text-sm text-center bg-white border border-accent-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            ) : (
              <button
                onClick={() => startEdit("quantity", String(item.quantity))}
                className={cn(
                  "text-sm font-mono text-surface-600 transition-colors",
                  editable && "hover:text-accent cursor-pointer"
                )}
                disabled={!editable}
              >
                {item.quantity} {item.unit}
              </button>
            )}
          </div>

          <span className="text-xs text-surface-400">&times;</span>

          {/* Unit Cost */}
          <div className="w-24 text-right">
            {editField === "unitCost" ? (
              <input
                autoFocus
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveField("unitCost", editValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveField("unitCost", editValue);
                  if (e.key === "Escape") setEditField(null);
                }}
                className="w-full px-1 py-1 text-sm text-right bg-white border border-accent-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
              />
            ) : (
              <button
                onClick={() =>
                  startEdit("unitCost", centavosToPesos(item.unitCost))
                }
                className={cn(
                  "text-sm font-mono text-surface-600 transition-colors",
                  editable && "hover:text-accent cursor-pointer"
                )}
                disabled={!editable}
              >
                {formatPeso(item.unitCost)}
              </button>
            )}
          </div>

          <span className="text-xs text-surface-400">=</span>

          {/* Subtotal */}
          <div className="w-24 text-right">
            <span className="text-sm font-mono font-medium text-primary">
              {formatPeso(item.subtotal)}
            </span>
          </div>

          {/* Estimated Hours (LABOR only) */}
          {group === "LABOR" && (
            <div className="w-14 text-center">
              {editField === "estimatedHours" ? (
                <input
                  autoFocus
                  type="number"
                  step="0.5"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveField("estimatedHours", editValue)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      saveField("estimatedHours", editValue);
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="w-full px-1 py-1 text-sm text-center bg-white border border-accent-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
                />
              ) : (
                <button
                  onClick={() =>
                    startEdit(
                      "estimatedHours",
                      String(item.estimatedHours ?? "")
                    )
                  }
                  className={cn(
                    "text-xs font-mono text-surface-400 transition-colors",
                    editable && "hover:text-accent cursor-pointer"
                  )}
                  title="Estimated hours"
                  disabled={!editable}
                >
                  {item.estimatedHours != null
                    ? `${item.estimatedHours}h`
                    : "\u2014"}
                </button>
              )}
            </div>
          )}

          {/* Delete Action */}
          {editable && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="p-1 rounded hover:bg-red-50 text-surface-400 hover:text-danger transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Line Item"
        message={`Are you sure you want to delete "${item.description}"?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Add Supplement Line Item Form
// ---------------------------------------------------------------------------

function AddSupplementLineItemForm({
  group,
  supplementId,
  jobOrderId,
  onClose,
  onUpdate,
}: {
  group: string;
  supplementId: string;
  jobOrderId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(group === "LABOR" ? "hrs" : "pcs");
  const [unitCost, setUnitCost] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }

    setSaving(true);
    const result = await addSupplementLineItemAction(supplementId, jobOrderId, {
      group,
      description: description.trim(),
      quantity: parseFloat(quantity) || 1,
      unit,
      unitCost: parseFloat(unitCost) || 0,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      notes: notes || null,
    });

    if (result.success) {
      toast.success("Item added.");
      onUpdate();
      onClose();
    } else {
      toast.error(result.error ?? "Failed to add item.");
    }
    setSaving(false);
  }

  return (
    <div className="px-4 py-3 border-t border-surface-100 bg-accent-50/30">
      <div className="space-y-3">
        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">
            Description
          </label>
          <input
            type="text"
            placeholder="Description of work or part"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
          />
        </div>

        {/* Row of numeric fields */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-20">
            <label className="block text-xs font-medium text-surface-500 mb-1">
              Qty
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
            />
          </div>

          <div className="w-24">
            <label className="block text-xs font-medium text-surface-500 mb-1">
              Unit
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
            >
              {LINE_ITEM_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label className="block text-xs font-medium text-surface-500 mb-1">
              Unit Cost (\u20B1)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
            />
          </div>

          {group === "LABOR" && (
            <div className="w-20">
              <label className="block text-xs font-medium text-surface-500 mb-1">
                Est. Hours
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="\u2014"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            placeholder="Additional notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Add Item
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

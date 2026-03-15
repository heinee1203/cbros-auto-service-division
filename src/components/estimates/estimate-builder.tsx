"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addLineItemAction,
  updateLineItemAction,
  deleteLineItemAction,
  duplicateLineItemAction,
} from "@/lib/actions/estimate-actions";
import { ESTIMATE_LINE_ITEM_GROUP_LABELS } from "@/types/enums";
import type { EstimateLineItemGroup } from "@/types/enums";
import { formatPeso, centavosToPesos, cn } from "@/lib/utils";
import { LINE_ITEM_UNITS } from "@/lib/constants";
import { EstimateSummary } from "./estimate-summary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  id: string;
  group: string;
  description: string;
  serviceCatalogId: string | null;
  quantity: number;
  unit: string;
  unitCost: number; // centavos
  markup: number;
  subtotal: number; // centavos
  notes: string | null;
  estimatedHours: number | null;
  assignedTechnicianId: string | null;
  sortOrder: number;
}

interface EstimateVersion {
  id: string;
  versionNumber: number;
  versionLabel: string;
  subtotalLabor: number;
  subtotalParts: number;
  subtotalMaterials: number;
  subtotalPaint: number;
  subtotalSublet: number;
  subtotalOther: number;
  vatRate: number;
  vatAmount: number;
  discountType: string | null;
  discountValue: number;
  discountReason: string | null;
  grandTotal: number;
  termsAndConditions: string | null;
  estimatedDays: number | null;
  lineItems: LineItem[];
}

interface Props {
  estimateRequestId: string;
  version: EstimateVersion;
  status: string;
  approvalToken?: string | null;
  customerId?: string;
  vehicleId?: string;
}

interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  defaultLaborRate: number; // centavos
  estimatedHours: number | null;
}

// Groups to display, in order
const GROUPS: EstimateLineItemGroup[] = [
  "LABOR",
  "PARTS",
  "PAINT",
  "SUBLET",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EstimateBuilder({ estimateRequestId, version, status, approvalToken, customerId, vehicleId }: Props) {
  const router = useRouter();
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  // Group line items
  const grouped: Record<string, LineItem[]> = {};
  for (const g of GROUPS) {
    grouped[g] = [];
  }
  for (const item of version.lineItems) {
    if (grouped[item.group]) {
      grouped[item.group].push(item);
    } else {
      if (!grouped["OTHER"]) grouped["OTHER"] = [];
      grouped["OTHER"].push(item);
    }
  }

  // Group subtotals mapping for summary
  const groupSubtotals: Record<string, number> = {
    LABOR: version.subtotalLabor,
    PARTS: version.subtotalParts,
    PAINT: version.subtotalPaint,
    MATERIALS: version.subtotalMaterials,
    SUBLET: version.subtotalSublet,
    OTHER: version.subtotalOther,
  };

  return (
    <div className="flex gap-5 items-start">
      {/* Left Panel — Line Item Groups */}
      <div className="flex-1 min-w-0 space-y-4">
        {GROUPS.map((group) => (
          <LineItemGroup
            key={group}
            group={group}
            items={grouped[group] ?? []}
            versionId={version.id}
            collapsed={!!collapsedGroups[group]}
            onToggle={() => toggleGroup(group)}
            subtotal={groupSubtotals[group] ?? 0}
          />
        ))}
      </div>

      {/* Right Panel — Summary */}
      <div className="w-80 shrink-0 sticky top-4">
        <EstimateSummary
          estimateRequestId={estimateRequestId}
          version={version}
          status={status}
          approvalToken={approvalToken}
          customerId={customerId}
          vehicleId={vehicleId}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Item Group
// ---------------------------------------------------------------------------

function LineItemGroup({
  group,
  items,
  versionId,
  collapsed,
  onToggle,
  subtotal,
}: {
  group: string;
  items: LineItem[];
  versionId: string;
  collapsed: boolean;
  onToggle: () => void;
  subtotal: number;
}) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const label =
    ESTIMATE_LINE_ITEM_GROUP_LABELS[group as EstimateLineItemGroup] ?? group;

  return (
    <div className="bg-white rounded-xl border border-surface-200">
      {/* Section Header */}
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
            <LineItemRow key={item.id} item={item} group={group} />
          ))}

          {/* Add Form */}
          {showAddForm ? (
            <AddLineItemForm
              group={group}
              versionId={versionId}
              sortOrder={items.length}
              onClose={() => setShowAddForm(false)}
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line Item Row — Inline Editable
// ---------------------------------------------------------------------------

function LineItemRow({ item, group }: { item: LineItem; group: string }) {
  const router = useRouter();
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const showMarkup = group === "PARTS" || group === "SUBLET";

  async function saveField(field: string, value: string) {
    let updateData: Record<string, unknown> = {};

    switch (field) {
      case "description":
        if (!value.trim()) return;
        updateData = { description: value.trim() };
        break;
      case "quantity":
        updateData = { quantity: parseFloat(value) || 1 };
        break;
      case "unitCost":
        updateData = { unitCost: parseFloat(value) || 0 };
        break;
      case "markup":
        updateData = { markup: parseFloat(value) || 0 };
        break;
      case "estimatedHours":
        updateData = {
          estimatedHours: value ? parseFloat(value) || null : null,
        };
        break;
    }

    const result = await updateLineItemAction(item.id, updateData);
    if (result.success) {
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update.");
    }
    setEditField(null);
  }

  function startEdit(field: string, currentValue: string) {
    setEditField(field);
    setEditValue(currentValue);
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const result = await duplicateLineItemAction(item.id);
    if (result.success) {
      toast.success("Item duplicated.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to duplicate.");
    }
    setDuplicating(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteLineItemAction(item.id);
    if (result.success) {
      toast.success("Item deleted.");
      router.refresh();
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
                className="text-sm text-primary text-left truncate w-full hover:text-accent transition-colors"
                title={item.description}
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
                className="text-sm font-mono text-surface-600 hover:text-accent transition-colors"
              >
                {item.quantity}
              </button>
            )}
          </div>

          {/* x */}
          <span className="text-xs text-surface-400">&times;</span>

          {/* Unit Cost (display in pesos) */}
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
                className="text-sm font-mono text-surface-600 hover:text-accent transition-colors"
              >
                {formatPeso(item.unitCost)}
              </button>
            )}
          </div>

          {/* Markup (for PARTS/SUBLET) */}
          {showMarkup && (
            <div className="w-16 text-center">
              {editField === "markup" ? (
                <input
                  autoFocus
                  type="number"
                  step="1"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveField("markup", editValue)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveField("markup", editValue);
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="w-full px-1 py-1 text-sm text-center bg-white border border-accent-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
                />
              ) : (
                <button
                  onClick={() => startEdit("markup", String(item.markup))}
                  className="text-xs font-mono text-surface-400 hover:text-accent transition-colors"
                >
                  +{item.markup}%
                </button>
              )}
            </div>
          )}

          {/* = Subtotal */}
          <span className="text-xs text-surface-400">=</span>
          <div className="w-24 text-right">
            <span className="text-sm font-mono font-medium text-primary">
              {formatPeso(item.subtotal)}
            </span>
          </div>

          {/* Estimated Hours (for LABOR) */}
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
                  className="text-xs font-mono text-surface-400 hover:text-accent transition-colors"
                  title="Estimated hours"
                >
                  {item.estimatedHours != null
                    ? `${item.estimatedHours}h`
                    : "—"}
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="p-1 rounded hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="p-1 rounded hover:bg-red-50 text-surface-400 hover:text-danger transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
// Add Line Item Form
// ---------------------------------------------------------------------------

function AddLineItemForm({
  group,
  versionId,
  sortOrder,
  onClose,
}: {
  group: string;
  versionId: string;
  sortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Form fields
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(group === "LABOR" ? "hrs" : "pcs");
  const [unitCost, setUnitCost] = useState("");
  const [markup, setMarkup] = useState("0");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [notes, setNotes] = useState("");

  // Service catalog search (for LABOR)
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<ServiceCatalogItem[]>(
    []
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const catalogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCatalog = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setCatalogResults([]);
        return;
      }
      setCatalogLoading(true);
      try {
        const res = await fetch(
          `/api/service-catalog?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const items = await res.json();
          setCatalogResults(items);
        }
      } catch {
        // silent
      } finally {
        setCatalogLoading(false);
      }
    },
    []
  );

  function handleCatalogSearch(q: string) {
    setCatalogQuery(q);
    setDescription(q);
    setShowCatalog(true);
    if (catalogTimer.current) clearTimeout(catalogTimer.current);
    catalogTimer.current = setTimeout(() => searchCatalog(q), 300);
  }

  function selectCatalogItem(item: ServiceCatalogItem) {
    setDescription(item.name);
    setUnitCost(centavosToPesos(item.defaultLaborRate));
    if (item.estimatedHours) {
      setEstimatedHours(String(item.estimatedHours));
    }
    setShowCatalog(false);
    setCatalogQuery("");
  }

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }

    setSaving(true);
    const result = await addLineItemAction(versionId, {
      group,
      description: description.trim(),
      quantity: parseFloat(quantity) || 1,
      unit,
      unitCost: parseFloat(unitCost) || 0,
      markup: parseFloat(markup) || 0,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      notes: notes || null,
      sortOrder,
    });

    if (result.success) {
      toast.success("Item added.");
      router.refresh();
      onClose();
    } else {
      toast.error(result.error ?? "Failed to add item.");
    }
    setSaving(false);
  }

  const showMarkup = group === "PARTS" || group === "SUBLET";

  return (
    <div className="px-4 py-3 border-t border-surface-100 bg-accent-50/30">
      <div className="space-y-3">
        {/* Description / Catalog Search */}
        <div className="relative">
          <label className="block text-xs font-medium text-surface-500 mb-1">
            Description
          </label>
          {group === "LABOR" ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search service catalog or type manually..."
                value={description}
                onChange={(e) => handleCatalogSearch(e.target.value)}
                onFocus={() => {
                  if (catalogResults.length > 0) setShowCatalog(true);
                }}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
              {showCatalog && catalogResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {catalogResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectCatalogItem(item)}
                      className="w-full text-left px-3 py-2 hover:bg-accent-50 transition-colors border-b border-surface-100 last:border-b-0"
                    >
                      <div className="text-sm font-medium text-primary">
                        {item.name}
                      </div>
                      <div className="text-xs text-surface-400">
                        {item.category}
                        {item.estimatedHours
                          ? ` · ${item.estimatedHours}h`
                          : ""}
                        {" · "}
                        {formatPeso(item.defaultLaborRate)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showCatalog && catalogLoading && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching...
                  </div>
                </div>
              )}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300"
            />
          )}
        </div>

        {/* Row of numeric fields */}
        <div className="flex items-end gap-3">
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
              Unit Cost (₱)
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

          {showMarkup && (
            <div className="w-20">
              <label className="block text-xs font-medium text-surface-500 mb-1">
                Markup %
              </label>
              <input
                type="number"
                step="1"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
              />
            </div>
          )}

          {group === "LABOR" && (
            <div className="w-20">
              <label className="block text-xs font-medium text-surface-500 mb-1">
                Est. Hours
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="—"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 font-mono"
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
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

"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Wrench,
  Plus,
  X,
  Minus,
  Save,
  Send,
  Printer,
  Loader2,
  Package,
  ChevronDown,
} from "lucide-react";
import { formatPeso, centavosToPesos } from "@/lib/utils";
import {
  addLineItemAction,
  updateLineItemAction,
  deleteLineItemAction,
  updateVersionDetailsAction,
} from "@/lib/actions/estimate-actions";
import { generateApprovalTokenAction } from "@/lib/actions/frontliner-estimate-actions";

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
  sortOrder: number;
}

interface VersionSummary {
  subtotalLabor: number;
  subtotalParts: number;
  subtotalMaterials: number;
  subtotalPaint: number;
  subtotalSublet: number;
  subtotalOther: number;
  discountType: string | null;
  discountValue: number;
  grandTotal: number;
}

interface ServiceCardData {
  serviceCatalogId: string;
  serviceName: string;
  laborItem: LineItem | null;
  partItems: LineItem[];
}

interface EstimateCardBuilderProps {
  versionId: string;
  initialLineItems: LineItem[];
  initialVersion: VersionSummary;
  onSave: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupLineItems(items: LineItem[]): {
  serviceCards: ServiceCardData[];
  otherItems: LineItem[];
} {
  const serviceMap = new Map<
    string,
    { serviceName: string; laborItem: LineItem | null; partItems: LineItem[] }
  >();
  const otherItems: LineItem[] = [];

  for (const item of items) {
    if (!item.serviceCatalogId) {
      otherItems.push(item);
      continue;
    }

    if (!serviceMap.has(item.serviceCatalogId)) {
      serviceMap.set(item.serviceCatalogId, {
        serviceName: "",
        laborItem: null,
        partItems: [],
      });
    }

    const entry = serviceMap.get(item.serviceCatalogId)!;

    if (item.group === "LABOR") {
      entry.laborItem = item;
      entry.serviceName = item.description;
    } else if (item.group === "PARTS") {
      entry.partItems.push(item);
    } else {
      // Other groups tied to a service still go under the service card
      entry.partItems.push(item);
    }

    // If no labor item yet, use first item description as service name
    if (!entry.serviceName && !entry.laborItem) {
      entry.serviceName = item.description;
    }
  }

  const serviceCards: ServiceCardData[] = Array.from(
    serviceMap.entries()
  ).map(([serviceCatalogId, entry]) => ({
    serviceCatalogId,
    serviceName: entry.serviceName || "Unnamed Service",
    laborItem: entry.laborItem,
    partItems: entry.partItems,
  }));

  return { serviceCards, otherItems };
}

function calculateCardTotal(card: ServiceCardData): number {
  let total = 0;
  if (card.laborItem) total += card.laborItem.subtotal;
  for (const part of card.partItems) total += part.subtotal;
  return total;
}

function calculateDiscount(
  rawTotal: number,
  discountType: string | null,
  discountValue: number
): number {
  if (!discountType || discountType === "none") return 0;
  if (discountType === "flat") return discountValue;
  if (discountType === "percentage")
    return Math.round(rawTotal * (discountValue / 10000));
  return 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HoursStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 0.5))}
        className="h-11 w-11 flex items-center justify-center rounded-lg border border-[var(--sch-border)] text-[var(--sch-text)] disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="h-12 w-16 flex items-center justify-center rounded-lg bg-[var(--sch-bg)] border border-[var(--sch-border)] font-mono text-lg text-[var(--sch-text)] text-center">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 0.5)}
        className="h-11 w-11 flex items-center justify-center rounded-lg border border-[var(--sch-border)] text-[var(--sch-text)] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function QtyStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-11 w-11 flex items-center justify-center rounded-lg border border-[var(--sch-border)] text-[var(--sch-text)] disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--sch-bg)] border border-[var(--sch-border)] font-mono text-lg text-[var(--sch-text)] text-center">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="h-11 w-11 flex items-center justify-center rounded-lg border border-[var(--sch-border)] text-[var(--sch-text)] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function PesoInput({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className || ""}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sch-text-muted)] font-mono text-sm">
        ₱
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder || "0.00"}
        className="h-12 w-full rounded-lg bg-[var(--sch-bg)] border border-[var(--sch-border)] pl-8 pr-3 font-mono text-lg text-right text-[var(--sch-text)] placeholder:text-[var(--sch-text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--sch-accent)] disabled:opacity-40"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Part Inline Form
// ---------------------------------------------------------------------------

function AddPartForm({
  onAdd,
  onCancel,
  isPending,
}: {
  onAdd: (desc: string, qty: number, pricePesos: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");

  const canSubmit = desc.trim().length > 0 && parseFloat(price) > 0;

  return (
    <div className="mt-3 p-3 rounded-lg border border-[var(--sch-accent)]/30 bg-[var(--sch-bg)]">
      <input
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Part description"
        className="h-12 w-full rounded-lg bg-[var(--sch-surface)] border border-[var(--sch-border)] px-3 text-[var(--sch-text)] placeholder:text-[var(--sch-text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--sch-accent)] mb-3"
      />
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0">
          <label className="text-xs text-[var(--sch-text-muted)] mb-1 block">
            Qty
          </label>
          <QtyStepper value={qty} onChange={setQty} disabled={isPending} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-[var(--sch-text-muted)] mb-1 block">
            Price
          </label>
          <PesoInput value={price} onChange={setPrice} disabled={isPending} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="h-10 px-4 rounded-lg border border-[var(--sch-border)] text-[var(--sch-text-muted)] text-sm font-medium disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => canSubmit && onAdd(desc.trim(), qty, price)}
          disabled={!canSubmit || isPending}
          className="h-10 px-4 rounded-lg bg-[var(--sch-accent)] text-black text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Card
// ---------------------------------------------------------------------------

function ServiceCard({
  card,
  addingPart,
  onToggleAddPart,
  onUpdateLaborHours,
  onUpdateLaborRate,
  onAddPart,
  onRemovePart,
  isPending,
}: {
  card: ServiceCardData;
  addingPart: boolean;
  onToggleAddPart: () => void;
  onUpdateLaborHours: (itemId: string, hours: number) => void;
  onUpdateLaborRate: (itemId: string, pesosValue: string) => void;
  onAddPart: (
    serviceCatalogId: string,
    desc: string,
    qty: number,
    pricePesos: string,
    partCount: number
  ) => void;
  onRemovePart: (itemId: string) => void;
  isPending: boolean;
}) {
  const cardTotal = calculateCardTotal(card);
  const laborItem = card.laborItem;

  // Local rate state for controlled input
  const [localRate, setLocalRate] = useState(
    laborItem ? centavosToPesos(laborItem.unitCost) : "0.00"
  );

  // Sync local rate when prop changes (e.g. after server update)
  const prevUnitCostRef = useRef(laborItem?.unitCost ?? 0);
  useEffect(() => {
    if (laborItem && laborItem.unitCost !== prevUnitCostRef.current) {
      setLocalRate(centavosToPesos(laborItem.unitCost));
      prevUnitCostRef.current = laborItem.unitCost;
    }
  }, [laborItem]);

  return (
    <div className="rounded-xl p-4 bg-[var(--sch-surface)] border border-[var(--sch-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[var(--sch-accent)]" />
          <h3 className="font-semibold text-[var(--sch-text)] line-clamp-1">
            {card.serviceName}
          </h3>
        </div>
        <span className="font-mono text-sm text-[var(--sch-accent)] font-semibold">
          {formatPeso(cardTotal)}
        </span>
      </div>

      {/* Labor section */}
      {laborItem && (
        <div className="mb-3">
          <div className="text-xs font-medium text-[var(--sch-text-muted)] uppercase tracking-wider mb-2">
            Labor
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-[var(--sch-text-muted)] mb-1 block">
                Hours
              </label>
              <HoursStepper
                value={laborItem.quantity}
                onChange={(v) => onUpdateLaborHours(laborItem.id, v)}
                disabled={isPending}
              />
            </div>
            <div className="text-[var(--sch-text-muted)] text-lg pb-2">
              &times;
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-[var(--sch-text-muted)] mb-1 block">
                Rate
              </label>
              <PesoInput
                value={localRate}
                onChange={setLocalRate}
                onBlur={() => onUpdateLaborRate(laborItem.id, localRate)}
                disabled={isPending}
              />
            </div>
            <div className="text-[var(--sch-text-muted)] text-lg pb-2">=</div>
            <div className="pb-2">
              <span className="font-mono text-lg text-[var(--sch-text)] font-semibold">
                {formatPeso(laborItem.subtotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Parts section */}
      {(card.partItems.length > 0 || laborItem) && (
        <div>
          {card.partItems.length > 0 && (
            <div className="text-xs font-medium text-[var(--sch-text-muted)] uppercase tracking-wider mb-2">
              Parts
            </div>
          )}
          {card.partItems.map((part) => (
            <div
              key={part.id}
              className="flex items-center justify-between py-2 border-b border-[var(--sch-border)] last:border-0"
            >
              <div className="flex-1 min-w-0 mr-2">
                <span className="text-sm text-[var(--sch-text)] line-clamp-1">
                  {part.description}
                </span>
                <span className="text-xs text-[var(--sch-text-muted)]">
                  {part.quantity} &times; {formatPeso(part.unitCost)}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-sm text-[var(--sch-text)]">
                  {formatPeso(part.subtotal)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemovePart(part.id)}
                  disabled={isPending}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Add Part button / form */}
          {addingPart ? (
            <AddPartForm
              onAdd={(desc, qty, price) =>
                onAddPart(
                  card.serviceCatalogId,
                  desc,
                  qty,
                  price,
                  card.partItems.length
                )
              }
              onCancel={onToggleAddPart}
              isPending={isPending}
            />
          ) : (
            <button
              type="button"
              onClick={onToggleAddPart}
              className="mt-2 flex items-center gap-1.5 text-sm text-[var(--sch-accent)] font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Part
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Other Items Card (no serviceCatalogId)
// ---------------------------------------------------------------------------

function OtherItemsCard({
  items,
  onRemove,
  onAddItem,
  isPending,
}: {
  items: LineItem[];
  onRemove: (id: string) => void;
  onAddItem: (desc: string, qty: number, pricePesos: string) => void;
  isPending: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  if (items.length === 0 && !showAddForm) return null;

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="rounded-xl p-4 bg-[var(--sch-surface)] border border-[var(--sch-border)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-[var(--sch-text-muted)]" />
          <h3 className="font-semibold text-[var(--sch-text)]">Other Items</h3>
        </div>
        <span className="font-mono text-sm text-[var(--sch-accent)] font-semibold">
          {formatPeso(total)}
        </span>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between py-2 border-b border-[var(--sch-border)] last:border-0"
        >
          <div className="flex-1 min-w-0 mr-2">
            <span className="text-sm text-[var(--sch-text)] line-clamp-1">
              {item.description}
            </span>
            <span className="text-xs text-[var(--sch-text-muted)]">
              {item.group} &middot; {item.quantity} &times;{" "}
              {formatPeso(item.unitCost)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-sm text-[var(--sch-text)]">
              {formatPeso(item.subtotal)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={isPending}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Add Item form */}
      {showAddForm ? (
        <div className="mt-3">
          <AddPartForm
            onAdd={(desc, qty, price) => {
              onAddItem(desc, qty, price);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
            isPending={isPending}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--sch-accent)] hover:opacity-80"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Link Copy Toast
// ---------------------------------------------------------------------------

function LinkCopyModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[var(--sch-surface)] border border-[var(--sch-border)] p-5">
        <h4 className="text-[var(--sch-text)] font-semibold mb-2">
          Approval Link
        </h4>
        <p className="text-sm text-[var(--sch-text-muted)] mb-3">
          Share this link with the customer for approval.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            readOnly
            value={url}
            className="flex-1 h-10 rounded-lg bg-[var(--sch-bg)] border border-[var(--sch-border)] px-3 text-xs text-[var(--sch-text)] font-mono truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="h-10 px-3 rounded-lg bg-[var(--sch-accent)] text-black text-sm font-semibold flex-shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-lg border border-[var(--sch-border)] text-[var(--sch-text-muted)] text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EstimateCardBuilder({
  versionId,
  initialLineItems,
  initialVersion,
  onSave,
}: EstimateCardBuilderProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems);
  const [version, setVersion] = useState<VersionSummary>(initialVersion);
  const [addingPartFor, setAddingPartFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce timer ref for hours changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { serviceCards, otherItems } = groupLineItems(lineItems);

  // Compute raw subtotal from line items
  const rawSubtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = calculateDiscount(
    rawSubtotal,
    version.discountType,
    version.discountValue
  );
  const grandTotal = rawSubtotal - discountAmount;

  // ---------------------------------------------------------------------------
  // Helpers to update local state after mutations
  // ---------------------------------------------------------------------------

  const refetchVersion = useCallback(async () => {
    // We don't have a direct refetch; we rely on the action response or
    // local recalculation. The version totals on the server are recalculated
    // by each action, but the actions don't all return them. We update locally.
  }, []);

  const updateLineItemLocally = useCallback(
    (id: string, updates: Partial<LineItem>) => {
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const updated = { ...item, ...updates };
          // Recalculate subtotal locally
          const base = Math.round(updated.quantity * updated.unitCost);
          updated.subtotal = base + Math.round(base * (updated.markup / 100));
          return updated;
        })
      );
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Labor handlers
  // ---------------------------------------------------------------------------

  const handleLaborHoursChange = useCallback(
    (itemId: string, newHours: number) => {
      // Update locally immediately for responsiveness
      updateLineItemLocally(itemId, { quantity: newHours });

      // Debounce the server call
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          // Actions expect unitCost in pesos
          const item = lineItems.find((i) => i.id === itemId);
          if (!item) return;
          const result = await updateLineItemAction(itemId, {
            quantity: newHours,
            unitCost: item.unitCost / 100, // Convert centavos to pesos for action
          });
          if (!result.success) {
            toast.error(result.error || "Failed to update hours");
          }
        });
      }, 500);
    },
    [lineItems, updateLineItemLocally]
  );

  const handleLaborRateBlur = useCallback(
    (itemId: string, pesosValue: string) => {
      const pesos = parseFloat(pesosValue);
      if (isNaN(pesos) || pesos < 0) return;

      const centavos = Math.round(pesos * 100);
      updateLineItemLocally(itemId, { unitCost: centavos });

      startTransition(async () => {
        const result = await updateLineItemAction(itemId, {
          unitCost: pesos, // Action expects pesos
        });
        if (!result.success) {
          toast.error(result.error || "Failed to update rate");
        }
      });
    },
    [updateLineItemLocally]
  );

  // ---------------------------------------------------------------------------
  // Part handlers
  // ---------------------------------------------------------------------------

  const handleAddPart = useCallback(
    (
      serviceCatalogId: string,
      desc: string,
      qty: number,
      pricePesos: string,
      partCount: number
    ) => {
      const price = parseFloat(pricePesos);
      if (isNaN(price) || price <= 0) return;

      startTransition(async () => {
        const result = await addLineItemAction(versionId, {
          group: "PARTS",
          description: desc,
          serviceCatalogId,
          quantity: qty,
          unit: "pcs",
          unitCost: price, // Action expects pesos
          markup: 0,
          sortOrder: (partCount + 1) * 10,
        });

        if (result.success && result.data) {
          // Add the new item locally
          const centavos = Math.round(price * 100);
          const subtotal = Math.round(qty * centavos);
          const newItem: LineItem = {
            id: result.data.id as string,
            group: "PARTS",
            description: desc,
            serviceCatalogId,
            quantity: qty,
            unit: "pcs",
            unitCost: centavos,
            markup: 0,
            subtotal,
            notes: null,
            estimatedHours: null,
            sortOrder: (partCount + 1) * 10,
          };
          setLineItems((prev) => [...prev, newItem]);
          setAddingPartFor(null);
          toast.success("Part added");
        } else {
          toast.error(result.error || "Failed to add part");
        }
      });
    },
    [versionId]
  );

  const handleRemovePart = useCallback((itemId: string) => {
    startTransition(async () => {
      const result = await deleteLineItemAction(itemId);
      if (result.success) {
        setLineItems((prev) => prev.filter((item) => item.id !== itemId));
        toast.success("Item removed");
      } else {
        toast.error(result.error || "Failed to remove item");
      }
    });
  }, []);

  // Add item to "Other Items" (no serviceCatalogId)
  const handleAddOtherItem = useCallback(
    (desc: string, qty: number, pricePesos: string) => {
      const price = parseFloat(pricePesos);
      if (isNaN(price) || price <= 0) return;

      startTransition(async () => {
        const result = await addLineItemAction(versionId, {
          group: "PARTS",
          description: desc,
          serviceCatalogId: null,
          quantity: qty,
          unit: "pcs",
          unitCost: price,
          markup: 0,
          sortOrder: (otherItems.length + 1) * 10,
        });

        if (result.success && result.data) {
          const centavos = Math.round(price * 100);
          const subtotal = Math.round(qty * centavos);
          const newItem: LineItem = {
            id: result.data.id as string,
            group: "PARTS",
            description: desc,
            serviceCatalogId: null,
            quantity: qty,
            unit: "pcs",
            unitCost: centavos,
            markup: 0,
            subtotal,
            notes: null,
            estimatedHours: null,
            sortOrder: (otherItems.length + 1) * 10,
          };
          setLineItems((prev) => [...prev, newItem]);
          toast.success("Item added");
        } else {
          toast.error(result.error || "Failed to add item");
        }
      });
    },
    [versionId, otherItems.length]
  );

  // ---------------------------------------------------------------------------
  // Discount handler
  // ---------------------------------------------------------------------------

  const handleDiscountChange = useCallback(
    (newType: string) => {
      const discountType =
        newType === "none" ? null : newType;

      setVersion((prev) => ({
        ...prev,
        discountType,
        discountValue: discountType ? prev.discountValue : 0,
      }));

      startTransition(async () => {
        const result = await updateVersionDetailsAction(versionId, {
          discountType: discountType as string | undefined,
          discountValue: 0,
        });
        if (!result.success) {
          toast.error(result.error || "Failed to update discount");
        } else if (result.data) {
          setVersion((prev) => ({
            ...prev,
            grandTotal: (result.data!.grandTotal as number) ?? prev.grandTotal,
          }));
        }
      });
    },
    [versionId]
  );

  const handleDiscountValueBlur = useCallback(
    (value: string) => {
      const numVal = parseFloat(value);
      if (isNaN(numVal) || numVal < 0) return;

      // For flat discount, value is in pesos; for percentage, it's a raw number
      const discountValue =
        version.discountType === "flat"
          ? Math.round(numVal * 100) // Store as centavos locally
          : Math.round(numVal * 100); // percentage stored as basis points

      setVersion((prev) => ({ ...prev, discountValue }));

      startTransition(async () => {
        const result = await updateVersionDetailsAction(versionId, {
          discountType: version.discountType as string | undefined,
          discountValue: numVal, // Action handles conversion
        });
        if (!result.success) {
          toast.error(result.error || "Failed to update discount");
        } else if (result.data) {
          setVersion((prev) => ({
            ...prev,
            grandTotal: (result.data!.grandTotal as number) ?? prev.grandTotal,
          }));
        }
      });
    },
    [versionId, version.discountType]
  );

  // ---------------------------------------------------------------------------
  // Footer actions
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(() => {
    setSaving(true);
    onSave();
    setSaving(false);
  }, [onSave]);

  const handleSaveAndSend = useCallback(async () => {
    setSaving(true);
    try {
      onSave();
      const result = await generateApprovalTokenAction(versionId);
      if (result.success && result.data) {
        const url = `${window.location.origin}/view/estimate/${result.data.token}`;
        setApprovalUrl(url);
      } else {
        toast.error(result.error || "Failed to generate link");
      }
    } finally {
      setSaving(false);
    }
  }, [versionId, onSave]);

  const handleSaveAndPrint = useCallback(async () => {
    setSaving(true);
    try {
      onSave();
      const result = await generateApprovalTokenAction(versionId);
      if (result.success && result.data) {
        window.open(
          `/view/estimate/${result.data.token}`,
          "_blank",
          "noopener"
        );
      } else {
        toast.error(result.error || "Failed to generate link");
      }
    } finally {
      setSaving(false);
    }
  }, [versionId, onSave]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const discountDisplayValue =
    version.discountType === "flat"
      ? (version.discountValue / 100).toFixed(2)
      : version.discountType === "percentage"
        ? (version.discountValue / 100).toFixed(2)
        : "0";

  return (
    <div className="pb-72">
      {/* Service cards */}
      <div className="space-y-4 px-4 pt-4">
        {serviceCards.map((card) => (
          <ServiceCard
            key={card.serviceCatalogId}
            card={card}
            addingPart={addingPartFor === card.serviceCatalogId}
            onToggleAddPart={() =>
              setAddingPartFor((prev) =>
                prev === card.serviceCatalogId ? null : card.serviceCatalogId
              )
            }
            onUpdateLaborHours={handleLaborHoursChange}
            onUpdateLaborRate={handleLaborRateBlur}
            onAddPart={handleAddPart}
            onRemovePart={handleRemovePart}
            isPending={isPending}
          />
        ))}

        <OtherItemsCard
          items={otherItems}
          onRemove={handleRemovePart}
          onAddItem={handleAddOtherItem}
          isPending={isPending}
        />

        {serviceCards.length === 0 && otherItems.length === 0 && (
          <div className="text-center py-12 text-[var(--sch-text-muted)]">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No line items yet.</p>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-lg bg-[var(--sch-bg)]/90 border-t border-[var(--sch-border)] p-4 z-40 pb-24">
        {/* Subtotal */}
        <div className="flex justify-between text-sm text-[var(--sch-text-muted)] mb-1">
          <span>Subtotal</span>
          <span className="font-mono">{formatPeso(rawSubtotal)}</span>
        </div>

        {/* Discount */}
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--sch-text-muted)]">
              Discount
            </span>
            <div className="relative">
              <select
                value={version.discountType || "none"}
                onChange={(e) => handleDiscountChange(e.target.value)}
                className="appearance-none h-8 pl-2 pr-7 rounded-md bg-[var(--sch-surface)] border border-[var(--sch-border)] text-xs text-[var(--sch-text)] focus:outline-none focus:ring-1 focus:ring-[var(--sch-accent)]"
              >
                <option value="none">None</option>
                <option value="flat">Flat</option>
                <option value="percentage">Percentage</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--sch-text-muted)] pointer-events-none" />
            </div>
          </div>
          {version.discountType && version.discountType !== "none" && (
            <div className="flex items-center gap-1">
              {version.discountType === "flat" && (
                <span className="text-xs text-[var(--sch-text-muted)]">₱</span>
              )}
              <input
                type="number"
                inputMode="decimal"
                step={version.discountType === "percentage" ? "1" : "0.01"}
                min="0"
                max={version.discountType === "percentage" ? "100" : undefined}
                defaultValue={discountDisplayValue}
                onBlur={(e) => handleDiscountValueBlur(e.target.value)}
                className="h-8 w-20 rounded-md bg-[var(--sch-surface)] border border-[var(--sch-border)] px-2 text-right font-mono text-xs text-[var(--sch-text)] focus:outline-none focus:ring-1 focus:ring-[var(--sch-accent)]"
              />
              {version.discountType === "percentage" && (
                <span className="text-xs text-[var(--sch-text-muted)]">%</span>
              )}
              {discountAmount > 0 && (
                <span className="text-xs text-red-400 font-mono ml-1">
                  &minus;{formatPeso(discountAmount)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Grand Total */}
        <div className="flex justify-between items-center mb-2 pt-1 border-t border-[var(--sch-border)]">
          <span className="text-base font-bold text-[var(--sch-text)]">
            Total
          </span>
          <span className="font-mono text-xl font-bold text-[var(--sch-text)]">
            {formatPeso(grandTotal)}
          </span>
        </div>

        {/* VAT note */}
        <p className="text-xs text-[var(--sch-text-muted)] italic mb-3">
          *Prices are VAT-inclusive
        </p>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isPending}
            className="flex-1 h-12 rounded-xl border border-[var(--sch-border)] text-[var(--sch-text)] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={handleSaveAndSend}
            disabled={saving || isPending}
            className="flex-1 h-12 rounded-xl bg-[var(--sch-accent)] text-black font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Save & Send
          </button>
          <button
            type="button"
            onClick={handleSaveAndPrint}
            disabled={saving || isPending}
            className="flex-1 h-12 rounded-xl border border-[var(--sch-border)] text-[var(--sch-text)] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print
          </button>
        </div>
      </div>

      {/* Approval URL Modal */}
      {approvalUrl && (
        <LinkCopyModal
          url={approvalUrl}
          onClose={() => setApprovalUrl(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Package, Check } from "lucide-react";
import { addBelongingAction, deleteBelongingAction } from "@/lib/actions/intake-actions";
import { COMMON_BELONGINGS } from "@/lib/constants";

interface Belonging {
  id: string;
  description: string;
  condition: string | null;
}

interface BelongingsChecklistProps {
  intakeRecordId: string;
  belongings: Belonging[];
  onUpdate: () => void;
}

export function BelongingsChecklist({
  intakeRecordId,
  belongings,
  onUpdate,
}: BelongingsChecklistProps) {
  // Derive checked items from existing belongings (match by label prefix)
  const initialChecked = new Set<string>();
  for (const item of COMMON_BELONGINGS) {
    if (belongings.some((b) => b.description.startsWith(item.label))) {
      initialChecked.add(item.id);
    }
  }

  const [checkedItems, setCheckedItems] = useState<Set<string>>(initialChecked);
  const [itemNotes, setItemNotes] = useState<Map<string, string>>(new Map());
  const [noItems, setNoItems] = useState(false);
  const [customDescription, setCustomDescription] = useState("");
  const [customCondition, setCustomCondition] = useState("");
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Toggle a common belonging item
  // -------------------------------------------------------------------------
  async function handleToggleItem(itemId: string) {
    const item = COMMON_BELONGINGS.find((i) => i.id === itemId);
    if (!item) return;

    const isCurrentlyChecked = checkedItems.has(itemId);

    if (isCurrentlyChecked) {
      // Uncheck: find and delete the belonging
      const existing = belongings.find((b) => b.description.startsWith(item.label));
      if (existing) {
        setSaving(true);
        const result = await deleteBelongingAction(existing.id);
        setSaving(false);
        if (!result.success) {
          toast.error(result.error || "Failed to remove item");
          return;
        }
      }
      setCheckedItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      setItemNotes((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      onUpdate();
    } else {
      // Check: add the belonging (if hasNotes, wait for notes to be entered)
      if (item.hasNotes) {
        // Just mark as checked — the user can type notes
        setCheckedItems((prev) => new Set(prev).add(itemId));
        // Auto-save immediately with just the label
        setSaving(true);
        const description = item.label;
        const result = await addBelongingAction(intakeRecordId, { description });
        setSaving(false);
        if (!result.success) {
          toast.error(result.error || "Failed to add item");
          setCheckedItems((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          return;
        }
        onUpdate();
      } else {
        // No notes needed — save immediately
        setSaving(true);
        const result = await addBelongingAction(intakeRecordId, {
          description: item.label,
        });
        setSaving(false);
        if (!result.success) {
          toast.error(result.error || "Failed to add item");
          return;
        }
        setCheckedItems((prev) => new Set(prev).add(itemId));
        onUpdate();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Save notes for a common item (re-create the belonging with updated desc)
  // -------------------------------------------------------------------------
  async function handleSaveNotes(itemId: string) {
    const item = COMMON_BELONGINGS.find((i) => i.id === itemId);
    if (!item) return;

    const notes = itemNotes.get(itemId)?.trim();
    if (!notes) return;

    // Delete the old one, add new with notes
    const existing = belongings.find((b) => b.description.startsWith(item.label));
    setSaving(true);
    if (existing) {
      await deleteBelongingAction(existing.id);
    }
    const description = `${item.label} — ${notes}`;
    const result = await addBelongingAction(intakeRecordId, { description });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || "Failed to save notes");
      return;
    }
    toast.success("Notes saved");
    onUpdate();
  }

  // -------------------------------------------------------------------------
  // Add custom item
  // -------------------------------------------------------------------------
  async function handleAddCustom() {
    if (!customDescription.trim()) {
      toast.error("Please enter an item description");
      return;
    }
    setSaving(true);
    const result = await addBelongingAction(intakeRecordId, {
      description: customDescription.trim(),
      condition: customCondition.trim() || null,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || "Failed to add item");
      return;
    }
    toast.success("Item added");
    setCustomDescription("");
    setCustomCondition("");
    onUpdate();
  }

  // -------------------------------------------------------------------------
  // Delete a recorded belonging
  // -------------------------------------------------------------------------
  async function handleDelete(id: string) {
    setSaving(true);
    const result = await deleteBelongingAction(id);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || "Failed to delete item");
      return;
    }
    // Also uncheck if it was a common item
    for (const item of COMMON_BELONGINGS) {
      const belonging = belongings.find((b) => b.id === id);
      if (belonging && belonging.description.startsWith(item.label)) {
        setCheckedItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    }
    toast.success("Item removed");
    onUpdate();
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* NO ITEMS LEFT CHECKBOX                                            */}
      {/* ----------------------------------------------------------------- */}
      <label className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-surface-300 cursor-pointer select-none transition-colors hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-50">
        <input
          type="checkbox"
          checked={noItems}
          onChange={(e) => setNoItems(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            noItems
              ? "bg-accent border-accent text-white"
              : "border-surface-300 bg-white"
          }`}
        >
          {noItems && <Check className="w-4 h-4" />}
        </div>
        <div>
          <span className="font-semibold text-surface-700">
            NO ITEMS LEFT IN VEHICLE
          </span>
          {noItems && (
            <p className="text-sm text-surface-500 mt-0.5">
              No personal items left in vehicle.
            </p>
          )}
        </div>
      </label>

      {!noItems && (
        <>
          {/* --------------------------------------------------------------- */}
          {/* COMMON ITEMS CHECKLIST                                          */}
          {/* --------------------------------------------------------------- */}
          <div>
            <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-3">
              Common Items
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMMON_BELONGINGS.map((item) => {
                const isChecked = checkedItems.has(item.id);
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      disabled={saving}
                      className={`w-full flex items-center gap-3 min-h-touch px-3 py-2 rounded-lg border transition-colors text-left ${
                        isChecked
                          ? "border-green-300 bg-green-50"
                          : "border-surface-200 bg-white hover:border-surface-300"
                      } disabled:opacity-50`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-surface-300 bg-white"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span
                        className={`text-sm ${
                          isChecked
                            ? "text-green-800 font-medium"
                            : "text-surface-700"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>

                    {/* Notes input for items with hasNotes */}
                    {isChecked && item.hasNotes && (
                      <div className="flex gap-2 ml-8">
                        <input
                          type="text"
                          placeholder="Notes / description..."
                          value={itemNotes.get(item.id) || ""}
                          onChange={(e) =>
                            setItemNotes((prev) =>
                              new Map(prev).set(item.id, e.target.value)
                            )
                          }
                          className="flex-1 text-sm rounded border border-surface-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(item.id)}
                          disabled={saving || !itemNotes.get(item.id)?.trim()}
                          className="text-sm px-3 py-1.5 rounded bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* ADD CUSTOM ITEM                                                 */}
          {/* --------------------------------------------------------------- */}
          <div>
            <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-3">
              Add Custom Item
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Item description"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="flex-1 min-h-touch rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              <input
                type="text"
                placeholder="Condition (optional)"
                value={customCondition}
                onChange={(e) => setCustomCondition(e.target.value)}
                className="sm:w-40 min-h-touch rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={saving || !customDescription.trim()}
                className="inline-flex items-center justify-center gap-2 min-h-touch px-4 rounded-lg bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* RECORDED BELONGINGS LIST                                        */}
          {/* --------------------------------------------------------------- */}
          <div>
            <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-3">
              Recorded Belongings
            </h3>
            {belongings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                <Package className="w-10 h-10 mb-2" />
                <p className="text-sm">No belongings recorded yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-100 border border-surface-200 rounded-lg overflow-hidden">
                {belongings.map((belonging) => (
                  <li
                    key={belonging.id}
                    className="flex items-center justify-between px-4 py-3 bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-800 truncate">
                        {belonging.description}
                      </p>
                      {belonging.condition && (
                        <p className="text-xs text-surface-500 mt-0.5">
                          Condition: {belonging.condition}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(belonging.id)}
                      disabled={saving}
                      className="ml-3 p-2 min-h-touch min-w-touch flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

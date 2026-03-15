"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import {
  getBaysAction,
  createBayAction,
  updateBayAction,
  deleteBayAction,
  reorderBaysAction,
} from "@/lib/actions/scheduler-actions";
import { BAY_TYPE_LABELS, BayType } from "@/types/enums";

const COLOR_PRESETS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

interface Bay {
  id: string;
  name: string;
  type: string;
  capacity: number;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  color: string | null;
}

export default function BayManagement() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("GENERAL");
  const [capacity, setCapacity] = useState(1);
  const [color, setColor] = useState("#3B82F6");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  // Load bays on mount
  useEffect(() => {
    loadBays();
  }, []);

  async function loadBays() {
    const result = await getBaysAction();
    if (result.success && result.data) {
      setBays(result.data);
    }
  }

  function resetForm() {
    setName("");
    setType("GENERAL");
    setCapacity(1);
    setColor("#3B82F6");
    setNotes("");
    setSortOrder(0);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(bay: Bay) {
    setName(bay.name);
    setType(bay.type);
    setCapacity(bay.capacity);
    setColor(bay.color || "#3B82F6");
    setNotes(bay.notes || "");
    setSortOrder(bay.sortOrder);
    setEditingId(bay.id);
    setShowForm(true);
  }

  function handleSubmit() {
    setError(null);
    const data = {
      name,
      type,
      capacity,
      color,
      notes: notes || null,
      sortOrder,
    };

    startTransition(async () => {
      const result = editingId
        ? await updateBayAction(editingId, data)
        : await createBayAction(data);

      if (result.success) {
        resetForm();
        await loadBays();
      } else {
        setError(result.error || "Something went wrong");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this bay?")) return;

    startTransition(async () => {
      const result = await deleteBayAction(id);
      if (result.success) {
        await loadBays();
      } else {
        setError(result.error || "Failed to delete bay");
      }
    });
  }

  function handleToggleActive(bay: Bay) {
    startTransition(async () => {
      const result = await updateBayAction(bay.id, {
        isActive: !bay.isActive,
      });
      if (result.success) {
        await loadBays();
      }
    });
  }

  function handleReorder(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= bays.length) return;
    const reordered = [...bays];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const orderedIds = reordered.map((b) => b.id);
    startTransition(async () => {
      const result = await reorderBaysAction(orderedIds);
      if (result.success) {
        await loadBays();
      } else {
        setError(result.error || "Failed to reorder bays");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            Bay Management
          </h3>
          <p className="text-sm text-surface-500">
            Configure shop bays and work stations
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Bay
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-4 bg-surface-50 rounded-lg border border-surface-200">
          <h4 className="text-sm font-semibold text-surface-700 mb-3">
            {editingId ? "Edit Bay" : "New Bay"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bay 1"
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              >
                {Object.entries(BAY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2 mb-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={`w-6 h-6 rounded-full flex-shrink-0 transition-all ${
                      color.toUpperCase() === preset.toUpperCase()
                        ? "ring-2 ring-offset-2 ring-accent-500"
                        : ""
                    }`}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded border border-surface-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 border border-surface-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Capacity
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                min={1}
                max={5}
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                min={0}
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this bay..."
                rows={2}
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={isPending || !name.trim()}
              className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {isPending
                ? "Saving..."
                : editingId
                  ? "Update Bay"
                  : "Create Bay"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-surface-300 text-surface-600 rounded-lg hover:bg-surface-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bay List */}
      {bays.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-8">
          No bays configured yet.
        </p>
      ) : (
        <div className="space-y-2">
          {bays.map((bay, index) => (
            <div
              key={bay.id}
              className={`flex items-center gap-4 p-3 rounded-lg border ${
                bay.isActive
                  ? "border-surface-200 bg-white"
                  : "border-surface-100 bg-surface-50 opacity-60"
              }`}
            >
              {/* Reorder arrows */}
              <div className="flex flex-col flex-shrink-0">
                <button
                  onClick={() => handleReorder(index, "up")}
                  disabled={index === 0 || isPending}
                  className="p-0.5 text-surface-400 hover:text-surface-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleReorder(index, "down")}
                  disabled={index === bays.length - 1 || isPending}
                  className="p-0.5 text-surface-400 hover:text-surface-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Color swatch */}
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: bay.color || "#94a3b8" }}
              />
              {/* Name & Type */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-900">
                    {bay.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600">
                    {BAY_TYPE_LABELS[bay.type as BayType] || bay.type}
                  </span>
                  {!bay.isActive && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                      Inactive
                    </span>
                  )}
                </div>
                {!bay.isActive && (
                  <p className="text-xs text-surface-400 italic mt-0.5">
                    Hidden from schedule
                  </p>
                )}
                {bay.notes && (
                  <p className="text-xs text-surface-400 mt-0.5 truncate">
                    {bay.notes}
                  </p>
                )}
              </div>
              {/* Capacity */}
              <span className="text-xs text-surface-400 flex-shrink-0">
                Cap: {bay.capacity}
              </span>
              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(bay)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    bay.isActive
                      ? "text-green-600 hover:bg-green-50"
                      : "text-surface-400 hover:bg-surface-100"
                  }`}
                  disabled={isPending}
                >
                  {bay.isActive ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => startEdit(bay)}
                  className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded transition-colors"
                  disabled={isPending}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(bay.id)}
                  className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  disabled={isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

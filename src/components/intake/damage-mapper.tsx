"use client";

import { useState, useCallback } from "react";
import { CarSvg } from "@/components/intake/car-svg";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DAMAGE_ZONES } from "@/lib/constants";
import {
  DamageType,
  DamageSeverity,
  DAMAGE_TYPE_LABELS,
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_SEVERITY_COLORS,
} from "@/types/enums";
import {
  addDamageEntryAction,
  updateDamageEntryAction,
  deleteDamageEntryAction,
} from "@/lib/actions/intake-actions";
import { Pencil, Trash2, ChevronRight } from "lucide-react";

type View = "top" | "left" | "right" | "front" | "rear";

interface DamageEntry {
  id: string;
  zone: string;
  damageType: string;
  severity: string;
  notes: string | null;
}

interface Photo {
  id: string;
  category: string | null;
  thumbnailPath: string;
}

interface DamageMapperProps {
  intakeRecordId: string;
  damageEntries: DamageEntry[];
  photos: Photo[];
  onUpdate: () => void;
  onComplete?: () => void;
}

const VIEWS: { value: View; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "front", label: "Front" },
  { value: "rear", label: "Rear" },
];

const DAMAGE_TYPES = Object.values(DamageType);
const SEVERITIES = Object.values(DamageSeverity);

// Build zone label lookup
const ZONE_LABEL_MAP = new Map<string, string>(DAMAGE_ZONES.map((z) => [z.id, z.label]));

function getZoneLabel(zoneId: string): string {
  return ZONE_LABEL_MAP.get(zoneId) || zoneId;
}

// Which zones are visible in each view
function getViewZoneIds(view: View): string[] {
  return DAMAGE_ZONES.filter((z) => (z.views as readonly string[]).includes(view)).map((z) => z.id);
}

export function DamageMapper({
  intakeRecordId,
  damageEntries,
  photos: _photos,
  onUpdate,
  onComplete,
}: DamageMapperProps) {
  const [currentView, setCurrentView] = useState<View>("top");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    damageType: DamageType.SCRATCH as string,
    severity: DamageSeverity.MINOR as string,
    notes: "",
  });
  const [noDamage, setNoDamage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Prepare numbered markers for the SVG
  const numberedEntries = damageEntries.map((entry, i) => ({
    zone: entry.zone,
    severity: entry.severity,
    index: i + 1,
  }));

  // Filter to current view
  const viewZoneIds = getViewZoneIds(currentView);
  const filteredMarkers = numberedEntries.filter((e) =>
    viewZoneIds.includes(e.zone)
  );

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      if (noDamage) return;

      // Check if there's already an entry for this zone
      const existing = damageEntries.find((e) => e.zone === zoneId);
      if (existing) {
        // Edit mode
        setEditingEntry(existing.id);
        setFormData({
          damageType: existing.damageType,
          severity: existing.severity,
          notes: existing.notes || "",
        });
      } else {
        // New entry
        setEditingEntry(null);
        setFormData({
          damageType: DamageType.SCRATCH,
          severity: DamageSeverity.MINOR,
          notes: "",
        });
      }
      setSelectedZone(zoneId);
    },
    [damageEntries, noDamage]
  );

  const handleCancel = () => {
    setSelectedZone(null);
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!selectedZone) return;
    setSaving(true);

    try {
      if (editingEntry) {
        await updateDamageEntryAction(editingEntry, {
          zone: selectedZone,
          damageType: formData.damageType,
          severity: formData.severity,
          notes: formData.notes || null,
        });
      } else {
        await addDamageEntryAction(intakeRecordId, {
          zone: selectedZone,
          damageType: formData.damageType,
          severity: formData.severity,
          notes: formData.notes || null,
        });
      }
      onUpdate();
      setSelectedZone(null);
      setEditingEntry(null);
    } finally {
      setSaving(false);
    }
  };

  const handleEditRow = (entry: DamageEntry) => {
    // Switch to a view that contains this zone
    const zone = DAMAGE_ZONES.find((z) => z.id === entry.zone);
    if (zone && zone.views.length > 0) {
      setCurrentView(zone.views[0] as View);
    }
    setSelectedZone(entry.zone);
    setEditingEntry(entry.id);
    setFormData({
      damageType: entry.damageType,
      severity: entry.severity,
      notes: entry.notes || "",
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDamageEntryAction(deleteId);
      onUpdate();
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* NO DAMAGE CHECKBOX */}
      <label className="flex items-center gap-3 p-4 bg-surface-50 rounded-xl border border-surface-200 cursor-pointer">
        <input
          type="checkbox"
          checked={noDamage}
          onChange={(e) => {
            setNoDamage(e.target.checked);
            if (e.target.checked) {
              setSelectedZone(null);
              setEditingEntry(null);
            }
          }}
          className="w-5 h-5 rounded border-surface-300 text-accent focus:ring-accent"
        />
        <span className="font-medium text-primary">
          No pre-existing damage
        </span>
      </label>

      {noDamage ? (
        <div className="text-center py-10 text-surface-500 bg-surface-50 rounded-xl border border-surface-200">
          <p className="text-lg font-medium">
            Vehicle inspected — no pre-existing damage observed.
          </p>
        </div>
      ) : (
        <>
          {/* VIEW TABS */}
          <div className="flex border-b border-surface-200">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => {
                  setCurrentView(v.value);
                  setSelectedZone(null);
                  setEditingEntry(null);
                }}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                  currentView === v.value
                    ? "text-accent border-b-2 border-accent font-bold"
                    : "text-surface-400 hover:text-surface-600"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* CAR SVG */}
          <div className="bg-white rounded-xl border border-surface-200 p-4">
            <p className="text-xs text-surface-400 text-center mb-2">
              Tap a zone to mark damage
            </p>
            <CarSvg
              view={currentView}
              damageEntries={filteredMarkers}
              onZoneClick={handleZoneClick}
            />
          </div>

          {/* DAMAGE FORM (slide-up panel) */}
          {selectedZone && (
            <div className="bg-white rounded-xl border border-surface-200 shadow-lg p-4 space-y-4 animate-in slide-in-from-bottom-4">
              <h4 className="font-semibold text-primary text-lg">
                {getZoneLabel(selectedZone)}
              </h4>

              {/* Damage type */}
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">
                  Damage Type
                </label>
                <select
                  value={formData.damageType}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, damageType: e.target.value }))
                  }
                  className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-accent focus:border-accent"
                >
                  {DAMAGE_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {DAMAGE_TYPE_LABELS[dt]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity radio buttons */}
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-2">
                  Severity
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SEVERITIES.map((sev) => {
                    const isSelected = formData.severity === sev;
                    return (
                      <label
                        key={sev}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-accent bg-accent-50"
                            : "border-surface-200 hover:border-surface-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="severity"
                          value={sev}
                          checked={isSelected}
                          onChange={() =>
                            setFormData((f) => ({ ...f, severity: sev }))
                          }
                          className="sr-only"
                        />
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${DAMAGE_SEVERITY_COLORS[sev]
                            .split(" ")[0]
                            .replace("100", "500")}`}
                        />
                        <span className="text-sm font-medium text-primary">
                          {DAMAGE_SEVERITY_LABELS[sev]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">
                  Notes{" "}
                  <span className="text-surface-400 font-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                  placeholder="e.g., 5cm scratch near handle"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingEntry
                    ? "Update"
                    : "Add Damage"}
                </button>
              </div>
            </div>
          )}

          {/* DAMAGE SUMMARY LIST */}
          {damageEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
                <h4 className="text-sm font-semibold text-primary">
                  Damage Log ({damageEntries.length})
                </h4>
              </div>
              <ul className="divide-y divide-surface-100">
                {damageEntries.map((entry, i) => (
                  <li
                    key={entry.id}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    {/* Number */}
                    <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {getZoneLabel(entry.zone)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600">
                          {DAMAGE_TYPE_LABELS[entry.damageType as DamageType] ||
                            entry.damageType}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            DAMAGE_SEVERITY_COLORS[
                              entry.severity as DamageSeverity
                            ] || "bg-surface-100 text-surface-500"
                          }`}
                        >
                          {DAMAGE_SEVERITY_LABELS[
                            entry.severity as DamageSeverity
                          ] || entry.severity}
                        </span>
                        {entry.notes && (
                          <span className="text-xs text-surface-400 truncate max-w-[120px]">
                            {entry.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditRow(entry)}
                        className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-accent transition-colors"
                        aria-label={`Edit ${getZoneLabel(entry.zone)} damage`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(entry.id)}
                        className="p-2 rounded-lg hover:bg-danger-50 text-surface-400 hover:text-danger transition-colors"
                        aria-label={`Delete ${getZoneLabel(entry.zone)} damage`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* CONTINUE BUTTON */}
      {onComplete && (
        <button
          type="button"
          onClick={onComplete}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-600 transition-colors"
        >
          Continue to Belongings
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Damage Entry"
        message="Are you sure you want to remove this damage entry? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}

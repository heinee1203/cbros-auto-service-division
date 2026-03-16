"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Camera,
  Upload,
  Check,
  ChevronRight,
  AlertTriangle,
  Image,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { WALKAROUND_SHOTS, CONDITIONAL_SHOTS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExistingPhoto {
  id: string;
  category: string | null;
  thumbnailPath: string;
}

interface CapturedPhoto {
  id: string;
  thumbnailPath: string;
}

interface Shot {
  id: string;
  label: string;
  category: string;
  required: boolean;
}

interface WalkaroundCaptureProps {
  intakeRecordId: string;
  jobOrderNumber: string;
  serviceCategories: string[];
  existingPhotos: ExistingPhoto[];
  onComplete: () => void;
  darkMode?: boolean;
}

// ---------------------------------------------------------------------------
// Category display labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  exterior: "Exterior",
  interior: "Interior",
  wheels: "Wheels",
  underbody: "Underbody",
  detail: "Detail",
  restoration: "Restoration",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WalkaroundCapture({
  intakeRecordId,
  jobOrderNumber,
  serviceCategories,
  existingPhotos,
  onComplete,
  darkMode,
}: WalkaroundCaptureProps) {
  // Build the full shot list from base + conditional shots
  const shotList = useMemo<Shot[]>(() => {
    const base: Shot[] = WALKAROUND_SHOTS.map((s) => ({ ...s }));
    const conditional: Shot[] = [];
    for (const cat of serviceCategories) {
      const extras = CONDITIONAL_SHOTS[cat];
      if (extras) {
        conditional.push(...extras.map((s) => ({ ...s, required: true })));
      }
    }
    return [...base, ...conditional];
  }, [serviceCategories]);

  // Group shots by category for display
  const groupedShots = useMemo(() => {
    const groups: { category: string; label: string; shots: Shot[] }[] = [];
    const seen = new Set<string>();
    for (const shot of shotList) {
      if (!seen.has(shot.category)) {
        seen.add(shot.category);
        groups.push({
          category: shot.category,
          label: CATEGORY_LABELS[shot.category] ?? shot.category,
          shots: [],
        });
      }
      groups.find((g) => g.category === shot.category)!.shots.push(shot);
    }
    return groups;
  }, [shotList]);

  // Initialize captured photos from existing ones
  const [capturedPhotos, setCapturedPhotos] = useState<Map<string, CapturedPhoto>>(() => {
    const map = new Map<string, CapturedPhoto>();
    for (const photo of existingPhotos) {
      if (photo.category && photo.category !== "extra") {
        map.set(photo.category, { id: photo.id, thumbnailPath: photo.thumbnailPath });
      }
    }
    return map;
  });

  const [uploading, setUploading] = useState<Map<string, boolean>>(new Map());
  const [extraPhotos, setExtraPhotos] = useState<CapturedPhoto[]>(() =>
    existingPhotos
      .filter((p) => p.category === "extra")
      .map((p) => ({ id: p.id, thumbnailPath: p.thumbnailPath }))
  );
  const [selectedShot, setSelectedShot] = useState<string | null>(
    shotList.length > 0 ? shotList[0].id : null
  );

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Progress stats
  const totalRequired = shotList.length;
  const capturedCount = shotList.filter((s) => capturedPhotos.has(s.id)).length;
  const remaining = totalRequired - capturedCount;
  const allCaptured = remaining === 0;
  const progressPct = totalRequired > 0 ? (capturedCount / totalRequired) * 100 : 0;

  // Selected shot details
  const activeShotData = shotList.find((s) => s.id === selectedShot) ?? null;

  // Upload handler
  const handleUpload = useCallback(
    async (file: File, shotId: string) => {
      setUploading((prev) => new Map(prev).set(shotId, true));

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", "INTAKE");
        formData.append("entityId", intakeRecordId);
        formData.append("stage", "INTAKE");
        formData.append("category", shotId);
        formData.append("jobOrderNumber", jobOrderNumber);

        const res = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Upload failed");
        }

        const data = await res.json();

        if (shotId === "extra") {
          setExtraPhotos((prev) => [
            ...prev,
            { id: data.id, thumbnailPath: data.thumbnailPath },
          ]);
        } else {
          setCapturedPhotos((prev) => {
            const next = new Map(prev);
            next.set(shotId, { id: data.id, thumbnailPath: data.thumbnailPath });
            return next;
          });
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to upload photo"
        );
      } finally {
        setUploading((prev) => {
          const next = new Map(prev);
          next.delete(shotId);
          return next;
        });
      }
    },
    [intakeRecordId, jobOrderNumber]
  );

  // File input change handler
  const handleFileChange = useCallback(
    (shotId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file, shotId);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleUpload]
  );

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerGallery = () => galleryInputRef.current?.click();
  const triggerExtra = () => extraInputRef.current?.click();

  // Auto-advance to next uncaptured shot after capture
  const selectNextUncaptured = useCallback(
    (afterId: string) => {
      const idx = shotList.findIndex((s) => s.id === afterId);
      for (let i = idx + 1; i < shotList.length; i++) {
        if (!capturedPhotos.has(shotList[i].id)) {
          setSelectedShot(shotList[i].id);
          return;
        }
      }
      // Wrap around
      for (let i = 0; i < idx; i++) {
        if (!capturedPhotos.has(shotList[i].id)) {
          setSelectedShot(shotList[i].id);
          return;
        }
      }
    },
    [shotList, capturedPhotos]
  );

  // Wrapper for upload that auto-advances
  const handleShotUpload = useCallback(
    async (file: File, shotId: string) => {
      await handleUpload(file, shotId);
      selectNextUncaptured(shotId);
    },
    [handleUpload, selectNextUncaptured]
  );

  const handleShotFileChange = useCallback(
    (shotId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleShotUpload(file, shotId);
      }
      e.target.value = "";
    },
    [handleShotUpload]
  );

  return (
    <div
      className={darkMode ? "flex flex-col h-full" : "flex flex-col h-full bg-gray-50"}
      style={darkMode ? { background: "var(--sch-bg)" } : undefined}
    >
      {/* ---- Progress Indicator ---- */}
      <div
        className={darkMode ? "shrink-0 border-b px-4 py-3 sm:px-6" : "shrink-0 border-b bg-white px-4 py-3 sm:px-6"}
        style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
      >
        <div className="flex items-center justify-between mb-2">
          {allCaptured ? (
            <p
              className="text-sm font-semibold text-green-600 flex items-center gap-1.5"
              style={darkMode ? { color: "#34D399" } : undefined}
            >
              <Check className="h-4 w-4" />
              All required photos captured!
            </p>
          ) : (
            <p
              className={darkMode ? "text-sm font-semibold" : "text-sm font-semibold text-gray-800"}
              style={darkMode ? { color: "var(--sch-text)" } : undefined}
            >
              {capturedCount} of {totalRequired} required photos captured
            </p>
          )}
          {extraPhotos.length > 0 && (
            <span
              className={darkMode ? "text-xs" : "text-xs text-gray-500"}
              style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}
            >
              +{extraPhotos.length} extra
            </span>
          )}
        </div>
        <div
          className={darkMode ? "h-2 w-full rounded-full overflow-hidden" : "h-2 w-full rounded-full bg-gray-200 overflow-hidden"}
          style={darkMode ? { background: "var(--sch-border)" } : undefined}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              allCaptured ? "bg-green-500" : darkMode ? "" : "bg-amber-500"
            }`}
            style={{ width: `${progressPct}%`, ...(darkMode && !allCaptured ? { background: "var(--sch-accent)" } : {}) }}
          />
        </div>
      </div>

      {/* ---- Main Content ---- */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* ---- Shot List Sidebar (desktop) / Horizontal strip (mobile) ---- */}
        <div
          className={darkMode ? "shrink-0 md:w-[300px] border-b md:border-b-0 md:border-r" : "shrink-0 md:w-[300px] border-b md:border-b-0 md:border-r bg-white"}
          style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
        >
          {/* Mobile: horizontal scroll */}
          <div className="md:hidden overflow-x-auto">
            <div className="flex gap-2 p-3">
              {shotList.map((shot, i) => {
                const captured = capturedPhotos.get(shot.id);
                const isUploading = uploading.get(shot.id);
                const isActive = selectedShot === shot.id;

                return (
                  <button
                    key={shot.id}
                    onClick={() => setSelectedShot(shot.id)}
                    className={`shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors min-h-[48px] ${
                      darkMode
                        ? ""
                        : isActive
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : captured
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    style={darkMode ? {
                      background: isActive ? "var(--sch-accent)" : captured ? "rgba(52,211,153,0.15)" : "var(--sch-surface)",
                      borderColor: isActive ? "var(--sch-accent)" : captured ? "#34D399" : "var(--sch-border)",
                      color: isActive ? "white" : captured ? "#34D399" : "var(--sch-text-muted)",
                    } : undefined}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" style={darkMode ? { color: "var(--sch-accent)" } : undefined} />
                    ) : captured ? (
                      <Check className="h-4 w-4 text-green-600" style={darkMode ? { color: "#34D399" } : undefined} />
                    ) : (
                      <span
                        className={darkMode ? "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]" : "flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-400"}
                        style={darkMode ? { borderColor: "var(--sch-border)", color: "var(--sch-text-dim)" } : undefined}
                      >
                        {i + 1}
                      </span>
                    )}
                    <span className="whitespace-nowrap">{shot.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop: vertical scrollable list */}
          <div className="hidden md:block overflow-y-auto h-full">
            {groupedShots.map((group) => (
              <div key={group.category}>
                <div
                  className={darkMode ? "sticky top-0 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border-b" : "sticky top-0 bg-gray-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200"}
                  style={darkMode ? { background: "var(--sch-bg)", color: "var(--sch-text-muted)", borderColor: "var(--sch-border)" } : undefined}
                >
                  {group.label}
                </div>
                {group.shots.map((shot, i) => {
                  const captured = capturedPhotos.get(shot.id);
                  const isUploading = uploading.get(shot.id);
                  const isActive = selectedShot === shot.id;
                  const globalIdx = shotList.findIndex((s) => s.id === shot.id) + 1;

                  return (
                    <button
                      key={shot.id}
                      onClick={() => setSelectedShot(shot.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-sm text-left border-b transition-colors min-h-[48px] ${
                        darkMode
                          ? isActive ? "border-l-2" : ""
                          : isActive
                          ? "bg-amber-50 border-l-2 border-l-amber-500"
                          : "hover:bg-gray-50"
                      } ${!darkMode ? "border-gray-100" : ""}`}
                      style={darkMode ? {
                        borderColor: "var(--sch-border)",
                        ...(isActive ? { background: "rgba(245,158,11,0.1)", borderLeftColor: "var(--sch-accent)" } : {}),
                      } : undefined}
                    >
                      {/* Status indicator */}
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-500" style={darkMode ? { color: "var(--sch-accent)" } : undefined} />
                      ) : captured ? (
                        <div className="relative shrink-0">
                          <div
                            className={darkMode ? "h-8 w-8 rounded overflow-hidden border" : "h-8 w-8 rounded overflow-hidden border border-green-200"}
                            style={darkMode ? { borderColor: "#34D399" } : undefined}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={captured.thumbnailPath}
                              alt={shot.label}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <Check className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-green-500 p-0.5 text-white" />
                        </div>
                      ) : (
                        <span
                          className={darkMode ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium" : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-xs font-medium text-gray-400"}
                          style={darkMode ? { borderColor: "var(--sch-border)", color: "var(--sch-text-dim)" } : undefined}
                        >
                          {globalIdx}
                        </span>
                      )}

                      <span
                        className={`flex-1 ${
                          darkMode
                            ? ""
                            : captured ? "text-green-700" : "text-gray-700"
                        }`}
                        style={darkMode ? { color: captured ? "#34D399" : "var(--sch-text)" } : undefined}
                      >
                        {shot.label}
                      </span>

                      {isActive && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-amber-500" style={darkMode ? { color: "var(--sch-accent)" } : undefined} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Extra photos section in sidebar */}
            <div>
              <div
                className={darkMode ? "sticky top-0 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border-b" : "sticky top-0 bg-gray-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200"}
                style={darkMode ? { background: "var(--sch-bg)", color: "var(--sch-text-muted)", borderColor: "var(--sch-border)" } : undefined}
              >
                Extra Photos ({extraPhotos.length})
              </div>
              {extraPhotos.map((photo, i) => (
                <div
                  key={photo.id}
                  className={darkMode ? "flex items-center gap-3 px-4 py-3 text-sm border-b" : "flex items-center gap-3 px-4 py-3 text-sm border-b border-gray-100"}
                  style={darkMode ? { borderColor: "var(--sch-border)" } : undefined}
                >
                  <div
                    className={darkMode ? "h-8 w-8 rounded overflow-hidden border shrink-0" : "h-8 w-8 rounded overflow-hidden border border-gray-200 shrink-0"}
                    style={darkMode ? { borderColor: "var(--sch-border)" } : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailPath}
                      alt={`Extra photo ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span
                    className={darkMode ? "" : "text-gray-600"}
                    style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}
                  >Extra photo {i + 1}</span>
                </div>
              ))}
              <button
                onClick={triggerExtra}
                className={darkMode ? "flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors min-h-[48px]" : "flex w-full items-center gap-2 px-4 py-3 text-sm text-amber-600 hover:bg-amber-50 transition-colors min-h-[48px]"}
                style={darkMode ? { color: "var(--sch-accent)" } : undefined}
              >
                <Plus className="h-4 w-4" />
                Add extra photo
              </button>
            </div>
          </div>
        </div>

        {/* ---- Active Shot / Capture Area ---- */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          {activeShotData ? (
            <div className="w-full max-w-md flex flex-col items-center gap-6">
              {/* Shot label */}
              <div className="text-center">
                <p
                  className={darkMode ? "text-xs uppercase tracking-wider mb-1" : "text-xs uppercase tracking-wider text-gray-500 mb-1"}
                  style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}
                >
                  Shot {shotList.findIndex((s) => s.id === activeShotData.id) + 1} of{" "}
                  {totalRequired}
                </p>
                <h2
                  className={darkMode ? "text-xl font-bold" : "text-xl font-bold text-gray-900"}
                  style={darkMode ? { color: "var(--sch-text)" } : undefined}
                >
                  {activeShotData.label}
                </h2>
              </div>

              {/* Current capture preview */}
              {capturedPhotos.has(activeShotData.id) ? (
                <div
                  className={darkMode ? "relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2" : "relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-green-200 bg-gray-100"}
                  style={darkMode ? { borderColor: "#34D399", background: "var(--sch-surface)" } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedPhotos.get(activeShotData.id)!.thumbnailPath}
                    alt={activeShotData.label}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                    <Check className="h-3 w-3" />
                    Captured
                  </div>
                </div>
              ) : (
                <div
                  className={darkMode ? "w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center" : "w-full aspect-[4/3] rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-400"}
                  style={darkMode ? { borderColor: "var(--sch-border)", background: "var(--sch-surface)", color: "var(--sch-text-dim)" } : undefined}
                >
                  <Image className="h-12 w-12 mb-2" />
                  <p className="text-sm">No photo yet</p>
                </div>
              )}

              {/* Upload spinner */}
              {uploading.get(activeShotData.id) && (
                <div className="flex items-center gap-2 text-amber-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Uploading...</span>
                </div>
              )}

              {/* Capture buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={triggerCamera}
                  disabled={!!uploading.get(activeShotData.id)}
                  className={darkMode ? "flex-1 flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]" : "flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"}
                  style={darkMode ? { background: "var(--sch-accent)" } : undefined}
                >
                  <Camera className="h-5 w-5" />
                  {capturedPhotos.has(activeShotData.id)
                    ? "Retake Photo"
                    : "Use Camera"}
                </button>
                <button
                  onClick={triggerGallery}
                  disabled={!!uploading.get(activeShotData.id)}
                  className={darkMode ? "flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-6 py-4 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]" : "flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-6 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"}
                  style={darkMode ? { borderColor: "var(--sch-border)", background: "var(--sch-surface)", color: "var(--sch-text)" } : undefined}
                >
                  <Upload className="h-5 w-5" />
                  Upload from Gallery
                </button>
              </div>

              {/* Mobile: Add extra photo button */}
              <div className="md:hidden w-full">
                <button
                  onClick={triggerExtra}
                  className={darkMode ? "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition-colors min-h-[48px]" : "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors min-h-[48px]"}
                  style={darkMode ? { borderColor: "var(--sch-accent)", color: "var(--sch-accent)", background: "rgba(245,158,11,0.1)" } : undefined}
                >
                  <Plus className="h-4 w-4" />
                  Add Extra Photo
                </button>
                {extraPhotos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {extraPhotos.map((photo, i) => (
                      <div
                        key={photo.id}
                        className={darkMode ? "h-16 w-16 shrink-0 rounded-lg overflow-hidden border" : "h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-gray-200"}
                        style={darkMode ? { borderColor: "var(--sch-border)" } : undefined}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumbnailPath}
                          alt={`Extra ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={darkMode ? "text-center" : "text-center text-gray-500"}
              style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}
            >
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>No shots configured</p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Hidden file inputs ---- */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={selectedShot ? handleShotFileChange(selectedShot) : undefined}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={selectedShot ? handleShotFileChange(selectedShot) : undefined}
      />
      <input
        ref={extraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange("extra")}
      />

      {/* ---- Bottom bar with Next button ---- */}
      <div
        className={darkMode ? "shrink-0 border-t px-4 py-3 sm:px-6" : "shrink-0 border-t bg-white px-4 py-3 sm:px-6"}
        style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
      >
        {allCaptured ? (
          <button
            onClick={onComplete}
            className={darkMode ? "w-full flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-semibold text-white shadow-sm transition-colors min-h-[48px]" : "w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 active:bg-amber-700 transition-colors min-h-[48px]"}
            style={darkMode ? { background: "var(--sch-accent)" } : undefined}
          >
            Continue to Damage Map
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              disabled
              className={darkMode ? "w-full flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-semibold cursor-not-allowed min-h-[48px]" : "w-full flex items-center justify-center gap-2 rounded-xl bg-gray-200 px-6 py-4 text-sm font-semibold text-gray-400 cursor-not-allowed min-h-[48px]"}
              style={darkMode ? { background: "var(--sch-border)", color: "var(--sch-text-dim)" } : undefined}
            >
              Continue to Damage Map
              <ChevronRight className="h-4 w-4" />
            </button>
            <p
              className={darkMode ? "flex items-center gap-1.5 text-xs" : "flex items-center gap-1.5 text-xs text-amber-600"}
              style={darkMode ? { color: "var(--sch-accent)" } : undefined}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {remaining} required photo{remaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

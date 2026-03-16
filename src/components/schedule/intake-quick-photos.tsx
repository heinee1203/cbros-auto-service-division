"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Check, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  QUICK_EXTERIOR_SHOTS,
  FOCUSED_WORK_AREA_SHOTS,
} from "@/lib/intake-levels";

interface IntakeQuickPhotosProps {
  intakeLevel: 1 | 2;
  intakeRecordId: string;
  jobOrderNumber: string;
  categories: string[];
  onComplete: () => void;
  onBack: () => void;
}

interface ShotDef {
  id: string;
  label: string;
  description: string;
}

interface CapturedPhoto {
  id: string;
  thumbnailPath: string;
  fullSizePath: string;
  localPreview: string; // object URL for immediate preview
}

function getWorkAreaShots(categories: string[]): ShotDef[] {
  const seen = new Set<string>();
  const shots: ShotDef[] = [];
  for (const cat of categories) {
    const catShots = FOCUSED_WORK_AREA_SHOTS[cat];
    if (!catShots) continue;
    for (const shot of catShots) {
      if (!seen.has(shot.id) && shots.length < 4) {
        seen.add(shot.id);
        shots.push(shot);
      }
    }
  }
  return shots;
}

export function IntakeQuickPhotos({
  intakeLevel,
  intakeRecordId,
  jobOrderNumber,
  categories,
  onComplete,
  onBack,
}: IntakeQuickPhotosProps) {
  const exteriorShots: ShotDef[] = [...QUICK_EXTERIOR_SHOTS];
  const workAreaShots = intakeLevel === 2 ? getWorkAreaShots(categories) : [];
  const allShots = [...exteriorShots, ...workAreaShots];

  const [captured, setCaptured] = useState<Record<string, CapturedPhoto>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const capturedCount = Object.keys(captured).length;
  const totalRequired = allShots.length;
  const allCaptured = capturedCount >= totalRequired;

  const upload = useCallback(
    async (file: File, shotId: string) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "intake_record");
      formData.append("entityId", intakeRecordId);
      formData.append("stage", "INTAKE");
      formData.append("category", shotId);
      formData.append("jobOrderNumber", jobOrderNumber);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json() as Promise<{
        id: string;
        thumbnailPath: string;
        fullSizePath: string;
      }>;
    },
    [intakeRecordId, jobOrderNumber]
  );

  const handleCapture = useCallback(
    async (shotId: string, file: File) => {
      const localPreview = URL.createObjectURL(file);

      // Show preview immediately
      setCaptured((prev) => ({
        ...prev,
        [shotId]: {
          id: "",
          thumbnailPath: "",
          fullSizePath: "",
          localPreview,
        },
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[shotId];
        return next;
      });
      setUploading((prev) => ({ ...prev, [shotId]: true }));

      try {
        const result = await upload(file, shotId);
        setCaptured((prev) => ({
          ...prev,
          [shotId]: { ...result, localPreview },
        }));
      } catch {
        // Keep the local preview but mark the error
        setErrors((prev) => ({
          ...prev,
          [shotId]: "Upload failed. Tap to retry.",
        }));
      } finally {
        setUploading((prev) => ({ ...prev, [shotId]: false }));
      }
    },
    [upload]
  );

  const triggerFileInput = (shotId: string) => {
    fileInputRefs.current[shotId]?.click();
  };

  const handleFileChange = (shotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCapture(shotId, file);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const renderShotCell = (shot: ShotDef) => {
    const photo = captured[shot.id];
    const isUploading = uploading[shot.id];
    const error = errors[shot.id];
    const hasCaptured = !!photo;

    return (
      <div key={shot.id} className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => triggerFileInput(shot.id)}
          className="relative rounded-lg flex items-center justify-center overflow-hidden transition-all"
          style={{
            width: 150,
            height: 150,
            background: hasCaptured ? "transparent" : "var(--sch-surface)",
            border: hasCaptured
              ? "2px solid #34D399"
              : "2px dashed var(--sch-border)",
          }}
        >
          {hasCaptured ? (
            <>
              {/* Thumbnail preview */}
              <img
                src={photo.localPreview}
                alt={shot.label}
                className="w-full h-full object-cover"
              />
              {/* Green checkmark overlay */}
              {!isUploading && !error && (
                <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-400">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              {/* Uploading spinner */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div
                    className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  />
                </div>
              )}
              {/* Error overlay */}
              {error && !isUploading && (
                <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
                  <span className="text-[10px] text-white font-medium text-center px-2">
                    {error}
                  </span>
                </div>
              )}
              {/* Retake label */}
              {!isUploading && (
                <div className="absolute bottom-0 inset-x-0 bg-black/50 py-1 flex items-center justify-center gap-1">
                  <RotateCcw className="w-3 h-3 text-white/80" />
                  <span className="text-[10px] text-white/80 font-medium">
                    Retake
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Camera
                className="w-8 h-8"
                style={{ color: "var(--sch-text-dim)" }}
              />
              <span
                className="text-xs font-medium text-center px-1"
                style={{ color: "var(--sch-text-dim)" }}
              >
                {shot.label}
              </span>
            </div>
          )}
        </button>
        {/* Hidden file input */}
        <input
          ref={(el) => { fileInputRefs.current[shot.id] = el; }}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(shot.id, e)}
        />
        {/* Label below when captured */}
        {hasCaptured && (
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--sch-text)" }}
          >
            {shot.label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h3
          className="text-base font-semibold mb-1"
          style={{ color: "var(--sch-text)" }}
        >
          {intakeLevel === 1 ? "Quick Exterior Photos" : "Focused Photos"}
        </h3>
        <p
          className="text-sm"
          style={{ color: "var(--sch-text-dim)" }}
        >
          {intakeLevel === 1
            ? "Capture 4 exterior views of the vehicle"
            : "Capture exterior views and work area close-ups"}
        </p>
      </div>

      {/* Progress counter */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--sch-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalRequired > 0 ? (capturedCount / totalRequired) * 100 : 0}%`,
                background: allCaptured ? "#34D399" : "var(--sch-accent, #3B82F6)",
              }}
            />
          </div>
          <span
            className="text-xs font-medium whitespace-nowrap"
            style={{ color: "var(--sch-text-dim)" }}
          >
            {capturedCount}/{totalRequired} photos captured
          </span>
        </div>
      </div>

      {/* Photo grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Exterior shots */}
        {intakeLevel === 2 && (
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--sch-text-dim)" }}
          >
            Exterior
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 justify-items-center">
          {exteriorShots.map(renderShotCell)}
        </div>

        {/* Work area shots (Level 2 only) */}
        {intakeLevel === 2 && workAreaShots.length > 0 && (
          <>
            <p
              className="text-xs font-semibold uppercase tracking-wider mt-4 mb-2"
              style={{ color: "var(--sch-text-dim)" }}
            >
              Work Area
            </p>
            <div className="grid grid-cols-2 gap-3 justify-items-center">
              {workAreaShots.map(renderShotCell)}
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="px-4 py-3 flex flex-col gap-2 border-t"
        style={{ borderColor: "var(--sch-border)" }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: "var(--sch-text-dim)",
              background: "var(--sch-surface)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={!allCaptured}
            className="flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
            style={{
              background: allCaptured ? "#34D399" : "var(--sch-surface)",
              color: allCaptured ? "#fff" : "var(--sch-text-dim)",
              border: allCaptured ? "none" : "1px solid var(--sch-border)",
            }}
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {/* Skip Photos — Level 1 only */}
        {intakeLevel === 1 && (
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-center py-1 transition-opacity hover:opacity-80"
            style={{ color: "var(--sch-text-dim)", opacity: 0.6 }}
          >
            Skip Photos
          </button>
        )}
      </div>
    </div>
  );
}

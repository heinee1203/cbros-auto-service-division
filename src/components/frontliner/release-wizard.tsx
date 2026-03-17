"use client";

import { useState, useRef, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { BelongingsReturn } from "@/components/release/belongings-return";
import {
  createReleaseAction,
  completeReleaseAction,
  updateReleaseAction,
} from "@/lib/actions/release-actions";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Belonging {
  id: string;
  description: string;
  condition: string | null;
  isReturned: boolean;
}

interface ReleaseWizardProps {
  jobOrderId: string;
  jobOrderNumber: string;
  releaseId: string | null;
  belongings: Belonging[];
}

interface UploadedPhoto {
  id: string;
  angle: string;
  thumbnailPath: string;
}

const RELEASE_ANGLES = [
  { id: "front", label: "Front" },
  { id: "rear", label: "Rear" },
  { id: "left_side", label: "Left Side" },
  { id: "right_side", label: "Right Side" },
  { id: "interior", label: "Interior" },
  { id: "odometer", label: "Odometer" },
] as const;

const STEP_LABELS = ["Photos", "Belongings", "Signature", "Complete"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ReleaseWizard({
  jobOrderId,
  jobOrderNumber,
  releaseId: initialReleaseId,
  belongings,
}: ReleaseWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard step state
  const [step, setStep] = useState(0);

  // Step 0 — Photos
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captureAngle, setCaptureAngle] = useState<string | null>(null);

  // Step 2 — Signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Step 3 — Completion
  const [releaseId, setReleaseId] = useState(initialReleaseId);
  const [completed, setCompleted] = useState(false);

  // ── Step 0: Photo capture ────────────────────────────────────────

  const handleCaptureClick = (angleId: string) => {
    setCaptureAngle(angleId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !captureAngle) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "JOB_ORDER");
      formData.append("entityId", jobOrderId);
      formData.append("stage", "RELEASE");
      formData.append("category", captureAngle);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setPhotos((prev) => [
        ...prev.filter((p) => p.angle !== captureAngle),
        { id: data.id, angle: captureAngle, thumbnailPath: data.thumbnailPath },
      ]);
      toast.success("Photo uploaded");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
      setCaptureAngle(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (angle: string) => {
    setPhotos((prev) => prev.filter((p) => p.angle !== angle));
  };

  // ── Step 2: Signature pad ────────────────────────────────────────

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (step === 2) {
      // Small delay to let canvas render
      const t = setTimeout(initCanvas, 100);
      return () => clearTimeout(t);
    }
  }, [step, initCanvas]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDrawStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const onDrawMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const onDrawEnd = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const getSignatureDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return null;
    return canvas.toDataURL("image/png");
  };

  // ── Step 3: Complete release ─────────────────────────────────────

  const handleComplete = () => {
    startTransition(async () => {
      try {
        // Ensure a release record exists
        let currentReleaseId = releaseId;
        if (!currentReleaseId) {
          const createRes = await createReleaseAction(jobOrderId);
          if (!createRes.success || !createRes.data) {
            toast.error(createRes.error || "Failed to create release record");
            return;
          }
          currentReleaseId = (createRes.data as { id: string }).id;
          setReleaseId(currentReleaseId);
        }

        // Save signature and required fields on the release record
        const signatureDataUrl = getSignatureDataUrl();
        const updateRes = await updateReleaseAction(
          currentReleaseId,
          jobOrderId,
          {
            customerSignature: signatureDataUrl,
            advisorSignature: signatureDataUrl, // same signature for frontliner flow
            belongingsReturned: true,
            customerSatisfied: true,
            warrantyExplained: true,
            careInstructionsGiven: true,
            keysReturned: true,
          }
        );
        if (!updateRes.success) {
          toast.error(updateRes.error || "Failed to update release record");
          return;
        }

        // Complete the release
        const completeRes = await completeReleaseAction(
          currentReleaseId,
          jobOrderId
        );
        if (completeRes.success) {
          setCompleted(true);
          toast.success("Vehicle released!");
        } else {
          toast.error(completeRes.error || "Failed to complete release");
        }
      } catch {
        toast.error("An unexpected error occurred");
      }
    });
  };

  // ── Navigation ───────────────────────────────────────────────────

  const canGoNext = (): boolean => {
    switch (step) {
      case 0:
        return photos.length >= 4;
      case 1:
        return true; // belongings step always allows next
      case 2:
        return hasSigned;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (step === 2) {
      // Step 2 → 3 triggers completion
      handleComplete();
      setStep(3);
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  // ── Success screen ───────────────────────────────────────────────

  if (completed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-6 py-16 px-4"
        style={{ minHeight: "60vh" }}
      >
        <div
          className="rounded-full p-4"
          style={{ background: "rgba(52, 211, 153, 0.15)" }}
        >
          <Check size={48} style={{ color: "#34D399" }} />
        </div>
        <div className="text-center space-y-2">
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--sch-text)" }}
          >
            Vehicle Released
          </h2>
          <p
            className="text-lg font-mono font-semibold"
            style={{ color: "var(--sch-accent)" }}
          >
            {jobOrderNumber}
          </p>
        </div>
        <button
          onClick={() => router.push("/frontliner/release")}
          className="flex h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--sch-accent)", color: "#000" }}
        >
          Back to Queue
        </button>
      </div>
    );
  }

  // ── Render steps ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div
        className="flex items-center justify-center gap-3 px-4 py-3"
        style={{
          background: "var(--sch-card)",
          borderBottom: "1px solid var(--sch-border)",
        }}
      >
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background:
                  i === step
                    ? "var(--sch-accent)"
                    : i < step
                      ? "rgba(52,211,153,0.3)"
                      : "var(--sch-surface)",
                color:
                  i === step
                    ? "#000"
                    : i < step
                      ? "#34D399"
                      : "var(--sch-text-dim)",
              }}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span
              className="text-xs font-medium hidden sm:inline"
              style={{
                color:
                  i === step ? "var(--sch-text)" : "var(--sch-text-dim)",
              }}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div
                className="w-4 h-px"
                style={{
                  background:
                    i < step ? "#34D399" : "var(--sch-border)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === 0 && (
          <div className="space-y-4">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--sch-text)" }}
            >
              Release Photos
            </h2>
            <p className="text-sm" style={{ color: "var(--sch-text-muted)" }}>
              <span className="font-mono">{photos.length}</span> of <span className="font-mono">6</span> photos taken (minimum <span className="font-mono">4</span> required)
            </p>

            {/* Progress bar */}
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: "var(--sch-border)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(photos.length / 6) * 100}%`,
                  background:
                    photos.length >= 4 ? "#34D399" : "var(--sch-accent)",
                }}
              />
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-2 gap-3">
              {RELEASE_ANGLES.map((angle) => {
                const taken = photos.find((p) => p.angle === angle.id);
                return (
                  <div key={angle.id} className="relative">
                    {taken ? (
                      <div className="relative">
                        <img
                          src={taken.thumbnailPath}
                          alt={angle.label}
                          className="w-full h-32 object-cover rounded-xl"
                        />
                        <button
                          onClick={() => removePhoto(angle.id)}
                          className="absolute top-1 right-1 rounded-full p-1"
                          style={{ background: "rgba(0,0,0,0.6)" }}
                        >
                          <Trash2 size={14} className="text-white" />
                        </button>
                        <span
                          className="absolute bottom-1 left-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                        >
                          {angle.label}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCaptureClick(angle.id)}
                        disabled={uploading}
                        className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed transition-colors disabled:opacity-50"
                        style={{
                          borderColor: "var(--sch-border)",
                          color: "var(--sch-text-muted)",
                        }}
                      >
                        {uploading && captureAngle === angle.id ? (
                          <Loader2 size={24} className="animate-spin" />
                        ) : (
                          <Camera size={24} />
                        )}
                        <span className="text-xs font-medium">
                          {angle.label}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--sch-text)" }}
            >
              Belongings Return
            </h2>
            {belongings.length > 0 ? (
              <BelongingsReturn
                belongings={belongings}
                jobOrderId={jobOrderId}
              />
            ) : (
              <div
                className="rounded-xl p-8 text-center"
                style={{
                  background: "var(--sch-card)",
                  color: "var(--sch-text-muted)",
                }}
              >
                No belongings recorded at intake
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--sch-text)" }}
            >
              Customer Signature
            </h2>
            <p className="text-sm" style={{ color: "var(--sch-text-muted)" }}>
              Customer confirms vehicle received in satisfactory condition
            </p>

            {/* Signature canvas */}
            <div
              className="relative rounded-xl border-2 overflow-hidden"
              style={{
                borderColor: hasSigned
                  ? "var(--sch-accent)"
                  : "var(--sch-border)",
                background: "var(--sch-surface)",
              }}
            >
              <canvas
                ref={canvasRef}
                className="w-full touch-none"
                style={{ height: 200 }}
                onMouseDown={onDrawStart}
                onMouseMove={onDrawMove}
                onMouseUp={onDrawEnd}
                onMouseLeave={onDrawEnd}
                onTouchStart={onDrawStart}
                onTouchMove={onDrawMove}
                onTouchEnd={onDrawEnd}
              />
              {!hasSigned && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ color: "var(--sch-text-dim)" }}
                >
                  <span className="text-sm">Sign here</span>
                </div>
              )}
            </div>

            <button
              onClick={clearSignature}
              className="flex h-12 min-h-[48px] items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--sch-text-muted)" }}
            >
              <RotateCcw size={14} />
              Clear Signature
            </button>
          </div>
        )}

        {step === 3 && !completed && (
          <div
            className="flex flex-col items-center justify-center gap-4 py-16"
            style={{ color: "var(--sch-text-muted)" }}
          >
            <Loader2 size={32} className="animate-spin" />
            <p className="text-sm">Completing release...</p>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step < 3 && (
        <div
          className="flex items-center gap-3 p-4"
          style={{
            background: "var(--sch-card)",
            borderTop: "1px solid var(--sch-border)",
          }}
        >
          <button
            onClick={goBack}
            disabled={step === 0}
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl font-medium transition-colors disabled:opacity-30"
            style={{
              background: "var(--sch-surface)",
              color: "var(--sch-text)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <button
            onClick={goNext}
            disabled={!canGoNext() || isPending}
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl font-semibold transition-colors disabled:opacity-30"
            style={{
              background: "var(--sch-accent)",
              color: "#000",
            }}
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {step === 2 ? "Complete Release" : "Next"}
            {step !== 2 && <ChevronRight size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shield,
  Loader2,
  Package,
  Gauge,
  PenTool,
  Columns,
  Image,
  CheckCircle2,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StepIndicator } from "@/components/ui/step-indicator";
import { FuelGauge } from "@/components/intake/fuel-gauge";
import { SignaturePad } from "@/components/ui/signature-pad";
import { BeforeAfterViewer } from "@/components/release/before-after-viewer";
import { BelongingsReturn } from "@/components/release/belongings-return";
import { WALKAROUND_SHOTS, RELEASE_WIZARD_STEPS } from "@/lib/constants";
import { FUEL_LEVEL_DISPLAY } from "@/types/enums";
import {
  createReleaseAction,
  updateReleaseAction,
  completeReleaseAction,
} from "@/lib/actions/release-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReleaseWizardClientProps {
  jobOrderId: string;
  jobOrderNumber: string;
  jobStatus: string;
  releaseRecord: ReleaseRecordData | null;
  vehicle: {
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string;
  };
  customer: { firstName: string; lastName: string; phone: string };
  intakeRecord: {
    id: string;
    fuelLevel: string | null;
    odometerReading: number | null;
  } | null;
  belongings: Array<{
    id: string;
    description: string;
    condition: string | null;
    isReturned: boolean;
  }>;
  serviceCategories: string[];
  beforeAfterPairs: PhotoPair[];
  unmatchedIntake: UnmatchedPhoto[];
  unmatchedRelease: UnmatchedPhoto[];
  existingReleasePhotos: Array<{
    id: string;
    category: string | null;
    thumbnailPath: string;
  }>;
  intakePhotos: Array<{
    id: string;
    category: string | null;
    thumbnailPath: string;
  }>;
  preReleaseValidation: { valid: boolean; issues: string[] };
  warrantyInfo: Array<{
    category: string;
    label: string;
    durationMonths: number;
    careInstructions: string;
    terms: string;
  }>;
  canRelease: boolean;
}

interface ReleaseRecordData {
  id: string;
  odometerReading: number | null;
  fuelLevel: string | null;
  keysReturned: boolean;
  customerSatisfied: boolean;
  warrantyExplained: boolean;
  careInstructionsGiven: boolean;
  customerSignature: string | null;
  advisorSignature: string | null;
  releaseDate: string | null;
  belongingsReturned: boolean;
  [key: string]: unknown;
}

interface PhotoPair {
  angle: string;
  label: string;
  intake: { id: string; fullSizePath: string; thumbnailPath: string } | null;
  release: { id: string; fullSizePath: string; thumbnailPath: string } | null;
}

interface UnmatchedPhoto {
  id: string;
  category: string | null;
  thumbnailPath: string;
  fullSizePath: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = RELEASE_WIZARD_STEPS.map((s) => ({ label: s.label }));

const RELEASE_ALLOWED_STATUSES = [
  "FULLY_PAID",
  "RELEASED",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReleaseWizardClient({
  jobOrderId,
  jobOrderNumber,
  jobStatus,
  releaseRecord,
  vehicle,
  customer,
  intakeRecord,
  belongings,
  serviceCategories,
  beforeAfterPairs,
  unmatchedIntake,
  unmatchedRelease,
  existingReleasePhotos,
  intakePhotos,
  preReleaseValidation,
  warrantyInfo,
  canRelease,
}: ReleaseWizardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set()
  );

  // Release record ID (from existing or after creation)
  const [releaseId, setReleaseId] = useState<string | null>(
    releaseRecord?.id ?? null
  );

  // Step 0: Photos state
  const [uploadingShot, setUploadingShot] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<
    Map<string, { id: string; thumbnailPath: string }>
  >(() => {
    const map = new Map<string, { id: string; thumbnailPath: string }>();
    for (const photo of existingReleasePhotos) {
      if (photo.category) {
        map.set(photo.category, {
          id: photo.id,
          thumbnailPath: photo.thumbnailPath,
        });
      }
    }
    return map;
  });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Step 3: Vehicle condition state
  const [odometer, setOdometer] = useState<string>(
    releaseRecord?.odometerReading?.toString() ?? ""
  );
  const [fuelLevel, setFuelLevel] = useState<string>(
    releaseRecord?.fuelLevel ?? intakeRecord?.fuelLevel ?? "HALF"
  );
  const [keysReturned, setKeysReturned] = useState(
    releaseRecord?.keysReturned ?? false
  );
  const [savingCondition, setSavingCondition] = useState(false);

  // Step 4: Warranty state
  const [warrantyExplained, setWarrantyExplained] = useState(
    releaseRecord?.warrantyExplained ?? false
  );
  const [careInstructionsGiven, setCareInstructionsGiven] = useState(
    releaseRecord?.careInstructionsGiven ?? false
  );

  // Step 5: Sign-off state
  const [customerSatisfied, setCustomerSatisfied] = useState(
    releaseRecord?.customerSatisfied ?? false
  );
  const [customerSignature, setCustomerSignature] = useState<string | null>(
    releaseRecord?.customerSignature ?? null
  );
  const [advisorSignature, setAdvisorSignature] = useState<string | null>(
    releaseRecord?.advisorSignature ?? null
  );
  const [completing, setCompleting] = useState(false);

  // -------------------------------------------------------------------------
  // Permission / status gates
  // -------------------------------------------------------------------------

  if (!canRelease) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-surface-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-primary mb-1">
          Permission Denied
        </h2>
        <p className="text-sm text-surface-500">
          You don&apos;t have permission to release vehicles.
        </p>
      </div>
    );
  }

  if (!RELEASE_ALLOWED_STATUSES.includes(jobStatus)) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-surface-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-primary mb-1">
          Release Not Available
        </h2>
        <p className="text-sm text-surface-500">
          Release is available after full payment. Current status:{" "}
          <span className="font-medium">{jobStatus.replace(/_/g, " ")}</span>
        </p>
      </div>
    );
  }

  // Already released — show completion summary
  if (jobStatus === "RELEASED" && releaseRecord) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <CheckCircle2 className="w-16 h-16 text-success-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-primary mb-2">
            Vehicle Released
          </h2>
          <p className="text-sm text-surface-500">
            {vehicle.make} {vehicle.model} ({vehicle.plateNumber}) was released
            to {customer.firstName} {customer.lastName}.
          </p>
          {releaseRecord.releaseDate && (
            <p className="text-xs text-surface-400 mt-1">
              Released on{" "}
              {new Date(releaseRecord.releaseDate).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-surface-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
              <Camera className="w-4 h-4 text-accent-500" />
              Release Photos
            </div>
            <p className="text-2xl font-bold text-primary">
              {existingReleasePhotos.length}
            </p>
            <p className="text-xs text-surface-400">photos captured</p>
          </div>
          <div className="bg-white border border-surface-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
              <Package className="w-4 h-4 text-accent-500" />
              Belongings
            </div>
            <p className="text-2xl font-bold text-primary">
              {belongings.filter((b) => b.isReturned).length}/{belongings.length}
            </p>
            <p className="text-xs text-surface-400">items returned</p>
          </div>
          <div className="bg-white border border-surface-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
              <Shield className="w-4 h-4 text-accent-500" />
              Warranties
            </div>
            <p className="text-2xl font-bold text-primary">
              {warrantyInfo.length}
            </p>
            <p className="text-xs text-surface-400">warranties created</p>
          </div>
        </div>

        {/* Before/After section */}
        <BeforeAfterViewer
          pairs={beforeAfterPairs}
          unmatchedIntake={unmatchedIntake}
          unmatchedRelease={unmatchedRelease}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const markComplete = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  };

  const goNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Start release process
  const handleStartRelease = async () => {
    startTransition(async () => {
      const result = await createReleaseAction(jobOrderId);
      if (result.success && result.data) {
        setReleaseId((result.data as { id: string }).id);
        toast.success("Release process started");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to start release process");
      }
    });
  };

  // Photo upload handler
  const handlePhotoUpload = async (shotId: string, file: File) => {
    setUploadingShot(shotId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "JOB_ORDER");
      formData.append("entityId", jobOrderId);
      formData.append("stage", "RELEASE");
      formData.append("category", shotId);
      formData.append("jobOrderNumber", jobOrderNumber);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json();
      setCapturedPhotos((prev) => {
        const next = new Map(prev);
        next.set(shotId, {
          id: data.id ?? data.photo?.id ?? shotId,
          thumbnailPath: data.thumbnailPath ?? data.photo?.thumbnailPath ?? "",
        });
        return next;
      });
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setUploadingShot(null);
    }
  };

  // Save vehicle condition (step 3)
  const handleSaveCondition = async () => {
    if (!releaseId) return;
    setSavingCondition(true);
    try {
      const result = await updateReleaseAction(releaseId, jobOrderId, {
        odometerReading: odometer ? parseInt(odometer, 10) : null,
        fuelLevel,
        keysReturned,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save condition");
        return;
      }
      toast.success("Vehicle condition saved");
      markComplete(3);
      goNext();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSavingCondition(false);
    }
  };

  // Save warranty acknowledgements (step 4)
  const handleSaveWarranty = async () => {
    if (!releaseId) return;
    startTransition(async () => {
      const result = await updateReleaseAction(releaseId, jobOrderId, {
        warrantyExplained,
        careInstructionsGiven,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save warranty info");
        return;
      }
      markComplete(4);
      goNext();
    });
  };

  // Signature handler
  const handleSignature = async (
    type: "customerSignature" | "advisorSignature",
    dataUrl: string
  ) => {
    if (!releaseId) return;
    if (type === "customerSignature") setCustomerSignature(dataUrl);
    else setAdvisorSignature(dataUrl);

    startTransition(async () => {
      const result = await updateReleaseAction(releaseId, jobOrderId, {
        [type]: dataUrl,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save signature");
      } else {
        toast.success(
          type === "customerSignature"
            ? "Customer signature saved"
            : "Advisor signature saved"
        );
      }
    });
  };

  // Complete release
  const handleCompleteRelease = async () => {
    if (!releaseId) return;
    setCompleting(true);
    try {
      // Save final fields first
      await updateReleaseAction(releaseId, jobOrderId, {
        customerSatisfied,
      });

      const result = await completeReleaseAction(releaseId, jobOrderId);
      if (result.success) {
        toast.success("Vehicle released successfully!");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to complete release");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setCompleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // No release record yet — show start button
  // -------------------------------------------------------------------------

  if (!releaseId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Vehicle Release</h1>
          <p className="text-sm text-surface-500 mt-1">
            {jobOrderNumber} &mdash; {vehicle.make} {vehicle.model}{" "}
            {vehicle.year ? `(${vehicle.year})` : ""} &bull;{" "}
            {vehicle.plateNumber} &bull; {vehicle.color}
          </p>
        </div>

        {/* Pre-release validation issues */}
        {preReleaseValidation.issues.length > 0 && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-warning-700 mb-2">
                  Pre-release warnings
                </p>
                <ul className="space-y-1 text-sm text-warning-600">
                  {preReleaseValidation.issues.map((issue, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-warning-400 rounded-full shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <PenTool className="w-12 h-12 text-surface-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-primary mb-2">
            Start Release Process
          </h2>
          <p className="text-sm text-surface-500 mb-6 max-w-md mx-auto">
            Begin the vehicle release wizard. You will capture release photos,
            review before/after comparisons, verify belongings, and collect
            signatures.
          </p>
          <button
            type="button"
            onClick={handleStartRelease}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Release
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Photo capture helpers
  // -------------------------------------------------------------------------

  // Build the intake photos lookup
  const intakePhotoMap = new Map<string, string>();
  for (const p of intakePhotos) {
    if (p.category) intakePhotoMap.set(p.category, p.thumbnailPath);
  }

  const requiredShots = WALKAROUND_SHOTS.filter((s) => s.required);
  const capturedCount = requiredShots.filter((s) =>
    capturedPhotos.has(s.id)
  ).length;
  const totalRequired = requiredShots.length;

  // -------------------------------------------------------------------------
  // Step content renderer
  // -------------------------------------------------------------------------

  const renderStepContent = () => {
    switch (currentStep) {
      // -------------------------------------------------------------------
      // Step 0: Release Photos
      // -------------------------------------------------------------------
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <Camera className="w-5 h-5 text-accent-500" />
                Release Photos
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                Capture photos of the vehicle before releasing to the customer.
                Match the same angles as the intake photos.
              </p>
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                  capturedCount >= totalRequired
                    ? "bg-success-100 text-success-600"
                    : "bg-yellow-100 text-yellow-700"
                )}
              >
                {capturedCount} of {totalRequired} required photos captured
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {WALKAROUND_SHOTS.map((shot) => {
                const captured = capturedPhotos.get(shot.id);
                const intakeThumb = intakePhotoMap.get(shot.id);
                const isUploading = uploadingShot === shot.id;

                return (
                  <div
                    key={shot.id}
                    className={cn(
                      "relative border rounded-lg p-3 transition-colors",
                      captured
                        ? "border-success-300 bg-success-50"
                        : "border-surface-200 bg-white"
                    )}
                  >
                    <p className="text-xs font-medium text-primary mb-2 truncate">
                      {shot.label}
                      {shot.required && (
                        <span className="text-danger-500 ml-0.5">*</span>
                      )}
                    </p>

                    {/* Intake reference thumbnail */}
                    {intakeThumb && !captured && (
                      <div className="mb-2">
                        <p className="text-[10px] text-surface-400 mb-0.5">
                          Match this angle:
                        </p>
                        <img
                          src={intakeThumb}
                          alt={`Intake - ${shot.label}`}
                          className="w-full h-20 object-cover rounded border border-surface-200 opacity-60"
                        />
                      </div>
                    )}

                    {/* Captured release photo */}
                    {captured ? (
                      <div className="relative">
                        <img
                          src={captured.thumbnailPath}
                          alt={`Release - ${shot.label}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        <div className="absolute top-1 right-1 w-5 h-5 bg-success-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={(el) => {
                            fileInputRefs.current[shot.id] = el;
                          }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(shot.id, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            fileInputRefs.current[shot.id]?.click()
                          }
                          disabled={isUploading}
                          className="w-full flex flex-col items-center justify-center h-24 border-2 border-dashed border-surface-300 rounded-lg text-surface-400 hover:border-accent-400 hover:text-accent-500 transition-colors disabled:opacity-50"
                        >
                          {isUploading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <>
                              <Camera className="w-6 h-6 mb-1" />
                              <span className="text-[10px]">
                                Capture / Upload
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={() => {
                  markComplete(0);
                  goNext();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors min-h-[48px]"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      // -------------------------------------------------------------------
      // Step 1: Before/After Review
      // -------------------------------------------------------------------
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <Columns className="w-5 h-5 text-accent-500" />
                Before &amp; After Review
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                Review the intake vs release photos side-by-side to verify work
                quality.
              </p>
            </div>

            <BeforeAfterViewer
              pairs={beforeAfterPairs}
              unmatchedIntake={unmatchedIntake}
              unmatchedRelease={unmatchedRelease}
            />

            {/* Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={() => {
                  markComplete(1);
                  goNext();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors min-h-[48px]"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      // -------------------------------------------------------------------
      // Step 2: Belongings Return
      // -------------------------------------------------------------------
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-500" />
                Belongings Return
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                Verify that all customer belongings recorded during intake have
                been returned.
              </p>
            </div>

            <BelongingsReturn
              belongings={belongings}
              jobOrderId={jobOrderId}
            />

            {/* Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={() => {
                  markComplete(2);
                  goNext();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors min-h-[48px]"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      // -------------------------------------------------------------------
      // Step 3: Vehicle Condition
      // -------------------------------------------------------------------
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-accent-500" />
                Vehicle Condition
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                Record the vehicle&apos;s condition at the time of release.
              </p>
            </div>

            {/* Odometer */}
            <div className="space-y-2">
              <label
                htmlFor="release-odometer"
                className="block text-sm font-medium text-primary"
              >
                Final Odometer Reading (km)
              </label>
              {intakeRecord?.odometerReading && (
                <p className="text-xs text-surface-400">
                  Intake reading:{" "}
                  {intakeRecord.odometerReading.toLocaleString()} km
                </p>
              )}
              <input
                id="release-odometer"
                type="number"
                inputMode="numeric"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 45000"
                className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[48px]"
              />
              {intakeRecord?.odometerReading &&
                odometer &&
                parseInt(odometer, 10) - intakeRecord.odometerReading > 100 && (
                  <div className="flex items-center gap-1.5 mt-1 text-amber-600 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Mileage increased by{" "}
                    {parseInt(odometer, 10) - intakeRecord.odometerReading} km
                    since intake
                  </div>
                )}
            </div>

            {/* Fuel Level */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-primary">
                Fuel Level
              </label>
              {intakeRecord?.fuelLevel && (
                <p className="text-xs text-surface-400">
                  Intake level:{" "}
                  {FUEL_LEVEL_DISPLAY[
                    intakeRecord.fuelLevel as keyof typeof FUEL_LEVEL_DISPLAY
                  ] ?? intakeRecord.fuelLevel}
                </p>
              )}
              <FuelGauge value={fuelLevel} onChange={setFuelLevel} />
              {intakeRecord?.fuelLevel &&
                fuelLevel &&
                fuelLevel !== intakeRecord.fuelLevel && (
                  <div className="flex items-center gap-1.5 mt-1 text-amber-600 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Fuel level differs from intake
                  </div>
                )}
            </div>

            {/* Keys returned */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={keysReturned}
                  onChange={(e) => setKeysReturned(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-primary flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-surface-400" />
                  All keys returned to customer
                </span>
              </label>
            </div>

            {/* Save & Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={handleSaveCondition}
                disabled={savingCondition}
                className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                {savingCondition ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save &amp; Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        );

      // -------------------------------------------------------------------
      // Step 4: Warranty & Care
      // -------------------------------------------------------------------
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent-500" />
                Warranty &amp; Care Instructions
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                Review warranty terms and care instructions with the customer.
              </p>
            </div>

            {warrantyInfo.length === 0 ? (
              <div className="text-center py-8 text-surface-400">
                <Shield className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">
                  No warranty information for these services
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {warrantyInfo.map((info) => (
                  <div
                    key={info.category}
                    className="border border-surface-200 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-accent-600" />
                      <h4 className="font-medium text-primary">{info.label}</h4>
                      <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full">
                        {info.durationMonths} months
                      </span>
                    </div>
                    <p className="text-sm text-surface-500 mb-3">
                      {info.terms}
                    </p>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">
                        Care Instructions
                      </p>
                      <p className="text-sm text-blue-600">
                        {info.careInstructions}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Acknowledgement checkboxes */}
            <div className="space-y-3 pt-4 border-t border-surface-200">
              <label className="flex items-center gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={warrantyExplained}
                  onChange={(e) => setWarrantyExplained(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-primary">
                  Customer acknowledges warranty terms
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={careInstructionsGiven}
                  onChange={(e) => setCareInstructionsGiven(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-primary">
                  Care instructions provided and explained
                </span>
              </label>
            </div>

            {/* Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={handleSaveWarranty}
                disabled={isPending}
                className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        );

      // -------------------------------------------------------------------
      // Step 5: Sign-Off
      // -------------------------------------------------------------------
      case 5: {
        const canComplete =
          customerSignature &&
          advisorSignature &&
          customerSatisfied &&
          warrantyExplained &&
          careInstructionsGiven;

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-accent-500" />
                Release Sign-Off
              </h3>
              <p className="text-sm text-surface-500 mb-4">
                Review the summary, collect signatures, and complete the
                release.
              </p>
            </div>

            {/* Summary */}
            <div className="bg-surface-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-primary">
                Release Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-surface-400">Vehicle</p>
                  <p className="text-primary font-medium">
                    {vehicle.make} {vehicle.model} ({vehicle.plateNumber})
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Customer</p>
                  <p className="text-primary font-medium">
                    {customer.firstName} {customer.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Release Photos</p>
                  <p className="text-primary font-medium">
                    {capturedPhotos.size + existingReleasePhotos.length} captured
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Belongings</p>
                  <p className="text-primary font-medium">
                    {belongings.length === 0
                      ? "None recorded"
                      : `${belongings.filter((b) => b.isReturned).length}/${belongings.length} returned`}
                  </p>
                </div>
                {serviceCategories.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-surface-400">Services</p>
                    <p className="text-primary font-medium">
                      {serviceCategories.join(", ")}
                    </p>
                  </div>
                )}
                {warrantyInfo.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-surface-400">Warranties</p>
                    <p className="text-primary font-medium">
                      {warrantyInfo
                        .map((w) => `${w.label} (${w.durationMonths}mo)`)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist indicators */}
            <div className="space-y-2">
              <ChecklistItem
                checked={warrantyExplained}
                label="Warranty terms explained"
              />
              <ChecklistItem
                checked={careInstructionsGiven}
                label="Care instructions provided"
              />
              <ChecklistItem
                checked={keysReturned}
                label="Keys returned"
              />
              <ChecklistItem
                checked={
                  belongings.length === 0 ||
                  belongings.every((b) => b.isReturned)
                }
                label="All belongings returned"
              />
            </div>

            {/* Customer satisfaction */}
            <div className="pt-4 border-t border-surface-200">
              <label className="flex items-center gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={customerSatisfied}
                  onChange={(e) => {
                    setCustomerSatisfied(e.target.checked);
                  }}
                  className="w-5 h-5 rounded border-surface-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-primary">
                  Customer is satisfied with the work
                </span>
              </label>
            </div>

            {/* Customer Signature */}
            <div className="pt-4 border-t border-surface-200">
              <h4 className="text-sm font-medium text-primary mb-2">
                Customer Signature
              </h4>
              {customerSignature ? (
                <div className="space-y-2">
                  <div className="border border-success-200 rounded-lg p-2 bg-success-50">
                    <img
                      src={customerSignature}
                      alt="Customer signature"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-success-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Signed
                  </p>
                </div>
              ) : (
                <SignaturePad
                  onSave={(dataUrl) =>
                    handleSignature("customerSignature", dataUrl)
                  }
                  label="Customer signs here"
                />
              )}
            </div>

            {/* Advisor Signature */}
            <div className="pt-4 border-t border-surface-200">
              <h4 className="text-sm font-medium text-primary mb-2">
                Service Advisor Signature
              </h4>
              {advisorSignature ? (
                <div className="space-y-2">
                  <div className="border border-success-200 rounded-lg p-2 bg-success-50">
                    <img
                      src={advisorSignature}
                      alt="Advisor signature"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-success-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Signed
                  </p>
                </div>
              ) : (
                <SignaturePad
                  onSave={(dataUrl) =>
                    handleSignature("advisorSignature", dataUrl)
                  }
                  label="Advisor signs here"
                />
              )}
            </div>

            {/* Complete Release */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={handleCompleteRelease}
                disabled={!canComplete || completing || isPending}
                className="flex items-center gap-2 px-6 py-3 bg-success-500 text-white font-medium rounded-lg hover:bg-success-600 active:bg-success-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                {completing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Completing Release...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Release
                  </>
                )}
              </button>
            </div>

            {!canComplete && (
              <p className="text-xs text-surface-400 text-center">
                Complete all items above to enable the release button.
              </p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Vehicle Release</h1>
        <p className="text-sm text-surface-500 mt-1">
          {jobOrderNumber} &mdash; {vehicle.make} {vehicle.model}{" "}
          {vehicle.year ? `(${vehicle.year})` : ""} &bull;{" "}
          {vehicle.plateNumber} &bull; {vehicle.color}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-xl border border-surface-200 p-4 sm:p-6">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={Array.from(completedSteps)}
        />
      </div>

      {/* Pre-release warnings (non-blocking) */}
      {preReleaseValidation.issues.length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-warning-700 mb-1">
                Warnings
              </p>
              <ul className="space-y-0.5 text-xs text-warning-600">
                {preReleaseValidation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-surface-200 p-4 sm:p-6">
        {renderStepContent()}
      </div>

      {/* Back button */}
      {currentStep > 0 && currentStep < 5 && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 px-5 py-3 text-surface-600 bg-white border border-surface-300 rounded-lg hover:bg-surface-50 active:bg-surface-100 transition-colors min-h-[48px]"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper subcomponent
// ---------------------------------------------------------------------------

function ChecklistItem({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
        checked ? "bg-success-50 text-success-700" : "bg-surface-50 text-surface-400"
      )}
    >
      {checked ? (
        <Check className="w-4 h-4 text-success-500" />
      ) : (
        <div className="w-4 h-4 border border-surface-300 rounded" />
      )}
      {label}
    </div>
  );
}

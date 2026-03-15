"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  AlertTriangle,
  Key,
  Loader2,
  Wrench,
  Calendar,
  MapPin,
  StickyNote,
} from "lucide-react";
import { StepIndicator } from "@/components/ui/step-indicator";
import { WalkaroundCapture } from "@/components/intake/walkaround-capture";
import { DamageMapper } from "@/components/intake/damage-mapper";
import { BelongingsChecklist } from "@/components/intake/belongings-checklist";
import { FuelGauge } from "@/components/intake/fuel-gauge";
import { AuthorizationForm } from "@/components/intake/authorization-form";
import { updateIntakeRecordAction } from "@/lib/actions/intake-actions";
import { PRIORITY_OPTIONS } from "@/types/enums";
import type { JobOrderConfigInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DamageEntry {
  id: string;
  zone: string;
  damageType: string;
  severity: string;
  notes: string | null;
}

interface Belonging {
  id: string;
  description: string;
  condition: string | null;
}

interface Photo {
  id: string;
  category: string | null;
  thumbnailPath: string;
}

interface IntakeWizardClientProps {
  jobOrderId: string;
  jobOrderNumber: string;
  intakeRecordId: string;
  vehicle: {
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  serviceCategories: string[];
  existingPhotos: Photo[];
  damageEntries: DamageEntry[];
  belongings: Belonging[];
  intakeRecord: {
    fuelLevel: string;
    odometerReading: number | null;
    hasWarningLights: boolean;
    warningLightsNote: string | null;
    keysCount: number;
  };
  estimateTotal: number;
  estimatedDays: number | null;
  services: string[];
  damageCount: number;
  damageSeverityCounts: Record<string, number>;
  belongingsCount: number;
  technicians: { id: string; name: string }[];
  authorizationTerms: string;
  existingJobConfig: {
    primaryTechnicianId: string;
    targetCompletionDate: string | null;
    priority: string;
    bayAssignment: string | null;
    notes: string | null;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Walkaround Photos" },
  { label: "Damage Map" },
  { label: "Belongings" },
  { label: "Vehicle Condition" },
  { label: "Job Config" },
  { label: "Authorization" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntakeWizardClient({
  jobOrderId,
  jobOrderNumber,
  intakeRecordId,
  vehicle,
  customer,
  serviceCategories,
  existingPhotos,
  damageEntries,
  belongings,
  intakeRecord,
  estimateTotal,
  estimatedDays,
  services,
  damageCount,
  damageSeverityCounts,
  belongingsCount,
  technicians,
  authorizationTerms,
  existingJobConfig,
}: IntakeWizardClientProps) {
  const router = useRouter();

  // Step navigation state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set()
  );

  // Step 4: Vehicle Condition state
  const [fuelLevel, setFuelLevel] = useState(intakeRecord.fuelLevel);
  const [odometerReading, setOdometerReading] = useState<string>(
    intakeRecord.odometerReading?.toString() ?? ""
  );
  const [hasWarningLights, setHasWarningLights] = useState(
    intakeRecord.hasWarningLights
  );
  const [warningLightsNote, setWarningLightsNote] = useState(
    intakeRecord.warningLightsNote ?? ""
  );
  const [keysCount, setKeysCount] = useState<string>(
    intakeRecord.keysCount?.toString() ?? "1"
  );
  const [savingCondition, setSavingCondition] = useState(false);

  // Step 5: Job Configuration state
  const [primaryTechnicianId, setPrimaryTechnicianId] = useState(
    existingJobConfig.primaryTechnicianId
  );
  const [targetCompletionDate, setTargetCompletionDate] = useState(
    existingJobConfig.targetCompletionDate ?? ""
  );
  const [priority, setPriority] = useState(existingJobConfig.priority);
  const [bayAssignment, setBayAssignment] = useState(
    existingJobConfig.bayAssignment ?? ""
  );
  const [jobNotes, setJobNotes] = useState(existingJobConfig.notes ?? "");

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------

  const markComplete = useCallback(
    (step: number) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(step);
        return next;
      });
    },
    []
  );

  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleStepComplete = useCallback(
    (step: number) => {
      markComplete(step);
      goNext();
    },
    [markComplete, goNext]
  );

  // Refresh server data (re-fetches server component)
  const refreshData = useCallback(() => {
    router.refresh();
  }, [router]);

  // -------------------------------------------------------------------------
  // Step 4: Save vehicle condition
  // -------------------------------------------------------------------------

  const handleSaveVehicleCondition = async () => {
    setSavingCondition(true);
    try {
      const result = await updateIntakeRecordAction(intakeRecordId, {
        fuelLevel,
        odometerReading: odometerReading ? parseInt(odometerReading, 10) : null,
        hasWarningLights,
        warningLightsNote: hasWarningLights ? warningLightsNote : null,
        keysCount: parseInt(keysCount, 10) || 1,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save vehicle condition");
        return;
      }
      toast.success("Vehicle condition saved");
      handleStepComplete(3);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSavingCondition(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step 5: Build job config for authorization step
  // -------------------------------------------------------------------------

  const jobConfig: JobOrderConfigInput = {
    primaryTechnicianId,
    targetCompletionDate: targetCompletionDate || null,
    priority,
    bayAssignment: bayAssignment || null,
    notes: jobNotes || null,
  };

  const handleJobConfigNext = () => {
    if (!primaryTechnicianId) {
      toast.error("Please assign a primary technician");
      return;
    }
    handleStepComplete(4);
  };

  // -------------------------------------------------------------------------
  // Render current step content
  // -------------------------------------------------------------------------

  const renderStepContent = () => {
    switch (currentStep) {
      // -------------------------------------------------------------------
      // Step 0: Walkaround Photos
      // -------------------------------------------------------------------
      case 0:
        return (
          <WalkaroundCapture
            intakeRecordId={intakeRecordId}
            jobOrderNumber={jobOrderNumber}
            serviceCategories={serviceCategories}
            existingPhotos={existingPhotos}
            onComplete={() => handleStepComplete(0)}
          />
        );

      // -------------------------------------------------------------------
      // Step 1: Damage Mapping
      // -------------------------------------------------------------------
      case 1:
        return (
          <DamageMapper
            intakeRecordId={intakeRecordId}
            damageEntries={damageEntries}
            photos={existingPhotos}
            onUpdate={refreshData}
            onComplete={() => handleStepComplete(1)}
          />
        );

      // -------------------------------------------------------------------
      // Step 2: Belongings Inventory
      // -------------------------------------------------------------------
      case 2:
        return (
          <div className="space-y-4">
            <BelongingsChecklist
              intakeRecordId={intakeRecordId}
              belongings={belongings}
              onUpdate={refreshData}
            />
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={() => handleStepComplete(2)}
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
              <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-accent-500" />
                Vehicle Condition
              </h3>
              <p className="text-sm text-surface-500 mb-6">
                Record the current condition of the vehicle at intake.
              </p>
            </div>

            {/* Fuel Level */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-primary">
                Fuel Level
              </label>
              <FuelGauge value={fuelLevel} onChange={setFuelLevel} />
            </div>

            {/* Odometer Reading */}
            <div className="space-y-2">
              <label
                htmlFor="odometer"
                className="block text-sm font-medium text-primary"
              >
                <Gauge className="inline-block w-4 h-4 mr-1.5 text-surface-400" />
                Odometer Reading (km)
              </label>
              <input
                id="odometer"
                type="number"
                inputMode="numeric"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                placeholder="e.g. 45000"
                className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[48px]"
              />
            </div>

            {/* Warning Lights */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={hasWarningLights}
                  onChange={(e) => setHasWarningLights(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-primary flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warning-500" />
                  Dashboard warning lights active
                </span>
              </label>
              {hasWarningLights && (
                <textarea
                  value={warningLightsNote}
                  onChange={(e) => setWarningLightsNote(e.target.value)}
                  placeholder="Describe which warning lights are active..."
                  rows={3}
                  className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                />
              )}
            </div>

            {/* Keys Count */}
            <div className="space-y-2">
              <label
                htmlFor="keysCount"
                className="block text-sm font-medium text-primary"
              >
                <Key className="inline-block w-4 h-4 mr-1.5 text-surface-400" />
                Number of Keys Received
              </label>
              <input
                id="keysCount"
                type="number"
                inputMode="numeric"
                min={0}
                max={10}
                value={keysCount}
                onChange={(e) => setKeysCount(e.target.value)}
                className="w-32 px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[48px]"
              />
            </div>

            {/* Save & Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={handleSaveVehicleCondition}
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
      // Step 4: Job Configuration
      // -------------------------------------------------------------------
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-accent-500" />
                Job Configuration
              </h3>
              <p className="text-sm text-surface-500 mb-6">
                Assign a technician, set the target date, and configure job
                priority.
              </p>
            </div>

            {/* Primary Technician */}
            <div className="space-y-2">
              <label
                htmlFor="technician"
                className="block text-sm font-medium text-primary"
              >
                Primary Technician <span className="text-danger-500">*</span>
              </label>
              <select
                id="technician"
                value={primaryTechnicianId}
                onChange={(e) => setPrimaryTechnicianId(e.target.value)}
                className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[48px]"
              >
                <option value="">Select technician...</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Completion Date */}
            <div className="space-y-2">
              <label
                htmlFor="targetDate"
                className="block text-sm font-medium text-primary"
              >
                <Calendar className="inline-block w-4 h-4 mr-1.5 text-surface-400" />
                Target Completion Date
              </label>
              <input
                id="targetDate"
                type="date"
                value={targetCompletionDate}
                onChange={(e) => setTargetCompletionDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[48px]"
              />
            </div>

            {/* Priority */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-primary">
                Priority
              </label>
              <div className="flex flex-wrap gap-3">
                {PRIORITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors min-h-[48px] ${
                      priority === opt.value
                        ? "border-accent-500 bg-accent-50 text-accent-700 ring-2 ring-accent-500/30"
                        : "border-surface-300 bg-white text-primary hover:border-surface-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={opt.value}
                      checked={priority === opt.value}
                      onChange={(e) => setPriority(e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Bay Assignment */}
            <div className="space-y-2">
              <label
                htmlFor="bay"
                className="block text-sm font-medium text-primary"
              >
                <MapPin className="inline-block w-4 h-4 mr-1.5 text-surface-400" />
                Bay Assignment
                <span className="text-surface-400 font-normal ml-1">
                  (optional)
                </span>
              </label>
              <input
                id="bay"
                type="text"
                value={bayAssignment}
                onChange={(e) => setBayAssignment(e.target.value)}
                placeholder="e.g. Bay 3, Booth A"
                className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[48px]"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label
                htmlFor="jobNotes"
                className="block text-sm font-medium text-primary"
              >
                <StickyNote className="inline-block w-4 h-4 mr-1.5 text-surface-400" />
                Notes
                <span className="text-surface-400 font-normal ml-1">
                  (optional)
                </span>
              </label>
              <textarea
                id="jobNotes"
                value={jobNotes}
                onChange={(e) => setJobNotes(e.target.value)}
                placeholder="Additional notes for the job..."
                rows={3}
                className="w-full px-4 py-3 border border-surface-300 rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Next */}
            <div className="flex justify-end pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={handleJobConfigNext}
                className="flex items-center gap-2 px-6 py-3 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 active:bg-accent-700 transition-colors min-h-[48px]"
              >
                Continue to Authorization
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      // -------------------------------------------------------------------
      // Step 5: Authorization & Sign-Off
      // -------------------------------------------------------------------
      case 5:
        return (
          <AuthorizationForm
            intakeRecordId={intakeRecordId}
            vehicle={vehicle}
            customer={customer}
            estimateTotal={estimateTotal}
            estimatedDays={estimatedDays}
            services={services}
            damageCount={damageEntries.length}
            damageSeverityCounts={damageSeverityCounts}
            belongingsCount={belongings.length}
            fuelLevel={fuelLevel}
            odometerReading={
              odometerReading ? parseInt(odometerReading, 10) : null
            }
            jobConfig={jobConfig}
            authorizationTerms={authorizationTerms}
          />
        );

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
        <h1 className="text-2xl font-bold text-primary">Vehicle Intake</h1>
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

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-surface-200 p-4 sm:p-6">
        {renderStepContent()}
      </div>

      {/* Back button (shown below content for steps > 0, excluding step 5 which handles its own navigation) */}
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

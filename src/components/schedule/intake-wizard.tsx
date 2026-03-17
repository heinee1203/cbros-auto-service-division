"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, CheckCircle2, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  INTAKE_LEVEL_STEPS,
  INTAKE_LEVEL_LABELS,
  type IntakeLevel,
} from "@/lib/intake-levels";
import { createWalkInIntakeAction } from "@/lib/actions/intake-actions";

import { IntakePlateLookup, type PlateLookupResult } from "./intake-plate-lookup";
import { IntakeServiceSelect } from "./service-select";
import { IntakeQuickPhotos } from "./intake-quick-photos";
import { IntakeDetailsForm } from "./intake-details-form";
import { IntakeAssignment } from "./intake-assignment";
import { IntakeQuickSignoff } from "./intake-quick-signoff";

/* ------------------------------------------------------------------ */
/*  Step label map (for progress bar)                                  */
/* ------------------------------------------------------------------ */

const STEP_LABELS: Record<string, string> = {
  "plate-lookup": "Vehicle",
  services: "Services",
  "quick-photos": "Photos",
  "focused-photos": "Photos",
  "walkaround-photos": "Photos",
  "damage-map": "Damage Map",
  details: "Details",
  "belongings-fuel": "Belongings",
  "estimate-review": "Estimate",
  assignment: "Assignment",
  "quick-signoff": "Sign-off",
  "advisor-signoff": "Sign-off",
  "full-signoff": "Sign-off",
};

/* ------------------------------------------------------------------ */
/*  Wizard data shape                                                  */
/* ------------------------------------------------------------------ */

interface WizardData {
  // From plate lookup
  plateLookupResult: PlateLookupResult | null;
  // From service select
  serviceIds: string[];
  serviceCategories: string[];
  // From details form
  vehicleId?: string;
  newVehicle?: {
    plateNumber: string;
    make: string;
    model: string;
    year?: number | null;
    color?: string | null;
    vin?: string | null;
  };
  customerId?: string;
  newCustomer?: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string | null;
  };
  odometerReading: number | null;
  // From assignment
  frontDeskLeadId: string;
  primaryTechnicianId: string | null;
  assistantTechnicianId: string | null;
  assignedBayId: string | null;
  priority: string;
  internalNotes: string | null;
  // From signoff
  customerSignature: string | null;
  advisorSignature: string | null;
}

const INITIAL_DATA: WizardData = {
  plateLookupResult: null,
  serviceIds: [],
  serviceCategories: [],
  odometerReading: null,
  frontDeskLeadId: "",
  primaryTechnicianId: null,
  assistantTechnicianId: null,
  assignedBayId: null,
  priority: "NORMAL",
  internalNotes: null,
  customerSignature: null,
  advisorSignature: null,
};

/* ------------------------------------------------------------------ */
/*  Success result shape                                               */
/* ------------------------------------------------------------------ */

interface CreationResult {
  jobOrderId: string;
  intakeRecordId: string;
  jobOrderNumber: string;
}

/* ------------------------------------------------------------------ */
/*  IntakeWizard                                                       */
/* ------------------------------------------------------------------ */

interface IntakeWizardProps {
  variant?: "schedule" | "frontliner";
  onComplete?: (jobId: string) => void;
}

export function IntakeWizard({ variant = "schedule", onComplete }: IntakeWizardProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Entry-path params
  const _appointmentId = searchParams.get("appointmentId");
  const _estimateId = searchParams.get("estimateId");

  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [intakeLevel, setIntakeLevel] = useState<IntakeLevel>(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreationResult | null>(null);

  // Derived steps
  const steps = useMemo(
    () => INTAKE_LEVEL_STEPS[intakeLevel],
    [intakeLevel]
  );
  const currentStepId = steps[currentStepIndex] ?? steps[0];
  const totalSteps = steps.length;
  const levelMeta = INTAKE_LEVEL_LABELS[intakeLevel];

  // Navigation helpers
  const goNext = useCallback(() => {
    setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleCancel = useCallback(() => {
    router.push("/schedule/floor");
  }, [router]);

  // ── Step handlers ──────────────────────────────────────────────────

  const handlePlateLookupComplete = useCallback(
    (lookupResult: PlateLookupResult) => {
      setData((prev) => ({ ...prev, plateLookupResult: lookupResult }));
      goNext();
    },
    [goNext]
  );

  const handleServiceSelectComplete = useCallback(
    (serviceIds: string[], categories: string[], level: IntakeLevel) => {
      setData((prev) => ({
        ...prev,
        serviceIds,
        serviceCategories: categories,
      }));

      // Update intake level — this may change steps array
      if (level !== intakeLevel) {
        setIntakeLevel(level);
        // After service selection, next step is index 2 regardless of level
        setCurrentStepIndex(2);
      } else {
        goNext();
      }
    },
    [intakeLevel, goNext]
  );

  const handlePhotosComplete = useCallback(() => {
    goNext();
  }, [goNext]);

  const handleDetailsComplete = useCallback(
    (details: {
      vehicleId?: string;
      newVehicle?: {
        plateNumber: string;
        make: string;
        model: string;
        year?: number | null;
        color?: string | null;
        vin?: string | null;
      };
      customerId?: string;
      newCustomer?: {
        firstName: string;
        lastName?: string;
        phone: string;
        email?: string | null;
      };
      odometerReading: number | null;
    }) => {
      setData((prev) => ({
        ...prev,
        vehicleId: details.vehicleId,
        newVehicle: details.newVehicle,
        customerId: details.customerId,
        newCustomer: details.newCustomer,
        odometerReading: details.odometerReading,
      }));
      goNext();
    },
    [goNext]
  );

  const handleAssignmentComplete = useCallback(
    (assignment: {
      frontDeskLeadId: string;
      primaryTechnicianId: string | null;
      assistantTechnicianId: string | null;
      assignedBayId: string | null;
      priority: string;
      internalNotes: string | null;
    }) => {
      setData((prev) => ({
        ...prev,
        frontDeskLeadId: assignment.frontDeskLeadId,
        primaryTechnicianId: assignment.primaryTechnicianId,
        assistantTechnicianId: assignment.assistantTechnicianId,
        assignedBayId: assignment.assignedBayId,
        priority: assignment.priority,
        internalNotes: assignment.internalNotes,
      }));
      goNext();
    },
    [goNext]
  );

  const handleSignoffComplete = useCallback(
    async (signatures: {
      customerSignature: string | null;
      advisorSignature: string | null;
    }) => {
      setSubmitting(true);

      // Assemble the full payload
      const payload = {
        vehicleId: data.vehicleId ?? null,
        newVehicle: data.newVehicle ?? null,
        customerId: data.customerId ?? null,
        newCustomer: data.newCustomer ?? null,
        serviceIds: data.serviceIds,
        intakeLevel,
        odometerReading: data.odometerReading,
        fuelLevel: "UNKNOWN",
        hasWarningLights: false,
        warningLightsNote: null,
        keysCount: 1,
        frontDeskLeadId: data.frontDeskLeadId || null,
        primaryTechnicianId: data.primaryTechnicianId,
        assistantTechnicianId: data.assistantTechnicianId,
        assignedBayId: data.assignedBayId,
        priority: data.priority,
        internalNotes: data.internalNotes,
        customerSignature: signatures.customerSignature,
        advisorSignature: signatures.advisorSignature,
        estimateRequestId: _estimateId ?? null,
        appointmentId: _appointmentId ?? null,
      };

      try {
        const res = await createWalkInIntakeAction(payload);
        if (res.success && res.data) {
          const d = res.data as Record<string, string>;
          setResult({
            jobOrderId: d.jobOrderId,
            intakeRecordId: d.intakeRecordId,
            jobOrderNumber: d.jobOrderNumber,
          });
          toast.success("Job order created!");
          if (variant === "frontliner" && onComplete) {
            onComplete(d.jobOrderId);
          }
        } else {
          toast.error(res.error ?? "Failed to create job order");
        }
      } catch {
        toast.error("An unexpected error occurred");
      } finally {
        setSubmitting(false);
      }
    },
    [data, intakeLevel, _estimateId, _appointmentId, variant, onComplete]
  );

  // ── Build signoff summary ─────────────────────────────────────────

  const signoffSummary = useMemo(() => {
    const lookup = data.plateLookupResult;
    const vehicle = lookup?.vehicle
      ? {
          plateNumber: lookup.vehicle.plateNumber,
          make: lookup.vehicle.make,
          model: lookup.vehicle.model,
        }
      : data.newVehicle
        ? {
            plateNumber: data.newVehicle.plateNumber,
            make: data.newVehicle.make,
            model: data.newVehicle.model,
          }
        : { plateNumber: "---", make: "---", model: "---" };

    const customer = lookup?.customer
      ? {
          firstName: lookup.customer.firstName,
          lastName: lookup.customer.lastName,
        }
      : data.newCustomer
        ? {
            firstName: data.newCustomer.firstName,
            lastName: data.newCustomer.lastName ?? "",
          }
        : { firstName: "---", lastName: "" };

    return {
      vehicle,
      customer,
      services: data.serviceIds.length
        ? [`${data.serviceIds.length} service(s) selected`]
        : ["None"],
      techName: null as string | null,
      bayName: null as string | null,
      priority: data.priority,
    };
  }, [data]);

  // ── Success screen ─────────────────────────────────────────────────

  if (result) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-6 py-16 px-4"
        style={{ minHeight: "60vh" }}
      >
        <div
          className="rounded-full p-4"
          style={{ background: "rgba(52, 211, 153, 0.15)" }}
        >
          <CheckCircle2
            size={48}
            style={{ color: "#34D399" }}
          />
        </div>

        <div className="text-center space-y-2">
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--sch-text)" }}
          >
            Job Created!
          </h2>
          <p
            className="text-lg font-mono font-semibold"
            style={{ color: "var(--sch-accent)" }}
          >
            {result.jobOrderNumber}
          </p>
          <p
            className="text-sm"
            style={{ color: "var(--sch-text-muted)" }}
          >
            The job order has been created and is ready on the floor board.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          <button
            onClick={() => router.push("/schedule/floor")}
            className="flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--sch-accent)", color: "#fff" }}
          >
            View on Board
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => {
              setResult(null);
              setCurrentStepIndex(0);
              setIntakeLevel(1);
              setData(INITIAL_DATA);
            }}
            className="flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--sch-surface)",
              color: "var(--sch-text)",
              border: "1px solid var(--sch-border)",
            }}
          >
            <RotateCcw size={14} />
            Start Another Intake
          </button>
        </div>
      </div>
    );
  }

  // ── Render current step ────────────────────────────────────────────

  function renderStep() {
    switch (currentStepId) {
      case "plate-lookup":
        return (
          <IntakePlateLookup
            onComplete={handlePlateLookupComplete}
          />
        );

      case "services":
        return (
          <IntakeServiceSelect
            onComplete={handleServiceSelectComplete}
            preselectedServiceIds={data.serviceIds.length > 0 ? data.serviceIds : undefined}
            onBack={goBack}
          />
        );

      case "quick-photos":
      case "focused-photos":
        return (
          <IntakeQuickPhotos
            intakeLevel={intakeLevel as 1 | 2}
            intakeRecordId=""
            jobOrderNumber=""
            categories={data.serviceCategories}
            onComplete={handlePhotosComplete}
            onBack={goBack}
          />
        );

      case "details":
        return data.plateLookupResult ? (
          <IntakeDetailsForm
            lookupResult={data.plateLookupResult}
            onComplete={handleDetailsComplete}
            onBack={goBack}
          />
        ) : (
          <IntakeDetailsForm
            lookupResult={{
              mode: "new",
              plateNumber: "",
            }}
            onComplete={handleDetailsComplete}
            onBack={goBack}
          />
        );

      case "assignment":
        return (
          <IntakeAssignment
            onComplete={handleAssignmentComplete}
            onBack={goBack}
          />
        );

      case "quick-signoff":
      case "advisor-signoff":
        return (
          <IntakeQuickSignoff
            intakeLevel={intakeLevel as 1 | 2}
            summary={signoffSummary}
            onComplete={handleSignoffComplete}
            onBack={goBack}
            submitting={submitting}
          />
        );

      // Level 3 placeholders
      case "walkaround-photos":
      case "damage-map":
      case "belongings-fuel":
      case "estimate-review":
      case "full-signoff":
        return (
          <div
            className="flex flex-col items-center justify-center gap-4 py-16"
            style={{ color: "var(--sch-text-muted)" }}
          >
            <p className="text-sm font-medium">
              Step &ldquo;{currentStepId}&rdquo; coming soon (Level 3)
            </p>
            <div className="flex gap-3">
              <button
                onClick={goBack}
                className="px-4 py-2 text-sm rounded-lg"
                style={{
                  background: "var(--sch-surface)",
                  border: "1px solid var(--sch-border)",
                  color: "var(--sch-text)",
                }}
              >
                Back
              </button>
              <button
                onClick={goNext}
                className="px-4 py-2 text-sm rounded-lg font-semibold"
                style={{
                  background: "var(--sch-accent)",
                  color: "#fff",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Main layout ────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--sch-bg)" }}
    >
      {/* ── Top bar: cancel + progress ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
        style={{
          background: "var(--sch-card)",
          borderBottom: "1px solid var(--sch-border)",
        }}
      >
        {/* Cancel — hidden in frontliner mode where the wizard IS the page */}
        {variant !== "frontliner" && (
          <button
            onClick={handleCancel}
            className="flex-shrink-0 rounded-lg p-2 transition-opacity hover:opacity-80"
            style={{ color: "var(--sch-text-muted)" }}
            aria-label="Cancel intake"
          >
            <X size={20} />
          </button>
        )}

        {/* Progress bar */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--sch-text)" }}
            >
              {STEP_LABELS[currentStepId] ?? currentStepId}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--sch-text-dim)" }}
            >
              {currentStepIndex + 1} / {totalSteps}
            </span>
          </div>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--sch-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
                background: "var(--sch-accent)",
              }}
            />
          </div>
        </div>

        {/* Level badge */}
        <span
          className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(245,158,11,0.15)",
            color: "var(--sch-accent)",
          }}
        >
          L{intakeLevel} {levelMeta.name}
        </span>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 min-h-0 flex flex-col p-4">{renderStep()}</div>
    </div>
  );
}

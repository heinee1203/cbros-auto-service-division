"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  IntakePlateLookup,
  type PlateLookupResult,
} from "@/components/schedule/intake-plate-lookup";
import { IntakeServiceSelect } from "@/components/schedule/service-select";
import EstimateCardBuilder from "@/components/frontliner/estimate-card-builder";
import {
  createEstimateFromServicesAction,
  getEstimateVersionAction,
} from "@/lib/actions/frontliner-estimate-actions";

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
  unitCost: number;
  markup: number;
  subtotal: number;
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

interface EstimateWizardProps {
  prefilledCustomerId?: string;
  prefilledVehicleId?: string;
  prefilledServiceIds?: string[];
  prefilledJobOrderId?: string;
  customerName?: string;
  vehiclePlate?: string;
  vehicleDesc?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitialStep(props: EstimateWizardProps): 1 | 2 | 3 {
  if (
    props.prefilledCustomerId &&
    props.prefilledVehicleId &&
    props.prefilledServiceIds &&
    props.prefilledServiceIds.length > 0
  ) {
    return 3; // will auto-create on mount
  }
  if (props.prefilledCustomerId && props.prefilledVehicleId) {
    return 2;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EstimateWizard(props: EstimateWizardProps) {
  const router = useRouter();
  const initialStep = getInitialStep(props);

  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [vehiclePresent, setVehiclePresent] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(
    props.prefilledCustomerId || null,
  );
  const [vehicleId, setVehicleId] = useState<string | null>(
    props.prefilledVehicleId || null,
  );
  const [customerName, setCustomerName] = useState(props.customerName || "");
  const [vehiclePlate, setVehiclePlate] = useState(props.vehiclePlate || "");
  const [vehicleDesc, setVehicleDesc] = useState(props.vehicleDesc || "");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [versionSummary, setVersionSummary] = useState<VersionSummary | null>(
    null,
  );
  const [creating, setCreating] = useState(false);

  const autoCreatedRef = useRef(false);

  // -----------------------------------------------------------------------
  // Create estimate + load version helper
  // -----------------------------------------------------------------------
  const createAndLoadEstimate = useCallback(
    async (serviceIds: string[]) => {
      if (!customerId || !vehicleId) return;

      setCreating(true);
      try {
        const createResult = await createEstimateFromServicesAction({
          customerId,
          vehicleId,
          serviceIds,
          jobOrderId: props.prefilledJobOrderId,
          vehiclePresent,
        });

        if (!createResult.success || !createResult.data) {
          toast.error(createResult.error || "Failed to create estimate");
          setCreating(false);
          return;
        }

        const loadResult = await getEstimateVersionAction(
          createResult.data.estimateVersionId,
        );

        if (!loadResult.success || !loadResult.data) {
          toast.error(loadResult.error || "Failed to load estimate version");
          setCreating(false);
          return;
        }

        const version = loadResult.data;
        setVersionId(createResult.data.estimateVersionId);
        setLineItems(version.lineItems || []);
        setVersionSummary({
          subtotalLabor: version.subtotalLabor,
          subtotalParts: version.subtotalParts,
          subtotalMaterials: version.subtotalMaterials,
          subtotalPaint: version.subtotalPaint,
          subtotalSublet: version.subtotalSublet,
          subtotalOther: version.subtotalOther,
          discountType: version.discountType,
          discountValue: version.discountValue,
          grandTotal: version.grandTotal,
        });
        setStep(3);
      } catch {
        toast.error("An unexpected error occurred");
      } finally {
        setCreating(false);
      }
    },
    [customerId, vehicleId, props.prefilledJobOrderId, vehiclePresent],
  );

  // -----------------------------------------------------------------------
  // Auto-create on mount when all prefilled data is provided
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (
      initialStep === 3 &&
      !autoCreatedRef.current &&
      props.prefilledServiceIds &&
      props.prefilledServiceIds.length > 0
    ) {
      autoCreatedRef.current = true;
      createAndLoadEstimate(props.prefilledServiceIds);
    }
  }, [initialStep, props.prefilledServiceIds, createAndLoadEstimate]);

  // -----------------------------------------------------------------------
  // Step 1 → Step 2: Plate lookup complete
  // -----------------------------------------------------------------------
  const handlePlateLookupComplete = useCallback(
    (result: PlateLookupResult) => {
      setCustomerId(result.customerId || null);
      setVehicleId(result.vehicleId || null);

      if (result.customer) {
        setCustomerName(
          `${result.customer.firstName} ${result.customer.lastName}`,
        );
      }
      if (result.vehicle) {
        setVehiclePlate(result.vehicle.plateNumber);
        const parts = [
          result.vehicle.year,
          result.vehicle.make,
          result.vehicle.model,
        ].filter(Boolean);
        setVehicleDesc(parts.join(" "));
      } else if (result.plateNumber) {
        setVehiclePlate(result.plateNumber);
      }

      setStep(2);
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Step 2 → Step 3: Service selection complete
  // -----------------------------------------------------------------------
  const handleServiceSelectComplete = useCallback(
    (serviceIds: string[], _categories: string[]) => {
      if (serviceIds.length === 0) {
        toast.error("Please select at least one service");
        return;
      }
      createAndLoadEstimate(serviceIds);
    },
    [createAndLoadEstimate],
  );

  // -----------------------------------------------------------------------
  // Back navigation
  // -----------------------------------------------------------------------
  const handleBack = useCallback(() => {
    if (step === 1) {
      router.back();
    } else if (step === 2) {
      if (props.prefilledCustomerId && props.prefilledVehicleId) {
        router.back();
      } else {
        setStep(1);
      }
    } else if (step === 3) {
      // From line item builder, go back to service selection
      setStep(2);
    }
  }, [step, router, props.prefilledCustomerId, props.prefilledVehicleId]);

  // -----------------------------------------------------------------------
  // Save handler for EstimateCardBuilder
  // -----------------------------------------------------------------------
  const handleSave = useCallback(() => {
    if (props.prefilledJobOrderId) {
      router.push("/frontliner/jobs");
    } else {
      router.back();
    }
  }, [router, props.prefilledJobOrderId]);

  // -----------------------------------------------------------------------
  // Service select back handler
  // -----------------------------------------------------------------------
  const handleServiceSelectBack = useCallback(() => {
    if (props.prefilledCustomerId && props.prefilledVehicleId) {
      router.back();
    } else {
      setStep(1);
    }
  }, [router, props.prefilledCustomerId, props.prefilledVehicleId]);

  // -----------------------------------------------------------------------
  // Loading state (creating estimate)
  // -----------------------------------------------------------------------
  if (creating) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--sch-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--sch-accent)]" />
        <p className="mt-3 text-sm text-[var(--sch-text-secondary)]">
          Creating estimate...
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 1: Plate Lookup
  // -----------------------------------------------------------------------
  if (step === 1) {
    return <IntakePlateLookup onComplete={handlePlateLookupComplete} />;
  }

  // -----------------------------------------------------------------------
  // Step 2: Service Selection
  // -----------------------------------------------------------------------
  if (step === 2) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: "var(--sch-border)" }}>
          <span className="text-sm text-[var(--sch-text-muted)]">Vehicle at shop?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVehiclePresent(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                vehiclePresent
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)] border border-[var(--sch-border)]"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setVehiclePresent(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !vehiclePresent
                  ? "bg-[var(--sch-accent)]/20 text-[var(--sch-accent)] border border-[var(--sch-accent)]/40"
                  : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)] border border-[var(--sch-border)]"
              }`}
            >
              Quote Only
            </button>
          </div>
        </div>
        <div className="flex-1">
          <IntakeServiceSelect
            onComplete={handleServiceSelectComplete}
            preselectedServiceIds={props.prefilledServiceIds}
            onBack={handleServiceSelectBack}
          />
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Step 3: Line Item Builder
  // -----------------------------------------------------------------------
  if (step === 3 && versionId && versionSummary) {
    const headerLabel =
      customerName && vehiclePlate
        ? `${customerName} — ${vehiclePlate}`
        : "Estimate";

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--sch-bg)]">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--sch-border)] px-4">
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--sch-text-secondary)] active:bg-[var(--sch-surface)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--sch-text)]">
            {headerLabel}
          </h1>
        </div>

        {/* Card builder */}
        <div className="flex-1 overflow-y-auto">
          <EstimateCardBuilder
            versionId={versionId}
            initialLineItems={lineItems}
            initialVersion={versionSummary}
            onSave={handleSave}
          />
        </div>
      </div>
    );
  }

  // Fallback (should not reach here)
  return null;
}

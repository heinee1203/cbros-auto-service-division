"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { SignaturePad } from "@/components/ui/signature-pad";
import { completeIntakeAction } from "@/lib/actions/intake-actions";
import { formatPeso, formatPlateNumber, formatDate, cn } from "@/lib/utils";
import { FUEL_LEVEL_DISPLAY, DAMAGE_SEVERITY_LABELS } from "@/types/enums";
import type { DamageSeverity } from "@/types/enums";
import type { JobOrderConfigInput } from "@/lib/validators";

interface AuthorizationFormProps {
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
  estimateTotal: number;
  estimatedDays: number | null;
  services: string[];
  damageCount: number;
  damageSeverityCounts: Record<string, number>;
  belongingsCount: number;
  fuelLevel: string;
  odometerReading: number | null;
  jobConfig: JobOrderConfigInput;
  authorizationTerms: string;
}

export function AuthorizationForm({
  intakeRecordId,
  vehicle,
  customer,
  estimateTotal,
  estimatedDays,
  services,
  damageCount,
  damageSeverityCounts,
  belongingsCount,
  fuelLevel,
  odometerReading,
  jobConfig,
  authorizationTerms,
}: AuthorizationFormProps) {
  const router = useRouter();
  const [customerSignature, setCustomerSignature] = useState<string | null>(
    null
  );
  const [advisorSignature, setAdvisorSignature] = useState<string | null>(null);
  const [customerNotPresent, setCustomerNotPresent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    advisorSignature !== null &&
    (customerSignature !== null || customerNotPresent);

  const getMissingMessage = () => {
    const missing: string[] = [];
    if (!advisorSignature) missing.push("advisor signature");
    if (!customerSignature && !customerNotPresent)
      missing.push('customer signature (or mark "Customer Not Present")');
    if (missing.length === 0) return null;
    return `Missing: ${missing.join(" and ")}`;
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const result = await completeIntakeAction(intakeRecordId, jobConfig, {
        customerSignature: customerNotPresent ? null : customerSignature,
        advisorSignature: advisorSignature!,
      });
      if (result.success && result.data) {
        toast.success("Vehicle checked in! Job order created.");
        router.push(`/jobs/${result.data.jobOrderId}`);
      } else {
        toast.error(result.error ?? "Failed to complete check-in.");
        setSubmitting(false);
      }
    } catch {
      toast.error("An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SUMMARY SECTION */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent-500" />
          Check-In Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vehicle Info */}
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
              Vehicle
            </p>
            <p className="font-mono font-bold text-lg text-primary">
              {formatPlateNumber(vehicle.plateNumber)}
            </p>
            <p className="text-sm text-surface-600">
              {vehicle.make} {vehicle.model}
              {vehicle.year ? ` (${vehicle.year})` : ""}
            </p>
            <p className="text-sm text-surface-500">{vehicle.color}</p>
            {odometerReading !== null && (
              <p className="text-sm text-surface-500 mt-1">
                {odometerReading.toLocaleString()} km
              </p>
            )}
          </div>

          {/* Customer */}
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
              Customer
            </p>
            <p className="font-semibold text-primary">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="text-sm text-surface-500">{customer.phone}</p>
          </div>

          {/* Estimated Cost */}
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
              Estimated Cost
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatPeso(estimateTotal)}
            </p>
          </div>

          {/* Estimated Completion */}
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
              Target Completion
            </p>
            <p className="font-semibold text-primary">
              {jobConfig.targetCompletionDate
                ? formatDate(jobConfig.targetCompletionDate)
                : "Not set"}
            </p>
            {estimatedDays !== null && (
              <p className="text-sm text-surface-500">
                ~{estimatedDays} day{estimatedDays !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Scope of Work */}
          <div className="rounded-lg border border-surface-200 bg-white p-4 sm:col-span-2">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
              Scope of Work
            </p>
            {services.length > 0 ? (
              <ul className="space-y-1">
                {services.map((service, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-surface-700 flex items-start gap-2"
                  >
                    <span className="text-accent-500 mt-0.5">&#8226;</span>
                    {service}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-surface-400 italic">
                No services listed
              </p>
            )}
          </div>

          {/* Pre-Existing Damage */}
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
              Pre-Existing Damage
            </p>
            {damageCount > 0 ? (
              <>
                <p className="text-sm font-medium text-primary mb-2">
                  {damageCount} damage mark{damageCount !== 1 ? "s" : ""}{" "}
                  recorded
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(damageSeverityCounts).map(
                    ([severity, count]) => (
                      <span
                        key={severity}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          severity === "COSMETIC" &&
                            "bg-success-100 text-success-600",
                          severity === "MINOR" &&
                            "bg-yellow-100 text-yellow-700",
                          severity === "MODERATE" &&
                            "bg-orange-100 text-orange-700",
                          severity === "SEVERE" &&
                            "bg-danger-100 text-danger-600"
                        )}
                      >
                        {count}{" "}
                        {DAMAGE_SEVERITY_LABELS[severity as DamageSeverity] ??
                          severity}
                      </span>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-surface-400 italic">
                No damage recorded
              </p>
            )}
          </div>

          {/* Belongings & Fuel */}
          <div className="rounded-lg border border-surface-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">
                Belongings
              </p>
              <p className="text-sm text-primary">
                {belongingsCount > 0
                  ? `${belongingsCount} item${belongingsCount !== 1 ? "s" : ""} inventoried`
                  : "No items left in vehicle"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-1">
                Fuel Level
              </p>
              <p className="text-sm text-primary">
                {FUEL_LEVEL_DISPLAY[
                  fuelLevel as keyof typeof FUEL_LEVEL_DISPLAY
                ] ?? fuelLevel}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TERMS AND CONDITIONS */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-3">
          Terms &amp; Conditions
        </h3>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-surface-200 bg-surface-50 p-4">
          <p className="text-sm text-surface-600 whitespace-pre-wrap">
            {authorizationTerms}
          </p>
        </div>
      </div>

      {/* SIGNATURES */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4">Signatures</h3>

        {/* Customer Not Present Toggle */}
        <label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={customerNotPresent}
            onChange={(e) => {
              setCustomerNotPresent(e.target.checked);
              if (e.target.checked) {
                setCustomerSignature(null);
              }
            }}
            className="h-4 w-4 rounded border-surface-300 text-accent-500 focus:ring-accent-500"
          />
          <span className="text-sm font-medium text-surface-700">
            Customer not present
          </span>
        </label>

        {customerNotPresent && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Vehicle received without customer present. Authorization pending.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Signature */}
          {!customerNotPresent && (
            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">
                Customer Signature
              </p>
              <SignaturePad
                onSave={(dataUrl) => setCustomerSignature(dataUrl)}
                height={150}
                label="Customer Signature"
                disabled={submitting}
              />
            </div>
          )}

          {/* Advisor Signature */}
          <div>
            <p className="text-sm font-medium text-surface-700 mb-2">
              Advisor Signature
            </p>
            <SignaturePad
              onSave={(dataUrl) => setAdvisorSignature(dataUrl)}
              height={150}
              label="Advisor Signature"
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {/* COMPLETE CHECK-IN BUTTON */}
      <div className="border-t border-surface-200 pt-6">
        {!canSubmit && (
          <p className="text-sm text-surface-500 mb-3">
            {getMissingMessage()}
          </p>
        )}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors min-h-touch",
            canSubmit && !submitting
              ? "bg-success text-white hover:bg-success/90"
              : "bg-surface-200 text-surface-400 cursor-not-allowed"
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Completing Check-In...
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5" />
              Complete Check-In
            </>
          )}
        </button>
      </div>
    </div>
  );
}

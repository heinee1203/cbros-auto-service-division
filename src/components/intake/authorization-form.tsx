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
  darkMode?: boolean;
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
  darkMode,
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
        <h3
          className={darkMode ? "text-lg font-semibold mb-4 flex items-center gap-2" : "text-lg font-semibold text-primary mb-4 flex items-center gap-2"}
          style={darkMode ? { color: "var(--sch-text)" } : undefined}
        >
          <FileText className="h-5 w-5 text-accent-500" style={darkMode ? { color: "var(--sch-accent)" } : undefined} />
          Check-In Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vehicle Info */}
          <div
            className={darkMode ? "rounded-lg border p-4" : "rounded-lg border border-surface-200 bg-white p-4"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-2" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-2"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
              Vehicle
            </p>
            <p className={darkMode ? "font-mono font-bold text-lg" : "font-mono font-bold text-lg text-primary"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
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
          <div
            className={darkMode ? "rounded-lg border p-4" : "rounded-lg border border-surface-200 bg-white p-4"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-2" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-2"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
              Customer
            </p>
            <p className={darkMode ? "font-semibold" : "font-semibold text-primary"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
              {customer.firstName} {customer.lastName}
            </p>
            <p className="text-sm text-surface-500">{customer.phone}</p>
          </div>

          {/* Estimated Cost */}
          <div
            className={darkMode ? "rounded-lg border p-4" : "rounded-lg border border-surface-200 bg-white p-4"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-2" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-2"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
              Estimated Cost
            </p>
            <p className={darkMode ? "text-2xl font-bold" : "text-2xl font-bold text-primary"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
              {formatPeso(estimateTotal)}
            </p>
          </div>

          {/* Estimated Completion */}
          <div
            className={darkMode ? "rounded-lg border p-4" : "rounded-lg border border-surface-200 bg-white p-4"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-2" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-2"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
              Target Completion
            </p>
            <p className={darkMode ? "font-semibold" : "font-semibold text-primary"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
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
          <div
            className={darkMode ? "rounded-lg border p-4 sm:col-span-2" : "rounded-lg border border-surface-200 bg-white p-4 sm:col-span-2"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-2" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-2"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
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
          <div
            className={darkMode ? "rounded-lg border p-4" : "rounded-lg border border-surface-200 bg-white p-4"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-2" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-2"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
              Pre-Existing Damage
            </p>
            {damageCount > 0 ? (
              <>
                <p className={darkMode ? "text-sm font-medium mb-2" : "text-sm font-medium text-primary mb-2"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
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
          <div
            className={darkMode ? "rounded-lg border p-4 space-y-3" : "rounded-lg border border-surface-200 bg-white p-4 space-y-3"}
            style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
          >
            <div>
              <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-1" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-1"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
                Belongings
              </p>
              <p className={darkMode ? "text-sm" : "text-sm text-primary"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
                {belongingsCount > 0
                  ? `${belongingsCount} item${belongingsCount !== 1 ? "s" : ""} inventoried`
                  : "No items left in vehicle"}
              </p>
            </div>
            <div>
              <p className={darkMode ? "text-xs font-medium uppercase tracking-wider mb-1" : "text-xs font-medium text-surface-500 uppercase tracking-wider mb-1"} style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}>
                Fuel Level
              </p>
              <p className={darkMode ? "text-sm" : "text-sm text-primary"} style={darkMode ? { color: "var(--sch-text)" } : undefined}>
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
        <h3
          className={darkMode ? "text-lg font-semibold mb-3" : "text-lg font-semibold text-primary mb-3"}
          style={darkMode ? { color: "var(--sch-text)" } : undefined}
        >
          Terms &amp; Conditions
        </h3>
        <div
          className={darkMode ? "max-h-40 overflow-y-auto rounded-lg border p-4" : "max-h-40 overflow-y-auto rounded-lg border border-surface-200 bg-surface-50 p-4"}
          style={darkMode ? { background: "var(--sch-surface)", borderColor: "var(--sch-border)" } : undefined}
        >
          <p
            className={darkMode ? "text-sm whitespace-pre-wrap" : "text-sm text-surface-600 whitespace-pre-wrap"}
            style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}
          >
            {authorizationTerms}
          </p>
        </div>
      </div>

      {/* SIGNATURES */}
      <div>
        <h3
          className={darkMode ? "text-lg font-semibold mb-4" : "text-lg font-semibold text-primary mb-4"}
          style={darkMode ? { color: "var(--sch-text)" } : undefined}
        >Signatures</h3>

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
          <span
            className={darkMode ? "text-sm font-medium" : "text-sm font-medium text-surface-700"}
            style={darkMode ? { color: "var(--sch-text)" } : undefined}
          >
            Customer not present
          </span>
        </label>

        {customerNotPresent && (
          <div
            className={darkMode ? "mb-4 flex items-start gap-3 rounded-lg border p-4" : "mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4"}
            style={darkMode ? { borderColor: "var(--sch-accent)", background: "rgba(245,158,11,0.1)" } : undefined}
          >
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
              <p
                className={darkMode ? "text-sm font-medium mb-2" : "text-sm font-medium text-surface-700 mb-2"}
                style={darkMode ? { color: "var(--sch-text)" } : undefined}
              >
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
      <div
        className={darkMode ? "border-t pt-6" : "border-t border-surface-200 pt-6"}
        style={darkMode ? { borderColor: "var(--sch-border)" } : undefined}
      >
        {!canSubmit && (
          <p
            className={darkMode ? "text-sm mb-3" : "text-sm text-surface-500 mb-3"}
            style={darkMode ? { color: "var(--sch-text-muted)" } : undefined}
          >
            {getMissingMessage()}
          </p>
        )}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors min-h-touch",
            !darkMode && canSubmit && !submitting && "bg-success text-white hover:bg-success/90",
            !darkMode && !(canSubmit && !submitting) && "bg-surface-200 text-surface-400 cursor-not-allowed",
            darkMode && !(canSubmit && !submitting) && "cursor-not-allowed",
          )}
          style={darkMode ? {
            background: canSubmit && !submitting ? "var(--sch-accent)" : "var(--sch-border)",
            color: canSubmit && !submitting ? "white" : "var(--sch-text-dim)",
          } : undefined}
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

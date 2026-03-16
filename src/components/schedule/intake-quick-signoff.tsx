"use client";

import { useState } from "react";
import { SignaturePad } from "@/components/ui/signature-pad";

interface IntakeQuickSignoffProps {
  intakeLevel: 1 | 2;
  summary: {
    vehicle: { plateNumber: string; make: string; model: string };
    customer: { firstName: string; lastName: string };
    services: string[];
    techName: string | null;
    bayName: string | null;
    priority: string;
  };
  onComplete: (signatures: {
    customerSignature: string | null;
    advisorSignature: string | null;
  }) => void;
  onBack: () => void;
  submitting: boolean;
}

export function IntakeQuickSignoff({
  intakeLevel,
  summary,
  onComplete,
  onBack,
  submitting,
}: IntakeQuickSignoffProps) {
  const [advisorSig, setAdvisorSig] = useState<string | null>(null);

  const canSubmit =
    intakeLevel === 1 ? !submitting : !submitting && advisorSig !== null;

  const handleCreate = () => {
    if (!canSubmit) return;
    onComplete({
      customerSignature: null,
      advisorSignature:
        intakeLevel === 1
          ? null
          : advisorSig,
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        height: "100%",
      }}
    >
      {/* Summary card */}
      <div
        style={{
          background: "var(--sch-card)",
          border: "1px solid var(--sch-border)",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3
          style={{
            color: "var(--sch-text)",
            fontSize: 14,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 16,
          }}
        >
          Job Summary
        </h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <SummaryRow
            label="Vehicle"
            value={`${summary.vehicle.make} ${summary.vehicle.model} (${summary.vehicle.plateNumber})`}
          />
          <SummaryRow
            label="Customer"
            value={`${summary.customer.firstName} ${summary.customer.lastName}`.toUpperCase()}
          />

          {/* Services list */}
          <div style={{ display: "flex", gap: 12 }}>
            <span
              style={{
                color: "var(--sch-text-muted)",
                fontSize: 14,
                minWidth: 80,
                flexShrink: 0,
              }}
            >
              Services
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {summary.services.map((svc) => (
                <span
                  key={svc}
                  style={{ color: "var(--sch-text)", fontSize: 14 }}
                >
                  &bull; {svc}
                </span>
              ))}
            </div>
          </div>

          <SummaryRow
            label="Tech"
            value={summary.techName ?? "Unassigned"}
          />
          <SummaryRow
            label="Bay"
            value={summary.bayName ?? "Unassigned"}
          />
          <SummaryRow label="Priority" value={summary.priority} />
        </div>
      </div>

      {/* Level 2: Advisor Signature */}
      {intakeLevel === 2 && (
        <div
          style={{
            background: "var(--sch-surface)",
            border: "1px solid var(--sch-border)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <label
            style={{
              color: "var(--sch-text-muted)",
              fontSize: 13,
              fontWeight: 600,
              display: "block",
              marginBottom: 8,
            }}
          >
            Advisor Signature
          </label>
          <SignaturePad
            onSave={(sig) => setAdvisorSig(sig)}
            label="Advisor — sign here"
          />
        </div>
      )}

      {/* Level 1 note */}
      {intakeLevel === 1 && (
        <p
          style={{
            color: "var(--sch-text-muted)",
            fontSize: 12,
            textAlign: "center",
            margin: 0,
          }}
        >
          Quick intake — advisor confirmation logged on create
        </p>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          marginTop: "auto",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid var(--sch-border)",
            background: "transparent",
            color: "var(--sch-text)",
            fontSize: 14,
            fontWeight: 500,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          &larr; Back
        </button>

        <button
          type="button"
          onClick={handleCreate}
          disabled={!canSubmit}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: "var(--sch-accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {submitting ? (
            <>
              <Spinner />
              Creating job...
            </>
          ) : (
            <>
              &#10003; {intakeLevel === 1 ? "Confirm & Create Job" : "Create Job"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── helpers ── */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span
        style={{
          color: "var(--sch-text-muted)",
          fontSize: 14,
          minWidth: 80,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--sch-text)", fontSize: 14 }}>{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="20"
        opacity="0.8"
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

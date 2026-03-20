"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Wrench,
  MapPin,
  AlertTriangle,
  Info,
} from "lucide-react";
import { isBodyPaintOnly } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface BayOption {
  id: string;
  name: string;
  occupied: boolean;
}

interface AssignmentData {
  frontDeskLeadId: string;
  primaryTechnicianId: string | null;
  assistantTechnicianId: string | null;
  assignedBayId: string | null;
  priority: string;
  internalNotes: string | null;
}

export interface IntakeAssignmentProps {
  onComplete: (assignment: AssignmentData) => void;
  onBack: () => void;
  prefilledTechId?: string;
  prefilledBayId?: string;
  serviceCategories?: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PRIORITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "RUSH", label: "Rush" },
  { value: "INSURANCE", label: "Insurance" },
] as const;

const selectStyle: React.CSSProperties = {
  background: "var(--sch-input-bg)",
  borderColor: "var(--sch-input-border)",
  color: "var(--sch-text)",
  border: "1px solid var(--sch-input-border)",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function IntakeAssignment({
  onComplete,
  onBack,
  prefilledTechId,
  prefilledBayId,
  serviceCategories = [],
}: IntakeAssignmentProps) {
  const hideBayAssignment = isBodyPaintOnly(serviceCategories);
  /* ---- data ---- */
  const [advisors, setAdvisors] = useState<StaffUser[]>([]);
  const [technicians, setTechnicians] = useState<StaffUser[]>([]);
  const [bays, setBays] = useState<BayOption[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---- form state ---- */
  const [frontDeskLeadId, setFrontDeskLeadId] = useState("");
  const [primaryTechId, setPrimaryTechId] = useState(prefilledTechId ?? "");
  const [assistantTechId, setAssistantTechId] = useState("");
  const [assignedBayId, setAssignedBayId] = useState(prefilledBayId ?? "");
  const [priority, setPriority] = useState("NORMAL");
  const [internalNotes, setInternalNotes] = useState("");

  /* ---- validation ---- */
  const [error, setError] = useState<string | null>(null);

  /* ---- fetch on mount ---- */
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [staffRes, bayRes] = await Promise.all([
          fetch("/api/users/by-role?role=OWNER,MANAGER,ADVISOR,TECHNICIAN"),
          fetch("/api/bays/live-floor"),
        ]);

        if (!cancelled && staffRes.ok) {
          const staff: StaffUser[] = await staffRes.json();
          setAdvisors(
            staff.filter((u) =>
              ["OWNER", "MANAGER", "ADVISOR"].includes(u.role)
            )
          );
          setTechnicians(staff.filter((u) => u.role === "TECHNICIAN"));
        }

        if (!cancelled && bayRes.ok) {
          const bayData = await bayRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setBays(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bayData.bays ?? bayData).map((b: any) => ({
              id: b.id,
              name: b.name,
              occupied: Array.isArray(b.assignments)
                ? b.assignments.length > 0
                : false,
            }))
          );
        }
      } catch {
        // silent — selects will just be empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- derived ---- */
  const availableAssistants = technicians.filter(
    (t) => t.id !== primaryTechId
  );

  // Reset assistant if it conflicts with newly selected lead
  useEffect(() => {
    if (assistantTechId && assistantTechId === primaryTechId) {
      setAssistantTechId("");
    }
  }, [primaryTechId, assistantTechId]);

  /* ---- submit ---- */
  function handleSubmit() {
    if (!frontDeskLeadId) {
      setError("Please select a Front Desk Lead.");
      return;
    }
    setError(null);
    onComplete({
      frontDeskLeadId,
      primaryTechnicianId: primaryTechId || null,
      assistantTechnicianId: assistantTechId || null,
      assignedBayId: assignedBayId || null,
      priority,
      internalNotes: internalNotes.trim() || null,
    });
  }

  /* ---- loading state ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2
          size={28}
          className="animate-spin"
          style={{ color: "var(--sch-accent)" }}
        />
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="rounded-lg p-2"
          style={{ background: "var(--sch-surface)" }}
        >
          <User size={20} style={{ color: "var(--sch-accent)" }} />
        </div>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Assignment
        </h3>
      </div>

      {/* Form Fields */}
      <div className="flex flex-col gap-4">
        {/* Front Desk Lead */}
        <FieldRow
          icon={<User size={16} />}
          label="Front Desk Lead"
          required
        >
          <select
            value={frontDeskLeadId}
            onChange={(e) => {
              setFrontDeskLeadId(e.target.value);
              if (error) setError(null);
            }}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
            style={{
              ...selectStyle,
              // @ts-expect-error -- CSS custom property
              "--tw-ring-color": "var(--sch-accent)",
            }}
          >
            <option value="">Select advisor...</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </FieldRow>

        {/* Lead Mechanic */}
        <FieldRow icon={<Wrench size={16} />} label="Lead Mechanic">
          <select
            value={primaryTechId}
            onChange={(e) => setPrimaryTechId(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
            style={{
              ...selectStyle,
              // @ts-expect-error -- CSS custom property
              "--tw-ring-color": "var(--sch-accent)",
            }}
          >
            <option value="">Assign later...</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </select>
        </FieldRow>

        {/* Assistant */}
        <FieldRow icon={<Wrench size={16} />} label="Assistant">
          <select
            value={assistantTechId}
            onChange={(e) => setAssistantTechId(e.target.value)}
            disabled={!primaryTechId}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              ...selectStyle,
              // @ts-expect-error -- CSS custom property
              "--tw-ring-color": "var(--sch-accent)",
            }}
          >
            <option value="">None</option>
            {availableAssistants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </select>
        </FieldRow>

        {/* Bay — hidden for body & paint only jobs */}
        {hideBayAssignment ? (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{
              background: "rgba(245,158,11,0.1)",
              color: "var(--sch-text-muted)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <Info size={16} style={{ color: "var(--sch-accent)", flexShrink: 0 }} />
            Body & Paint jobs do not require bay assignment.
          </div>
        ) : (
          <FieldRow icon={<MapPin size={16} />} label="Bay">
            <select
              value={assignedBayId}
              onChange={(e) => setAssignedBayId(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
              style={{
                ...selectStyle,
                // @ts-expect-error -- CSS custom property
                "--tw-ring-color": "var(--sch-accent)",
              }}
            >
              <option value="">Assign later...</option>
              {bays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.occupied ? "(occupied)" : "(available)"}
                </option>
              ))}
            </select>
          </FieldRow>
        )}

        {/* Priority */}
        <FieldRow icon={<AlertTriangle size={16} />} label="Priority">
          <div className="flex gap-3">
            {PRIORITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer text-sm"
                style={{ color: "var(--sch-text)" }}
              >
                <span
                  className="relative flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors"
                  style={{
                    borderColor:
                      priority === opt.value
                        ? "var(--sch-accent)"
                        : "var(--sch-input-border)",
                    background:
                      priority === opt.value
                        ? "var(--sch-accent)"
                        : "transparent",
                  }}
                >
                  {priority === opt.value && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: "white" }}
                    />
                  )}
                </span>
                <input
                  type="radio"
                  name="priority"
                  value={opt.value}
                  checked={priority === opt.value}
                  onChange={() => setPriority(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </FieldRow>

        {/* Internal Notes */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--sch-text-muted)" }}
          >
            Internal Notes
          </label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes for the team..."
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 resize-none"
            style={{
              ...selectStyle,
              // @ts-expect-error -- CSS custom property
              "--tw-ring-color": "var(--sch-accent)",
            }}
          />
        </div>
      </div>

      {/* Validation error */}
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
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
          type="button"
          onClick={handleSubmit}
          className="flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--sch-accent)", color: "white" }}
        >
          Continue
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: label + input row                                   */
/* ------------------------------------------------------------------ */

function FieldRow({
  icon,
  label,
  required,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--sch-text-muted)" }}
      >
        <span style={{ color: "var(--sch-text-dim)" }}>{icon}</span>
        {label}
        {required && (
          <span style={{ color: "var(--sch-accent)" }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}

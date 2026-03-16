"use client";

import { useState, useEffect, useCallback } from "react";
import { createQuickJobAction } from "@/lib/actions/intake-actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface QuickJobModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface LookupResult {
  found: true;
  vehicle: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
}

export function QuickJobModal({ open, onClose, onCreated }: QuickJobModalProps) {
  const [plate, setPlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) return;
    setPlate("");
    setCustomerName("");
    setPhone("");
    setReason("");
    setLookupResult(null);
    setLookingUp(false);
    setSubmitting(false);
  }, [open]);

  // Debounced plate lookup
  useEffect(() => {
    if (plate.length < 3) {
      setLookupResult(null);
      return;
    }

    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/vehicles/lookup?plate=${encodeURIComponent(plate)}`
        );
        const data = await res.json();
        if (data.found) {
          setLookupResult(data as LookupResult);
          if (data.customer) {
            setCustomerName(
              `${data.customer.firstName} ${data.customer.lastName}`
            );
            setPhone(data.customer.phone || "");
          }
        } else {
          setLookupResult(null);
        }
      } catch {
        setLookupResult(null);
      } finally {
        setLookingUp(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      setLookingUp(false);
    };
  }, [plate]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!plate.trim() || !customerName.trim() || !phone.trim() || !reason.trim()) {
      toast.error("All fields are required");
      return;
    }

    setSubmitting(true);
    const result = await createQuickJobAction({
      plateNumber: plate.trim(),
      customerName: customerName.trim(),
      customerPhone: phone.trim(),
      reason: reason.trim(),
      vehicleId: lookupResult?.vehicle?.id,
      customerId: lookupResult?.customer?.id,
    });

    if (result.success) {
      toast.success(`Quick job created: ${result.data?.jobOrderNumber}`);
      onCreated();
      onClose();
    } else {
      toast.error(result.error || "Failed to create quick job");
    }
    setSubmitting(false);
  }

  if (!open) return null;

  const vehicleLabel = lookupResult
    ? [
        lookupResult.vehicle.year,
        lookupResult.vehicle.make,
        lookupResult.vehicle.model,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  const customerLabel = lookupResult?.customer
    ? `${lookupResult.customer.firstName} ${lookupResult.customer.lastName}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-job-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className="relative w-full max-w-md mx-4 rounded-xl p-6"
        style={{
          background: "var(--sch-bg)",
          border: "1px solid var(--sch-border)",
        }}
      >
        <h3
          id="quick-job-title"
          className="text-lg font-semibold mb-1"
          style={{ color: "var(--sch-text)" }}
        >
          Quick Job
        </h3>
        <p
          className="text-sm mb-5"
          style={{ color: "var(--sch-text-muted)" }}
        >
          Create an emergency job record with minimal data
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Plate Number */}
          <div>
            <label
              htmlFor="qj-plate"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Plate Number
            </label>
            <div className="relative">
              <input
                id="qj-plate"
                type="text"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="e.g. ABC 1234"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--sch-input-bg)",
                  border: "1px solid var(--sch-input-border)",
                  color: "var(--sch-text)",
                }}
              />
              {lookingUp && (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
                  style={{ color: "var(--sch-text-muted)" }}
                />
              )}
            </div>
            {lookupResult && vehicleLabel && (
              <div
                className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(245,158,11,0.15)",
                  color: "rgb(217,119,6)",
                }}
              >
                Returning vehicle: {vehicleLabel} &mdash; {customerLabel}
              </div>
            )}
          </div>

          {/* Customer Name */}
          <div>
            <label
              htmlFor="qj-name"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Customer Name
            </label>
            <input
              id="qj-name"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--sch-input-bg)",
                border: "1px solid var(--sch-input-border)",
                color: "var(--sch-text)",
              }}
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="qj-phone"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Phone
            </label>
            <input
              id="qj-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--sch-input-bg)",
                border: "1px solid var(--sch-input-border)",
                color: "var(--sch-text)",
              }}
            />
          </div>

          {/* Reason for Visit */}
          <div>
            <label
              htmlFor="qj-reason"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--sch-text-muted)" }}
            >
              Reason for Visit
            </label>
            <input
              id="qj-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Tow-in, bumper damage"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--sch-input-bg)",
                border: "1px solid var(--sch-input-border)",
                color: "var(--sch-text)",
              }}
            />
          </div>

          {/* Warning Banner */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs leading-relaxed"
            style={{
              background: "rgba(245,158,11,0.15)",
              color: "rgb(217,119,6)",
            }}
          >
            <span className="flex-shrink-0 mt-0.5">&#9888;</span>
            <span>
              This creates an incomplete job record. Full intake must be
              completed later.
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg disabled:opacity-50"
              style={{
                background: "var(--sch-surface)",
                color: "var(--sch-text)",
                border: "1px solid var(--sch-border)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
              style={{
                background: "var(--sch-accent)",
              }}
            >
              {submitting ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

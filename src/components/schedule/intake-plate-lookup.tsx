"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Car, User, ChevronRight, Loader2 } from "lucide-react";

export interface PlateLookupResult {
  mode: "existing" | "existing-diff-customer" | "new";
  vehicleId?: string;
  customerId?: string;
  vehicle?: {
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    vin: string | null;
    lastOdometer: number | null;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  visitCount?: number;
  lastVisitDate?: string;
  plateNumber?: string;
}

interface IntakePlateLookupProps {
  onComplete: (result: PlateLookupResult) => void;
  prefilledPlate?: string;
}

interface LookupResponse {
  found: boolean;
  vehicle?: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    vin: string | null;
    lastOdometer: number | null;
    lastVisitDate: string | null;
    visitCount: number;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  } | null;
}

export function IntakePlateLookup({
  onComplete,
  prefilledPlate,
}: IntakePlateLookupProps) {
  const [plate, setPlate] = useState(prefilledPlate ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doLookup = useCallback(async (query: string) => {
    const normalized = query.replace(/[\s-]/g, "");
    if (normalized.length < 3) {
      setResult(null);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/vehicles/lookup?plate=${encodeURIComponent(normalized)}`
      );
      if (res.ok) {
        const data: LookupResponse = await res.json();
        setResult(data);
        setSearched(true);
      }
    } catch {
      setResult(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalized = plate.replace(/[\s-]/g, "");
    if (normalized.length < 3) {
      setResult(null);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doLookup(plate);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [plate, doLookup]);

  // Auto-trigger lookup for prefilled plate
  useEffect(() => {
    if (prefilledPlate && prefilledPlate.replace(/[\s-]/g, "").length >= 3) {
      doLookup(prefilledPlate);
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleUseVehicle() {
    if (!result?.found || !result.vehicle) return;
    onComplete({
      mode: "existing",
      vehicleId: result.vehicle.id,
      customerId: result.customer?.id,
      vehicle: {
        plateNumber: result.vehicle.plateNumber,
        make: result.vehicle.make,
        model: result.vehicle.model,
        year: result.vehicle.year,
        color: result.vehicle.color,
        vin: result.vehicle.vin,
        lastOdometer: result.vehicle.lastOdometer,
      },
      customer: result.customer ?? undefined,
      visitCount: result.vehicle.visitCount,
      lastVisitDate: result.vehicle.lastVisitDate ?? undefined,
    });
  }

  function handleDifferentCustomer() {
    if (!result?.found || !result.vehicle) return;
    onComplete({
      mode: "existing-diff-customer",
      vehicleId: result.vehicle.id,
      vehicle: {
        plateNumber: result.vehicle.plateNumber,
        make: result.vehicle.make,
        model: result.vehicle.model,
        year: result.vehicle.year,
        color: result.vehicle.color,
        vin: result.vehicle.vin,
        lastOdometer: result.vehicle.lastOdometer,
      },
      visitCount: result.vehicle.visitCount,
      lastVisitDate: result.vehicle.lastVisitDate ?? undefined,
    });
  }

  function handleNewVehicle() {
    onComplete({
      mode: "new",
      plateNumber: plate.replace(/[\s-]/g, "").toUpperCase() || undefined,
    });
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search Input */}
      <div className="relative">
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "var(--sch-text-muted)" }}
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Search size={20} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="Scan or type plate number"
          className="w-full rounded-xl py-4 pl-12 pr-4 text-lg font-mono tracking-wider outline-none focus:ring-2"
          style={{
            background: "var(--sch-input-bg)",
            borderColor: "var(--sch-input-border)",
            color: "var(--sch-text)",
            border: "1px solid var(--sch-input-border)",
            // focus ring via CSS var
            // @ts-expect-error -- CSS custom property for ring color
            "--tw-ring-color": "var(--sch-accent)",
          }}
        />
      </div>

      {/* Results */}
      {searched && !loading && result?.found && result.vehicle && (
        <div
          className="rounded-xl p-5 flex flex-col gap-4"
          style={{
            background: "var(--sch-card)",
            border: "1px solid var(--sch-border)",
          }}
        >
          {/* Vehicle Info */}
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 rounded-lg p-2.5"
              style={{ background: "var(--sch-surface)" }}
            >
              <Car size={24} style={{ color: "var(--sch-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--sch-text)" }}
              >
                {result.vehicle.year ?? ""} {result.vehicle.make}{" "}
                {result.vehicle.model}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span
                  className="text-sm font-mono"
                  style={{ color: "var(--sch-text-muted)" }}
                >
                  {result.vehicle.plateNumber}
                </span>
                {result.vehicle.vin && (
                  <span
                    className="text-sm font-mono"
                    style={{ color: "var(--sch-text-dim)" }}
                  >
                    VIN: {result.vehicle.vin}
                  </span>
                )}
              </div>
              {result.vehicle.color && (
                <div
                  className="text-sm mt-1"
                  style={{ color: "var(--sch-text-dim)" }}
                >
                  Color: {result.vehicle.color}
                </div>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div
            className="flex flex-wrap gap-4 rounded-lg p-3"
            style={{ background: "var(--sch-surface)" }}
          >
            {result.vehicle.lastOdometer != null && (
              <div>
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "var(--sch-text-dim)" }}
                >
                  Last ODO
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--sch-text)" }}
                >
                  {result.vehicle.lastOdometer.toLocaleString()} km
                </div>
              </div>
            )}
            {result.vehicle.lastVisitDate && (
              <div>
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "var(--sch-text-dim)" }}
                >
                  Last Visit
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--sch-text)" }}
                >
                  {formatDate(result.vehicle.lastVisitDate)}
                </div>
              </div>
            )}
            <div>
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--sch-text-dim)" }}
              >
                Visits
              </div>
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--sch-accent)" }}
              >
                Visit #{result.vehicle.visitCount + 1}
              </div>
            </div>
          </div>

          {/* Customer Info */}
          {result.customer && (
            <div className="flex items-center gap-3">
              <div
                className="flex-shrink-0 rounded-lg p-2.5"
                style={{ background: "var(--sch-surface)" }}
              >
                <User size={20} style={{ color: "var(--sch-text-muted)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--sch-text)" }}
                >
                  {result.customer.firstName} {result.customer.lastName}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--sch-text-muted)" }}
                >
                  {result.customer.phone}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={handleUseVehicle}
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--sch-accent)", color: "white" }}
            >
              Use This Vehicle
              <ChevronRight size={16} />
            </button>
            <button
              onClick={handleDifferentCustomer}
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--sch-surface)",
                color: "var(--sch-text)",
                border: "1px solid var(--sch-border)",
              }}
            >
              Different Customer
            </button>
          </div>
        </div>
      )}

      {/* Not Found */}
      {searched && !loading && result && !result.found && (
        <div
          className="rounded-xl p-6 text-center flex flex-col items-center gap-3"
          style={{
            background: "var(--sch-card)",
            border: "1px solid var(--sch-border)",
          }}
        >
          <div
            className="rounded-full p-3"
            style={{ background: "var(--sch-surface)" }}
          >
            <Car size={28} style={{ color: "var(--sch-text-dim)" }} />
          </div>
          <div
            className="text-sm font-medium"
            style={{ color: "var(--sch-text-muted)" }}
          >
            No vehicle found for &ldquo;{plate}&rdquo;
          </div>
          <button
            onClick={handleNewVehicle}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 mt-1"
            style={{ background: "var(--sch-accent)", color: "white" }}
          >
            Continue as New Vehicle
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* New Vehicle + New Customer (always visible at bottom when result is shown) */}
      {searched && !loading && (
        <button
          onClick={handleNewVehicle}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--sch-text-dim)" }}
        >
          New Vehicle + New Customer
        </button>
      )}
    </div>
  );
}

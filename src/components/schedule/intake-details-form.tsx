"use client";

import { useState } from "react";

interface IntakeDetailsFormProps {
  lookupResult: {
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
    plateNumber?: string;
  };
  onComplete: (details: {
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
  }) => void;
  onBack: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatOdometer(value: number | null): string {
  if (value == null) return "--";
  return value.toLocaleString();
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 1990 + 2 }, (_, i) => currentYear + 1 - i);

// ── Styles ─────────────────────────────────────────────────────────────────
const inputClass =
  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent";
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--sch-input-bg)",
  borderColor: "var(--sch-input-border)",
  color: "var(--sch-text)",
};
const labelClass = "block text-sm font-medium mb-1";
const labelStyle: React.CSSProperties = { color: "var(--sch-text-muted)" };

// ── Summary Card ───────────────────────────────────────────────────────────
function VehicleSummaryCard({
  vehicle,
  onEdit,
}: {
  vehicle: NonNullable<IntakeDetailsFormProps["lookupResult"]["vehicle"]>;
  onEdit: () => void;
}) {
  const title = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: "var(--sch-card)",
        borderColor: "var(--sch-border)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--sch-text)" }}>
            {title}
          </p>
          <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            Plate: {vehicle.plateNumber}
            {"  "}VIN: {vehicle.vin || "--"}
          </p>
          {vehicle.color && (
            <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
              Color: {vehicle.color}
            </p>
          )}
          {vehicle.lastOdometer != null && (
            <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
              Last ODO: {formatOdometer(vehicle.lastOdometer)} km
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium shrink-0 ml-2"
          style={{ color: "var(--sch-accent)" }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function CustomerSummaryCard({
  customer,
  onEdit,
}: {
  customer: NonNullable<IntakeDetailsFormProps["lookupResult"]["customer"]>;
  onEdit: () => void;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: "var(--sch-card)",
        borderColor: "var(--sch-border)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--sch-text)" }}>
            {customer.firstName} {customer.lastName}
          </p>
          <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
            {customer.phone}
          </p>
          {customer.email && (
            <p className="text-xs" style={{ color: "var(--sch-text-muted)" }}>
              {customer.email}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium shrink-0 ml-2"
          style={{ color: "var(--sch-accent)" }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Vehicle Form ───────────────────────────────────────────────────────────
function VehicleFormFields({
  values,
  onChange,
  errors,
}: {
  values: {
    plateNumber: string;
    make: string;
    model: string;
    year: string;
    color: string;
    vin: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <h3
        className="text-sm font-semibold uppercase tracking-wider"
        style={{ color: "var(--sch-text-muted)" }}
      >
        Vehicle Information
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Year */}
        <div>
          <label className={labelClass} style={labelStyle}>
            Year
          </label>
          <select
            value={values.year}
            onChange={(e) => onChange("year", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">--</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Make */}
        <div>
          <label className={labelClass} style={labelStyle}>
            Make <span style={{ color: "var(--sch-accent)" }}>*</span>
          </label>
          <input
            type="text"
            value={values.make}
            onChange={(e) => onChange("make", e.target.value.toUpperCase())}
            placeholder="e.g. TOYOTA"
            className={inputClass}
            style={{
              ...inputStyle,
              ...(errors.make ? { borderColor: "#EF4444" } : {}),
            }}
          />
          {errors.make && (
            <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
              {errors.make}
            </p>
          )}
        </div>
      </div>

      {/* Model */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Model <span style={{ color: "var(--sch-accent)" }}>*</span>
        </label>
        <input
          type="text"
          value={values.model}
          onChange={(e) => onChange("model", e.target.value)}
          placeholder="e.g. Fortuner"
          className={inputClass}
          style={{
            ...inputStyle,
            ...(errors.model ? { borderColor: "#EF4444" } : {}),
          }}
        />
        {errors.model && (
          <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
            {errors.model}
          </p>
        )}
      </div>

      {/* Plate Number */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Plate Number <span style={{ color: "var(--sch-accent)" }}>*</span>
        </label>
        <input
          type="text"
          value={values.plateNumber}
          onChange={(e) => onChange("plateNumber", e.target.value.toUpperCase())}
          placeholder="e.g. ABC-1234"
          className={inputClass}
          style={{
            ...inputStyle,
            ...(errors.plateNumber ? { borderColor: "#EF4444" } : {}),
          }}
        />
        {errors.plateNumber && (
          <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
            {errors.plateNumber}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* VIN */}
        <div>
          <label className={labelClass} style={labelStyle}>
            VIN
          </label>
          <input
            type="text"
            value={values.vin}
            onChange={(e) => onChange("vin", e.target.value)}
            placeholder="Optional"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Color */}
        <div>
          <label className={labelClass} style={labelStyle}>
            Color
          </label>
          <input
            type="text"
            value={values.color}
            onChange={(e) => onChange("color", e.target.value)}
            placeholder="Optional"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ── Customer Form ──────────────────────────────────────────────────────────
function CustomerFormFields({
  values,
  onChange,
  errors,
}: {
  values: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <h3
        className="text-sm font-semibold uppercase tracking-wider"
        style={{ color: "var(--sch-text-muted)" }}
      >
        Customer Information
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* First Name */}
        <div>
          <label className={labelClass} style={labelStyle}>
            First Name <span style={{ color: "var(--sch-accent)" }}>*</span>
          </label>
          <input
            type="text"
            value={values.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            placeholder="Juan"
            className={inputClass}
            style={{
              ...inputStyle,
              ...(errors.firstName ? { borderColor: "#EF4444" } : {}),
            }}
          />
          {errors.firstName && (
            <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
              {errors.firstName}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className={labelClass} style={labelStyle}>
            Last Name
          </label>
          <input
            type="text"
            value={values.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            placeholder="Dela Cruz"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Phone <span style={{ color: "var(--sch-accent)" }}>*</span>
        </label>
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="+63..."
          className={inputClass}
          style={{
            ...inputStyle,
            ...(errors.phone ? { borderColor: "#EF4444" } : {}),
          }}
        />
        {errors.phone && (
          <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
            {errors.phone}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Email
        </label>
        <input
          type="email"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="Optional"
          className={inputClass}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function IntakeDetailsForm({
  lookupResult,
  onComplete,
  onBack,
}: IntakeDetailsFormProps) {
  const { mode, vehicle, customer } = lookupResult;

  // ── Edit toggles for summary cards ────────────────────────────────────
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);

  // ── Vehicle form state ────────────────────────────────────────────────
  const [vehicleForm, setVehicleForm] = useState({
    plateNumber: vehicle?.plateNumber || lookupResult.plateNumber || "",
    make: vehicle?.make || "",
    model: vehicle?.model || "",
    year: vehicle?.year != null ? String(vehicle.year) : "",
    color: vehicle?.color || "",
    vin: vehicle?.vin || "",
  });

  // ── Customer form state ───────────────────────────────────────────────
  const [customerForm, setCustomerForm] = useState({
    firstName: customer?.firstName || "",
    lastName: customer?.lastName || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
  });

  // ── Odometer state ────────────────────────────────────────────────────
  const [odometer, setOdometer] = useState("");

  // ── Errors ────────────────────────────────────────────────────────────
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({});
  const [odometerError, setOdometerError] = useState("");

  // ── Determine what to show ────────────────────────────────────────────
  const showVehicleSummary = mode === "existing" && vehicle && !editingVehicle;
  const showVehicleForm =
    mode === "new" || mode === "existing-diff-customer" ? false : editingVehicle;
  // For existing-diff-customer, vehicle is pre-filled (summary shown)
  const showVehicleSummaryDiffCustomer =
    mode === "existing-diff-customer" && vehicle && !editingVehicle;
  const showVehicleFormNew = mode === "new";

  const showCustomerSummary = mode === "existing" && customer && !editingCustomer;
  const showCustomerForm =
    mode === "existing-diff-customer" ||
    mode === "new" ||
    editingCustomer;

  // ── Field change handlers ─────────────────────────────────────────────
  const handleVehicleChange = (field: string, value: string) => {
    setVehicleForm((prev) => ({ ...prev, [field]: value }));
    setVehicleErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleCustomerChange = (field: string, value: string) => {
    setCustomerForm((prev) => ({ ...prev, [field]: value }));
    setCustomerErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // ── Validate ──────────────────────────────────────────────────────────
  const validate = (): boolean => {
    let valid = true;
    const vErrors: Record<string, string> = {};
    const cErrors: Record<string, string> = {};

    // Validate vehicle if editing or new
    const needsVehicleValidation =
      mode === "new" || editingVehicle;
    if (needsVehicleValidation) {
      if (!vehicleForm.plateNumber.trim()) {
        vErrors.plateNumber = "Plate number is required";
        valid = false;
      }
      if (!vehicleForm.make.trim()) {
        vErrors.make = "Make is required";
        valid = false;
      }
      if (!vehicleForm.model.trim()) {
        vErrors.model = "Model is required";
        valid = false;
      }
    }

    // Validate customer if entering new or editing
    const needsCustomerValidation =
      mode === "existing-diff-customer" || mode === "new" || editingCustomer;
    if (needsCustomerValidation) {
      if (!customerForm.firstName.trim()) {
        cErrors.firstName = "First name is required";
        valid = false;
      }
      if (!customerForm.phone.trim()) {
        cErrors.phone = "Phone is required";
        valid = false;
      }
    }

    // Validate odometer
    if (odometer.trim() !== "") {
      const num = Number(odometer);
      if (isNaN(num) || num < 0) {
        setOdometerError("Odometer must be 0 or greater");
        valid = false;
      } else {
        setOdometerError("");
      }
    } else {
      setOdometerError("");
    }

    setVehicleErrors(vErrors);
    setCustomerErrors(cErrors);
    return valid;
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!validate()) return;

    const odometerReading =
      odometer.trim() !== "" ? Number(odometer) : null;

    // Build vehicle payload
    let vehicleId: string | undefined;
    let newVehicle:
      | {
          plateNumber: string;
          make: string;
          model: string;
          year?: number | null;
          color?: string | null;
          vin?: string | null;
        }
      | undefined;

    if (mode === "new" || editingVehicle) {
      newVehicle = {
        plateNumber: vehicleForm.plateNumber.trim(),
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
        color: vehicleForm.color.trim() || null,
        vin: vehicleForm.vin.trim() || null,
      };
    } else {
      vehicleId = lookupResult.vehicleId;
    }

    // Build customer payload
    let customerId: string | undefined;
    let newCustomer:
      | {
          firstName: string;
          lastName?: string;
          phone: string;
          email?: string | null;
        }
      | undefined;

    if (
      mode === "existing-diff-customer" ||
      mode === "new" ||
      editingCustomer
    ) {
      newCustomer = {
        firstName: customerForm.firstName.trim(),
        lastName: customerForm.lastName.trim() || undefined,
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim() || null,
      };
    } else {
      customerId = lookupResult.customerId;
    }

    onComplete({
      vehicleId,
      newVehicle,
      customerId,
      newCustomer,
      odometerReading,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Vehicle Section ──────────────────────────────────────────── */}
      {showVehicleSummary && vehicle && (
        <VehicleSummaryCard
          vehicle={vehicle}
          onEdit={() => setEditingVehicle(true)}
        />
      )}

      {showVehicleSummaryDiffCustomer && vehicle && (
        <VehicleSummaryCard
          vehicle={vehicle}
          onEdit={() => setEditingVehicle(true)}
        />
      )}

      {(showVehicleForm || showVehicleFormNew) && (
        <VehicleFormFields
          values={vehicleForm}
          onChange={handleVehicleChange}
          errors={vehicleErrors}
        />
      )}

      {/* ── Customer Section ─────────────────────────────────────────── */}
      {showCustomerSummary && customer && (
        <CustomerSummaryCard
          customer={customer}
          onEdit={() => setEditingCustomer(true)}
        />
      )}

      {showCustomerForm && !showCustomerSummary && (
        <CustomerFormFields
          values={customerForm}
          onChange={handleCustomerChange}
          errors={customerErrors}
        />
      )}

      {/* ── Odometer Section ─────────────────────────────────────────── */}
      <div>
        <label className={labelClass} style={labelStyle}>
          Odometer Reading (km)
        </label>
        <input
          type="number"
          min={0}
          value={odometer}
          onChange={(e) => {
            setOdometer(e.target.value);
            setOdometerError("");
          }}
          placeholder="e.g. 148500"
          className={inputClass}
          style={{
            ...inputStyle,
            ...(odometerError ? { borderColor: "#EF4444" } : {}),
          }}
        />
        {odometerError && (
          <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
            {odometerError}
          </p>
        )}
        {vehicle?.lastOdometer != null && (
          <p className="text-xs mt-1" style={{ color: "var(--sch-text-dim)" }}>
            was {formatOdometer(vehicle.lastOdometer)} on last visit
          </p>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium rounded-lg border"
          style={{
            color: "var(--sch-text-muted)",
            borderColor: "var(--sch-border)",
            background: "transparent",
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2 text-sm font-semibold rounded-lg text-white"
          style={{
            background: "var(--sch-accent)",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Car,
  Shield,
  User,
  Calendar,
  Wrench,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { SlideOver } from "@/components/ui/slide-over";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatPlateNumber } from "@/lib/utils";
import {
  updateVehicleAction,
  deleteVehicleAction,
} from "@/lib/actions/vehicle-actions";
import {
  JOB_ORDER_STATUS_LABELS,
  JOB_ORDER_STATUS_COLORS,
  type JobOrderStatus,
  BodyType,
} from "@/types/enums";
import { VEHICLE_MAKES } from "@/lib/constants";
import type { VehicleInput } from "@/lib/validators";
import { X, ChevronDown as ChevronDownIcon } from "lucide-react";
import { useEffect, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Task = {
  name: string;
};

type JobOrder = {
  id: string;
  jobOrderNumber: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  tasks: Task[];
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
};

type VehicleDetail = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  color: string;
  colorCode: string | null;
  vin: string | null;
  engineType: string | null;
  bodyType: string;
  insuranceCompany: string | null;
  policyNumber: string | null;
  notes: string | null;
  customerId: string;
  customer: Customer;
  jobOrders: JobOrder[];
  createdAt: string | Date;
  updatedAt: string | Date;
};

// ─── Customer search (for edit form) ──────────────────────────────────────────

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

// ─── VehicleForm (edit only, pre-populated) ───────────────────────────────────

interface VehicleFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle: VehicleDetail;
}

function VehicleEditForm({ open, onClose, onSuccess, vehicle }: VehicleFormProps) {
  const [form, setForm] = useState<VehicleInput>({
    customerId: vehicle.customerId,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year ?? null,
    color: vehicle.color,
    colorCode: vehicle.colorCode ?? "",
    vin: vehicle.vin ?? "",
    engineType: vehicle.engineType ?? "",
    bodyType: vehicle.bodyType,
    insuranceCompany: vehicle.insuranceCompany ?? "",
    policyNumber: vehicle.policyNumber ?? "",
    notes: vehicle.notes ?? "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleInput, string>>>({});

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState(
    `${vehicle.customer.firstName} ${vehicle.customer.lastName}`
  );
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption>({
    id: vehicle.customerId,
    firstName: vehicle.customer.firstName,
    lastName: vehicle.customer.lastName,
    phone: vehicle.customer.phone,
  });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Make dropdown state
  const [makeQuery, setMakeQuery] = useState(vehicle.make);
  const [makeDropdownOpen, setMakeDropdownOpen] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setForm({
        customerId: vehicle.customerId,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year ?? null,
        color: vehicle.color,
        colorCode: vehicle.colorCode ?? "",
        vin: vehicle.vin ?? "",
        engineType: vehicle.engineType ?? "",
        bodyType: vehicle.bodyType,
        insuranceCompany: vehicle.insuranceCompany ?? "",
        policyNumber: vehicle.policyNumber ?? "",
        notes: vehicle.notes ?? "",
      });
      setCustomerQuery(`${vehicle.customer.firstName} ${vehicle.customer.lastName}`);
      setSelectedCustomer({
        id: vehicle.customerId,
        firstName: vehicle.customer.firstName,
        lastName: vehicle.customer.lastName,
        phone: vehicle.customer.phone,
      });
      setMakeQuery(vehicle.make);
      setErrors({});
    }
  }, [open, vehicle]);

  // Customer search debounce
  useEffect(() => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (customerQuery.length < 2 || selectedCustomer) {
      if (!selectedCustomer) setCustomerResults([]);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(customerQuery)}`
        );
        if (res.ok) {
          const data: CustomerOption[] = await res.json();
          setCustomerResults(data);
          setCustomerSearchOpen(data.length > 0);
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    };
  }, [customerQuery, selectedCustomer]);

  function setField<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function selectCustomer(c: CustomerOption) {
    setSelectedCustomer(c);
    setCustomerQuery(`${c.firstName} ${c.lastName}`);
    setField("customerId", c.id);
    setCustomerResults([]);
    setCustomerSearchOpen(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null as unknown as CustomerOption);
    setCustomerQuery("");
    setField("customerId", "");
    setTimeout(() => customerInputRef.current?.focus(), 0);
  }

  const filteredMakes = makeQuery
    ? VEHICLE_MAKES.filter((m) => m.toLowerCase().includes(makeQuery.toLowerCase()))
    : VEHICLE_MAKES;

  function selectMake(make: string) {
    setMakeQuery(make);
    setField("make", make);
    setMakeDropdownOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) {
      setErrors((prev) => ({ ...prev, customerId: "Please select a customer" }));
      return;
    }
    setSubmitting(true);
    setErrors({});

    const payload: VehicleInput = {
      ...form,
      colorCode: form.colorCode || null,
      vin: form.vin || null,
      engineType: form.engineType || null,
      insuranceCompany: form.insuranceCompany || null,
      policyNumber: form.policyNumber || null,
      notes: form.notes || null,
    };

    const result = await updateVehicleAction(vehicle.id, payload);
    setSubmitting(false);

    if (result.success) {
      toast.success("Vehicle updated.");
      onSuccess();
      onClose();
    } else {
      toast.error(result.error ?? "Something went wrong.");
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-surface-300 transition-colors";
  const labelClass = "block text-xs font-medium text-surface-500 mb-1";

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Edit Vehicle"
      description={`Editing ${formatPlateNumber(vehicle.plateNumber)}`}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vehicle-edit-form"
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      }
    >
      <form id="vehicle-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Customer search */}
        <div className="relative">
          <label className={labelClass}>Owner / Customer *</label>
          <div className="relative">
            <input
              ref={customerInputRef}
              type="text"
              className={cn(
                inputClass,
                errors.customerId && "border-red-400",
                selectedCustomer && "pr-8"
              )}
              placeholder="Search by name or phone..."
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                if (selectedCustomer) {
                  setSelectedCustomer(null as unknown as CustomerOption);
                  setField("customerId", "");
                }
              }}
              onFocus={() => {
                if (customerResults.length > 0) setCustomerSearchOpen(true);
              }}
              autoComplete="off"
            />
            {selectedCustomer && (
              <button
                type="button"
                onClick={clearCustomer}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-100"
              >
                <X className="w-3.5 h-3.5 text-surface-400" />
              </button>
            )}
          </div>
          {errors.customerId && (
            <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>
          )}
          {customerSearchOpen && customerResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg overflow-hidden">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-surface-50 transition-colors border-b border-surface-100 last:border-0"
                  onClick={() => selectCustomer(c)}
                >
                  <div className="text-sm font-medium text-primary">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="text-xs text-surface-400">{c.phone}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Plate Number */}
        <div>
          <label className={labelClass}>Plate Number *</label>
          <input
            type="text"
            className={cn(inputClass, "uppercase font-mono", errors.plateNumber && "border-red-400")}
            placeholder="ABC 1234"
            value={form.plateNumber}
            onChange={(e) => setField("plateNumber", e.target.value.toUpperCase())}
            required
          />
        </div>

        {/* Make */}
        <div className="relative">
          <label className={labelClass}>Make *</label>
          <div className="relative">
            <input
              type="text"
              className={cn(inputClass, "pr-8", errors.make && "border-red-400")}
              placeholder="Toyota, Honda, Ford..."
              value={makeQuery}
              onChange={(e) => {
                setMakeQuery(e.target.value);
                setField("make", e.target.value);
                setMakeDropdownOpen(true);
              }}
              onFocus={() => setMakeDropdownOpen(true)}
              onBlur={() => setTimeout(() => setMakeDropdownOpen(false), 150)}
              required
            />
            <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
          {makeDropdownOpen && filteredMakes.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredMakes.map((make) => (
                <button
                  key={make}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 transition-colors border-b border-surface-100 last:border-0"
                  onMouseDown={() => selectMake(make)}
                >
                  {make}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model */}
        <div>
          <label className={labelClass}>Model *</label>
          <input
            type="text"
            className={cn(inputClass, errors.model && "border-red-400")}
            value={form.model}
            onChange={(e) => setField("model", e.target.value)}
            required
          />
        </div>

        {/* Year + Color */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Year</label>
            <input
              type="number"
              className={inputClass}
              min={1900}
              max={2100}
              value={form.year ?? ""}
              onChange={(e) =>
                setField("year", e.target.value ? parseInt(e.target.value, 10) : null)
              }
            />
          </div>
          <div>
            <label className={labelClass}>Color *</label>
            <input
              type="text"
              className={cn(inputClass, errors.color && "border-red-400")}
              value={form.color}
              onChange={(e) => setField("color", e.target.value)}
              required
            />
          </div>
        </div>

        {/* Color Code + VIN */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Color Code</label>
            <input
              type="text"
              className={inputClass}
              value={form.colorCode ?? ""}
              onChange={(e) => setField("colorCode", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>VIN</label>
            <input
              type="text"
              className={cn(inputClass, "font-mono uppercase")}
              value={form.vin ?? ""}
              onChange={(e) => setField("vin", e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {/* Engine Type + Body Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Engine Type</label>
            <select
              className={inputClass}
              value={form.engineType ?? ""}
              onChange={(e) => setField("engineType", e.target.value || null)}
            >
              <option value="">— Select —</option>
              <option value="Gas">Gas</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Body Type *</label>
            <select
              className={inputClass}
              value={form.bodyType}
              onChange={(e) => setField("bodyType", e.target.value)}
              required
            >
              {Object.values(BodyType).map((bt) => (
                <option key={bt} value={bt}>
                  {bt.charAt(0) + bt.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Insurance */}
        <div className="pt-2 border-t border-surface-100">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
            Insurance (optional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Insurance Company</label>
              <input
                type="text"
                className={inputClass}
                value={form.insuranceCompany ?? ""}
                onChange={(e) => setField("insuranceCompany", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Policy Number</label>
              <input
                type="text"
                className={inputClass}
                value={form.policyNumber ?? ""}
                onChange={(e) => setField("policyNumber", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            rows={3}
            className={inputClass}
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </form>
    </SlideOver>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "CHECKED_IN",
  "IN_PROGRESS",
  "QC_PENDING",
  "QC_PASSED",
  "QC_FAILED_REWORK",
  "AWAITING_PAYMENT",
  "PARTIAL_PAYMENT",
  "FULLY_PAID",
]);

function isActiveJob(status: string) {
  return ACTIVE_STATUSES.has(status);
}

// ─── Main client component ─────────────────────────────────────────────────────

interface Props {
  vehicle: VehicleDetail;
}

export function VehicleDetailClient({ vehicle }: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeJob = vehicle.jobOrders.find((jo) => isActiveJob(jo.status));

  // Compute stats
  const totalJobs = vehicle.jobOrders.length;
  const firstVisit =
    vehicle.jobOrders.length > 0
      ? vehicle.jobOrders[vehicle.jobOrders.length - 1].createdAt
      : null;
  const lastVisit =
    vehicle.jobOrders.length > 0 ? vehicle.jobOrders[0].createdAt : null;

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteVehicleAction(vehicle.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Vehicle deleted.");
      router.push("/vehicles");
    } else {
      toast.error(result.error ?? "Could not delete vehicle.");
    }
  }

  function handleEditSuccess() {
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-surface-400">
        <Link href="/vehicles" className="hover:text-surface-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Vehicles
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-primary font-mono font-semibold">
          {formatPlateNumber(vehicle.plateNumber)}
        </span>
      </nav>

      {/* Active Job Callout */}
      {activeJob && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                  Active Job Order
                </p>
                <p className="text-sm font-bold text-amber-900 font-mono">
                  {activeJob.jobOrderNumber}
                </p>
              </div>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold",
                  JOB_ORDER_STATUS_COLORS[activeJob.status as JobOrderStatus] ??
                    "bg-surface-100 text-surface-600"
                )}
              >
                {JOB_ORDER_STATUS_LABELS[activeJob.status as JobOrderStatus] ?? activeJob.status}
              </span>
            </div>
            <Link
              href={`/jobs/${activeJob.id}`}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
            >
              View Job
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        {/* Top section */}
        <div className="bg-[#1A1A2E] px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white font-mono tracking-widest">
                {formatPlateNumber(vehicle.plateNumber)}
              </h1>
              <p className="text-amber-400 text-lg font-semibold mt-1">
                {vehicle.year ? `${vehicle.year} ` : ""}{vehicle.make} {vehicle.model}
              </p>
              <p className="text-slate-400 text-sm mt-0.5">
                {vehicle.bodyType.charAt(0) + vehicle.bodyType.slice(1).toLowerCase()}
                {vehicle.engineType ? ` · ${vehicle.engineType}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 border border-red-900 rounded-lg hover:bg-red-950 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {/* Color */}
          <div>
            <p className="text-xs text-surface-400 font-medium mb-1">Color</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">{vehicle.color}</span>
              {vehicle.colorCode && (
                <span className="text-xs text-surface-400 font-mono bg-surface-100 px-1.5 py-0.5 rounded">
                  {vehicle.colorCode}
                </span>
              )}
            </div>
          </div>

          {/* VIN */}
          {vehicle.vin && (
            <div className="sm:col-span-2">
              <p className="text-xs text-surface-400 font-medium mb-1">VIN</p>
              <span className="text-sm font-mono text-primary tracking-wide">
                {vehicle.vin}
              </span>
            </div>
          )}

          {/* Owner */}
          <div>
            <p className="text-xs text-surface-400 font-medium mb-1 flex items-center gap-1">
              <User className="w-3 h-3" />
              Owner
            </p>
            <Link
              href={`/customers/${vehicle.customer.id}`}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline transition-colors"
            >
              {vehicle.customer.firstName} {vehicle.customer.lastName}
            </Link>
            <p className="text-xs text-surface-400 mt-0.5">{vehicle.customer.phone}</p>
          </div>

          {/* Insurance */}
          {(vehicle.insuranceCompany || vehicle.policyNumber) && (
            <div>
              <p className="text-xs text-surface-400 font-medium mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Insurance
              </p>
              {vehicle.insuranceCompany && (
                <p className="text-sm font-medium text-primary">{vehicle.insuranceCompany}</p>
              )}
              {vehicle.policyNumber && (
                <p className="text-xs text-surface-400 font-mono">{vehicle.policyNumber}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {vehicle.notes && (
            <div className="sm:col-span-3">
              <p className="text-xs text-surface-400 font-medium mb-1">Notes</p>
              <p className="text-sm text-surface-600 leading-relaxed">{vehicle.notes}</p>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="border-t border-surface-100 px-6 py-4 bg-surface-50 flex items-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{totalJobs}</p>
            <p className="text-xs text-surface-400 mt-0.5">Total Jobs</p>
          </div>
          <div className="w-px h-10 bg-surface-200" />
          <div>
            <p className="text-xs text-surface-400 mb-0.5">First Visit</p>
            <p className="text-sm font-medium text-primary">
              {firstVisit ? formatDate(firstVisit as string) : "—"}
            </p>
          </div>
          <div className="w-px h-10 bg-surface-200" />
          <div>
            <p className="text-xs text-surface-400 mb-0.5">Last Visit</p>
            <p className="text-sm font-medium text-primary">
              {lastVisit ? formatDate(lastVisit as string) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Vehicle History Timeline */}
      <div>
        <h2 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-500" />
          Service History
          <span className="text-sm font-normal text-surface-400">
            ({totalJobs} job{totalJobs !== 1 ? "s" : ""})
          </span>
        </h2>

        {vehicle.jobOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-200 py-12 text-center">
            <Car className="w-8 h-8 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-400">No job orders yet for this vehicle.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-surface-200" />

            <div className="space-y-3">
              {vehicle.jobOrders.map((jo, idx) => {
                const statusColor =
                  JOB_ORDER_STATUS_COLORS[jo.status as JobOrderStatus] ??
                  "bg-surface-100 text-surface-600";
                const statusLabel =
                  JOB_ORDER_STATUS_LABELS[jo.status as JobOrderStatus] ?? jo.status;
                const services = jo.tasks.map((t) => t.name).join(", ");
                const isFirst = idx === 0;

                return (
                  <div key={jo.id} className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex-shrink-0 mt-3.5">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 relative",
                          isFirst && isActiveJob(jo.status)
                            ? "bg-amber-50 border-amber-400"
                            : "bg-white border-surface-200"
                        )}
                      >
                        <Wrench
                          className={cn(
                            "w-4 h-4",
                            isFirst && isActiveJob(jo.status)
                              ? "text-amber-500"
                              : "text-surface-400"
                          )}
                        />
                      </div>
                    </div>

                    {/* Entry card */}
                    <div className="flex-1 bg-white rounded-xl border border-surface-200 px-4 py-3 hover:border-surface-300 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/jobs/${jo.id}`}
                            className="font-mono font-bold text-sm text-primary hover:text-amber-600 transition-colors"
                          >
                            {jo.jobOrderNumber}
                          </Link>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-semibold",
                              statusColor
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-surface-400">
                            {formatDate(jo.createdAt as string)}
                          </p>
                          {jo.createdAt !== jo.updatedAt && (
                            <p className="text-xs text-surface-300 mt-0.5">
                              Updated {formatDate(jo.updatedAt as string)}
                            </p>
                          )}
                        </div>
                      </div>

                      {services && (
                        <p className="text-xs text-surface-500 mt-2 leading-relaxed">
                          {services}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit SlideOver */}
      <VehicleEditForm
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={handleEditSuccess}
        vehicle={vehicle}
      />

      {/* Delete ConfirmDialog */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to delete ${formatPlateNumber(vehicle.plateNumber)}? This will also remove all associated records. This action cannot be undone.`}
        confirmLabel="Delete Vehicle"
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}

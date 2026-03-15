"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "@/components/ui/slide-over";
import { createAppointmentAction, updateAppointmentAction } from "@/lib/actions/scheduler-actions";
import { APPOINTMENT_TYPE_LABELS } from "@/types/enums";
import { toast } from "sonner";
import type { CalendarAppointment } from "./calendar-types";

interface AppointmentFormProps {
  open: boolean;
  onClose: () => void;
  appointment?: CalendarAppointment | null;
  defaultDate?: string;
  defaultType?: string;
  estimateId?: string;
  customerId?: string;
  vehicleId?: string;
  onSaved: () => void;
}

export function AppointmentForm({
  open,
  onClose,
  appointment,
  defaultDate,
  defaultType,
  estimateId: estimateIdProp,
  customerId: customerIdProp,
  vehicleId: vehicleIdProp,
  onSaved,
}: AppointmentFormProps) {
  // ── Form state ──────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [type, setType] = useState("ESTIMATE_INSPECTION");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Customer search state ───────────────────────────────────────────────
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<
    Array<{ id: string; firstName: string; lastName: string; phone: string }>
  >([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Vehicle state ───────────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState<
    Array<{
      id: string;
      plateNumber: string;
      make: string;
      model: string;
      year?: number | null;
      color: string;
    }>
  >([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // ── Debounced customer search ───────────────────────────────────────────
  useEffect(() => {
    if (customerQuery.length < 2) {
      setCustomerResults([]);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(customerQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setCustomerResults(data);
          setShowResults(true);
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Fetch vehicles when customer selected ───────────────────────────────
  const fetchVehicles = useCallback(async (custId: string) => {
    setLoadingVehicles(true);
    try {
      const res = await fetch(`/api/customers/${custId}/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomer?.id) {
      fetchVehicles(selectedCustomer.id);
    }
  }, [selectedCustomer?.id, fetchVehicles]);

  // ── Reset / pre-fill form when opening ──────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (appointment) {
      // Edit mode: populate from appointment
      setSelectedCustomer({
        id: appointment.customer.id,
        firstName: appointment.customer.firstName,
        lastName: appointment.customer.lastName,
      });
      setVehicleId(appointment.vehicleId || "");
      setEstimateId(appointment.estimateId || "");
      setType(appointment.type);
      setDate(appointment.scheduledDate.split("T")[0]);
      setTime(appointment.scheduledTime);
      setDuration(String(appointment.duration));
      setNotes(appointment.notes || "");
      setCustomerQuery("");
      setShowResults(false);
    } else {
      // Create mode: reset + apply defaults
      setSelectedCustomer(null);
      setVehicleId(vehicleIdProp || "");
      setEstimateId(estimateIdProp || "");
      setType(defaultType || "ESTIMATE_INSPECTION");
      setDate(defaultDate || "");
      setTime("09:00");
      setDuration("60");
      setNotes("");
      setCustomerQuery("");
      setCustomerResults([]);
      setShowResults(false);
      setVehicles([]);
    }
  }, [open, appointment, defaultDate, defaultType, estimateIdProp, vehicleIdProp, customerIdProp]);

  // ── If customerId prop provided in create mode, fetch customer info ─────
  useEffect(() => {
    if (!open || appointment || !customerIdProp) return;
    // We set a minimal customer from the prop; vehicles will auto-fetch
    // We don't have the name, so fetch vehicles list and set id only
    setSelectedCustomer((prev) => {
      if (prev?.id === customerIdProp) return prev;
      return { id: customerIdProp, firstName: "", lastName: "" };
    });
  }, [open, appointment, customerIdProp]);

  // ── Auto-select vehicle when vehicles load and vehicleIdProp set ────────
  useEffect(() => {
    if (vehicleIdProp && vehicles.length > 0) {
      const match = vehicles.find((v) => v.id === vehicleIdProp);
      if (match) setVehicleId(match.id);
    }
  }, [vehicleIdProp, vehicles]);

  // ── Select a customer from search results ───────────────────────────────
  const handleSelectCustomer = (cust: {
    id: string;
    firstName: string;
    lastName: string;
  }) => {
    setSelectedCustomer(cust);
    setCustomerQuery("");
    setShowResults(false);
    setVehicleId("");
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    const formData = {
      customerId: selectedCustomer?.id || "",
      vehicleId: vehicleId || null,
      estimateId: estimateId || null,
      type,
      scheduledDate: date,
      scheduledTime: time,
      duration: parseInt(duration),
      notes: notes || null,
    };

    const result = appointment
      ? await updateAppointmentAction(appointment.id, formData)
      : await createAppointmentAction(formData);

    if (result.success) {
      toast.success(
        appointment ? "Appointment updated" : "Appointment created"
      );
      onSaved();
      onClose();
    } else {
      toast.error(result.error || "Something went wrong");
    }
    setSaving(false);
  };

  // ── Input classes ───────────────────────────────────────────────────────
  const inputClass =
    "w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent";
  const labelClass = "text-sm font-medium text-surface-700 mb-1";

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={appointment ? "Edit Appointment" : "New Appointment"}
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-600 hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedCustomer || !date || !time}
            className="px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-semibold hover:bg-accent-700 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : appointment
                ? "Update"
                : "Create Appointment"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Customer Search */}
        <div>
          <label className={labelClass}>Customer</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between px-3 py-2 bg-surface-50 border border-surface-200 rounded-lg">
              <span className="text-sm font-medium text-primary">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setVehicleId("");
                  setVehicles([]);
                  setCustomerQuery("");
                }}
                className="text-xs text-accent-600 hover:text-accent-700 font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search by name or phone..."
                className={inputClass}
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5 text-xs text-surface-400">
                  Searching...
                </div>
              )}
              {showResults && customerResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customerResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className="px-3 py-2 hover:bg-surface-50 cursor-pointer text-sm"
                    >
                      <span className="font-medium">
                        {cust.firstName} {cust.lastName}
                      </span>
                      <span className="ml-2 text-surface-400">
                        {cust.phone}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {showResults && customerResults.length === 0 && !isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg">
                  <div className="px-3 py-2 text-sm text-surface-400">
                    No customers found
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vehicle */}
        <div>
          <label className={labelClass}>Vehicle</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!selectedCustomer || loadingVehicles}
            className={inputClass}
          >
            <option value="">
              {loadingVehicles
                ? "Loading vehicles..."
                : !selectedCustomer
                  ? "Select a customer first"
                  : "Select a vehicle"}
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} - {v.make} {v.model}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            {Object.entries(APPOINTMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Time */}
        <div>
          <label className={labelClass}>Time</label>
          <input
            type="time"
            step="900"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Duration */}
        <div>
          <label className={labelClass}>Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={inputClass}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes..."
            className={inputClass}
          />
        </div>
      </div>
    </SlideOver>
  );
}

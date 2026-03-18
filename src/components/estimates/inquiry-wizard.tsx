"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Search,
  Car,
  User,
  FileText,
  Camera,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SERVICE_CATEGORIES, VEHICLE_MAKES } from "@/lib/constants";
import { PRIORITY_OPTIONS } from "@/types/enums";
import { createEstimateRequestAction } from "@/lib/actions/estimate-actions";
import { createCustomerAction } from "@/lib/actions/customer-actions";
import { createVehicleAction } from "@/lib/actions/vehicle-actions";
import { formatPlateNumber, formatPhone, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CustomerResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
}

interface VehicleResult {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  color: string;
  jobOrders?: { id: string; jobOrderNumber: string; status: string; createdAt: string }[];
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
const STEPS = [
  { label: "Customer", icon: User },
  { label: "Vehicle", icon: Car },
  { label: "Concerns", icon: FileText },
  { label: "Photos", icon: Camera },
  { label: "Review", icon: ClipboardCheck },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function InquiryWizard() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1 — Customer
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // New customer inline form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Step 2 — Vehicle
  const [vehicleId, setVehicleId] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleResult | null>(null);
  const [vehicles, setVehicles] = useState<VehicleResult[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);

  // New vehicle inline form
  const [newPlate, setNewPlate] = useState("");
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newColor, setNewColor] = useState("");
  const [creatingVehicle, setCreatingVehicle] = useState(false);

  // Step 3 — Concerns
  const [customerConcern, setCustomerConcern] = useState("");
  const [requestedCategories, setRequestedCategories] = useState<string[]>([]);
  const [priority, setPriority] = useState("NORMAL");
  const [isInsuranceClaim, setIsInsuranceClaim] = useState(false);
  const [claimNumber, setClaimNumber] = useState("");
  const [adjusterName, setAdjusterName] = useState("");
  const [adjusterContact, setAdjusterContact] = useState("");

  // Step 5 — Submit
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Customer search (debounced)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (customerQuery.length < 2) {
      setCustomerResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(customerQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomerResults(data);
          setShowResults(true);
        }
      } catch {
        // silently ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Close results dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch vehicles when customer is selected
  // ---------------------------------------------------------------------------
  const fetchVehicles = useCallback(async (custId: string) => {
    setLoadingVehicles(true);
    try {
      const res = await fetch(`/api/customers/${custId}/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    if (customerId) {
      fetchVehicles(customerId);
    }
  }, [customerId, fetchVehicles]);

  // ---------------------------------------------------------------------------
  // Priority → insurance flag sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setIsInsuranceClaim(priority === "INSURANCE");
  }, [priority]);

  // ---------------------------------------------------------------------------
  // Inline customer creation
  // ---------------------------------------------------------------------------
  const handleCreateCustomer = async () => {
    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim()) {
      toast.error("First name, last name, and phone are required.");
      return;
    }
    setCreatingCustomer(true);
    try {
      const result = await createCustomerAction({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || null,
        tags: [],
      });
      if (result.success && result.data?.id) {
        const created: CustomerResult = {
          id: result.data.id as string,
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || null,
        };
        setSelectedCustomer(created);
        setCustomerId(created.id);
        setShowNewCustomerForm(false);
        setNewFirstName("");
        setNewLastName("");
        setNewPhone("");
        setNewEmail("");
        toast.success("Customer created successfully.");
      } else {
        toast.error(result.error || "Failed to create customer.");
      }
    } catch {
      toast.error("An error occurred while creating the customer.");
    } finally {
      setCreatingCustomer(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Inline vehicle creation
  // ---------------------------------------------------------------------------
  const handleCreateVehicle = async () => {
    if (!newPlate.trim() || !newMake.trim() || !newModel.trim() || !newColor.trim()) {
      toast.error("Plate, make, model, and color are required.");
      return;
    }
    setCreatingVehicle(true);
    try {
      const result = await createVehicleAction({
        customerId,
        plateNumber: newPlate.trim(),
        make: newMake.trim(),
        model: newModel.trim(),
        year: newYear ? parseInt(newYear, 10) : null,
        color: newColor.trim(),
        bodyType: "SEDAN",
      });
      if (result.success && result.data?.id) {
        const created: VehicleResult = {
          id: result.data.id as string,
          plateNumber: newPlate.trim().replace(/[\s-]/g, "").toUpperCase(),
          make: newMake.trim(),
          model: newModel.trim(),
          year: newYear ? parseInt(newYear, 10) : null,
          color: newColor.trim(),
          jobOrders: [],
        };
        setVehicles((prev) => [created, ...prev]);
        setSelectedVehicle(created);
        setVehicleId(created.id);
        setShowNewVehicleForm(false);
        setNewPlate("");
        setNewMake("");
        setNewModel("");
        setNewYear("");
        setNewColor("");
        toast.success("Vehicle added successfully.");
      } else {
        toast.error(result.error || "Failed to add vehicle.");
      }
    } catch {
      toast.error("An error occurred while adding the vehicle.");
    } finally {
      setCreatingVehicle(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await createEstimateRequestAction({
        customerId,
        vehicleId,
        customerConcern,
        requestedCategories,
        priority,
        isInsuranceClaim,
        claimNumber: isInsuranceClaim ? claimNumber || null : null,
        adjusterName: isInsuranceClaim ? adjusterName || null : null,
        adjusterContact: isInsuranceClaim ? adjusterContact || null : null,
      });
      if (result.success && result.data?.id) {
        toast.success(`Estimate request ${result.data.requestNumber} created!`);
        router.push(`/estimates/${result.data.id}`);
      } else {
        toast.error(result.error || "Failed to create estimate request.");
      }
    } catch {
      toast.error("An error occurred while creating the estimate request.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step navigation validation
  // ---------------------------------------------------------------------------
  const canProceed = (s: number) => {
    switch (s) {
      case 1:
        return !!customerId;
      case 2:
        return !!vehicleId;
      case 3:
        return customerConcern.trim().length > 0 && requestedCategories.length > 0;
      case 4:
        return true; // photos step is optional
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed(step) && step < 5) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // ---------------------------------------------------------------------------
  // Category checkbox toggle
  // ---------------------------------------------------------------------------
  const toggleCategory = (cat: string) => {
    setRequestedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Step Indicator
  // ---------------------------------------------------------------------------
  const renderStepper = () => (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isCompleted = step > stepNum;
        const isCurrent = step === stepNum;
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && "bg-accent text-white",
                  !isCompleted && !isCurrent && "border-2 border-surface-300 text-surface-400"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1 font-medium",
                  isCurrent ? "text-accent-600" : "text-surface-400"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-10 h-0.5 mx-1 mt-[-12px]",
                  step > stepNum ? "bg-green-500" : "bg-surface-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Step 1 — Customer
  // ---------------------------------------------------------------------------
  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">Select Customer</h2>

      {selectedCustomer ? (
        <div className="bg-white rounded-xl border border-accent ring-2 ring-accent-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-primary">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </p>
              <p className="text-sm text-surface-500">{formatPhone(selectedCustomer.phone)}</p>
              {selectedCustomer.email && (
                <p className="text-sm text-surface-400">{selectedCustomer.email}</p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerId("");
                setCustomerQuery("");
                setVehicleId("");
                setSelectedVehicle(null);
                setVehicles([]);
              }}
              className="text-surface-400 hover:text-danger"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 animate-spin" />
              )}
            </div>

            {showResults && customerResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerId(c.id);
                      setShowResults(false);
                      setCustomerQuery("");
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-50 border-b border-surface-100 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-primary">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-surface-400">{formatPhone(c.phone)}</p>
                  </button>
                ))}
              </div>
            )}

            {showResults && customerQuery.length >= 2 && customerResults.length === 0 && !isSearching && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg p-4 text-center text-sm text-surface-400">
                No customers found.
              </div>
            )}
          </div>

          {/* Create New Customer */}
          {!showNewCustomerForm ? (
            <button
              onClick={() => setShowNewCustomerForm(true)}
              className="flex items-center gap-2 text-sm text-accent hover:text-accent-600 font-medium"
            >
              <Plus className="w-4 h-4" />
              Create New Customer
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">New Customer</h3>
                <button onClick={() => setShowNewCustomerForm(false)} className="text-surface-400 hover:text-danger">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Phone *</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateCustomer}
                disabled={creatingCustomer}
                className="bg-accent text-white hover:bg-accent-600 font-semibold rounded-xl px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {creatingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Customer
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Step 2 — Vehicle
  // ---------------------------------------------------------------------------
  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">Select Vehicle</h2>

      {loadingVehicles ? (
        <div className="flex items-center gap-2 text-sm text-surface-400 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading vehicles...
        </div>
      ) : (
        <>
          {vehicles.length === 0 && !showNewVehicleForm && (
            <p className="text-sm text-surface-400">No vehicles on file for this customer.</p>
          )}

          <div className="grid gap-3">
            {vehicles.map((v) => {
              const isSelected = vehicleId === v.id;
              const hasHistory = v.jobOrders && v.jobOrders.length > 0;
              return (
                <div key={v.id}>
                  <button
                    onClick={() => {
                      setSelectedVehicle(v);
                      setVehicleId(v.id);
                    }}
                    className={cn(
                      "w-full text-left bg-white rounded-xl border p-4 transition-colors",
                      isSelected
                        ? "border-accent ring-2 ring-accent-200"
                        : "border-surface-200 hover:border-surface-300"
                    )}
                  >
                    <p className="font-bold font-mono text-primary">
                      {formatPlateNumber(v.plateNumber)}
                    </p>
                    <p className="text-sm text-surface-500">
                      {[v.year, v.make, v.model].filter(Boolean).join(" ")} &middot; {v.color}
                    </p>
                  </button>
                  {isSelected && hasHistory && (
                    <div className="mt-2 flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2 text-sm text-warning-700">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        This vehicle has been here before.{" "}
                        <Link href={`/vehicles/${v.id}`} className="underline font-medium">
                          View History &rarr;
                        </Link>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New Vehicle */}
          {!showNewVehicleForm ? (
            <button
              onClick={() => setShowNewVehicleForm(true)}
              className="flex items-center gap-2 text-sm text-accent hover:text-accent-600 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add New Vehicle
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">New Vehicle</h3>
                <button onClick={() => setShowNewVehicleForm(false)} className="text-surface-400 hover:text-danger">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Plate Number *</label>
                  <input
                    type="text"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="ABC 1234"
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Make *</label>
                  <select
                    value={newMake}
                    onChange={(e) => setNewMake(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  >
                    <option value="">Select make</option>
                    {VEHICLE_MAKES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Model *</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="2024"
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Color *</label>
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="e.g. White"
                    className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateVehicle}
                disabled={creatingVehicle}
                className="bg-accent text-white hover:bg-accent-600 font-semibold rounded-xl px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {creatingVehicle && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Vehicle
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Step 3 — Concerns
  // ---------------------------------------------------------------------------
  const renderStep3 = () => (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-primary">Concern Details</h2>

      {/* Customer concern */}
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">
          Customer Concern *
        </label>
        <textarea
          value={customerConcern}
          onChange={(e) => setCustomerConcern(e.target.value)}
          rows={4}
          placeholder="Describe the customer's concern or requested work..."
          className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 resize-none"
        />
      </div>

      {/* Service categories */}
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-2">
          Service Categories * <span className="font-normal text-surface-400">(select at least one)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_CATEGORIES.map((cat) => (
            <label
              key={cat}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors",
                requestedCategories.includes(cat)
                  ? "bg-accent-50 border-accent-300 text-accent-700"
                  : "bg-white border-surface-200 text-surface-600 hover:border-surface-300"
              )}
            >
              <input
                type="checkbox"
                checked={requestedCategories.includes(cat)}
                onChange={() => toggleCategory(cat)}
                className="accent-accent w-4 h-4"
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-surface-500 mb-2">Priority</label>
        <div className="flex gap-3">
          {PRIORITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors",
                priority === opt.value
                  ? "bg-accent-50 border-accent-300 text-accent-700"
                  : "bg-white border-surface-200 text-surface-600 hover:border-surface-300"
              )}
            >
              <input
                type="radio"
                name="priority"
                value={opt.value}
                checked={priority === opt.value}
                onChange={(e) => setPriority(e.target.value)}
                className="accent-accent"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Insurance conditional fields */}
      {priority === "INSURANCE" && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-warning-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Insurance Claim Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Claim Number</label>
              <input
                type="text"
                value={claimNumber}
                onChange={(e) => setClaimNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Adjuster Name</label>
              <input
                type="text"
                value={adjusterName}
                onChange={(e) => setAdjusterName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Adjuster Contact</label>
              <input
                type="text"
                value={adjusterContact}
                onChange={(e) => setAdjusterContact(e.target.value)}
                placeholder="Phone or email"
                className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Step 4 — Photos (placeholder)
  // ---------------------------------------------------------------------------
  const renderStep4 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">Photos</h2>
      <button
        type="button"
        onClick={handleNext}
        className="w-full border-2 border-dashed border-surface-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer"
      >
        <Camera className="w-12 h-12 text-surface-300 mb-3" />
        <p className="text-sm text-surface-500 font-medium">
          Photos can be added after creating the estimate request.
        </p>
        <span className="text-sm text-accent hover:text-accent-600 underline underline-offset-2 font-medium mt-2 inline-flex items-center gap-1">
          Skip for now
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Step 5 — Review
  // ---------------------------------------------------------------------------
  const renderStep5 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">Review &amp; Submit</h2>

      {/* Customer */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <p className="text-xs font-medium text-surface-400 mb-1">Customer</p>
        {selectedCustomer && (
          <div>
            <p className="font-semibold text-primary">
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </p>
            <p className="text-sm text-surface-500">{formatPhone(selectedCustomer.phone)}</p>
          </div>
        )}
      </div>

      {/* Vehicle */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <p className="text-xs font-medium text-surface-400 mb-1">Vehicle</p>
        {selectedVehicle && (
          <div>
            <p className="font-bold font-mono text-primary">
              {formatPlateNumber(selectedVehicle.plateNumber)}
            </p>
            <p className="text-sm text-surface-500">
              {[selectedVehicle.year, selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ")}{" "}
              &middot; {selectedVehicle.color}
            </p>
          </div>
        )}
      </div>

      {/* Concern */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <p className="text-xs font-medium text-surface-400 mb-1">Concern</p>
        <p className="text-sm text-primary whitespace-pre-wrap">{customerConcern}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {requestedCategories.map((cat) => (
            <Badge key={cat} variant="accent">{cat}</Badge>
          ))}
        </div>
        <div className="mt-2">
          <Badge variant={priority === "INSURANCE" ? "warning" : priority === "RUSH" ? "danger" : "default"}>
            {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label || priority}
          </Badge>
        </div>
      </div>

      {/* Insurance info */}
      {isInsuranceClaim && (claimNumber || adjusterName || adjusterContact) && (
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <p className="text-xs font-medium text-surface-400 mb-1">Insurance Details</p>
          {claimNumber && (
            <p className="text-sm text-surface-600">
              <span className="text-surface-400">Claim #:</span> {claimNumber}
            </p>
          )}
          {adjusterName && (
            <p className="text-sm text-surface-600">
              <span className="text-surface-400">Adjuster:</span> {adjusterName}
            </p>
          )}
          {adjusterContact && (
            <p className="text-sm text-surface-600">
              <span className="text-surface-400">Contact:</span> {adjusterContact}
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-accent text-white hover:bg-accent-600 font-semibold rounded-xl px-6 py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Estimate Request"
        )}
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto">
      {renderStepper()}

      <div className="min-h-[300px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={cn(
              "flex items-center gap-1 px-4 py-2 text-sm rounded-xl font-medium transition-colors",
              step === 1
                ? "text-surface-300 cursor-not-allowed"
                : "text-surface-500 hover:text-primary hover:bg-surface-100"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed(step)}
            className={cn(
              "flex items-center gap-1 px-5 py-2 text-sm rounded-xl font-semibold transition-colors",
              canProceed(step)
                ? "bg-accent text-white hover:bg-accent-600"
                : "bg-surface-200 text-surface-400 cursor-not-allowed"
            )}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

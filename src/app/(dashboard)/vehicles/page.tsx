"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Car, Search, X, ChevronDown } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { SlideOver } from "@/components/ui/slide-over";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatPlateNumber } from "@/lib/utils";
import { createVehicleAction, updateVehicleAction } from "@/lib/actions/vehicle-actions";
import { VEHICLE_MAKES } from "@/lib/constants";
import { BodyType, JOB_ORDER_STATUS_COLORS } from "@/types/enums";
import type { VehicleInput } from "@/lib/validators";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface ActiveJob {
  id: string;
  jobOrderNumber: string;
  status: string;
}

interface VehicleRow {
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
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count: { jobOrders: number };
  jobOrders: ActiveJob[];
  updatedAt: string;
  createdAt: string;
}

interface VehicleListResult {
  vehicles: VehicleRow[];
  total: number;
  pageCount: number;
}

// ─── VehicleForm ───────────────────────────────────────────────────────────────

interface VehicleFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle?: VehicleRow | null;
}

function VehicleForm({ open, onClose, onSuccess, vehicle }: VehicleFormProps) {
  const isEditing = !!vehicle;

  const [form, setForm] = useState<VehicleInput>({
    customerId: "",
    plateNumber: "",
    make: "",
    model: "",
    year: null,
    color: "",
    colorCode: "",
    vin: "",
    engineType: "",
    bodyType: "SEDAN",
    insuranceCompany: "",
    policyNumber: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleInput, string>>>({});

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Make search state
  const [makeQuery, setMakeQuery] = useState("");
  const [makeDropdownOpen, setMakeDropdownOpen] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (vehicle) {
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
      setSelectedCustomer({
        id: vehicle.customerId,
        firstName: vehicle.customer.firstName,
        lastName: vehicle.customer.lastName,
        phone: "",
      });
      setCustomerQuery(`${vehicle.customer.firstName} ${vehicle.customer.lastName}`);
      setMakeQuery(vehicle.make);
    } else {
      setForm({
        customerId: "",
        plateNumber: "",
        make: "",
        model: "",
        year: null,
        color: "",
        colorCode: "",
        vin: "",
        engineType: "",
        bodyType: "SEDAN",
        insuranceCompany: "",
        policyNumber: "",
        notes: "",
      });
      setSelectedCustomer(null);
      setCustomerQuery("");
      setMakeQuery("");
    }
    setErrors({});
    setCustomerResults([]);
    setCustomerSearchOpen(false);
  }, [vehicle, open]);

  // Customer search debounce
  useEffect(() => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (customerQuery.length < 2 || selectedCustomer) {
      if (!selectedCustomer) setCustomerResults([]);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(customerQuery)}`);
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
    setSelectedCustomer(null);
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

    const result = isEditing
      ? await updateVehicleAction(vehicle!.id, payload)
      : await createVehicleAction(payload);

    setSubmitting(false);

    if (result.success) {
      toast.success(isEditing ? "Vehicle updated." : "Vehicle added.");
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
      title={isEditing ? "Edit Vehicle" : "New Vehicle"}
      description={
        isEditing
          ? `Editing ${formatPlateNumber(vehicle?.plateNumber ?? "")}`
          : "Register a new vehicle"
      }
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
            form="vehicle-form"
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>
      }
    >
      <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-4">

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
                const val = e.target.value;
                setCustomerQuery(val);
                if (selectedCustomer) {
                  setSelectedCustomer(null);
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
          {errors.plateNumber && (
            <p className="text-xs text-red-500 mt-1">{errors.plateNumber}</p>
          )}
        </div>

        {/* Make (searchable dropdown) */}
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
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
          {errors.make && (
            <p className="text-xs text-red-500 mt-1">{errors.make}</p>
          )}
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
            placeholder="Fortuner, Civic, Ranger..."
            value={form.model}
            onChange={(e) => setField("model", e.target.value)}
            required
          />
          {errors.model && (
            <p className="text-xs text-red-500 mt-1">{errors.model}</p>
          )}
        </div>

        {/* Year + Color */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Year</label>
            <input
              type="number"
              className={inputClass}
              placeholder="2020"
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
              placeholder="Pearl White"
              value={form.color}
              onChange={(e) => setField("color", e.target.value)}
              required
            />
            {errors.color && (
              <p className="text-xs text-red-500 mt-1">{errors.color}</p>
            )}
          </div>
        </div>

        {/* Color Code + VIN */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Color Code</label>
            <input
              type="text"
              className={inputClass}
              placeholder="040 / NH-788P"
              value={form.colorCode ?? ""}
              onChange={(e) => setField("colorCode", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>VIN</label>
            <input
              type="text"
              className={cn(inputClass, "font-mono uppercase")}
              placeholder="1HGBH41JXMN109186"
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
                placeholder="Malayan, Pioneer..."
                value={form.insuranceCompany ?? ""}
                onChange={(e) => setField("insuranceCompany", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Policy Number</label>
              <input
                type="text"
                className={inputClass}
                placeholder="POL-0000000"
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
            placeholder="Internal notes about this vehicle..."
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </form>
    </SlideOver>
  );
}

// ─── Table columns ─────────────────────────────────────────────────────────────

function buildColumns(
  onOwnerClick: (customerId: string, e: React.MouseEvent) => void
): ColumnDef<VehicleRow, unknown>[] {
  return [
    {
      accessorKey: "plateNumber",
      header: "Plate Number",
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="font-mono font-bold text-primary tracking-wider">
          {formatPlateNumber(getValue() as string)}
        </span>
      ),
    },
    {
      id: "makeModel",
      header: "Make / Model",
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-primary text-sm">
            {row.original.make} {row.original.model}
          </div>
          <div className="text-xs text-surface-400 mt-0.5">
            {row.original.bodyType.charAt(0) + row.original.bodyType.slice(1).toLowerCase()}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "year",
      header: "Year",
      enableSorting: true,
      cell: ({ getValue }) => {
        const yr = getValue() as number | null;
        return <span className="text-sm text-surface-600">{yr ?? "—"}</span>;
      },
    },
    {
      accessorKey: "color",
      header: "Color",
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <span className="text-sm text-surface-700">{row.original.color}</span>
          {row.original.colorCode && (
            <span className="text-xs text-surface-400 ml-1">
              ({row.original.colorCode})
            </span>
          )}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => onOwnerClick(row.original.customer.id, e)}
          className="text-sm text-amber-600 hover:text-amber-700 hover:underline font-medium transition-colors"
        >
          {row.original.customer.firstName} {row.original.customer.lastName}
        </button>
      ),
    },
    {
      id: "activeJob",
      header: "Active Job",
      enableSorting: false,
      cell: ({ row }) => {
        const activeJob = row.original.jobOrders[0];
        if (!activeJob) return <span className="text-surface-300 text-sm">—</span>;
        const colorClass =
          JOB_ORDER_STATUS_COLORS[activeJob.status as keyof typeof JOB_ORDER_STATUS_COLORS] ??
          "bg-surface-100 text-surface-600";
        return (
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", colorClass)}>
            {activeJob.jobOrderNumber}
          </span>
        );
      },
    },
    {
      id: "totalJobs",
      header: "Total Jobs",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-surface-500">{row.original._count.jobOrders}</span>
      ),
    },
  ];
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const router = useRouter();

  const [data, setData] = useState<VehicleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filterMake, setFilterMake] = useState("");
  const [filterBodyType, setFilterBodyType] = useState("");

  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleRow | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPageIndex(0);
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sort = sorting[0];
      const params = new URLSearchParams({
        page: String(pageIndex + 1),
        pageSize: "25",
        sortBy: sort?.id ?? "updatedAt",
        sortOrder: sort?.desc ? "desc" : "asc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterMake) params.set("make", filterMake);
      if (filterBodyType) params.set("bodyType", filterBodyType);

      const res = await fetch(`/api/vehicles?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch vehicles");

      const result: VehicleListResult = await res.json();
      setData(result.vehicles);
      setTotal(result.total);
      setPageCount(result.pageCount);
    } catch {
      toast.error("Could not load vehicles.");
    } finally {
      setLoading(false);
    }
  }, [pageIndex, sorting, debouncedSearch, filterMake, filterBodyType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleRowClick(row: VehicleRow) {
    router.push(`/vehicles/${row.id}`);
  }

  function handleOwnerClick(customerId: string, e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/customers/${customerId}`);
  }

  const columns = buildColumns(handleOwnerClick);

  function handleNewVehicle() {
    setEditVehicle(null);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditVehicle(null);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Vehicles</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {loading
              ? "Loading..."
              : `${total.toLocaleString()} vehicle${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={handleNewVehicle}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search plate, make, model, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-100 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-surface-400" />
            </button>
          )}
        </div>

        {/* Make filter */}
        <select
          value={filterMake}
          onChange={(e) => {
            setFilterMake(e.target.value);
            setPageIndex(0);
          }}
          className="px-3 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors text-surface-700"
        >
          <option value="">All Makes</option>
          {VEHICLE_MAKES.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </select>

        {/* Body type filter */}
        <select
          value={filterBodyType}
          onChange={(e) => {
            setFilterBodyType(e.target.value);
            setPageIndex(0);
          }}
          className="px-3 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors text-surface-700"
        >
          <option value="">All Body Types</option>
          {Object.values(BodyType).map((bt) => (
            <option key={bt} value={bt}>
              {bt.charAt(0) + bt.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(filterMake || filterBodyType) && (
          <button
            onClick={() => {
              setFilterMake("");
              setFilterBodyType("");
              setPageIndex(0);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-surface-500 hover:text-surface-700 border border-surface-200 rounded-xl hover:bg-surface-50 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={25}
        sorting={sorting}
        onSortingChange={setSorting}
        onPageChange={setPageIndex}
        onRowClick={handleRowClick}
        isLoading={loading}
        emptyState={
          <EmptyState
            icon={Car}
            title={
              search || filterMake || filterBodyType
                ? "No vehicles found"
                : "No vehicles yet"
            }
            description={
              search || filterMake || filterBodyType
                ? "No vehicles match the current filters. Try adjusting your search."
                : "Add your first vehicle to get started."
            }
            action={
              !search && !filterMake && !filterBodyType ? (
                <button
                  onClick={handleNewVehicle}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Vehicle
                </button>
              ) : undefined
            }
          />
        }
      />

      {/* Vehicle Form SlideOver */}
      <VehicleForm
        open={showForm}
        onClose={handleFormClose}
        onSuccess={fetchData}
        vehicle={editVehicle}
      />
    </div>
  );
}

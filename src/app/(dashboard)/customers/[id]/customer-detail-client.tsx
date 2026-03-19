"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building2,
  UserCheck,
  Car,
  Plus,
  FileText,
  StickyNote,
  Shield,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { SlideOver } from "@/components/ui/slide-over";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import {
  formatPeso,
  formatDate,
  formatPhone,
  cn,
} from "@/lib/utils";
import {
  updateCustomerAction,
  deleteCustomerAction,
  toggleSmsOptOutAction,
} from "@/lib/actions/customer-actions";
import { JOB_ORDER_STATUS_LABELS, JOB_ORDER_STATUS_COLORS, type JobOrderStatus } from "@/types/enums";
import type { CustomerInput } from "@/lib/validators";

// ─── Types ────────────────────────────────────────────────────────────────────

type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  color: string;
};

type JobOrder = {
  id: string;
  joNumber: string;
  status: string;
  createdAt: string | Date;
  vehicle: {
    plateNumber: string;
    make: string;
    model: string;
  } | null;
};

type CustomerDetail = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneAlt: string | null;
  email: string | null;
  address: string | null;
  company: string | null;
  referredBy: string | null;
  notes: string | null;
  tags: string;
  smsOptOut: boolean;
  jobCount: number;
  totalSpend: number;
  lastVisit: string | Date | null;
  firstVisit: string | Date | null;
  createdAt: string | Date;
  vehicles: Vehicle[];
  jobOrders: JobOrder[];
};

// ─── Tag helpers ───────────────────────────────────────────────────────────────

const CUSTOMER_TAGS = ["VIP", "Fleet", "Insurance", "Regular", "Walk-in", "Referred"] as const;

function tagVariant(
  tag: string
): "accent" | "warning" | "success" | "default" | "outline" {
  switch (tag) {
    case "VIP":
      return "accent";
    case "Fleet":
      return "warning";
    case "Insurance":
      return "success";
    default:
      return "outline";
  }
}

function parseTags(tagsJson: string): string[] {
  try {
    return JSON.parse(tagsJson ?? "[]");
  } catch {
    return [];
  }
}

// ─── CustomerForm (edit mode) ──────────────────────────────────────────────────

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: Partial<CustomerDetail>) => void;
  customer: CustomerDetail;
}

function CustomerForm({ open, onClose, onSuccess, customer }: CustomerFormProps) {
  const [form, setForm] = useState<CustomerInput>({
    firstName: "",
    lastName: "",
    phone: "",
    phoneAlt: "",
    email: "",
    address: "",
    company: "",
    referredBy: "",
    notes: "",
    tags: [],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        phoneAlt: customer.phoneAlt ?? "",
        email: customer.email ?? "",
        address: customer.address ?? "",
        company: customer.company ?? "",
        referredBy: customer.referredBy ?? "",
        notes: customer.notes ?? "",
        tags: parseTags(customer.tags),
      });
    }
  }, [open, customer]);

  function setField<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tag: string) {
    setForm((prev) => {
      const current = prev.tags ?? [];
      return {
        ...prev,
        tags: current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: CustomerInput = {
      ...form,
      email: form.email || null,
      phoneAlt: form.phoneAlt || null,
      address: form.address || null,
      company: form.company || null,
      referredBy: form.referredBy || null,
      notes: form.notes || null,
    };

    const result = await updateCustomerAction(customer.id, payload);
    setSubmitting(false);

    if (result.success) {
      toast.success("Customer updated.");
      onSuccess({ ...payload, tags: JSON.stringify(form.tags) } as unknown as Partial<CustomerDetail>);
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
      title="Edit Customer"
      description={`${customer.firstName} ${customer.lastName}`}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors touch-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-customer-form"
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors touch-target"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      }
    >
      <form id="edit-customer-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Juan"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input
              type="text"
              className={inputClass}
              placeholder="dela Cruz"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Phone *</label>
            <input
              type="tel"
              className={inputClass}
              placeholder="09XX XXX XXXX"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Alt Phone</label>
            <input
              type="tel"
              className={inputClass}
              placeholder="Optional"
              value={form.phoneAlt ?? ""}
              onChange={(e) => setField("phoneAlt", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            className={inputClass}
            placeholder="juan@example.com"
            value={form.email ?? ""}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Company / Business</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Optional"
            value={form.company ?? ""}
            onChange={(e) => setField("company", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Street, Barangay, City"
            value={form.address ?? ""}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Referred By</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Name or source"
            value={form.referredBy ?? ""}
            onChange={(e) => setField("referredBy", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Tags</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {CUSTOMER_TAGS.map((tag) => {
              const selected = (form.tags ?? []).includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    selected
                      ? "bg-accent text-white border-accent"
                      : "bg-white text-surface-500 border-surface-200 hover:border-accent-300"
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Internal notes..."
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </form>
    </SlideOver>
  );
}

// ─── Warranty & Follow-up types ────────────────────────────────────────────────

type WarrantyInfo = {
  id: string;
  serviceCategory: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  jobOrder: { jobOrderNumber: string };
};

type FollowUpInfo = {
  id: string;
  type: string;
  title: string;
  scheduledAt: string;
  metadata: string | null;
};

// ─── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "vehicles" | "jobs" | "notes" | "followups";

// ─── Main client component ─────────────────────────────────────────────────────

interface CustomerDetailClientProps {
  customer: CustomerDetail;
  warranties?: WarrantyInfo[];
  followUps?: FollowUpInfo[];
}

export function CustomerDetailClient({ customer: initialCustomer, warranties, followUps }: CustomerDetailClientProps) {
  const router = useRouter();

  // Merge local edits on top of server data
  const [customer, setCustomer] = useState<CustomerDetail>(initialCustomer);

  const [activeTab, setActiveTab] = useState<Tab>("vehicles");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(customer.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const tags = parseTags(customer.tags);

  function handleEditSuccess(updated: Partial<CustomerDetail>) {
    setCustomer((prev) => ({ ...prev, ...updated }));
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteCustomerAction(customer.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Customer deleted.");
      router.push("/customers");
    } else {
      toast.error(result.error ?? "Could not delete customer.");
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    const result = await updateCustomerAction(customer.id, { notes: notesValue });
    setSavingNotes(false);
    if (result.success) {
      setCustomer((prev) => ({ ...prev, notes: notesValue }));
      setEditingNotes(false);
      toast.success("Notes saved.");
    } else {
      toast.error(result.error ?? "Could not save notes.");
    }
  }

  const handleToggleSms = useCallback(async (optOut: boolean) => {
    const result = await toggleSmsOptOutAction(customer.id, optOut);
    if (result.success) {
      setCustomer((prev) => ({ ...prev, smsOptOut: optOut }));
      toast.success(optOut ? "SMS notifications disabled" : "SMS notifications enabled");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update");
    }
  }, [customer.id, router]);

  const statClass =
    "flex flex-col items-center justify-center px-6 py-4 bg-white border border-surface-200 rounded-xl";

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <button
          onClick={() => router.push("/customers")}
          className="flex items-center gap-1.5 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Customers
        </button>
        <span>/</span>
        <span className="text-primary font-medium">
          {customer.firstName} {customer.lastName}
        </span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-surface-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Identity */}
          <div className="flex items-start gap-4 min-w-0">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-accent-100 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-accent-700 select-none">
                {customer.firstName.charAt(0)}
                {customer.lastName.charAt(0)}
              </span>
            </div>

            {/* Details */}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary leading-tight">
                {customer.firstName} {customer.lastName}
              </h1>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant={tagVariant(tag)}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Contact info */}
              <div className="mt-3 space-y-1.5">
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-2 text-sm text-surface-600 hover:text-accent-600 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                  <span className="font-mono">{formatPhone(customer.phone)}</span>
                  {customer.phoneAlt && (
                    <span className="text-surface-400 font-mono">
                      · {formatPhone(customer.phoneAlt)}
                    </span>
                  )}
                </a>

                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-2 text-sm text-surface-600 hover:text-accent-600 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    {customer.email}
                  </a>
                )}

                {customer.address && (
                  <div className="flex items-center gap-2 text-sm text-surface-600">
                    <MapPin className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    {customer.address}
                  </div>
                )}

                {customer.company && (
                  <div className="flex items-center gap-2 text-sm text-surface-600">
                    <Building2 className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    {customer.company}
                  </div>
                )}

                {customer.referredBy && (
                  <div className="flex items-center gap-2 text-sm text-surface-600">
                    <UserCheck className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    Referred by {customer.referredBy}
                  </div>
                )}
              </div>

              {/* SMS Opt-out toggle */}
              <div className="flex items-center gap-2 mt-3">
                <MessageSquare className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                <span className="text-sm text-surface-600">SMS Notifications</span>
                <button
                  onClick={() => handleToggleSms(!customer.smsOptOut)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    !customer.smsOptOut ? "bg-green-500" : "bg-surface-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      !customer.smsOptOut ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Member since */}
              <p className="text-xs text-surface-400 mt-3">
                Member since{" "}
                <span className="font-mono">
                  {customer.firstVisit
                    ? formatDate(customer.firstVisit as string)
                    : formatDate(customer.createdAt as string)}
                </span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors touch-target"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-danger-200 text-danger hover:bg-danger-50 transition-colors touch-target"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className={statClass}>
          <span className="text-2xl font-bold font-mono text-primary">
            {customer.jobCount}
          </span>
          <span className="text-xs text-surface-400 mt-0.5">Total Jobs</span>
        </div>
        <div className={statClass}>
          <span className="text-2xl font-bold font-mono text-primary">
            {formatPeso(customer.totalSpend)}
          </span>
          <span className="text-xs text-surface-400 mt-0.5">Total Spend</span>
        </div>
        <div className={statClass}>
          <span className="text-2xl font-bold font-mono text-primary">
            {customer.vehicles.length}
          </span>
          <span className="text-xs text-surface-400 mt-0.5">Vehicles</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-surface-200">
          {(
            [
              { id: "vehicles" as Tab, label: "Vehicles", icon: Car },
              { id: "jobs" as Tab, label: "Job History", icon: FileText },
              { id: "notes" as Tab, label: "Notes", icon: StickyNote },
              { id: "followups" as Tab, label: "Follow-ups", icon: Shield },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors touch-target",
                activeTab === id
                  ? "border-accent text-accent-600 bg-accent-50/30"
                  : "border-transparent text-surface-500 hover:text-primary hover:bg-surface-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "vehicles" && customer.vehicles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-200 text-surface-600 text-xs font-semibold">
                  {customer.vehicles.length}
                </span>
              )}
              {id === "jobs" && customer.jobCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-200 text-surface-600 text-xs font-semibold">
                  {customer.jobCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* Vehicles tab */}
          {activeTab === "vehicles" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">
                  Registered Vehicles
                </h3>
                <button
                  onClick={() =>
                    router.push(`/vehicles/new?customerId=${customer.id}`)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 transition-colors touch-target"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Vehicle
                </button>
              </div>

              {customer.vehicles.length === 0 ? (
                <div className="py-10 flex flex-col items-center text-center">
                  <Car className="w-10 h-10 text-surface-300 mb-3" />
                  <p className="text-sm font-medium text-surface-500">
                    No vehicles on file
                  </p>
                  <p className="text-xs text-surface-400 mt-1">
                    Add a vehicle to start creating job orders.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-surface-100">
                  {customer.vehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => router.push(`/vehicles/${vehicle.id}`)}
                      className="w-full flex items-center gap-4 py-3 text-left hover:bg-surface-50 rounded-lg px-3 -mx-3 transition-colors group touch-target"
                    >
                      <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 group-hover:bg-surface-200 transition-colors">
                        <Car className="w-4 h-4 text-surface-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-primary">
                            {vehicle.plateNumber}
                          </span>
                        </div>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {[vehicle.year, vehicle.make, vehicle.model, vehicle.color]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-surface-300 rotate-180 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Job History tab */}
          {activeTab === "jobs" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">Job History</h3>

              {customer.jobOrders.length === 0 ? (
                <div className="py-10 flex flex-col items-center text-center">
                  <FileText className="w-10 h-10 text-surface-300 mb-3" />
                  <p className="text-sm font-medium text-surface-500">
                    No job orders yet
                  </p>
                  <p className="text-xs text-surface-400 mt-1">
                    Job orders will appear here once created.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-200">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          JO #
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Vehicle
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {customer.jobOrders.map((jo) => {
                        const status = jo.status as JobOrderStatus;
                        const statusColor =
                          JOB_ORDER_STATUS_COLORS[status] ?? "bg-surface-100 text-surface-500";
                        const statusLabel =
                          JOB_ORDER_STATUS_LABELS[status] ?? jo.status;

                        return (
                          <tr
                            key={jo.id}
                            className="hover:bg-surface-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/jobs/${jo.id}`)}
                          >
                            <td className="px-3 py-3">
                              <span className="font-mono text-sm font-semibold text-primary">
                                {jo.joNumber}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-surface-600">
                              {jo.vehicle ? (
                                <span>
                                  <span className="font-mono font-medium">
                                    {jo.vehicle.plateNumber}
                                  </span>
                                  <span className="text-surface-400 ml-1.5 text-xs">
                                    {jo.vehicle.make} {jo.vehicle.model}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-surface-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                  statusColor
                                )}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-surface-500 text-sm font-mono">
                              {formatDate(jo.createdAt as string)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {activeTab === "notes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">
                  Internal Notes
                </h3>
                {!editingNotes && (
                  <button
                    onClick={() => {
                      setNotesValue(customer.notes ?? "");
                      setEditingNotes(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors touch-target"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>

              {editingNotes ? (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    autoFocus
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Add internal notes about this customer..."
                    className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 transition-colors resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingNotes(false)}
                      disabled={savingNotes}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors touch-target"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors touch-target"
                    >
                      {savingNotes ? "Saving..." : "Save Notes"}
                    </button>
                  </div>
                </div>
              ) : customer.notes ? (
                <div className="bg-surface-50 rounded-lg px-4 py-3 text-sm text-surface-600 whitespace-pre-wrap leading-relaxed">
                  {customer.notes}
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center text-center">
                  <StickyNote className="w-8 h-8 text-surface-300 mb-2" />
                  <p className="text-sm text-surface-400">No notes yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Follow-ups & Warranties tab */}
          {activeTab === "followups" && (
            <div className="space-y-6">
              {/* Active Warranties */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Active Warranties</h3>
                {(!warranties || warranties.length === 0) ? (
                  <div className="py-6 flex flex-col items-center text-center">
                    <Shield className="w-8 h-8 text-surface-300 mb-2" />
                    <p className="text-sm text-surface-400">No active warranties.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {warranties.map((w) => {
                      const endDate = new Date(w.endDate);
                      const now = new Date();
                      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysLeft <= 0;
                      const isExpiringSoon = daysLeft > 0 && daysLeft <= 30;

                      return (
                        <div
                          key={w.id}
                          className={cn(
                            "border rounded-lg p-3",
                            isExpired
                              ? "border-red-200 bg-red-50"
                              : isExpiringSoon
                              ? "border-amber-200 bg-amber-50"
                              : "border-green-200 bg-green-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-primary">{w.serviceCategory}</p>
                              <p className="text-xs text-surface-500 mt-0.5">{w.description}</p>
                              <p className="text-xs text-surface-400 mt-1">
                                JO# <span className="font-mono">{w.jobOrder.jobOrderNumber}</span> · Expires <span className="font-mono">{formatDate(w.endDate)}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              {isExpired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  Expired
                                </span>
                              ) : isExpiringSoon ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  {daysLeft}d left
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  {daysLeft}d left
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upcoming Follow-ups */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Upcoming Follow-ups</h3>
                {(!followUps || followUps.length === 0) ? (
                  <div className="py-6 flex flex-col items-center text-center">
                    <Calendar className="w-8 h-8 text-surface-300 mb-2" />
                    <p className="text-sm text-surface-400">No upcoming follow-ups scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followUps.map((f) => {
                      const typeLabels: Record<string, string> = {
                        FOLLOW_UP_SATISFACTION: "Satisfaction Check",
                        FOLLOW_UP_SURVEY: "Customer Survey",
                        FOLLOW_UP_MAINTENANCE: "Maintenance Reminder",
                        WARRANTY_EXPIRY: "Warranty Expiry",
                      };
                      const typeColors: Record<string, string> = {
                        FOLLOW_UP_SATISFACTION: "bg-blue-100 text-blue-700",
                        FOLLOW_UP_SURVEY: "bg-purple-100 text-purple-700",
                        FOLLOW_UP_MAINTENANCE: "bg-amber-100 text-amber-700",
                        WARRANTY_EXPIRY: "bg-red-100 text-red-700",
                      };
                      return (
                        <div key={f.id} className="flex items-center justify-between border border-surface-200 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-primary">{f.title}</p>
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1",
                              typeColors[f.type] || "bg-surface-100 text-surface-600"
                            )}>
                              {typeLabels[f.type] || f.type}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 font-mono">{formatDate(f.scheduledAt)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit SlideOver */}
      <CustomerForm
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={handleEditSuccess}
        customer={customer}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${customer.firstName} ${customer.lastName}? This action cannot be undone.`}
        confirmLabel="Delete Customer"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

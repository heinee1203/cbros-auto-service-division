"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Search, X } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { SlideOver } from "@/components/ui/slide-over";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  formatPeso,
  formatDate,
  formatPhone,
  cn,
} from "@/lib/utils";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/lib/actions/customer-actions";
import type { CustomerInput } from "@/lib/validators";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerRow {
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
  tags: string; // JSON string
  jobCount: number;
  totalSpend: number;
  lastVisit: string | null;
  firstVisit: string | null;
  createdAt: string;
  _count: { vehicles: number };
}

interface CustomerListResult {
  customers: CustomerRow[];
  total: number;
  pageCount: number;
}

// ─── Customer tags ─────────────────────────────────────────────────────────────

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

// ─── CustomerForm component ────────────────────────────────────────────────────

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer?: CustomerRow | null;
}

function CustomerForm({ open, onClose, onSuccess, customer }: CustomerFormProps) {
  const isEditing = !!customer;

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
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInput, string>>>({});

  // Populate form when editing
  useEffect(() => {
    if (customer) {
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(customer.tags ?? "[]");
      } catch {
        parsedTags = [];
      }
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
        tags: parsedTags,
      });
    } else {
      setForm({
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
    }
    setErrors({});
  }, [customer, open]);

  function setField<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
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
    setErrors({});

    const payload: CustomerInput = {
      ...form,
      email: form.email || null,
      phoneAlt: form.phoneAlt || null,
      address: form.address || null,
      company: form.company || null,
      referredBy: form.referredBy || null,
      notes: form.notes || null,
    };

    const result = isEditing
      ? await updateCustomerAction(customer!.id, payload)
      : await createCustomerAction(payload);

    setSubmitting(false);

    if (result.success) {
      toast.success(isEditing ? "Customer updated." : "Customer added.");
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
      title={isEditing ? "Edit Customer" : "New Customer"}
      description={
        isEditing
          ? `Editing ${customer?.firstName} ${customer?.lastName}`
          : "Add a new customer to your database"
      }
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
            form="customer-form"
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors touch-target"
          >
            {submitting
              ? "Saving..."
              : isEditing
              ? "Save Changes"
              : "Add Customer"}
          </button>
        </div>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <input
              type="text"
              className={cn(inputClass, errors.firstName && "border-danger")}
              placeholder="Juan"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
            {errors.firstName && (
              <p className="text-xs text-danger mt-1">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input
              type="text"
              className={cn(inputClass, errors.lastName && "border-danger")}
              placeholder="dela Cruz"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              required
            />
            {errors.lastName && (
              <p className="text-xs text-danger mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Phone *</label>
            <input
              type="tel"
              className={cn(inputClass, errors.phone && "border-danger")}
              placeholder="09XX XXX XXXX"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              required
            />
            {errors.phone && (
              <p className="text-xs text-danger mt-1">{errors.phone}</p>
            )}
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

        {/* Email */}
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            className={cn(inputClass, errors.email && "border-danger")}
            placeholder="juan@example.com"
            value={form.email ?? ""}
            onChange={(e) => setField("email", e.target.value)}
          />
          {errors.email && (
            <p className="text-xs text-danger mt-1">{errors.email}</p>
          )}
        </div>

        {/* Company */}
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

        {/* Address */}
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

        {/* Referred By */}
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

        {/* Tags */}
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

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Internal notes about this customer..."
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </form>
    </SlideOver>
  );
}

// ─── Table columns ─────────────────────────────────────────────────────────────

const columns: ColumnDef<CustomerRow, unknown>[] = [
  {
    accessorKey: "firstName",
    header: "Name",
    enableSorting: true,
    cell: ({ row }) => (
      <div className="font-medium text-primary">
        {row.original.firstName} {row.original.lastName}
        {row.original.company && (
          <div className="text-xs text-surface-400 font-normal mt-0.5">
            {row.original.company}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{formatPhone(getValue() as string)}</span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    enableSorting: false,
    cell: ({ getValue }) => {
      const email = getValue() as string | null;
      return email ? (
        <span className="text-surface-600 text-sm">{email}</span>
      ) : (
        <span className="text-surface-300 text-sm">—</span>
      );
    },
  },
  {
    accessorKey: "_count",
    header: "Vehicles",
    enableSorting: false,
    cell: ({ getValue }) => {
      const count = (getValue() as { vehicles: number })?.vehicles ?? 0;
      return <span className="text-sm text-surface-500">{count}</span>;
    },
  },
  {
    accessorKey: "jobCount",
    header: "Total Jobs",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="text-sm text-surface-500">{getValue() as number}</span>
    ),
  },
  {
    accessorKey: "totalSpend",
    header: "Total Spend",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="font-mono text-sm text-primary">
        {formatPeso(getValue() as number)}
      </span>
    ),
  },
  {
    accessorKey: "lastVisit",
    header: "Last Visit",
    enableSorting: true,
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      return (
        <span className="text-sm text-surface-500 font-mono">
          {val ? formatDate(val) : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    enableSorting: false,
    cell: ({ getValue }) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse((getValue() as string) ?? "[]");
      } catch {
        tags = [];
      }
      if (!tags.length) return <span className="text-surface-300 text-xs">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant={tagVariant(tag)}>
              {tag}
            </Badge>
          ))}
        </div>
      );
    },
  },
];

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();

  const [data, setData] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastVisit", desc: true },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);

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
        sortBy: sort?.id ?? "lastVisit",
        sortOrder: sort?.desc ? "desc" : "asc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch customers");

      const result: CustomerListResult = await res.json();
      setData(result.customers);
      setTotal(result.total);
      setPageCount(result.pageCount);
    } catch {
      toast.error("Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, [pageIndex, sorting, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleRowClick(row: CustomerRow) {
    router.push(`/customers/${row.id}`);
  }

  function handleNewCustomer() {
    setEditCustomer(null);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditCustomer(null);
  }

  function handleFormSuccess() {
    fetchData();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Customers</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {loading ? "Loading..." : `${total.toLocaleString()} customer${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={handleNewCustomer}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors touch-target shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 transition-colors"
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
            icon={Users}
            title={search ? "No customers found" : "No customers yet"}
            description={
              search
                ? `No customers match "${search}". Try a different search.`
                : "Add your first customer to get started."
            }
            action={
              !search ? (
                <button
                  onClick={handleNewCustomer}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Customer
                </button>
              ) : undefined
            }
          />
        }
      />

      {/* Customer Form SlideOver */}
      <CustomerForm
        open={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        customer={editCustomer}
      />
    </div>
  );
}

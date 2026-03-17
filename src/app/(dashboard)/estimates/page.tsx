"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, ClipboardList, Search, X } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPeso, formatPlateNumber, cn } from "@/lib/utils";
import { ESTIMATE_STATUS_TABS } from "@/lib/constants";
import {
  ESTIMATE_REQUEST_STATUS_LABELS,
  ESTIMATE_REQUEST_STATUS_COLORS,
} from "@/types/enums";
import type { EstimateRequestStatus } from "@/types/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EstimateRequestRow {
  id: string;
  requestNumber: string;
  customerId: string;
  vehicleId: string;
  status: string;
  customerConcern: string;
  requestedCategories: string; // JSON array
  isInsuranceClaim: boolean;
  createdAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    color: string;
  };
  _count: { estimates: number };
  estimates: Array<{
    versions: Array<{
      grandTotal: number;
      versionNumber: number;
      approvalToken: string | null;
    }>;
  }>;
}

interface EstimateListResult {
  requests: EstimateRequestRow[];
  total: number;
  pageCount: number;
}

// ─── Table columns ─────────────────────────────────────────────────────────────

const columns: ColumnDef<EstimateRequestRow, unknown>[] = [
  {
    accessorKey: "requestNumber",
    header: "EST Number",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="font-mono font-bold text-primary">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "customer",
    header: "Customer",
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-primary">
          {row.original.customer.firstName} {row.original.customer.lastName}
        </div>
        <div className="text-xs text-surface-400 mt-0.5">
          {row.original.customer.phone}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "vehicle",
    header: "Vehicle",
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="font-mono text-sm text-primary">
          {formatPlateNumber(row.original.vehicle.plateNumber)}
        </div>
        <div className="text-xs text-surface-400 mt-0.5">
          {row.original.vehicle.make} {row.original.vehicle.model}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "requestedCategories",
    header: "Categories",
    enableSorting: false,
    cell: ({ getValue }) => {
      let categories: string[] = [];
      try {
        categories = JSON.parse((getValue() as string) ?? "[]");
      } catch {
        categories = [];
      }
      if (!categories.length)
        return <span className="text-surface-300 text-xs">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <Badge key={cat} variant="outline">
              {cat}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: true,
    cell: ({ getValue }) => {
      const status = getValue() as EstimateRequestStatus;
      const label =
        ESTIMATE_REQUEST_STATUS_LABELS[status] ?? status;
      const colorClass =
        ESTIMATE_REQUEST_STATUS_COLORS[status] ?? "bg-surface-100 text-surface-500";
      return (
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
            colorClass
          )}
        >
          {label}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="text-sm font-mono text-surface-500">
        {formatDate(getValue() as string)}
      </span>
    ),
  },
  {
    id: "total",
    header: "Total",
    enableSorting: false,
    cell: ({ row }) => {
      const latestVersion = row.original.estimates?.[0]?.versions?.[0];
      if (!latestVersion) return <span className="text-surface-300 text-sm">—</span>;
      return (
        <span className="text-sm font-medium font-mono">
          {formatPeso(latestVersion.grandTotal)}
        </span>
      );
    },
  },
];

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function EstimatesPage() {
  const router = useRouter();

  const [data, setData] = useState<EstimateRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

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
        sortBy: sort?.id ?? "createdAt",
        sortOrder: sort?.desc ? "desc" : "asc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeTab && activeTab !== "ALL") params.set("status", activeTab);

      const res = await fetch(`/api/estimates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch estimates");

      const result: EstimateListResult = await res.json();
      setData(result.requests);
      setTotal(result.total);
      setPageCount(result.pageCount);
    } catch {
      toast.error("Could not load estimates.");
    } finally {
      setLoading(false);
    }
  }, [pageIndex, sorting, debouncedSearch, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleRowClick(row: EstimateRequestRow) {
    router.push(`/estimates/${row.id}`);
  }

  function handleTabClick(value: string) {
    setActiveTab(value);
    setPageIndex(0);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Estimates</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {loading
              ? "Loading..."
              : `${total.toLocaleString()} estimate request${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => router.push("/estimates/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors touch-target shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Inquiry
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ESTIMATE_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabClick(tab.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "bg-accent text-white"
                : "bg-white text-surface-500 hover:bg-surface-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by EST number, name, or plate..."
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
            icon={ClipboardList}
            title={search ? "No estimate requests found" : "No estimate requests yet"}
            description={
              search
                ? `No estimate requests match "${search}". Try a different search.`
                : "Create your first estimate request to get started."
            }
            action={
              !search ? (
                <button
                  onClick={() => router.push("/estimates/new")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Inquiry
                </button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Search, X, CalendarCheck } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatDate,
  formatPhone,
  formatPlateNumber,
  cn,
} from "@/lib/utils";
import { JOB_ORDER_STATUS_TABS, JOB_TAB_STATUS_MAP, JOB_CATEGORY_GROUP_TABS } from "@/lib/constants";
import {
  JOB_ORDER_STATUS_LABELS,
  JOB_ORDER_STATUS_COLORS,
  type JobOrderStatus,
  type JobOrderPriority,
} from "@/types/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobOrderRow {
  id: string;
  jobOrderNumber: string;
  status: string;
  priority: string;
  targetCompletionDate: string | null;
  actualCompletionDate: string | null;
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
  };
  primaryTechnician: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  _count: { tasks: number };
  totalEstimatedHours: number;
  totalActualHours: number;
  efficiency: number | null;
  daysInShop: number;
  isOverdue: boolean;
}

interface JobOrderListResult {
  jobOrders: JobOrderRow[];
  total: number;
  pageCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInShop(createdAt: string, actualCompletionDate: string | null): number {
  const start = new Date(createdAt);
  const end = actualCompletionDate ? new Date(actualCompletionDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getOverdueDays(
  targetCompletionDate: string | null,
  status: string
): number {
  if (!targetCompletionDate) return 0;
  if (status === "RELEASED" || status === "CANCELLED") return 0;
  const target = new Date(targetCompletionDate);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "RUSH":
      return "bg-red-100 text-red-700";
    case "INSURANCE":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-surface-100 text-surface-500";
  }
}

function priorityLabel(priority: string) {
  switch (priority) {
    case "RUSH":
      return "Rush";
    case "INSURANCE":
      return "Insurance";
    default:
      return "Normal";
  }
}

// ─── Table columns ─────────────────────────────────────────────────────────────

function buildColumns(
  pickUpMap: Map<string, { date: string; time: string }>
): ColumnDef<JobOrderRow, unknown>[] {
  return [
  {
    accessorKey: "jobOrderNumber",
    header: "JO Number",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="font-mono font-bold text-primary text-sm">
        {getValue() as string}
      </span>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    enableSorting: false,
    cell: ({ row }) => {
      const pickup = pickUpMap.get(row.original.customer.id);
      return (
        <div>
          <div className="font-medium text-primary text-sm flex items-center gap-1">
            <span>{row.original.customer.firstName} {row.original.customer.lastName}</span>
            {pickup && (
              <span
                className="inline-flex items-center text-accent-500"
                title={`Pick-up: ${formatDate(pickup.date)}${pickup.time ? ` at ${pickup.time}` : ""}`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          <div className="text-xs text-surface-400 mt-0.5">
            {formatPhone(row.original.customer.phone)}
          </div>
        </div>
      );
    },
  },
  {
    id: "vehicle",
    header: "Vehicle",
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="font-mono font-medium text-primary text-sm tracking-wider">
          {formatPlateNumber(row.original.vehicle.plateNumber)}
        </div>
        <div className="text-xs text-surface-400 mt-0.5">
          {row.original.vehicle.make} {row.original.vehicle.model}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: true,
    cell: ({ row }) => {
      const status = row.original.status;
      const label =
        JOB_ORDER_STATUS_LABELS[status as JobOrderStatus] ?? status;
      const colorClass =
        JOB_ORDER_STATUS_COLORS[status as JobOrderStatus] ??
        "bg-surface-100 text-surface-600";
      return (
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit",
              colorClass
            )}
          >
            {label}
          </span>
          {row.original.isOverdue && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger-100 text-danger-600 uppercase w-fit">
              Overdue
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: "assignedTech",
    header: "Assigned Tech",
    enableSorting: false,
    cell: ({ row }) => {
      const tech = row.original.primaryTechnician;
      return tech ? (
        <span className="text-sm text-surface-600">
          {tech.firstName} {tech.lastName}
        </span>
      ) : (
        <span className="text-sm text-surface-300">Unassigned</span>
      );
    },
  },
  {
    accessorKey: "targetCompletionDate",
    header: "Target Date",
    enableSorting: true,
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      return (
        <span className="text-sm text-surface-500 font-mono">
          {val ? formatDate(val) : "\u2014"}
        </span>
      );
    },
  },
  {
    id: "estHours",
    header: "Est Hours",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm text-surface-600 font-mono">
        {row.original.totalEstimatedHours > 0
          ? `${row.original.totalEstimatedHours}h`
          : "\u2014"}
      </span>
    ),
  },
  {
    id: "actHours",
    header: "Act Hours",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm text-surface-600 font-mono">
        {row.original.totalActualHours > 0
          ? `${row.original.totalActualHours}h`
          : "\u2014"}
      </span>
    ),
  },
  {
    id: "efficiency",
    header: "Efficiency",
    enableSorting: false,
    cell: ({ row }) => {
      const eff = row.original.efficiency;
      if (eff === null) {
        return <span className="text-sm text-surface-300">{"\u2014"}</span>;
      }
      return (
        <span
          className={cn(
            "text-sm font-semibold font-mono",
            eff >= 100 ? "text-green-600" : "text-red-600"
          )}
        >
          {eff}%
        </span>
      );
    },
  },
  {
    id: "daysInShop",
    header: "Days",
    enableSorting: false,
    cell: ({ row }) => {
      const days = row.original.daysInShop;
      const overdue = getOverdueDays(
        row.original.targetCompletionDate,
        row.original.status
      );
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-surface-600 font-medium font-mono">{days}</span>
          {overdue > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger-100 text-danger-600 uppercase">
              +{overdue}d
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "priority",
    header: "Priority",
    enableSorting: false,
    cell: ({ getValue }) => {
      const priority = getValue() as string;
      return (
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
            priorityBadge(priority)
          )}
        >
          {priorityLabel(priority)}
        </span>
      );
    },
  },
  ];
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const router = useRouter();

  const [data, setData] = useState<JobOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pickUpMap, setPickUpMap] = useState<Map<string, { date: string; time: string }>>(new Map());

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categoryGroup, setCategoryGroup] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
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
        pageSize: "20",
        sortBy: sort?.id ?? "createdAt",
        sortOrder: sort?.desc ? "desc" : "asc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryGroup && categoryGroup !== "ALL") {
        params.set("categoryGroup", categoryGroup);
      }
      if (statusFilter && statusFilter !== "ALL") {
        const statuses = JOB_TAB_STATUS_MAP[statusFilter];
        if (statuses && statuses.length > 0) {
          params.set("status", statuses.join(","));
        } else {
          params.set("status", statusFilter);
        }
      }

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch job orders");

      const result: JobOrderListResult = await res.json();
      setData(result.jobOrders);
      setTotal(result.total);
      setPageCount(result.pageCount);
    } catch {
      toast.error("Could not load job orders.");
    } finally {
      setLoading(false);
    }
  }, [pageIndex, sorting, debouncedSearch, statusFilter, categoryGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch upcoming pick-up appointments for loaded customers
  useEffect(() => {
    if (data.length === 0) {
      setPickUpMap(new Map());
      return;
    }
    const customerIds = Array.from(new Set(data.map((j) => j.customer.id)));
    fetch(`/api/appointments/upcoming-pickups?customerIds=${customerIds.join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          pickups: Array<{
            customerId: string;
            scheduledDate: string;
            scheduledTime: string;
          }>
        ) => {
          const map = new Map<string, { date: string; time: string }>();
          for (const p of pickups) {
            if (!map.has(p.customerId)) {
              map.set(p.customerId, {
                date: p.scheduledDate,
                time: p.scheduledTime,
              });
            }
          }
          setPickUpMap(map);
        }
      )
      .catch(() => {});
  }, [data]);

  const columns = useMemo(() => buildColumns(pickUpMap), [pickUpMap]);

  function handleRowClick(row: JobOrderRow) {
    router.push(`/jobs/${row.id}`);
  }

  function handleCategoryGroupChange(value: string) {
    setCategoryGroup(value);
    setPageIndex(0);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPageIndex(0);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">Job Orders</h1>
          {!loading && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-100 text-accent-700">
              {total.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Category group filter */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {JOB_CATEGORY_GROUP_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleCategoryGroupChange(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors touch-target",
              categoryGroup === tab.value
                ? "bg-primary text-white shadow-sm"
                : "text-surface-500 hover:text-primary hover:bg-surface-100"
            )}
          >
            {tab.value === "AUTO_REPAIR" && "🔧 "}
            {tab.value === "BODY_PAINT" && "🎨 "}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {JOB_ORDER_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors touch-target",
              statusFilter === tab.value
                ? "bg-accent text-white shadow-sm"
                : "text-surface-500 hover:text-primary hover:bg-surface-100"
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
          placeholder="Search JO number, plate, customer..."
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
        pageSize={20}
        sorting={sorting}
        onSortingChange={setSorting}
        onPageChange={setPageIndex}
        onRowClick={handleRowClick}
        isLoading={loading}
        emptyState={
          <EmptyState
            icon={Wrench}
            title={
              search || statusFilter !== "ALL" || categoryGroup !== "ALL"
                ? "No job orders found"
                : "No job orders yet"
            }
            description={
              search || statusFilter !== "ALL" || categoryGroup !== "ALL"
                ? "No job orders match the current filters. Try adjusting your search."
                : "Job orders will appear here once vehicles are checked in."
            }
          />
        }
      />
    </div>
  );
}

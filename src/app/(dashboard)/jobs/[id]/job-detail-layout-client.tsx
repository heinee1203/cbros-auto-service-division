"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Camera,
  ListTodo,
  Image,
  ClipboardCheck,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { cn, formatPlateNumber } from "@/lib/utils";
import {
  JOB_ORDER_STATUS_LABELS,
  JOB_ORDER_STATUS_COLORS,
  type JobOrderStatus,
} from "@/types/enums";

const TABS = [
  { label: "Overview", href: "", icon: LayoutDashboard },
  { label: "Estimate", href: "/estimate", icon: ClipboardList },
  { label: "Intake", href: "/intake", icon: Camera },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Photos", href: "/photos", icon: Image },
  { label: "QC", href: "/qc", icon: ClipboardCheck },
  { label: "Invoice", href: "/invoice", icon: Receipt },
  { label: "Release", href: "/release", icon: CheckCircle2 },
] as const;

interface JobDetailLayoutClientProps {
  children: React.ReactNode;
  jobId: string;
  jobOrderNumber: string;
  status: string;
  customerName: string;
  vehiclePlate: string;
  vehicleDesc: string;
}

export function JobDetailLayoutClient({
  children,
  jobId,
  jobOrderNumber,
  status,
  customerName,
  vehiclePlate,
  vehicleDesc,
}: JobDetailLayoutClientProps) {
  const pathname = usePathname();
  const basePath = `/jobs/${jobId}`;

  const statusKey = status as JobOrderStatus;
  const statusLabel = JOB_ORDER_STATUS_LABELS[statusKey] ?? status;
  const statusColor =
    JOB_ORDER_STATUS_COLORS[statusKey] ?? "bg-gray-100 text-gray-500";
  const plateDisplay = formatPlateNumber(vehiclePlate);

  return (
    <div className="space-y-4">
      {/* Breadcrumb header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/jobs"
            className="text-surface-500 hover:text-primary transition-colors"
          >
            Job Orders
          </Link>
          <span className="text-surface-300">/</span>
          <span className="font-semibold text-primary text-base">
            <span className="font-mono">{jobOrderNumber}</span>
            {plateDisplay && (
              <span className="text-surface-600 font-mono">
                {" "}
                &mdash; {plateDisplay}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-surface-600">{customerName}</span>
          {vehicleDesc && (
            <span className="text-sm text-surface-400">{vehicleDesc}</span>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Tab navigation + content */}
      <div className="bg-white rounded-xl border border-surface-200">
        <div className="flex overflow-x-auto border-b border-surface-200">
          {TABS.map((tab) => {
            const tabPath = `${basePath}${tab.href}`;
            const isActive =
              tab.href === ""
                ? pathname === basePath
                : pathname.startsWith(tabPath);

            return (
              <Link
                key={tab.label}
                href={tabPath}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors touch-target",
                  isActive
                    ? "border-accent text-accent-600"
                    : "border-transparent text-surface-400 hover:text-primary hover:border-surface-300"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
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
import { cn } from "@/lib/utils";

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

export default function JobDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const jobId = params.id as string;
  const basePath = `/jobs/${jobId}`;

  return (
    <div className="space-y-4">
      {/* Job header — will be populated with actual job data in Phase 3+ */}
      <div className="flex items-center gap-3">
        <Link
          href="/jobs"
          className="text-sm text-surface-400 hover:text-primary"
        >
          Job Orders
        </Link>
        <span className="text-surface-300">/</span>
        <span className="text-sm font-medium text-primary">Job Detail</span>
      </div>

      {/* Tab navigation */}
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

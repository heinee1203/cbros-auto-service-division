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

export function JobDetailTabs({ jobId }: { jobId: string }) {
  const pathname = usePathname();
  const basePath = `/jobs/${jobId}`;

  return (
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
  );
}

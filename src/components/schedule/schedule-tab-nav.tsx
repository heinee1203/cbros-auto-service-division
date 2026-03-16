"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, Calendar, FileSearch, Settings } from "lucide-react";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";

interface ScheduleTabNavProps {
  userRole: string;
}

const TABS = [
  { label: "Live Floor", href: "/schedule/floor", icon: Factory },
  { label: "Calendar", href: "/schedule/calendar", icon: Calendar },
  { label: "Registry", href: "/schedule/registry", icon: FileSearch },
] as const;

const ADMIN_TAB = {
  label: "Admin",
  href: "/schedule/admin",
  icon: Settings,
} as const;

export function ScheduleTabNav({ userRole }: ScheduleTabNavProps) {
  const pathname = usePathname();
  const showAdmin = can(userRole as UserRole, "schedule:bays_manage");

  const tabs = showAdmin ? [...TABS, ADMIN_TAB] : [...TABS];

  return (
    <nav
      className="flex items-center gap-1 px-4 border-b overflow-x-auto shrink-0"
      style={{
        backgroundColor: "var(--sch-card)",
        borderColor: "var(--sch-border)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: isActive ? "var(--sch-accent)" : "transparent",
              color: isActive ? "var(--sch-accent)" : "var(--sch-text-muted)",
            }}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

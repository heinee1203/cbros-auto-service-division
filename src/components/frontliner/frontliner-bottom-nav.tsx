"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Timer,
  Camera,
  CheckSquare,
  Plus,
  Car,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/enums";

interface TabItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const TECHNICIAN_TABS: TabItem[] = [
  { label: "Home", href: "/frontliner", icon: Home },
  { label: "Clock", href: "/frontliner/clock", icon: Timer },
  { label: "Photos", href: "/frontliner/photos", icon: Camera },
  { label: "Tasks", href: "/frontliner/my-tasks", icon: CheckSquare },
];

const ADVISOR_TABS: TabItem[] = [
  { label: "Home", href: "/frontliner", icon: Home },
  { label: "Intake", href: "/frontliner/intake", icon: Plus },
  { label: "Jobs", href: "/frontliner/jobs", icon: Car },
  { label: "Release", href: "/frontliner/release", icon: ClipboardList },
];

const QC_INSPECTOR_TABS: TabItem[] = [
  { label: "Home", href: "/frontliner", icon: Home },
  { label: "QC Queue", href: "/frontliner/qc", icon: ClipboardCheck },
  { label: "Photos", href: "/frontliner/photos", icon: Camera },
];

function getTabsForRole(role: UserRole): TabItem[] {
  switch (role) {
    case "TECHNICIAN":
      return TECHNICIAN_TABS;
    case "QC_INSPECTOR":
      return QC_INSPECTOR_TABS;
    default:
      // ADVISOR, OWNER, MANAGER, ESTIMATOR, CASHIER
      return ADVISOR_TABS;
  }
}

interface FrontlinerBottomNavProps {
  role: UserRole;
}

export function FrontlinerBottomNav({ role }: FrontlinerBottomNavProps) {
  const pathname = usePathname();
  const tabs = getTabsForRole(role);

  const isActive = (href: string) =>
    href === "/frontliner"
      ? pathname === "/frontliner"
      : pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--sch-card)] border-t border-[var(--sch-border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] min-h-[64px] transition-colors",
                active
                  ? "text-[var(--sch-accent)] font-medium"
                  : "text-[var(--sch-text-dim)]"
              )}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-xs mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Users,
  Car,
  Receipt,
  Calendar,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { useState } from "react";

const ICONS = {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Users,
  Car,
  Calendar,
  Receipt,
  BarChart3,
  Settings,
} as const;

interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
  permission: Permission | null;
  showBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard", permission: null },
  {
    label: "Job Orders",
    href: "/jobs",
    icon: "Wrench",
    permission: "jobs:view",
    showBadge: true,
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: "Calendar",
    permission: "schedule:view",
  },
  {
    label: "Estimates",
    href: "/estimates",
    icon: "ClipboardList",
    permission: "estimates:view",
  },
  {
    label: "Customers",
    href: "/customers",
    icon: "Users",
    permission: "customers:view",
  },
  {
    label: "Vehicles",
    href: "/vehicles",
    icon: "Car",
    permission: "customers:view",
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: "Receipt",
    permission: "invoices:view",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "BarChart3",
    permission: "analytics:view",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    permission: "settings:manage",
  },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.permission || can(userRole, item.permission)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-primary text-white transition-all duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="font-mono font-bold text-primary text-sm">
                AS
              </span>
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">
                AutoServ Pro
              </h1>
              <p className="text-[10px] text-white/50 leading-none mt-0.5">
                Shop Management
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center mx-auto">
            <span className="font-mono font-bold text-primary text-sm">
              AS
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors touch-target",
                isActive
                  ? "bg-accent text-primary font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-white/10 text-white/50 hover:text-white transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}

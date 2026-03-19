"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Users,
  MoreHorizontal,
  Car,
  Receipt,
  Calendar,
  BarChart3,
  Coins,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission: Permission | null;
}

const PRIMARY_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: null },
  { label: "Jobs", href: "/jobs", icon: Wrench, permission: "jobs:view" },
  { label: "Estimates", href: "/estimates", icon: ClipboardList, permission: "estimates:view" },
  { label: "Customers", href: "/customers", icon: Users, permission: "customers:view" },
];

const MORE_ITEMS: NavItem[] = [
  { label: "Schedule", href: "/schedule", icon: Calendar, permission: "schedule:view" },
  { label: "Vehicles", href: "/vehicles", icon: Car, permission: "customers:view" },
  { label: "Invoices", href: "/invoices", icon: Receipt, permission: "invoices:view" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics:view" },
  { label: "Commissions", href: "/commissions", icon: Coins, permission: "commissions:view" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings:manage" },
];

interface BottomNavProps {
  userRole: UserRole;
}

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const filteredPrimary = PRIMARY_ITEMS.filter(
    (item) => !item.permission || can(userRole, item.permission)
  );
  const filteredMore = MORE_ITEMS.filter(
    (item) => !item.permission || can(userRole, item.permission)
  );

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  // Check if any "more" item is active
  const moreActive = filteredMore.some((item) => isActive(item.href));

  return (
    <>
      {/* More overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-xl p-4 pb-2 z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-primary">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {filteredMore.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-xs transition-colors min-h-touch",
                    isActive(item.href)
                      ? "bg-accent/10 text-accent"
                      : "text-surface-500 hover:bg-surface-100"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-surface-200 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around px-2">
          {filteredPrimary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] min-h-touch text-xs transition-colors",
                isActive(item.href)
                  ? "text-accent font-medium"
                  : "text-surface-400"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive(item.href) && "stroke-[2.5]")} />
              <span>{item.label}</span>
            </Link>
          ))}
          {filteredMore.length > 0 && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] min-h-touch text-xs transition-colors",
                moreActive || moreOpen
                  ? "text-accent font-medium"
                  : "text-surface-400"
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

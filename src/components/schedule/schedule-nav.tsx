"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Appointments", href: "/schedule/appointments" },
  { label: "Bay Schedule", href: "/schedule/bays" },
  { label: "Tech Schedule", href: "/schedule/technicians" },
] as const;

export function ScheduleNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 bg-surface-100 rounded-lg p-1 w-fit">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "bg-white text-primary shadow-sm"
                : "text-surface-500 hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

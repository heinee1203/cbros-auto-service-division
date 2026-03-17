"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";
import type { UserRole } from "@/types/enums";

interface FrontlinerTopbarProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

const ADMIN_ROLES: UserRole[] = ["ADVISOR", "MANAGER", "OWNER"];

export function FrontlinerTopbar({ user }: FrontlinerTopbarProps) {
  const canSwitchToAdmin = ADMIN_ROLES.includes(user.role);

  return (
    <header className="flex items-center h-14 px-4 bg-[var(--sch-card)] border-b border-[var(--sch-border)] gap-3 shrink-0">
      {/* Left: brand */}
      <span className="text-sm font-semibold text-[var(--sch-accent)]">
        AutoServ
      </span>

      <div className="flex-1" />

      {/* Right: user avatar + name + bell + admin link */}
      <div className="flex items-center gap-3">
        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-[var(--sch-accent)] flex items-center justify-center text-white text-xs font-medium shrink-0">
          {getInitials(user.firstName, user.lastName)}
        </div>

        {/* First name */}
        <span className="text-sm text-[var(--sch-text)]">
          {user.firstName}
        </span>

        {/* Offline sync indicator */}
        <SyncStatusBadge />

        {/* Notification bell */}
        <button className="p-2 rounded-lg touch-target">
          <Bell className="w-5 h-5 text-[var(--sch-text-muted)]" />
        </button>

        {/* Switch to Admin link */}
        {canSwitchToAdmin && (
          <Link
            href="/"
            className="text-xs text-[var(--sch-text-dim)] hover:text-[var(--sch-text-muted)] transition-colors"
          >
            Admin &rarr;
          </Link>
        )}
      </div>
    </header>
  );
}

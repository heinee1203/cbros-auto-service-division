"use client";

import { Bell, LogOut, Search, Smartphone, User } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { cn, getInitials } from "@/lib/utils";
import { USER_ROLE_LABELS, type UserRole } from "@/types/enums";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";

interface TopbarProps {
  user: {
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  onSearchOpen: () => void;
}

export function Topbar({ user, onSearchOpen }: TopbarProps) {
  return (
    <header className="flex items-center h-16 px-4 bg-white border-b border-surface-200 gap-4">
      {/* Global search trigger */}
      <button
        onClick={onSearchOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-500 transition-colors flex-1 max-w-md touch-target"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">
          Search plates, jobs, customers...
        </span>
        <kbd className="hidden sm:inline-flex ml-auto px-1.5 py-0.5 text-[10px] font-mono bg-surface-200 rounded text-surface-400">
          Ctrl+K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* Notification bell */}
      <button className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors touch-target">
        <Bell className="w-5 h-5 text-surface-500" />
        {/* Unread indicator — wired up in Phase 10 */}
      </button>

      {/* Floor View link */}
      <Link
        href="/frontliner"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-surface-100 text-surface-500 text-xs transition-colors"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Floor View</span>
      </Link>

      {/* Sync status */}
      <SyncStatusBadge />

      {/* User menu */}
      <div className="flex items-center gap-3 pl-3 border-l border-surface-200">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
          {getInitials(user.firstName, user.lastName)}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium leading-none">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-surface-400 leading-none mt-0.5">
            {USER_ROLE_LABELS[user.role]}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors touch-target"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 text-surface-400" />
        </button>
      </div>
    </header>
  );
}

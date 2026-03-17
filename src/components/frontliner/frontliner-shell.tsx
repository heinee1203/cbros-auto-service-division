"use client";

import type { UserRole } from "@/types/enums";
import { FrontlinerTopbar } from "@/components/frontliner/frontliner-topbar";
import { FrontlinerBottomNav } from "@/components/frontliner/frontliner-bottom-nav";

interface FrontlinerShellProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  children: React.ReactNode;
}

export function FrontlinerShell({ user, children }: FrontlinerShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <FrontlinerTopbar user={user} />
      <main className="flex-1 overflow-y-auto p-4 pb-24">{children}</main>
      <FrontlinerBottomNav role={user.role} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { GlobalSearch } from "@/components/search/global-search";
import type { UserRole } from "@/types/enums";

interface AppShellProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userRole={user.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar user={user} onSearchOpen={() => setSearchOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ArrowLeft, Search, Sun, Moon, LogOut } from "lucide-react";
import { useScheduleTheme } from "./schedule-theme-provider";
import { useDivision } from "@/components/division-provider";
import { USER_DIVISION_LABELS, type UserDivision } from "@/types/enums";

const DIVISION_OPTIONS: UserDivision[] = ["ALL", "MECHANICAL", "BODY_PAINT"];

interface ScheduleTopbarProps {
  user: {
    firstName: string;
    lastName: string;
    role: string;
    division: UserDivision;
  };
}

export function ScheduleTopbar({ user }: ScheduleTopbarProps) {
  const { theme, toggleTheme } = useScheduleTheme();
  const { activeDivision, setActiveDivision, canSwitch } = useDivision();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header
      className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
      style={{
        backgroundColor: "var(--sch-card)",
        borderColor: "var(--sch-border)",
      }}
    >
      {/* Left section: branding + back link */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-lg font-bold tracking-tight whitespace-nowrap"
          style={{ color: "var(--sch-accent)" }}
        >
          CBROS
        </span>
        <Link
          href="/"
          className="hidden sm:flex items-center gap-1 text-sm whitespace-nowrap hover:underline"
          style={{ color: "var(--sch-text-muted)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to AutoServ
        </Link>
      </div>

      {/* Division switcher (ALL users only) */}
      {canSwitch ? (
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--sch-bg)" }}>
          {DIVISION_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDivision(d)}
              className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
              style={{
                backgroundColor: activeDivision === d ? "var(--sch-accent)" : "transparent",
                color: activeDivision === d ? "#000" : "var(--sch-text-muted)",
              }}
            >
              {USER_DIVISION_LABELS[d]}
            </button>
          ))}
        </div>
      ) : (
        <span
          className="text-xs font-medium px-2 py-1 rounded-md"
          style={{ backgroundColor: "var(--sch-bg)", color: "var(--sch-text-muted)" }}
        >
          {USER_DIVISION_LABELS[user.division]}
        </span>
      )}

      {/* Center section: search */}
      <div className="hidden md:flex flex-1 justify-center max-w-md mx-auto">
        <div className="relative w-full">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--sch-text-dim)" }}
          />
          <input
            type="text"
            placeholder="Search plate, VIN, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border outline-none focus:ring-1"
            style={{
              backgroundColor: "var(--sch-bg)",
              borderColor: "var(--sch-border)",
              color: "var(--sch-text)",
            }}
          />
        </div>
      </div>

      {/* Right section: theme toggle, user info, sign out */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
          style={{ color: "var(--sch-text-muted)" }}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <span
          className="hidden sm:inline text-sm whitespace-nowrap"
          style={{ color: "var(--sch-text-muted)" }}
        >
          {user.firstName} {user.lastName}
        </span>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
          style={{ color: "var(--sch-text-muted)" }}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

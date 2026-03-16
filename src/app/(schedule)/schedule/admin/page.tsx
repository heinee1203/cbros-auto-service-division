"use client";

import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";

const BayManagement = dynamic(
  () => import("@/components/schedule/bay-management"),
  { ssr: false }
);

const TechWorkSchedule = dynamic(
  () =>
    import("@/components/schedule/tech-work-schedule").then((m) => ({
      default: m.TechWorkSchedule,
    })),
  { ssr: false }
);

export default function AdminPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div
        className="flex items-center justify-center py-12"
        style={{ color: "var(--sch-text-muted)" }}
      >
        Loading...
      </div>
    );
  }

  if (
    !session?.user ||
    !can(session.user.role as UserRole, "schedule:bays_manage")
  ) {
    redirect("/schedule/floor");
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--sch-text)" }}
        >
          Bay Management
        </h2>
        <BayManagement />
      </div>

      <div>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--sch-text)" }}
        >
          Technician Work Schedules
        </h2>
        <TechWorkSchedule />
      </div>
    </div>
  );
}

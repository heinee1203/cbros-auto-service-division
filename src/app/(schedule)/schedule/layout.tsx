import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ScheduleThemeProvider } from "@/components/schedule/schedule-theme-provider";
import { ScheduleTopbar } from "@/components/schedule/schedule-topbar";
import { ScheduleTabNav } from "@/components/schedule/schedule-tab-nav";
import { DivisionProvider } from "@/components/division-provider";
import type { UserDivision } from "@/types/enums";

export default async function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user || !can(session.user.role, "schedule:view")) {
    redirect("/login");
  }

  return (
    <ScheduleThemeProvider>
      <DivisionProvider userDivision={(session.user.division || "ALL") as UserDivision}>
        <div className="flex flex-col h-screen">
          <ScheduleTopbar
            user={{
              firstName: session.user.firstName,
              lastName: session.user.lastName,
              role: session.user.role,
              division: (session.user.division || "ALL") as UserDivision,
            }}
          />
          <ScheduleTabNav userRole={session.user.role} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </DivisionProvider>
    </ScheduleThemeProvider>
  );
}

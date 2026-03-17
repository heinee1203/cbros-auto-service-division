import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ScheduleThemeProvider } from "@/components/schedule/schedule-theme-provider";
import { FrontlinerShell } from "@/components/frontliner/frontliner-shell";
import type { UserRole } from "@/types/enums";

export default async function FrontlinerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <ScheduleThemeProvider>
      <FrontlinerShell
        user={{
          id: session.user.id,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          role: session.user.role as UserRole,
        }}
      >
        {children}
      </FrontlinerShell>
    </ScheduleThemeProvider>
  );
}

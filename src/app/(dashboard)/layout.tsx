import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import type { UserRole } from "@/types/enums";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        id: session.user.id,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role as UserRole,
      }}
    >
      {children}
    </AppShell>
  );
}

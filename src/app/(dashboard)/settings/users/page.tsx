import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { UsersClient } from "./users-client";

export default async function UserManagementPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  if (!can(session.user.role as UserRole, "users:manage")) {
    redirect("/");
  }

  return <UsersClient currentUserId={session.user.id} />;
}

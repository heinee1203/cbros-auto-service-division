import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types/enums";

/**
 * Lightweight user lookup by role — used by intake assignment dropdowns.
 * Only returns id, firstName, lastName, role for active users.
 *
 * Query params:
 *   role  — comma-separated roles, e.g. "ADVISOR,MANAGER"
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Anyone who can create an intake can look up staff members
  if (!can(session.user.role as UserRole, "intake:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = request.nextUrl.searchParams.get("role");
  const roleList = roles
    ? roles.split(",").map((r) => r.trim().toUpperCase())
    : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(roleList ? { role: { in: roleList } } : {}),
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json(users);
}

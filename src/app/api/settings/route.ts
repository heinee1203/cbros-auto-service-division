import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAllSettings } from "@/lib/services/settings";
import type { UserRole } from "@/types/enums";

export async function GET() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role as UserRole, "settings:manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const settings = await getAllSettings();
  return NextResponse.json(settings);
}

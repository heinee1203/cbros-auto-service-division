import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAllSettings } from "@/lib/services/settings";
import { SettingsClient } from "./settings-client";
import BayManagement from "@/components/schedule/bay-management";
import { TechWorkSchedule } from "@/components/schedule/tech-work-schedule";
import type { UserRole } from "@/types/enums";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user || !can(session.user.role as UserRole, "settings:manage")) return notFound();

  const settings = await getAllSettings();

  // Group by category
  const grouped: Record<string, Array<{ id: string; key: string; value: string; description: string | null; category: string }>> = {};
  for (const s of settings) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  return (
    <div className="space-y-6">
      <SettingsClient initialSettings={grouped} />
      {can(session.user.role as UserRole, "schedule:bays_manage") && (
        <BayManagement />
      )}
      {can(session.user.role as UserRole, "schedule:tech_manage") && (
        <TechWorkSchedule />
      )}
    </div>
  );
}

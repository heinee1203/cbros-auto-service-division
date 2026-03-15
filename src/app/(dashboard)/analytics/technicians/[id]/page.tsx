import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getTechnicianDetail } from "@/lib/services/analytics";
import { TechDetailClient } from "./tech-detail-client";

interface PageProps {
  params: { id: string };
}

export default async function TechnicianDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user) return notFound();
  if (!can(session.user.role, "analytics:view")) return notFound();

  const now = new Date();
  const defaultRange = {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };

  let detail;
  try {
    detail = await getTechnicianDetail(params.id, defaultRange);
  } catch {
    return notFound();
  }

  if (!detail) return notFound();

  return <TechDetailClient initialData={detail} />;
}

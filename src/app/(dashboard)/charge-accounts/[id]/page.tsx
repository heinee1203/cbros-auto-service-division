import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getChargeAccountById,
  type AgingBreakdown,
} from "@/lib/services/charge-accounts";
import { ChargeAccountDetailClient } from "./detail-client";

export default async function ChargeAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const account = await getChargeAccountById(id);
  if (!account) return notFound();

  // Serialize dates for client component
  const serialized = JSON.parse(JSON.stringify(account));

  return <ChargeAccountDetailClient account={serialized} />;
}

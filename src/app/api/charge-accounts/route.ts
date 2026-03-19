import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChargeAccounts } from "@/lib/services/charge-accounts";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accounts = await getChargeAccounts();
  return NextResponse.json({ accounts });
}

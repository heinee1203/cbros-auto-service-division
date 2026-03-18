import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { testConnection } from "@/lib/services/apex-pos";

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await testConnection();
  return NextResponse.json(result);
}

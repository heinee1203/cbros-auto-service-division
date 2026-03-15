import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getActiveEntry,
  clockIn,
  forceClockOutAndIn,
} from "@/lib/services/time-entries";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entry = await getActiveEntry(session.user.id);

  if (!entry) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json(entry);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, jobOrderId, source, force } = body as {
    taskId: string;
    jobOrderId: string;
    source?: string;
    force?: boolean;
  };

  if (!taskId || !jobOrderId) {
    return NextResponse.json(
      { error: "taskId and jobOrderId are required" },
      { status: 400 }
    );
  }

  try {
    if (force) {
      const entry = await forceClockOutAndIn(
        session.user.id,
        taskId,
        jobOrderId,
        source
      );
      return NextResponse.json(entry, { status: 201 });
    }

    const result = await clockIn(session.user.id, taskId, jobOrderId, source);

    if ("conflict" in result && result.conflict) {
      return NextResponse.json(
        {
          error: "Already clocked in",
          conflict: true,
          existingEntry: result.existingEntry,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clock in failed" },
      { status: 500 }
    );
  }
}

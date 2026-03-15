"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { jobNoteSchema } from "@/lib/validators";
import { addJobNote } from "@/lib/services/job-activities";
import type { ActionResult } from "@/lib/actions/estimate-actions";

export async function addJobNoteAction(
  jobOrderId: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = jobNoteSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await addJobNote(
      jobOrderId,
      parsed.data.content,
      parsed.data.mentions,
      session.user.id
    );
    revalidatePath(`/jobs/${jobOrderId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add note",
    };
  }
}

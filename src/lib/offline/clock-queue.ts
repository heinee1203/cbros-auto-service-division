import { getOfflineDB } from "./db";

export async function enqueueClockAction(
  type: "clock_in" | "clock_out",
  payload: {
    pin: string;
    taskId?: string;
    jobOrderId?: string;
    notes?: string;
  }
) {
  const db = await getOfflineDB();
  await db.add("clock-queue", {
    type,
    pin: payload.pin,
    taskId: payload.taskId,
    jobOrderId: payload.jobOrderId,
    notes: payload.notes,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getQueuedClockActions() {
  const db = await getOfflineDB();
  return db.getAllFromIndex("clock-queue", "by-created");
}

export async function getClockQueueCount() {
  const db = await getOfflineDB();
  return db.count("clock-queue");
}

export async function syncClockActions(): Promise<{ synced: number; failed: number }> {
  const db = await getOfflineDB();
  const items = await db.getAllFromIndex("clock-queue", "by-created");
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retryCount >= 5) {
      failed++;
      continue;
    }

    try {
      const response = await fetch("/api/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: item.type,
          pin: item.pin,
          taskId: item.taskId,
          jobOrderId: item.jobOrderId,
          notes: item.notes,
          offlineTimestamp: item.timestamp,
        }),
      });

      if (response.ok) {
        await db.delete("clock-queue", item.id!);
        synced++;
      } else {
        const data = await response.json().catch(() => ({}));
        // Skip duplicates (already clocked in/out)
        if (data.error?.includes("already") || data.error?.includes("duplicate")) {
          await db.delete("clock-queue", item.id!);
          synced++; // Count as handled
        } else {
          const tx = db.transaction("clock-queue", "readwrite");
          const store = tx.objectStore("clock-queue");
          const record = await store.get(item.id!);
          if (record) {
            record.retryCount++;
            await store.put(record);
          }
          await tx.done;
          failed++;
        }
      }
    } catch {
      const tx = db.transaction("clock-queue", "readwrite");
      const store = tx.objectStore("clock-queue");
      const record = await store.get(item.id!);
      if (record) {
        record.retryCount++;
        await store.put(record);
      }
      await tx.done;
      failed++;
    }
  }

  return { synced, failed };
}

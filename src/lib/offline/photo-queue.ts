import { getOfflineDB } from "./db";

const MAX_RETRIES = 5;

export async function enqueuePhoto(
  file: File,
  metadata: {
    entityType: string;
    entityId: string;
    category: string;
    stage: string;
    jobOrderId: string;
  }
) {
  const db = await getOfflineDB();
  await db.add("photo-queue", {
    blob: file,
    fileName: file.name,
    entityType: metadata.entityType,
    entityId: metadata.entityId,
    category: metadata.category,
    stage: metadata.stage,
    jobOrderId: metadata.jobOrderId,
    capturedAt: new Date().toISOString(),
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getQueuedPhotos() {
  const db = await getOfflineDB();
  return db.getAll("photo-queue");
}

export async function getQueueCount() {
  const db = await getOfflineDB();
  return db.count("photo-queue");
}

export async function removePhoto(id: number) {
  const db = await getOfflineDB();
  await db.delete("photo-queue", id);
}

export async function syncPhotos(): Promise<{ synced: number; failed: number }> {
  const db = await getOfflineDB();
  const items = await db.getAll("photo-queue");
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRIES) {
      failed++;
      continue;
    }

    try {
      const formData = new FormData();
      const file = new File([item.blob], item.fileName, { type: "image/jpeg" });
      formData.append("file", file);
      formData.append("entityType", item.entityType);
      formData.append("entityId", item.entityId);
      formData.append("category", item.category);
      formData.append("stage", item.stage);
      formData.append("jobOrderId", item.jobOrderId);
      formData.append("capturedAt", item.capturedAt);

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await db.delete("photo-queue", item.id!);
        synced++;
      } else {
        // Increment retry count
        const tx = db.transaction("photo-queue", "readwrite");
        const store = tx.objectStore("photo-queue");
        const record = await store.get(item.id!);
        if (record) {
          record.retryCount++;
          await store.put(record);
        }
        await tx.done;
        failed++;
      }
    } catch {
      // Network error — increment retry
      const tx = db.transaction("photo-queue", "readwrite");
      const store = tx.objectStore("photo-queue");
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

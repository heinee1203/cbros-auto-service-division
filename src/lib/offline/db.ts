import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface AutoServOfflineDB extends DBSchema {
  "photo-queue": {
    key: number;
    value: {
      id?: number;
      blob: Blob;
      fileName: string;
      entityType: string;
      entityId: string;
      category: string;
      stage: string;
      jobOrderId: string;
      capturedAt: string;
      retryCount: number;
      createdAt: string;
    };
    indexes: {
      "by-entity": string;
      "by-created": string;
    };
  };
  "clock-queue": {
    key: number;
    value: {
      id?: number;
      type: "clock_in" | "clock_out";
      pin: string;
      taskId?: string;
      jobOrderId?: string;
      notes?: string;
      timestamp: string;
      retryCount: number;
      createdAt: string;
    };
    indexes: {
      "by-created": string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AutoServOfflineDB>> | null = null;

export function getOfflineDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<AutoServOfflineDB>("autoserv-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("photo-queue")) {
          const photoStore = db.createObjectStore("photo-queue", {
            keyPath: "id",
            autoIncrement: true,
          });
          photoStore.createIndex("by-entity", "entityId");
          photoStore.createIndex("by-created", "createdAt");
        }
        if (!db.objectStoreNames.contains("clock-queue")) {
          const clockStore = db.createObjectStore("clock-queue", {
            keyPath: "id",
            autoIncrement: true,
          });
          clockStore.createIndex("by-created", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

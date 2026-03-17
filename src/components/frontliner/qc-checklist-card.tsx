"use client";

import { useState, useRef, useTransition } from "react";
import { updateChecklistItemAction } from "@/lib/actions/qc-actions";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QCChecklistCardProps {
  item: {
    id: string;
    description: string;
    category: string;
    status: string;
    notes: string | null;
  };
  inspectionId: string;
  jobId: string;
  onStatusChange: (itemId: string, newStatus: string) => void;
}

export function QCChecklistCard({
  item,
  inspectionId,
  jobId,
  onStatusChange,
}: QCChecklistCardProps) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoThumb, setPhotoThumb] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onStatusChange(item.id, newStatus);
    startTransition(async () => {
      const result = await updateChecklistItemAction(item.id, jobId, {
        checklistItemId: item.id,
        status: newStatus,
        notes: newStatus === "FAIL" ? notes || null : null,
        photoId: newStatus === "FAIL" ? photoId : null,
      });
      if (!result.success) {
        toast.error(result.error || "Failed to update item");
        setStatus(item.status);
        onStatusChange(item.id, item.status);
      }
    });
  };

  const handleNotesBlur = () => {
    if (status !== "FAIL") return;
    startTransition(async () => {
      const result = await updateChecklistItemAction(item.id, jobId, {
        checklistItemId: item.id,
        status,
        notes: notes || null,
        photoId,
      });
      if (!result.success) {
        toast.error(result.error || "Failed to save notes");
      }
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "QC_INSPECTION");
      formData.append("entityId", inspectionId);
      formData.append("stage", "QC");
      formData.append("category", item.description);

      const resp = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error("Upload failed");

      const data = await resp.json();
      setPhotoId(data.id);
      setPhotoThumb(data.thumbnailPath);

      // Update checklist item with photo
      startTransition(async () => {
        await updateChecklistItemAction(item.id, jobId, {
          checklistItemId: item.id,
          status,
          notes: notes || null,
          photoId: data.id,
        });
      });
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const btnBase =
    "flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold transition-colors";

  return (
    <div className="rounded-xl bg-[var(--sch-card)] p-4">
      <p className="mb-3 text-base font-medium text-[var(--sch-text)]">
        {item.description}
      </p>

      <div className="flex gap-3">
        {/* Pass */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleStatusChange("PASS")}
          className={`${btnBase} ${
            status === "PASS"
              ? "bg-emerald-600 text-white"
              : "bg-[var(--sch-surface)] text-[var(--sch-text-dim)]"
          }`}
          aria-label="Pass"
        >
          {"\u2705"}
        </button>

        {/* Fail */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleStatusChange("FAIL")}
          className={`${btnBase} ${
            status === "FAIL"
              ? "bg-red-600 text-white"
              : "bg-[var(--sch-surface)] text-[var(--sch-text-dim)]"
          }`}
          aria-label="Fail"
        >
          {"\u274C"}
        </button>

        {/* N/A */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleStatusChange("NA")}
          className={`${btnBase} ${
            status === "NA" && item.status !== "NA"
              ? "bg-[var(--sch-text-dim)] text-white"
              : "bg-[var(--sch-surface)] text-[var(--sch-text-dim)]"
          }`}
          aria-label="Not Applicable"
        >
          {"\u2796"}
        </button>
      </div>

      {/* Fail details section */}
      {status === "FAIL" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Describe the issue..."
            rows={2}
            className="w-full rounded-lg bg-[var(--sch-surface)] p-3 text-sm text-[var(--sch-text)] placeholder:text-[var(--sch-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--sch-accent)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-12 min-h-[48px] items-center gap-2 rounded-lg bg-[var(--sch-surface)] px-3 text-sm text-[var(--sch-text-muted)] transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Add Photo"}
            </button>
            {photoThumb && (
              <img
                src={photoThumb}
                alt="QC issue"
                className="h-10 w-10 rounded-lg object-cover"
              />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

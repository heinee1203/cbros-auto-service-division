"use client";

import { useState, useRef, useMemo } from "react";
import { CheckCircle2, Circle, Camera, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MILESTONE_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ExistingPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  category: string | null;
  createdAt: string;
}

interface MilestonePhotosProps {
  taskId: string;
  taskName: string;
  jobOrderNumber: string;
  serviceCatalogId?: string | null;
  requiredMilestonePhotos: string | null;
  existingPhotos: ExistingPhoto[];
  onUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MilestonePhotos({
  taskId,
  taskName,
  jobOrderNumber,
  requiredMilestonePhotos,
  existingPhotos,
  onUpdate,
}: MilestonePhotosProps) {
  const [uploadingMilestone, setUploadingMilestone] = useState<string | null>(
    null
  );

  // Parse milestone IDs from JSON string
  const milestoneIds = useMemo<string[]>(() => {
    if (!requiredMilestonePhotos) return [];
    try {
      const parsed = JSON.parse(requiredMilestonePhotos);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }, [requiredMilestonePhotos]);

  // Group existing photos by milestone category
  const photosByMilestone = useMemo(() => {
    const map = new Map<string, ExistingPhoto[]>();
    for (const photo of existingPhotos) {
      if (photo.category) {
        const list = map.get(photo.category) || [];
        list.push(photo);
        map.set(photo.category, list);
      }
    }
    return map;
  }, [existingPhotos]);

  // Progress stats
  const completedCount = milestoneIds.filter(
    (id) => (photosByMilestone.get(id)?.length ?? 0) >= 1
  ).length;
  const totalCount = milestoneIds.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Upload handler
  async function handleUpload(milestoneId: string, file: File) {
    setUploadingMilestone(milestoneId);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "TASK");
      formData.append("entityId", taskId);
      formData.append("stage", "PROGRESS");
      formData.append("category", milestoneId);
      formData.append("jobOrderNumber", jobOrderNumber);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Upload failed");
      }

      const label = MILESTONE_LABELS[milestoneId] || milestoneId;
      toast.success(`${label} photo uploaded`);
      onUpdate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setUploadingMilestone(null);
    }
  }

  // No milestones configured
  if (milestoneIds.length === 0) {
    return (
      <div className="text-sm text-surface-400 py-4 text-center">
        No milestone photos configured for this service.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Progress bar */}
      <div className="flex items-center gap-3 pb-3 mb-1">
        <span className="text-sm font-medium text-surface-600 whitespace-nowrap">
          {completedCount} of {totalCount} milestones
        </span>
        <div className="flex-1 h-2 rounded-full bg-surface-200">
          <div
            className="h-2 rounded-full bg-accent-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestone rows */}
      {milestoneIds.map((milestoneId) => (
        <MilestoneRow
          key={milestoneId}
          milestoneId={milestoneId}
          photos={photosByMilestone.get(milestoneId) || []}
          isUploading={uploadingMilestone === milestoneId}
          onUpload={(file) => handleUpload(milestoneId, file)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestoneRow
// ---------------------------------------------------------------------------
interface MilestoneRowProps {
  milestoneId: string;
  photos: ExistingPhoto[];
  isUploading: boolean;
  onUpload: (file: File) => void;
}

function MilestoneRow({
  milestoneId,
  photos,
  isUploading,
  onUpload,
}: MilestoneRowProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const label = MILESTONE_LABELS[milestoneId] || milestoneId;
  const hasPhotos = photos.length >= 1;
  const displayPhotos = photos.slice(0, 3);
  const extraCount = photos.length - 3;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset the input so same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-100">
      {/* Status icon */}
      {hasPhotos ? (
        <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-surface-300 flex-shrink-0" />
      )}

      {/* Label + thumbnails */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-medium",
            hasPhotos ? "text-surface-700" : "text-surface-500"
          )}
        >
          {label}
        </span>

        {displayPhotos.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {displayPhotos.map((photo) => (
              <img
                key={photo.id}
                src={photo.thumbnailUrl || photo.url}
                alt={label}
                className="w-12 h-12 rounded object-cover"
              />
            ))}
            {extraCount > 0 && (
              <span className="text-xs text-surface-400 ml-1">
                +{extraCount} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Upload buttons or loading spinner */}
      {isUploading ? (
        <Loader2 className="w-5 h-5 text-accent-500 animate-spin flex-shrink-0" />
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Camera button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            title="Take photo"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Gallery button */}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            title="Choose from gallery"
          >
            <Image className="w-4 h-4" />
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}

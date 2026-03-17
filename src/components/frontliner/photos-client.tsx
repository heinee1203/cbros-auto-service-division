"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Loader2, ImageOff } from "lucide-react";
import { MILESTONE_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TaskPhoto {
  id: string;
  category: string | null;
  thumbnailPath: string;
}

interface TaskData {
  id: string;
  name: string;
  jobOrderNumber: string;
  plateNumber: string;
  milestones: string[];
  photos: TaskPhoto[];
}

interface PhotosClientProps {
  tasks: TaskData[];
  mode: "technician" | "qc";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PhotosClient({ tasks, mode }: PhotosClientProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [localPhotos, setLocalPhotos] = useState<
    Record<string, Record<string, TaskPhoto>>
  >(() => {
    // Initialize lookup: taskId -> { category -> photo }
    const map: Record<string, Record<string, TaskPhoto>> = {};
    for (const t of tasks) {
      map[t.id] = {};
      for (const p of t.photos) {
        if (p.category) {
          map[t.id][p.category] = p;
        }
      }
    }
    return map;
  });
  const [uploadingMilestone, setUploadingMilestone] = useState<string | null>(
    null
  );

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const milestoneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pillsRef = useRef<HTMLDivElement | null>(null);

  const selectedTask = tasks[selectedIndex];

  // Count completed milestones for the selected task
  const countCompleted = useCallback(
    (task: TaskData) => {
      const taskPhotos = localPhotos[task.id] || {};
      return task.milestones.filter((m) => taskPhotos[m]).length;
    },
    [localPhotos]
  );

  // ---------------------------------------------------------------------------
  // Upload handler
  // ---------------------------------------------------------------------------
  async function handlePhotoUpload(milestone: string, file: File) {
    if (!selectedTask) return;

    setUploadingMilestone(milestone);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", mode === "technician" ? "TASK" : "JOB_ORDER");
      formData.append("entityId", selectedTask.id);
      formData.append("stage", mode === "technician" ? "PROGRESS" : "QC");
      formData.append("category", milestone);
      formData.append("jobOrderNumber", selectedTask.jobOrderNumber);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();

      // Update local state with new photo
      setLocalPhotos((prev) => ({
        ...prev,
        [selectedTask.id]: {
          ...prev[selectedTask.id],
          [milestone]: {
            id: data.id,
            category: milestone,
            thumbnailPath: data.thumbnailPath,
          },
        },
      }));

      toast.success("Photo saved");

      // Auto-advance: find next empty milestone and scroll into view
      const currentIdx = selectedTask.milestones.indexOf(milestone);
      const updatedPhotos = {
        ...localPhotos[selectedTask.id],
        [milestone]: { id: data.id, category: milestone, thumbnailPath: data.thumbnailPath },
      };
      for (let i = currentIdx + 1; i < selectedTask.milestones.length; i++) {
        const nextMilestone = selectedTask.milestones[i];
        if (!updatedPhotos[nextMilestone]) {
          // Scroll to the next empty milestone
          setTimeout(() => {
            milestoneRefs.current[nextMilestone]?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }, 300);
          break;
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setUploadingMilestone(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <ImageOff className="w-12 h-12 text-[var(--sch-text-dim)] mb-4" />
        <p className="text-[var(--sch-text-muted)] text-sm">
          No active tasks with photo requirements
        </p>
      </div>
    );
  }

  if (!selectedTask) return null;

  const taskPhotos = localPhotos[selectedTask.id] || {};
  const completed = countCompleted(selectedTask);
  const total = selectedTask.milestones.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4 pb-8">
      {/* ------------------------------------------------------------------- */}
      {/* Task selector pills                                                 */}
      {/* ------------------------------------------------------------------- */}
      {tasks.length > 1 && (
        <div
          ref={pillsRef}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1"
        >
          {tasks.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setSelectedIndex(idx)}
              className={`shrink-0 h-12 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sch-accent)] ${
                idx === selectedIndex
                  ? "bg-[var(--sch-accent)] text-black"
                  : "bg-[var(--sch-surface)] text-[var(--sch-text-muted)]"
              }`}
            >
              <span className="block truncate max-w-[160px]">{t.name}</span>
              <span className="block text-xs font-mono opacity-70">
                {t.plateNumber}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Selected task header                                                */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-[var(--sch-card)] rounded-xl p-4">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-base font-semibold text-[var(--sch-text)] truncate">
            {selectedTask.name}
          </h2>
          <span className="font-mono text-xs text-[var(--sch-text-muted)] shrink-0 ml-2">
            {selectedTask.jobOrderNumber}
          </span>
        </div>
        <span className="font-mono text-xs text-[var(--sch-text-muted)]">
          {selectedTask.plateNumber}
        </span>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Progress indicator                                                  */}
      {/* ------------------------------------------------------------------- */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[var(--sch-text-muted)]">
            <span className="font-mono">{completed}</span> of <span className="font-mono">{total}</span> milestones documented
          </span>
          <span className="font-mono text-xs text-[var(--sch-text-muted)]">
            {progressPct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--sch-surface)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--sch-accent)] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Milestone grid (2 columns)                                          */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        {selectedTask.milestones.map((milestone) => {
          const photo = taskPhotos[milestone];
          const label = MILESTONE_LABELS[milestone] || milestone.replace(/_/g, " ");
          const isUploading = uploadingMilestone === milestone;
          const inputKey = `${selectedTask.id}-${milestone}`;

          return (
            <div
              key={milestone}
              ref={(el) => {
                milestoneRefs.current[milestone] = el;
              }}
              className="bg-[var(--sch-card)] rounded-xl overflow-hidden"
            >
              {photo ? (
                /* Photo exists — show thumbnail with overlay label */
                <div className="relative aspect-square">
                  <Image
                    src={photo.thumbnailPath}
                    alt={label}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 200px"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
                    <p className="text-xs text-white font-medium truncate capitalize">
                      {label}
                    </p>
                  </div>
                </div>
              ) : (
                /* No photo — camera trigger */
                <button
                  onClick={() => fileInputRefs.current[inputKey]?.click()}
                  disabled={isUploading}
                  className="w-full aspect-square flex flex-col items-center justify-center gap-2 text-[var(--sch-text-dim)] hover:text-[var(--sch-accent)] transition-colors disabled:opacity-50 relative min-h-[48px]"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-xs">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8" />
                      <span className="text-xs font-medium capitalize px-2 text-center">
                        {label}
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Hidden file input — one per milestone per task */}
              <input
                ref={(el) => {
                  fileInputRefs.current[inputKey] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handlePhotoUpload(milestone, file);
                    e.target.value = "";
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

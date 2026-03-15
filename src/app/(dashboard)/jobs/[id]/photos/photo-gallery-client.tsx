"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

// --- Types ---

interface Photo {
  id: string;
  entityType: string;
  entityId: string;
  stage: string;
  category: string | null;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string } | null;
}

interface PhotoGalleryClientProps {
  photos: Photo[];
  taskMap: Record<string, string>;
  jobOrderNumber: string;
}

// --- Helpers ---

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  INTAKE: {
    label: "Intake",
    color: "bg-blue-100 text-blue-700",
  },
  PROGRESS: {
    label: "Progress",
    color: "bg-amber-100 text-amber-700",
  },
  QC: {
    label: "QC",
    color: "bg-purple-100 text-purple-700",
  },
  RELEASE: {
    label: "Release",
    color: "bg-green-100 text-green-700",
  },
};

function getStageBadge(stage: string) {
  const config = STAGE_CONFIG[stage] ?? {
    label: stage,
    color: "bg-surface-100 text-surface-600",
  };
  return config;
}

function deriveStage(photo: Photo): string {
  // Map entityType to display stage
  if (photo.entityType === "INTAKE") return "INTAKE";
  if (photo.entityType === "TASK") return "PROGRESS";
  if (photo.entityType === "QC_INSPECTION") return "QC";
  if (photo.entityType === "RELEASE") return "RELEASE";
  // Fallback to the photo's own stage field
  return photo.stage;
}

// --- Components ---

function StageBadge({ stage }: { stage: string }) {
  const { label, color } = getStageBadge(stage);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        color
      )}
    >
      {label}
    </span>
  );
}

// --- Main Component ---

export default function PhotoGalleryClient({
  photos,
  taskMap,
  jobOrderNumber,
}: PhotoGalleryClientProps) {
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [taskFilter, setTaskFilter] = useState<string>("ALL");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Derive display stage for each photo
  const photosWithStage = useMemo(
    () =>
      photos.map((p) => ({
        ...p,
        displayStage: deriveStage(p),
      })),
    [photos]
  );

  // Count per stage
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of photosWithStage) {
      counts[p.displayStage] = (counts[p.displayStage] || 0) + 1;
    }
    return counts;
  }, [photosWithStage]);

  // Get unique task IDs that have photos
  const taskIdsWithPhotos = useMemo(() => {
    const ids = new Set<string>();
    for (const p of photosWithStage) {
      if (p.displayStage === "PROGRESS" && p.entityId) {
        ids.add(p.entityId);
      }
    }
    return Array.from(ids);
  }, [photosWithStage]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    let result = photosWithStage;

    if (stageFilter !== "ALL") {
      result = result.filter((p) => p.displayStage === stageFilter);
    }

    if (stageFilter === "PROGRESS" && taskFilter !== "ALL") {
      result = result.filter((p) => p.entityId === taskFilter);
    }

    return result;
  }, [photosWithStage, stageFilter, taskFilter]);

  // Summary text
  const summaryParts: string[] = [];
  for (const stage of ["INTAKE", "PROGRESS", "QC", "RELEASE"]) {
    const count = stageCounts[stage];
    if (count) {
      summaryParts.push(
        `${STAGE_CONFIG[stage]?.label ?? stage}: ${count}`
      );
    }
  }
  const summaryText =
    photos.length > 0
      ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} — ${summaryParts.join(", ")}`
      : "";

  // Lightbox navigation
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const goToPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null && prev > 0 ? prev - 1 : prev
    );
  }, []);

  const goToNext = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null && prev < filteredPhotos.length - 1 ? prev + 1 : prev
    );
  }, [filteredPhotos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, closeLightbox, goToPrev, goToNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (lightboxIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxIndex]);

  const currentPhoto =
    lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  // Empty state
  if (photos.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-primary">Photo Gallery</h2>
        <EmptyState
          icon={Camera}
          title="No photos yet"
          description="Photos will appear here as they are captured during intake and service"
          className="mt-8"
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-primary">Photo Gallery</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-600">
          {photos.length}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value);
            setTaskFilter("ALL");
          }}
          className="px-3 py-1.5 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="ALL">All Stages ({photos.length})</option>
          {(["INTAKE", "PROGRESS", "QC", "RELEASE"] as const).map(
            (stage) =>
              (stageCounts[stage] ?? 0) > 0 && (
                <option key={stage} value={stage}>
                  {STAGE_CONFIG[stage].label} ({stageCounts[stage]})
                </option>
              )
          )}
        </select>

        {stageFilter === "PROGRESS" && taskIdsWithPhotos.length > 0 && (
          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="ALL">All Tasks</option>
            {taskIdsWithPhotos.map((tid) => (
              <option key={tid} value={tid}>
                {taskMap[tid] ?? tid}
              </option>
            ))}
          </select>
        )}

        <span className="text-xs text-surface-400 ml-auto">
          {summaryText}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {filteredPhotos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openLightbox(index)}
            className="group relative aspect-square rounded-lg overflow-hidden bg-surface-100 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbnailUrl ?? photo.url}
              alt={photo.caption ?? `${photo.displayStage} photo`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-start p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <StageBadge stage={photo.displayStage} />
            </div>
          </button>
        ))}
      </div>

      {filteredPhotos.length === 0 && (
        <div className="text-center py-12 text-sm text-surface-400">
          No photos match the current filter.
        </div>
      )}

      {/* Lightbox */}
      {currentPhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous button */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10 p-2"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Next button */}
          {lightboxIndex < filteredPhotos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10 p-2"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <div
            className="flex-1 flex items-center justify-center w-full px-16 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhoto.url}
              alt={currentPhoto.caption ?? `${currentPhoto.displayStage} photo`}
              className="max-h-[80vh] max-w-full object-contain rounded"
            />
          </div>

          {/* Info bar */}
          <div
            className="w-full max-w-2xl px-6 py-3 flex items-center gap-4 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <StageBadge stage={currentPhoto.displayStage} />

            {currentPhoto.displayStage === "PROGRESS" &&
              taskMap[currentPhoto.entityId] && (
                <span className="text-white/70">
                  {taskMap[currentPhoto.entityId]}
                </span>
              )}

            {currentPhoto.category && (
              <span className="text-white/50">
                {currentPhoto.category.replace(/_/g, " ")}
              </span>
            )}

            {currentPhoto.caption && (
              <span className="text-white/70 truncate">
                {currentPhoto.caption}
              </span>
            )}

            <span className="text-white/50 ml-auto whitespace-nowrap">
              {currentPhoto.uploadedBy
                ? `${currentPhoto.uploadedBy.firstName} ${currentPhoto.uploadedBy.lastName}`
                : ""}
              {currentPhoto.uploadedBy && " · "}
              {formatDateTime(currentPhoto.createdAt)}
            </span>

            <span className="text-white/40 text-xs whitespace-nowrap">
              {lightboxIndex + 1} / {filteredPhotos.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

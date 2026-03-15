"use client";

import { useState, useRef, useCallback } from "react";
import {
  Columns,
  SlidersHorizontal,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoData {
  id: string;
  fullSizePath: string;
  thumbnailPath: string;
}

interface PhotoPair {
  angle: string;
  label: string;
  intake: PhotoData | null;
  release: PhotoData | null;
}

interface BeforeAfterViewerProps {
  pairs: PhotoPair[];
  unmatchedIntake?: Array<{
    id: string;
    category: string | null;
    thumbnailPath: string;
    fullSizePath: string;
  }>;
  unmatchedRelease?: Array<{
    id: string;
    category: string | null;
    thumbnailPath: string;
    fullSizePath: string;
  }>;
}

type ViewMode = "side-by-side" | "slider";

export function BeforeAfterViewer({
  pairs,
  unmatchedIntake,
  unmatchedRelease,
}: BeforeAfterViewerProps) {
  const [mode, setMode] = useState<ViewMode>("side-by-side");
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pairs with at least one photo (for side-by-side)
  const visiblePairs = pairs.filter((p) => p.intake || p.release);

  // Pairs with both photos (for slider)
  const validPairs = pairs.filter((p) => p.intake && p.release);

  const currentPair = validPairs[currentPairIndex] ?? null;

  const handleDrag = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100)
    );
    setSliderPos(pos);
  }, []);

  const startDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      setIsDragging(true);
      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      handleDrag(clientX);
    },
    [handleDrag]
  );

  const onDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging) return;
      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      handleDrag(clientX);
    },
    [isDragging, handleDrag]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  const hasAnyPhotos =
    visiblePairs.length > 0 ||
    (unmatchedIntake && unmatchedIntake.length > 0) ||
    (unmatchedRelease && unmatchedRelease.length > 0);

  if (!hasAnyPhotos) {
    return (
      <div className="bg-white rounded-lg border border-surface-200 p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">
          Before &amp; After Comparison
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-surface-400">
          <ImageOff className="w-12 h-12 mb-3" />
          <p className="text-sm">No photos to compare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">
        Before &amp; After Comparison
      </h3>

      {/* Mode Toggle */}
      <div className="flex bg-surface-100 rounded-lg p-1 mb-4">
        <button
          onClick={() => setMode("side-by-side")}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
            mode === "side-by-side"
              ? "bg-white shadow-sm text-primary"
              : "text-surface-500"
          )}
        >
          <Columns className="w-4 h-4 inline mr-1.5" /> Side by Side
        </button>
        <button
          onClick={() => setMode("slider")}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
            mode === "slider"
              ? "bg-white shadow-sm text-primary"
              : "text-surface-500"
          )}
        >
          <SlidersHorizontal className="w-4 h-4 inline mr-1.5" /> Slider
        </button>
      </div>

      {/* Side-by-Side Mode */}
      {mode === "side-by-side" && (
        <div className="space-y-6">
          {visiblePairs.map((pair) => (
            <div key={pair.angle}>
              <p className="text-sm font-medium text-surface-700 mb-2">
                {pair.label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-surface-500 uppercase font-medium mb-1">
                    Before
                  </p>
                  {pair.intake ? (
                    <img
                      src={pair.intake.fullSizePath}
                      alt={`Before - ${pair.label}`}
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <div className="bg-surface-100 rounded-lg aspect-[4/3] flex items-center justify-center text-surface-400">
                      <ImageOff className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-surface-500 uppercase font-medium mb-1">
                    After
                  </p>
                  {pair.release ? (
                    <img
                      src={pair.release.fullSizePath}
                      alt={`After - ${pair.label}`}
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <div className="bg-surface-100 rounded-lg aspect-[4/3] flex items-center justify-center text-surface-400">
                      <ImageOff className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slider Mode */}
      {mode === "slider" && (
        <>
          {validPairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400">
              <ImageOff className="w-12 h-12 mb-3" />
              <p className="text-sm">
                No matched photo pairs available for slider view
              </p>
            </div>
          ) : currentPair ? (
            <>
              <p className="text-sm font-medium text-surface-700 mb-2">
                {currentPair.label}
              </p>
              <div
                ref={containerRef}
                className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-100"
              >
                {/* Intake (below) */}
                {currentPair.intake && (
                  <img
                    src={currentPair.intake.fullSizePath}
                    alt={`Before - ${currentPair.label}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {/* Release (above, clipped) */}
                {currentPair.release && (
                  <img
                    src={currentPair.release.fullSizePath}
                    alt={`After - ${currentPair.label}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                    }}
                  />
                )}
                {/* Divider line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <GripVertical className="w-4 h-4 text-surface-500" />
                  </div>
                </div>
                {/* Labels */}
                <span className="absolute top-3 left-3 px-2 py-1 bg-black/50 text-white text-xs rounded">
                  BEFORE
                </span>
                <span className="absolute top-3 right-3 px-2 py-1 bg-black/50 text-white text-xs rounded">
                  AFTER
                </span>
                {/* Drag area */}
                <div
                  className="absolute inset-0 z-20 cursor-ew-resize"
                  style={{ touchAction: "none" }}
                  onMouseDown={startDrag}
                  onMouseMove={onDrag}
                  onMouseUp={stopDrag}
                  onMouseLeave={stopDrag}
                  onTouchStart={startDrag}
                  onTouchMove={onDrag}
                  onTouchEnd={stopDrag}
                />
              </div>
              {/* Prev/Next controls */}
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() =>
                    setCurrentPairIndex((i) => Math.max(0, i - 1))
                  }
                  disabled={currentPairIndex === 0}
                  className={cn(
                    "flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors",
                    currentPairIndex === 0
                      ? "text-surface-300 cursor-not-allowed"
                      : "text-surface-600 hover:bg-surface-100"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-surface-500">
                  {currentPairIndex + 1} of {validPairs.length} &mdash;{" "}
                  {currentPair.label}
                </span>
                <button
                  onClick={() =>
                    setCurrentPairIndex((i) =>
                      Math.min(validPairs.length - 1, i + 1)
                    )
                  }
                  disabled={currentPairIndex === validPairs.length - 1}
                  className={cn(
                    "flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors",
                    currentPairIndex === validPairs.length - 1
                      ? "text-surface-300 cursor-not-allowed"
                      : "text-surface-600 hover:bg-surface-100"
                  )}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export interface AnimalPhotoItem {
  id: string;
  src: string;
  alt: string;
  label: string;
  sourceLabel: string;
  capturedAtLabel: string | null;
}

interface AnimalPhotoViewerProps {
  animalTagId: string;
  photos: AnimalPhotoItem[];
}

export function AnimalPhotoViewer({ animalTagId, photos }: AnimalPhotoViewerProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const clampedActivePhotoIndex = photos.length
    ? Math.min(activePhotoIndex, photos.length - 1)
    : -1;
  const activePhoto = clampedActivePhotoIndex >= 0 ? photos[clampedActivePhotoIndex] : null;

  function closeLightbox() {
    setIsLightboxOpen(false);
  }

  function moveToPhoto(offset: number) {
    if (!photos.length || clampedActivePhotoIndex < 0) return;
    const nextIndex = (clampedActivePhotoIndex + offset + photos.length) % photos.length;
    setActivePhotoIndex(nextIndex);
  }

  useEffect(() => {
    if (!isLightboxOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        setActivePhotoIndex((previousIndex) => {
          if (!photos.length) return previousIndex;
          const baseIndex = Math.min(previousIndex, photos.length - 1);
          return (baseIndex - 1 + photos.length) % photos.length;
        });
      } else if (event.key === "ArrowRight") {
        setActivePhotoIndex((previousIndex) => {
          if (!photos.length) return previousIndex;
          const baseIndex = Math.min(previousIndex, photos.length - 1);
          return (baseIndex + 1) % photos.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, photos.length]);

  if (!photos.length) {
    return (
      <p className="rounded-xl border bg-surface px-3 py-2 text-sm text-foreground-muted">
        No photos uploaded for this animal yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activePhoto ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="group relative block w-full overflow-hidden rounded-xl border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Expand photo: ${activePhoto.label}`}
          >
            <Image
              src={activePhoto.src}
              alt={activePhoto.alt}
              width={1200}
              height={900}
              unoptimized
              className="h-56 w-full object-cover sm:h-72"
            />
            <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">
              <Expand className="h-3.5 w-3.5" />
              Expand
            </span>
            {photos.length > 1 ? (
              <span className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                {clampedActivePhotoIndex + 1} of {photos.length}
              </span>
            ) : null}
          </button>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{activePhoto.label}</p>
            <p className="text-xs text-foreground-muted">
              {activePhoto.sourceLabel}
              {activePhoto.capturedAtLabel
                ? ` | Captured ${activePhoto.capturedAtLabel}`
                : ""}
            </p>
          </div>
        </div>
      ) : null}

      {photos.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {photos.map((photo, index) => {
            const isActive = photo.id === activePhoto?.id;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActivePhotoIndex(index)}
                className={`overflow-hidden rounded-lg border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? "ring-2 ring-accent" : ""
                }`}
                aria-current={isActive ? "true" : "false"}
                aria-label={`View photo: ${photo.label}`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={240}
                  height={180}
                  unoptimized
                  className="h-16 w-full object-cover sm:h-20"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {isLightboxOpen && activePhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="relative w-full max-w-6xl">
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-10 right-0 inline-flex items-center gap-1 rounded-lg border border-white/25 bg-black/40 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/60"
              aria-label="Close photo viewer"
            >
              <X className="h-4 w-4" />
              Close
            </button>

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => moveToPhoto(-1)}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/25 bg-black/50 p-2 text-white hover:bg-black/70"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveToPhoto(1)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/25 bg-black/50 p-2 text-white hover:bg-black/70"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-white/20 bg-black/30 p-2">
              <Image
                src={activePhoto.src}
                alt={activePhoto.alt}
                width={2000}
                height={1500}
                unoptimized
                className="max-h-[78vh] w-full rounded-lg object-contain"
              />
            </div>
            <p className="mt-2 text-sm text-white">
              {animalTagId} | {activePhoto.label}
              {activePhoto.capturedAtLabel
                ? ` | Captured ${activePhoto.capturedAtLabel}`
                : ""}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

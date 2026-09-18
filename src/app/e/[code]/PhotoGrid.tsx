"use client";

import { useRef, useState } from "react";

type Photo = {
  id: string;
  viewUrl: string;
  downloadUrl: string;
  mimeType: string;
};

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "6px",
          width: "100%",
          maxWidth: "42rem",
        }}
      >
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            style={{
              display: "block",
              position: "relative",
              aspectRatio: "1",
              overflow: "hidden",
              borderRadius: "6px",
              background: "rgba(128, 128, 128, 0.15)",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {photo.mimeType.startsWith("video/") ? (
              <video
                src={photo.viewUrl}
                muted
                playsInline
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.viewUrl}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          photo={photos[openIndex]}
          onClose={() => setOpenIndex(null)}
          onPrev={() => setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length))}
          onNext={() => setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length))}
        />
      )}
    </>
  );
}

function Lightbox({
  photo,
  onClose,
  onPrev,
  onNext,
}: {
  photo: Photo;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const touchStartX = useRef<number | null>(null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.95)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = event.changedTouches[0].clientX - touchStartX.current;
        if (delta > 50) onPrev();
        else if (delta < -50) onNext();
        touchStartX.current = null;
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "none",
          border: "none",
          color: "white",
          fontSize: "1.5rem",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous"
        style={{
          position: "absolute",
          left: 4,
          background: "none",
          border: "none",
          color: "white",
          fontSize: "2rem",
          cursor: "pointer",
          padding: "12px",
        }}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next"
        style={{
          position: "absolute",
          right: 4,
          background: "none",
          border: "none",
          color: "white",
          fontSize: "2rem",
          cursor: "pointer",
          padding: "12px",
        }}
      >
        ›
      </button>

      <div
        style={{
          maxWidth: "100%",
          maxHeight: "75vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photo.mimeType.startsWith("video/") ? (
          <video
            src={photo.viewUrl}
            controls
            playsInline
            style={{ maxWidth: "100%", maxHeight: "75vh" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.viewUrl}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }}
          />
        )}
      </div>

      <p
        style={{
          color: "rgba(255, 255, 255, 0.6)",
          fontSize: "0.8rem",
          marginTop: "16px",
          textAlign: "center",
        }}
      >
        Press and hold to save to your photos, or{" "}
        <a href={photo.downloadUrl} style={{ color: "white", textDecoration: "underline" }}>
          download
        </a>
        .
      </p>
    </div>
  );
}

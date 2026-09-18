"use client";

import { useRef, useState } from "react";

type Photo = {
  id: string;
  viewUrl: string;
  mimeType: string;
};

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div
        style={{
          columnCount: 2,
          columnGap: "8px",
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
              width: "100%",
              marginBottom: "8px",
              breakInside: "avoid",
              borderRadius: "4px",
              overflow: "hidden",
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
                style={{ width: "100%", display: "block" }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.viewUrl}
                alt=""
                loading="lazy"
                style={{ width: "100%", display: "block" }}
              />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          photo={photos[openIndex]}
          index={openIndex}
          total={photos.length}
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
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  photo: Photo;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const touchStartY = useRef<number | null>(null);

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
        touchStartY.current = event.touches[0].clientY;
      }}
      onTouchEnd={(event) => {
        if (touchStartY.current === null) return;
        const delta = event.changedTouches[0].clientY - touchStartY.current;
        // Swipe up (like TikTok/Instagram) advances to the next photo;
        // swipe down goes back, matching a vertical feed gesture.
        if (delta < -50) onNext();
        else if (delta > 50) onPrev();
        touchStartY.current = null;
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
          top: 4,
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          color: "white",
          fontSize: "1.5rem",
          cursor: "pointer",
          padding: "12px",
        }}
      >
        ▲
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next"
        style={{
          position: "absolute",
          bottom: 4,
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          color: "white",
          fontSize: "1.5rem",
          cursor: "pointer",
          padding: "12px",
        }}
      >
        ▼
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
          letterSpacing: "0.1em",
          marginTop: "16px",
          textAlign: "center",
        }}
      >
        {index + 1} / {total}
      </p>
    </div>
  );
}

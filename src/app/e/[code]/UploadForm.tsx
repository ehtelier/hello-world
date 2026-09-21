"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmUpload, requestUpload } from "./actions";
import { getCapturedAt } from "@/lib/capturedAt";
import { captureVideoThumbnail } from "@/lib/videoThumbnail";

async function putFile(uploadUrl: string, contentType: string, body: Blob) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!response.ok) {
    throw new Error("Upload failed");
  }
}

export function UploadForm({ code }: { code: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    let done = 0;
    let failed = 0;
    setStatus(`Uploading 0 of ${files.length}...`);

    // One at a time, not all at once: large video files uploaded
    // concurrently can exceed a phone's memory/connection and fail.
    for (const file of files) {
      try {
        const contentType = file.type || "application/octet-stream";
        const capturedAt = await getCapturedAt(file);

        const { uploadUrl, storageKey } = await requestUpload(code, file.name, contentType);
        await putFile(uploadUrl, contentType, file);

        let thumbKey: string | null = null;
        if (contentType.startsWith("video/")) {
          const thumbBlob = await captureVideoThumbnail(file);
          if (thumbBlob) {
            const thumb = await requestUpload(code, `${file.name}-thumb.jpg`, "image/jpeg");
            await putFile(thumb.uploadUrl, "image/jpeg", thumbBlob);
            thumbKey = thumb.storageKey;
          }
        }

        await confirmUpload(code, storageKey, file.name, contentType, file.size, capturedAt, thumbKey);
        done += 1;
      } catch {
        failed += 1;
      }
      setStatus(`Uploading ${done + failed} of ${files.length}...`);
    }

    setStatus(failed > 0 ? `Done, but ${failed} failed. Try again for those.` : "Done.");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
    setTimeout(() => setStatus(""), 4000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <input
        ref={inputRef}
        id="upload-input"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            handleFiles(event.target.files);
          }
        }}
        style={{ display: "none" }}
      />
      <label
        htmlFor="upload-input"
        style={{
          padding: "14px 28px",
          borderRadius: "8px",
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Upload photos & videos
      </label>
      {status && <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>{status}</p>}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmUpload, requestUpload } from "./actions";
import { getCapturedAt } from "@/lib/capturedAt";
import { captureVideoThumbnail } from "@/lib/videoThumbnail";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mobile connections drop mid-transfer, especially on weak signal with
// large video files; retry transient failures a couple of times before
// giving up, with a short growing delay between attempts.
async function putFile(uploadUrl: string, contentType: string, body: Blob, attempts = 3) {
  let lastError: Error = new Error("upload failed");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      });
      if (response.ok) return;

      const bodyText = await response.text().catch(() => "");
      lastError = new Error(
        `upload rejected: ${response.status} ${response.statusText}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ""}`
      );
      // A real rejection (bad signature, expired URL, etc.) won't succeed
      // on retry; only server errors are worth retrying.
      if (response.status < 500) break;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastError = new Error(`network error (${reason})`);
    }

    if (attempt < attempts) {
      await wait(1500 * attempt);
    }
  }

  throw lastError;
}

export function UploadForm({ code }: { code: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    let done = 0;
    const failures: { name: string; reason: string }[] = [];
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
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ name: file.name, reason });
      }
      setStatus(`Uploading ${done + failures.length} of ${files.length}...`);
    }

    if (failures.length > 0) {
      setStatus(
        `Done, but ${failures.length} failed: ${failures.map((f) => `${f.name} (${f.reason})`).join("; ")}`
      );
    } else {
      setStatus("Done.");
      setTimeout(() => setStatus(""), 4000);
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
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
      {status && (
        <p style={{ fontSize: "0.85rem", opacity: 0.7, maxWidth: "24rem", textAlign: "center" }}>
          {status}
        </p>
      )}
    </div>
  );
}

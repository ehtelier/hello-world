"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmUpload, requestUpload } from "./actions";
import { getCapturedAt } from "@/lib/capturedAt";

export function UploadForm({ code }: { code: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    let done = 0;
    setStatus(`Uploading 0 of ${files.length}...`);

    try {
      await Promise.all(
        files.map(async (file) => {
          const contentType = file.type || "application/octet-stream";
          const capturedAt = await getCapturedAt(file);
          const { uploadUrl, storageKey } = await requestUpload(code, file.name, contentType);

          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: file,
          });
          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`);
          }

          await confirmUpload(code, storageKey, file.name, contentType, file.size, capturedAt);
          done += 1;
          setStatus(`Uploading ${done} of ${files.length}...`);
        })
      );
      setStatus("Done.");
    } catch {
      setStatus("Something went wrong. Try again.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
      setTimeout(() => setStatus(""), 2500);
    }
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

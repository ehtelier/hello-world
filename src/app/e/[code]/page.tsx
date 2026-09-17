import { sql, type EventRow } from "@/lib/db";
import { createDownloadUrl, createViewUrl } from "@/lib/r2";
import { buildDownloadFilename } from "@/lib/downloadName";
import { UploadForm } from "./UploadForm";
import { PhotoGrid } from "./PhotoGrid";

type PhotoRow = {
  id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  byte_size: string;
  uploaded_at: string;
};

export default async function EventGallery({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = code.trim().toUpperCase();

  const [event] = (await sql`
    SELECT * FROM events WHERE code = ${normalizedCode} LIMIT 1
  `) as EventRow[];

  if (!event || event.disabled) {
    return (
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          gap: "16px",
        }}
      >
        <p style={{ letterSpacing: "0.3em", fontSize: "0.7rem", opacity: 0.5 }}>
          NO ENTRY
        </p>
        <p style={{ maxWidth: "22rem", opacity: 0.75 }}>
          That code does not open any door.
        </p>
      </main>
    );
  }

  // Fetched oldest-first so the sequence number in each download's filename
  // reflects upload order and stays stable as new photos are added later.
  const photosAsc = (await sql`
    SELECT * FROM photos WHERE event_id = ${event.id} ORDER BY uploaded_at ASC
  `) as PhotoRow[];

  const photosWithUrls = await Promise.all(
    photosAsc.map(async (photo, index) => {
      const downloadName = buildDownloadFilename(event.name, index + 1, photo.filename);
      return {
        ...photo,
        viewUrl: await createViewUrl(photo.storage_key),
        downloadUrl: await createDownloadUrl(photo.storage_key, downloadName, photo.mime_type),
      };
    })
  );
  // Newest first for display, independent of the ascending numbering above.
  photosWithUrls.reverse();

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px",
        gap: "24px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ letterSpacing: "0.3em", fontSize: "0.7rem", opacity: 0.5 }}>
          YOU ARE IN
        </p>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600 }}>{event.name}</h1>
      </div>

      <UploadForm code={event.code} />

      {photosWithUrls.length === 0 ? (
        <p style={{ opacity: 0.6, textAlign: "center" }}>
          No photos yet. Be the first to upload.
        </p>
      ) : (
        <PhotoGrid
          photos={photosWithUrls.map((photo) => ({
            id: photo.id,
            viewUrl: photo.viewUrl,
            downloadUrl: photo.downloadUrl,
            mimeType: photo.mime_type,
          }))}
        />
      )}
    </main>
  );
}

import { sql } from "@/lib/db";
import { createViewUrl } from "@/lib/r2";
import { resolveAccess } from "@/lib/access";
import { UploadForm } from "./UploadForm";
import { PhotoGrid } from "./PhotoGrid";

type PhotoRow = {
  id: string;
  storage_key: string;
  thumb_key: string | null;
  filename: string;
  mime_type: string;
  byte_size: string;
  uploaded_at: string;
  uploader_name: string | null;
};

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export default async function EventGallery({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = code.trim().toUpperCase();

  const access = await resolveAccess(normalizedCode);

  if (!access || access.event.disabled) {
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

  const { event, attendee } = access;

  // Ordered by when each photo/video was actually taken (falling back to
  // upload time if that's unknown), not by upload order, so the gallery
  // reads as the day actually unfolded no matter who uploaded what when.
  const photosByCaptureTime = (await sql`
    SELECT photos.*, attendees.name AS uploader_name
    FROM photos
    LEFT JOIN attendees ON attendees.id = photos.attendee_id
    WHERE photos.event_id = ${event.id}
    ORDER BY COALESCE(photos.taken_at, photos.uploaded_at) ASC
  `) as PhotoRow[];

  const photosWithUrls = await Promise.all(
    photosByCaptureTime.map(async (photo) => ({
      ...photo,
      viewUrl: await createViewUrl(photo.storage_key),
      thumbUrl: photo.thumb_key ? await createViewUrl(photo.thumb_key) : null,
    }))
  );

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
          {attendee ? `YOU ARE IN, ${attendee.name.toUpperCase()}` : "YOU ARE IN"}
        </p>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600 }}>{event.name}</h1>
      </div>

      <UploadForm code={normalizedCode} />

      {photosWithUrls.length === 0 ? (
        <p style={{ opacity: 0.6, textAlign: "center" }}>
          No photos yet. Be the first to upload.
        </p>
      ) : (
        <PhotoGrid
          photos={photosWithUrls.map((photo) => ({
            id: photo.id,
            viewUrl: photo.viewUrl,
            thumbUrl: photo.thumbUrl,
            mimeType: photo.mime_type,
            uploaderFirstName: photo.uploader_name ? firstNameOf(photo.uploader_name) : null,
          }))}
        />
      )}
    </main>
  );
}

import {
  sql,
  type EventRow,
  ITINERARY_VISIBLE_STATUSES,
  GALLERY_VISIBLE_STATUSES,
  UPLOAD_ENABLED_STATUSES,
} from "@/lib/db";
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

function formatEventWhen(event: EventRow): string | null {
  const parts: string[] = [];
  if (event.event_date) {
    // Neon returns `date` columns as JS Date objects at runtime despite the
    // EventRow type saying string, so this has to accept either shape.
    const raw = event.event_date as unknown as string | Date;
    const date = raw instanceof Date ? raw : new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));
    }
  }
  if (event.area) parts.push(event.area);
  return parts.length ? parts.join(" · ") : null;
}

function StageHeader({
  event,
  participantName,
}: {
  event: EventRow;
  participantName: string | null;
}) {
  const when = formatEventWhen(event);
  let eyebrow: string;
  let bodyCopy: string | null = null;

  switch (event.status) {
    case "draft":
      eyebrow = "NOT OPEN YET";
      bodyCopy = "This event hasn't been announced yet. Check back soon.";
      break;
    case "inviting":
      eyebrow = "YOU'RE INVITED";
      bodyCopy = "More details, including where we're shooting, will follow closer to the day.";
      break;
    case "confirmed":
      eyebrow = participantName ? `YOU'RE IN, ${participantName.toUpperCase()}` : "YOU'RE IN";
      bodyCopy = "We'll share where we're shooting closer to the day.";
      break;
    case "live":
      eyebrow = participantName ? `YOU'RE IN, ${participantName.toUpperCase()}` : "YOU'RE IN";
      break;
    case "gallery":
      eyebrow = "THE GALLERY";
      break;
    case "archived":
      eyebrow = "ARCHIVED";
      bodyCopy = "This event has wrapped. The gallery below is read-only.";
      break;
  }

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ letterSpacing: "0.3em", fontSize: "0.7rem", opacity: 0.5 }}>{eyebrow}</p>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 600 }}>{event.name}</h1>
      {when && <p style={{ fontSize: "0.85rem", opacity: 0.6, marginTop: "4px" }}>{when}</p>}
      {bodyCopy && <p style={{ maxWidth: "22rem", opacity: 0.75, marginTop: "10px" }}>{bodyCopy}</p>}
    </div>
  );
}

function Itinerary({ event }: { event: EventRow }) {
  const legs = [
    { label: "SHOOT", location: event.shoot_location, time: event.shoot_time },
    { label: "DISCOVER", location: event.discover_location, time: event.discover_time },
    { label: "HANG", location: event.hang_location, time: event.hang_time },
  ].filter((leg) => leg.location || leg.time);

  const hasMeetingPoint =
    event.meeting_point_name || event.meeting_point_address || event.meeting_point_map_link;

  if (legs.length === 0 && !hasMeetingPoint) return null;

  return (
    <div style={{ width: "100%", maxWidth: "28rem", display: "flex", flexDirection: "column", gap: "16px" }}>
      {hasMeetingPoint && (
        <div
          style={{
            textAlign: "center",
            padding: "16px",
            border: "1px solid rgba(128, 128, 128, 0.3)",
            borderRadius: "10px",
          }}
        >
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", opacity: 0.5, marginBottom: "6px" }}>
            MEETING POINT
          </p>
          {event.meeting_point_name && <p style={{ fontWeight: 600 }}>{event.meeting_point_name}</p>}
          {event.meeting_point_address && (
            <p style={{ fontSize: "0.85rem", opacity: 0.75 }}>{event.meeting_point_address}</p>
          )}
          {event.estimated_steps && <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>{event.estimated_steps}</p>}
          {event.meeting_point_map_link && (
            <a
              href={event.meeting_point_map_link}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.8rem", textDecoration: "underline" }}
            >
              Open map
            </a>
          )}
        </div>
      )}

      {legs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {legs.map((leg) => (
            <div
              key={leg.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
                paddingBottom: "8px",
              }}
            >
              <div>
                <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", opacity: 0.5 }}>{leg.label}</p>
                {leg.location && <p style={{ fontSize: "0.95rem" }}>{leg.location}</p>}
              </div>
              {leg.time && <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>{leg.time}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const { event, participant } = access;

  const showItinerary = ITINERARY_VISIBLE_STATUSES.includes(event.status);
  const showGallery = GALLERY_VISIBLE_STATUSES.includes(event.status);
  const allowUpload = UPLOAD_ENABLED_STATUSES.includes(event.status);

  let photosWithUrls: Array<
    PhotoRow & { viewUrl: string; thumbUrl: string | null }
  > = [];

  if (showGallery) {
    // Ordered by when each photo/video was actually taken (falling back to
    // upload time if that's unknown), not by upload order, so the gallery
    // reads as the day actually unfolded no matter who uploaded what when.
    const photosByCaptureTime = (await sql`
      SELECT photos.*, participants.first_name AS uploader_name
      FROM photos
      LEFT JOIN participants ON participants.id = photos.participant_id
      WHERE photos.event_id = ${event.id}
      ORDER BY COALESCE(photos.taken_at, photos.uploaded_at) ASC
    `) as PhotoRow[];

    photosWithUrls = await Promise.all(
      photosByCaptureTime.map(async (photo) => ({
        ...photo,
        viewUrl: await createViewUrl(photo.storage_key),
        thumbUrl: photo.thumb_key ? await createViewUrl(photo.thumb_key) : null,
      }))
    );
  }

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
      <StageHeader event={event} participantName={participant?.name ?? null} />

      {showItinerary && <Itinerary event={event} />}

      {allowUpload && <UploadForm code={normalizedCode} />}

      {showGallery &&
        (photosWithUrls.length === 0 ? (
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
              uploaderFirstName: photo.uploader_name,
            }))}
          />
        ))}
    </main>
  );
}

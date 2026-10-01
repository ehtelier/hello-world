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

const BRAND = "PARIS PHOTO CLUB";
const editorialSerifStack = "var(--font-editorial-serif), Georgia, serif";
const functionalSansStack = "var(--font-functional-sans), Arial, Helvetica, sans-serif";

// Date-only columns carry no time zone; reading them with local getters can
// roll the date back a day depending on the viewer's time zone, so this
// reads UTC getters instead of letting toLocaleDateString pick local ones.
function formatEventDateLine(event: EventRow): string | null {
  if (!event.event_date) return null;
  // Neon returns `date` columns as JS Date objects at runtime despite the
  // EventRow type saying string, so this has to accept either shape.
  const raw = event.event_date as unknown as string | Date;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getUTCDate();
  const month = date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }).toUpperCase();
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

// draft / inviting / confirmed: the event hasn't started, so there's
// nothing to show but the invitation itself — no itinerary, gallery, or
// upload form yet, just the save-the-date.
function InvitationScreen({
  event,
  participantName,
}: {
  event: EventRow;
  participantName: string | null;
}) {
  const dateLine = formatEventDateLine(event);
  const eyebrow =
    event.status === "inviting" ? "YOU'RE INVITED" : event.status === "confirmed" ? "YOU'RE IN" : "NOT ANNOUNCED YET";
  const closingLine = event.status === "draft" ? "Nothing to see yet." : "The rest will follow.";

  return (
    <main
      style={{
        flex: 1,
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "40px 24px",
        textAlign: "center",
        gap: "40px",
        fontFamily: functionalSansStack,
      }}
    >
      <p style={{ fontSize: "0.65rem", letterSpacing: "0.3em", opacity: 0.45 }}>{BRAND}</p>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
        <div>
          {event.ppc_number && (
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.5, marginBottom: "6px" }}>
              {event.ppc_number}
            </p>
          )}
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.25em", opacity: 0.6 }}>{eyebrow}</p>
        </div>

        <h1
          style={{
            fontFamily: editorialSerifStack,
            fontWeight: 400,
            fontSize: "clamp(2.75rem, 12vw, 4.5rem)",
            lineHeight: 1,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
          }}
        >
          {event.name}
        </h1>

        {dateLine && <p style={{ fontSize: "0.9rem", letterSpacing: "0.15em", opacity: 0.65 }}>{dateLine}</p>}

        <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.4, marginTop: "10px" }}>
          SHOOT → DISCOVER → HANG
        </p>

        <p style={{ fontWeight: 400, fontSize: "0.85rem", opacity: 0.85 }}>{closingLine}</p>
      </div>

      <p style={{ fontSize: "0.6rem", letterSpacing: "0.2em", opacity: 0.35 }}>
        PRIVATE INVITATION{participantName ? ` · FOR ${participantName.toUpperCase()}` : ""}
      </p>
    </main>
  );
}

// live / gallery / archived: the itinerary and/or gallery render below this,
// so it's a compact header rather than a full-bleed screen.
function StageHeader({
  event,
  participantName,
}: {
  event: EventRow;
  participantName: string | null;
}) {
  const dateAreaLine = [formatEventDateLine(event), event.area].filter(Boolean).join(" · ");

  let eyebrow = participantName ? `YOU'RE IN, ${participantName.toUpperCase()}` : "YOU'RE IN";
  if (event.status === "gallery") eyebrow = "THE GALLERY";
  if (event.status === "archived") eyebrow = "ARCHIVED";

  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <p style={{ fontSize: "0.6rem", letterSpacing: "0.3em", opacity: 0.4 }}>{BRAND}</p>
      {event.ppc_number && (
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", opacity: 0.45 }}>{event.ppc_number}</p>
      )}
      <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.55, marginTop: "4px" }}>{eyebrow}</p>
      <h1
        style={{
          fontFamily: editorialSerifStack,
          fontWeight: 400,
          fontSize: "clamp(2rem, 8vw, 3rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
        }}
      >
        {event.name}
      </h1>
      {dateAreaLine && <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "2px" }}>{dateAreaLine}</p>}
      {event.status === "archived" && (
        <p style={{ maxWidth: "22rem", opacity: 0.8, marginTop: "8px", fontWeight: 400 }}>
          This event has wrapped. The gallery below is read-only.
        </p>
      )}
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
          fontFamily: functionalSansStack,
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

  if (event.status === "draft" || event.status === "inviting" || event.status === "confirmed") {
    return <InvitationScreen event={event} participantName={participant?.name ?? null} />;
  }

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
        fontFamily: functionalSansStack,
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

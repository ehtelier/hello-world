import {
  sql,
  type EventRow,
  ITINERARY_VISIBLE_STATUSES,
  GALLERY_VISIBLE_STATUSES,
  UPLOAD_ENABLED_STATUSES,
} from "@/lib/db";
import { createViewUrl } from "@/lib/r2";
import { resolveAccess } from "@/lib/access";
import { acceptInvitation, declineInvitation, markInvitationOpened } from "./actions";
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

type Participant = NonNullable<Awaited<ReturnType<typeof resolveAccess>>>["participant"];

const BRAND = "PARIS PHOTO CLUB";
const editorialSerifStack = "var(--font-editorial-serif), Georgia, serif";
const functionalSansStack = "var(--font-functional-sans), Arial, Helvetica, sans-serif";

const screenStyle: React.CSSProperties = {
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
};

const eventNameStyle: React.CSSProperties = {
  fontFamily: editorialSerifStack,
  fontWeight: 400,
  fontSize: "clamp(2.5rem, 11vw, 4rem)",
  lineHeight: 1,
  letterSpacing: "-0.01em",
  textTransform: "uppercase",
};

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

// invited / opened: the minimal pre-acceptance screen. No gallery
// credential to remember yet, no tagline — just enough to decide.
function PendingInvitationScreen({ event, code }: { event: EventRow; code: string }) {
  const dateLine = formatEventDateLine(event);
  const timeRange = [event.start_time, event.end_time].filter(Boolean).join(" — ");

  return (
    <main style={screenStyle}>
      <p style={{ fontSize: "0.65rem", letterSpacing: "0.3em", opacity: 0.45 }}>{BRAND}</p>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        {event.ppc_number && (
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.5 }}>{event.ppc_number}</p>
        )}

        <h1 style={eventNameStyle}>{event.name}</h1>

        {dateLine && <p style={{ fontSize: "0.9rem", letterSpacing: "0.15em", opacity: 0.65 }}>{dateLine}</p>}
        {timeRange && <p style={{ fontSize: "0.85rem", letterSpacing: "0.1em", opacity: 0.55 }}>{timeRange}</p>}
        {event.area && (
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.2em", opacity: 0.45 }}>{event.area.toUpperCase()}</p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <form action={acceptInvitation.bind(null, code)}>
          <button
            type="submit"
            style={{
              padding: "14px 32px",
              borderRadius: "8px",
              border: "none",
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 600,
              fontSize: "0.85rem",
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            ACCEPT INVITATION
          </button>
        </form>
        <form action={declineInvitation.bind(null, code)}>
          <button
            type="submit"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              opacity: 0.4,
              fontSize: "0.75rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Decline
          </button>
        </form>
      </div>
    </main>
  );
}

// declined / cancelled: a quiet dead end, not an error.
function RespondedScreen({ event, status }: { event: EventRow; status: "declined" | "cancelled" }) {
  return (
    <main style={screenStyle}>
      <p style={{ fontSize: "0.65rem", letterSpacing: "0.3em", opacity: 0.45 }}>{BRAND}</p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <h1 style={eventNameStyle}>{event.name}</h1>
        <p style={{ fontSize: "0.95rem", opacity: 0.6 }}>
          {status === "declined" ? "you declined this invitation." : "this invitation has been cancelled."}
        </p>
      </div>
      <div />
    </main>
  );
}

// draft / inviting / confirmed, once accepted (or for the unattributed
// general code, which has no accept step): the save-the-date, no itinerary.
function AcceptedScreen({
  event,
  participant,
}: {
  event: EventRow;
  participant: Participant;
}) {
  const dateLine = formatEventDateLine(event);
  const eyebrow =
    event.status === "draft" ? "NOT ANNOUNCED YET" : participant?.invitationStatus === "accepted" ? "YOU'RE IN" : "YOU'RE INVITED";
  const closingLine = event.status === "draft" ? "Nothing to see yet." : "the rest will follow.";

  return (
    <main style={screenStyle}>
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

        <h1 style={{ ...eventNameStyle, fontSize: "clamp(2.75rem, 12vw, 4.5rem)" }}>{event.name}</h1>

        {dateLine && <p style={{ fontSize: "0.9rem", letterSpacing: "0.15em", opacity: 0.65 }}>{dateLine}</p>}

        <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.4, marginTop: "10px" }}>
          SHOOT → DISCOVER → HANG
        </p>

        <p style={{ fontWeight: 400, fontSize: "0.95rem", opacity: 0.85 }}>{closingLine}</p>
      </div>

      <p style={{ fontSize: "0.6rem", letterSpacing: "0.2em", opacity: 0.35 }}>
        PRIVATE INVITATION{participant ? ` · FOR ${participant.name.toUpperCase()}` : ""}
      </p>
    </main>
  );
}

// brief: the organizer has "released the brief" ~24-48h out. Information
// becomes the reveal — meeting point, then shoot/discover/hang, times and
// all.
function BriefScreen({ event }: { event: EventRow }) {
  const dateLine = formatEventDateLine(event);
  const legs = [
    { label: "MEET", time: event.meeting_point_time, location: event.meeting_point_name ?? event.meeting_point_address },
    { label: "SHOOT", time: event.shoot_time, location: event.shoot_location },
    { label: "DISCOVER", time: event.discover_time, location: event.discover_location },
    { label: "HANG", time: event.hang_time, location: event.hang_location },
  ].filter((leg) => leg.time || leg.location);

  return (
    <main style={screenStyle}>
      <div>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.3em", opacity: 0.45 }}>{BRAND}</p>
        {event.ppc_number && (
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.5, marginTop: "6px" }}>
            {event.ppc_number}
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", width: "100%" }}>
        <p style={{ fontSize: "0.8rem", letterSpacing: "0.3em", opacity: 0.6 }}>THE BRIEF</p>
        <h1 style={{ ...eventNameStyle, fontSize: "clamp(2rem, 9vw, 3.25rem)" }}>{event.name}</h1>
        {dateLine && <p style={{ fontSize: "0.85rem", letterSpacing: "0.15em", opacity: 0.6 }}>{dateLine}</p>}

        {legs.length > 0 && (
          <div
            style={{
              width: "100%",
              maxWidth: "26rem",
              borderTop: "1px solid rgba(128, 128, 128, 0.3)",
              marginTop: "8px",
              paddingTop: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            {legs.map((leg) => (
              <div key={leg.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.5 }}>{leg.label}</p>
                <div style={{ textAlign: "right" }}>
                  {leg.time && <p style={{ fontSize: "0.9rem" }}>{leg.time}</p>}
                  {leg.location && <p style={{ fontSize: "0.8rem", opacity: 0.65 }}>{leg.location}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {event.meeting_point_map_link && (
          <a
            href={event.meeting_point_map_link}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "0.75rem", letterSpacing: "0.1em", opacity: 0.6, textDecoration: "underline", marginTop: "8px" }}
          >
            OPEN MEETING POINT ↗
          </a>
        )}
      </div>

      <p style={{ fontSize: "0.6rem", letterSpacing: "0.2em", opacity: 0.35 }}>{BRAND}</p>
    </main>
  );
}

// live only: the meeting point + shoot/discover/hang, with real times and
// locations — the itinerary made concrete.
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
            MEET HERE
          </p>
          {event.meeting_point_time && <p style={{ fontSize: "0.85rem", opacity: 0.75 }}>{event.meeting_point_time}</p>}
          {event.meeting_point_name && <p style={{ fontWeight: 600 }}>{event.meeting_point_name}</p>}
          {event.meeting_point_address && (
            <p style={{ fontSize: "0.85rem", opacity: 0.75 }}>{event.meeting_point_address}</p>
          )}
          {event.meeting_point_map_link && (
            <a
              href={event.meeting_point_map_link}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.8rem", textDecoration: "underline" }}
            >
              Open in Maps
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

// archived: an artifact. Locations only, no times — what happened, not when.
function ArchivedItineraryRecap({ event }: { event: EventRow }) {
  const legs = [
    { label: "SHOOT", location: event.shoot_location },
    { label: "DISCOVER", location: event.discover_location },
    { label: "HANG", location: event.hang_location },
  ].filter((leg) => leg.location);

  if (legs.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", textAlign: "center" }}>
      {legs.map((leg) => (
        <p key={leg.label} style={{ fontSize: "0.85rem", opacity: 0.7 }}>
          {leg.label} — {leg.location}
        </p>
      ))}
    </div>
  );
}

// live / gallery / archived: the itinerary and/or gallery render below this,
// so it's a compact header rather than a full-bleed screen.
function StageHeader({
  event,
  participantName,
  momentsCount,
}: {
  event: EventRow;
  participantName: string | null;
  momentsCount: number | null;
}) {
  const dateLine = formatEventDateLine(event);

  // live: streamlined on purpose — brand + PPC number, name, date, nothing
  // else. No eyebrow, no "TODAY", no moments count; the itinerary and
  // gallery/upload below speak for themselves.
  if (event.status === "live") {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
        <p style={{ display: "flex", gap: "14px", fontSize: "0.6rem", letterSpacing: "0.3em", opacity: 0.4 }}>
          <span>{BRAND}</span>
          {event.ppc_number && <span>{event.ppc_number}</span>}
        </p>
        <h1 style={{ ...eventNameStyle, fontSize: "clamp(2rem, 8vw, 3rem)", lineHeight: 1.05 }}>{event.name}</h1>
        {dateLine && <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>{dateLine}</p>}
      </div>
    );
  }

  const dateAreaLine = [dateLine, event.area].filter(Boolean).join(" · ");

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
      <h1 style={{ ...eventNameStyle, fontSize: "clamp(2rem, 8vw, 3rem)", lineHeight: 1.05 }}>{event.name}</h1>
      {dateAreaLine && <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "2px" }}>{dateAreaLine}</p>}
      {momentsCount !== null && (
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", opacity: 0.5, marginTop: "4px" }}>
          {momentsCount} {momentsCount === 1 ? "MOMENT" : "MOMENTS"}
        </p>
      )}
      {event.status === "archived" && <ArchivedItineraryRecap event={event} />}
      {event.status === "archived" && (
        <p style={{ maxWidth: "22rem", opacity: 0.8, marginTop: "8px", fontWeight: 400 }}>
          This event has wrapped. The gallery below is read-only.
        </p>
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

  if (participant?.invitationStatus === "invited") {
    await markInvitationOpened(normalizedCode);
  }

  const preBrief = event.status === "draft" || event.status === "inviting" || event.status === "confirmed";

  if (preBrief && participant && (participant.invitationStatus === "invited" || participant.invitationStatus === "opened")) {
    return <PendingInvitationScreen event={event} code={normalizedCode} />;
  }

  if (preBrief && participant && (participant.invitationStatus === "declined" || participant.invitationStatus === "cancelled")) {
    return <RespondedScreen event={event} status={participant.invitationStatus} />;
  }

  if (preBrief) {
    return <AcceptedScreen event={event} participant={participant} />;
  }

  if (event.status === "brief") {
    return <BriefScreen event={event} />;
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
      <StageHeader
        event={event}
        participantName={participant?.name ?? null}
        momentsCount={showGallery ? photosWithUrls.length : null}
      />

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

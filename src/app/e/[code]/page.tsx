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
import { DeclineControl } from "./DeclineControl";
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

// Event titles use the same Montserrat system as the rest of the UI, not a
// contrasting display face -- hierarchy comes from scale (a much larger
// size than the surrounding text) and weight, not a different typeface.
// Letter spacing stays minimal/moderate here, unlike the very wide tracking
// used for small labels like PARIS PHOTO CLUB or PRIVATE ACCESS.
const eventNameStyle: React.CSSProperties = {
  fontFamily: functionalSansStack,
  fontWeight: 400,
  fontSize: "clamp(2.5rem, 11vw, 4rem)",
  lineHeight: 1,
  letterSpacing: "0.02em",
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
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear() % 100).padStart(2, "0");
  return `${day} · ${month} · ${year}`;
}

// Times are stored as "HH:MM" (the native format of <input type="time">,
// set by the organizer in the admin form). Guests never see AM/PM or a
// colon — always a plain four-digit 24-hour number, e.g. "14:00" -> "1400",
// "9:00" -> "0900". The stored value itself is untouched; this only
// affects display.
function formatTime24(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const [, hours, minutes] = match;
  return `${hours.padStart(2, "0")}${minutes}`;
}

// invited / opened: the minimal pre-acceptance screen. No gallery
// credential to remember yet, no tagline — just enough to decide.
function PendingInvitationScreen({ event, code }: { event: EventRow; code: string }) {
  const dateLine = formatEventDateLine(event);
  const timeRange = [formatTime24(event.start_time), formatTime24(event.end_time)]
    .filter(Boolean)
    .join(" — ");

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

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
        <form action={acceptInvitation.bind(null, code)}>
          <button
            type="submit"
            style={{
              background: "none",
              border: "none",
              padding: "18px 28px",
              color: "inherit",
              fontWeight: 600,
              fontSize: "0.85rem",
              letterSpacing: "0.15em",
              cursor: "pointer",
            }}
          >
            ACCEPT INVITATION →
          </button>
        </form>
        <DeclineControl onDecline={declineInvitation.bind(null, code)} />
      </div>
    </main>
  );
}

// declined / cancelled: a quiet dead end, not a receipt. The event title
// and an explanation of what they just did both go unsaid — the database
// already knows; they don't need it repeated back to them.
function RespondedScreen({ status }: { status: "declined" | "cancelled" }) {
  return (
    <main style={screenStyle}>
      <p style={{ fontSize: "0.65rem", letterSpacing: "0.3em", opacity: 0.45 }}>{BRAND}</p>
      <p style={{ fontSize: "0.75rem", letterSpacing: "0.25em", opacity: 0.5 }}>
        {status === "declined" ? "MAYBE NEXT TIME." : "INVITATION CANCELLED."}
      </p>
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

  const meet = {
    time: formatTime24(event.meeting_point_time),
    location: event.meeting_point_name ?? event.meeting_point_address,
  };
  const shoot = { time: formatTime24(event.shoot_time), location: event.shoot_location };

  // MEET and SHOOT read as one moment, not two, when they're actually the
  // same moment -- same time, same place.
  const meetIsShoot = Boolean(meet.time) && Boolean(meet.location) && meet.time === shoot.time && meet.location === shoot.location;

  const legs = (
    meetIsShoot
      ? [{ label: "MEET + SHOOT", time: meet.time, location: meet.location }]
      : [
          { label: "MEET", time: meet.time, location: meet.location },
          { label: "SHOOT", time: shoot.time, location: shoot.location },
        ]
  ).concat([
    { label: "DISCOVER", time: formatTime24(event.discover_time), location: event.discover_location },
    { label: "HANG", time: formatTime24(event.hang_time), location: event.hang_location },
  ]).filter((leg) => leg.time || leg.location);

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
              paddingTop: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "32px",
            }}
          >
            {legs.map((leg) => (
              <div key={leg.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", opacity: 0.5 }}>{leg.label}</p>
                <div style={{ textAlign: "right" }}>
                  {leg.time && <p style={{ fontSize: "1.2rem", fontWeight: 500 }}>{leg.time}</p>}
                  {leg.location && <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "2px" }}>{leg.location}</p>}
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
            MEETING POINT ↗︎
          </a>
        )}
      </div>

      <p style={{ fontSize: "0.6rem", letterSpacing: "0.2em", opacity: 0.35 }}>{BRAND}</p>
    </main>
  );
}

// live only: the meeting point + shoot/discover/hang, with real times and
// locations — the itinerary made concrete.
// live only: the meeting point moved to The Brief (where attendees still
// need arrival info) -- by live, the day starts directly with SHOOT.
function Itinerary({ event }: { event: EventRow }) {
  const legs = [
    { label: "SHOOT", location: event.shoot_location, time: formatTime24(event.shoot_time) },
    { label: "DISCOVER", location: event.discover_location, time: formatTime24(event.discover_time) },
    { label: "HANG", location: event.hang_location, time: formatTime24(event.hang_time) },
  ].filter((leg) => leg.location || leg.time);

  if (legs.length === 0) return null;

  return (
    <div style={{ width: "100%", maxWidth: "28rem", display: "flex", flexDirection: "column", gap: "10px" }}>
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
            <p style={{ fontSize: "0.6rem", letterSpacing: "0.2em", opacity: 0.5 }}>{leg.label}</p>
            {leg.location && <p style={{ fontSize: "0.85rem", opacity: 0.85 }}>{leg.location}</p>}
          </div>
          {leg.time && <p style={{ fontSize: "0.75rem", fontWeight: 400, opacity: 0.45 }}>{leg.time}</p>}
        </div>
      ))}
    </div>
  );
}

// live / gallery / archived: one master header shared by all three, so the
// event page reads as the same page evolving over time rather than three
// separate designs. Just brand + PPC number inline, title, date -- no
// eyebrow, no status label, nothing else. The itinerary / upload-or-closing
// line / moments count / grid below do the rest of the talking.
function StageHeader({ event }: { event: EventRow }) {
  const dateLine = formatEventDateLine(event);

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
    return <RespondedScreen status={participant.invitationStatus} />;
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
      <StageHeader event={event} />

      {showItinerary && <Itinerary event={event} />}

      {allowUpload && <UploadForm code={normalizedCode} />}
      {event.status === "archived" && (
        <p style={{ fontSize: "0.75rem", letterSpacing: "0.25em", opacity: 0.4 }}>YOU WERE PART OF THIS.</p>
      )}

      {showGallery && photosWithUrls.length > 0 && (
        <>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", opacity: 0.5 }}>
            {photosWithUrls.length} {photosWithUrls.length === 1 ? "MOMENT" : "MOMENTS"}
          </p>
          <PhotoGrid
            photos={photosWithUrls.map((photo) => ({
              id: photo.id,
              viewUrl: photo.viewUrl,
              thumbUrl: photo.thumbUrl,
              mimeType: photo.mime_type,
              uploaderFirstName: photo.uploader_name,
            }))}
          />
        </>
      )}
    </main>
  );
}

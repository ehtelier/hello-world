import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { sql, EVENT_STATUSES, INVITATION_STATUSES, ATTENDANCE_STATUSES, type EventRow } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { createViewUrl } from "@/lib/r2";
import {
  addParticipant,
  archiveEvent,
  deletePhoto,
  regenerateCredential,
  removeParticipant,
  setEventStatus,
  toggleCredential,
  toggleDisabled,
  unarchiveEvent,
  updateEvent,
  updateParticipantStatus,
} from "../../actions";
import { EventForm } from "../../EventForm";
import { ConfirmButton } from "../../ConfirmButton";
import { DeleteEventButton } from "../../DeleteEventButton";
import { AutoSubmitSelect } from "../../AutoSubmitSelect";

type EventParticipantWithName = {
  id: string;
  participant_id: string;
  code: string;
  invitation_status: string;
  attendance_status: string;
  credential_status: "active" | "disabled";
  date_invited: string;
  first_name: string;
  last_name: string | null;
  photo_count: number;
  video_count: number;
  total_count: number;
};

type PhotoRow = {
  id: string;
  storage_key: string;
  thumb_key: string | null;
  filename: string;
  mime_type: string;
  byte_size: string;
  uploaded_at: string;
  uploader_first_name: string | null;
};

async function baseUrl() {
  const headerList = await headers();
  const host = headerList.get("host");
  return `https://${host}`;
}

export default async function AdminEventDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const { id: eventId } = await params;

  const [event] = (await sql`SELECT * FROM events WHERE id = ${eventId}`) as EventRow[];
  if (!event) {
    notFound();
  }

  const origin = await baseUrl();

  const participants = (await sql`
    SELECT
      event_participants.id,
      event_participants.participant_id,
      event_participants.code,
      event_participants.invitation_status,
      event_participants.attendance_status,
      event_participants.credential_status,
      event_participants.date_invited,
      participants.first_name,
      participants.last_name,
      COUNT(photos.id) FILTER (WHERE photos.mime_type LIKE 'image/%')::int AS photo_count,
      COUNT(photos.id) FILTER (WHERE photos.mime_type LIKE 'video/%')::int AS video_count,
      COUNT(photos.id)::int AS total_count
    FROM event_participants
    JOIN participants ON participants.id = event_participants.participant_id
    LEFT JOIN photos ON photos.participant_id = participants.id AND photos.event_id = event_participants.event_id
    WHERE event_participants.event_id = ${eventId}
    GROUP BY event_participants.id, participants.id
    ORDER BY event_participants.date_invited ASC
  `) as EventParticipantWithName[];

  const participantsWithQr = await Promise.all(
    participants.map(async (p) => ({
      ...p,
      url: `${origin}/e/${p.code}`,
      qr: await QRCode.toDataURL(`${origin}/e/${p.code}`, { margin: 1, width: 140 }),
    }))
  );

  const photos = (await sql`
    SELECT photos.*, participants.first_name AS uploader_first_name
    FROM photos
    LEFT JOIN participants ON participants.id = photos.participant_id
    WHERE photos.event_id = ${eventId}
    ORDER BY photos.uploaded_at DESC
  `) as PhotoRow[];

  const photosWithThumbs = await Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      previewUrl: await createViewUrl(photo.thumb_key ?? photo.storage_key),
      originalUrl: await createViewUrl(photo.storage_key),
    }))
  );

  const [summary] = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE mime_type LIKE 'image/%')::int AS photos,
      COUNT(*) FILTER (WHERE mime_type LIKE 'video/%')::int AS videos,
      COUNT(*)::int AS total,
      COUNT(DISTINCT participant_id)::int AS contributors
    FROM photos WHERE event_id = ${eventId}
  `) as { photos: number; videos: number; total: number; contributors: number }[];

  const eventUrl = `${origin}/e/${event.code}`;

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px",
        gap: "32px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "40rem" }}>
        <a href="/admin" style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          ← All events
        </a>
      </div>

      {/* Event header + access controls */}
      <div style={{ width: "100%", maxWidth: "40rem", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            {event.ppc_number ? `${event.ppc_number}: ` : ""}
            {event.name}
          </h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <form action={setEventStatus.bind(null, eventId)} style={{ display: "flex", gap: "6px" }}>
              <AutoSubmitSelect name="status" options={EVENT_STATUSES} defaultValue={event.status} />
            </form>
            <form
              action={async () => {
                "use server";
                await toggleDisabled(eventId, !event.disabled);
              }}
            >
              <button
                type="submit"
                style={{
                  background: "none",
                  border: "1px solid rgba(128, 128, 128, 0.4)",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                {event.disabled ? "Enable access" : "Disable access"}
              </button>
            </form>
            {event.status === "archived" ? (
              <form action={async () => { "use server"; await unarchiveEvent(eventId); }}>
                <button type="submit" style={{ background: "none", border: "1px solid rgba(128,128,128,0.4)", borderRadius: "6px", padding: "6px 10px", color: "inherit", cursor: "pointer", fontSize: "0.8rem" }}>
                  Reactivate
                </button>
              </form>
            ) : (
              <ConfirmButton
                label="Archive"
                confirmMessage={`Archive "${event.name}"? The gallery and data stay intact.`}
                onConfirm={archiveEvent.bind(null, eventId)}
              />
            )}
            <DeleteEventButton eventId={event.id} eventName={event.name} />
          </div>
        </div>

        {event.disabled && <p style={{ fontSize: "0.8rem", color: "#e5484d" }}>Access is currently disabled.</p>}

        <p style={{ fontSize: "0.8rem", opacity: 0.6, wordBreak: "break-all" }}>
          General code: <span style={{ fontFamily: "monospace" }}>{event.code}</span> — {eventUrl}
        </p>
      </div>

      {/* Contribution summary */}
      <div style={{ width: "100%", maxWidth: "40rem", display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {summary && (
          <>
            <Stat label="Photos" value={summary.photos} />
            <Stat label="Videos" value={summary.videos} />
            <Stat label="Total media" value={summary.total} />
            <Stat label="Contributors" value={summary.contributors} />
          </>
        )}
      </div>

      {/* Edit event details */}
      <section style={{ width: "100%", maxWidth: "40rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px" }}>Event details</h2>
        <EventForm event={event} submitLabel="Save changes" action={updateEvent.bind(null, eventId)} />
      </section>

      {/* Participants */}
      <section style={{ width: "100%", maxWidth: "40rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px" }}>
          Participants ({participantsWithQr.length})
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {participantsWithQr.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: "12px",
                border: "1px solid rgba(128, 128, 128, 0.3)",
                borderRadius: "10px",
                padding: "12px",
                opacity: p.credential_status === "disabled" ? 0.5 : 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.qr} alt="" width={64} height={64} style={{ borderRadius: "4px", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {p.first_name} {p.last_name ?? ""}
                </p>
                <p style={{ fontFamily: "monospace", fontSize: "0.75rem", opacity: 0.7 }}>{p.code}</p>
                <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  {p.photo_count} photos · {p.video_count} videos ({p.total_count} total)
                  {p.credential_status === "disabled" ? " · credential disabled" : ""}
                </p>

                <form
                  action={updateParticipantStatus.bind(null, p.id, eventId)}
                  style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
                >
                  <select
                    name="invitation_status"
                    defaultValue={p.invitation_status}
                    style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: "0.75rem" }}
                  >
                    {INVITATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    name="attendance_status"
                    defaultValue={p.attendance_status}
                    style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: "0.75rem" }}
                  >
                    {ATTENDANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "none", color: "inherit", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    Save
                  </button>
                </form>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <form action={toggleCredential.bind(null, p.id, eventId, p.credential_status === "active" ? "disabled" : "active")}>
                    <button type="submit" style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "none", color: "inherit", cursor: "pointer", fontSize: "0.75rem" }}>
                      {p.credential_status === "active" ? "Disable credential" : "Reactivate credential"}
                    </button>
                  </form>
                  <ConfirmButton
                    label="Regenerate credential"
                    confirmMessage={`Regenerate ${p.first_name}'s code? Their old link will stop working.`}
                    onConfirm={regenerateCredential.bind(null, p.id, eventId)}
                  />
                  <ConfirmButton
                    label="Remove from event"
                    confirmMessage={`Remove ${p.first_name} from this event? Their uploads stay, but their credential is gone.`}
                    onConfirm={removeParticipant.bind(null, p.id, eventId)}
                    variant="danger"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          action={addParticipant.bind(null, eventId)}
          style={{ display: "flex", gap: "8px", marginTop: "16px" }}
        >
          <input
            type="text"
            name="first_name"
            placeholder="First name"
            required
            style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: "0.85rem" }}
          />
          <input
            type="text"
            name="last_name"
            placeholder="Last name (optional)"
            style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: "0.85rem" }}
          />
          <button
            type="submit"
            style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "none", color: "inherit", cursor: "pointer", fontSize: "0.85rem", whiteSpace: "nowrap" }}
          >
            + Add
          </button>
        </form>
      </section>

      {/* Gallery management */}
      <section style={{ width: "100%", maxWidth: "40rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px" }}>
          Gallery ({photosWithThumbs.length})
        </h2>
        {photosWithThumbs.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No uploads yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
            {photosWithThumbs.map((photo) => (
              <div key={photo.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <a href={photo.originalUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "6px", background: "rgba(128,128,128,0.15)" }}
                  />
                </a>
                <p style={{ fontSize: "0.7rem", opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {photo.uploader_first_name ?? "Unattributed"}
                </p>
                <p style={{ fontSize: "0.65rem", opacity: 0.5 }}>
                  {photo.mime_type.startsWith("video/") ? "Video" : "Photo"} ·{" "}
                  {formatBytes(Number(photo.byte_size))} · {formatDate(photo.uploaded_at)}
                </p>
                <ConfirmButton
                  label="Delete"
                  confirmMessage={`Permanently delete this ${photo.mime_type.startsWith("video/") ? "video" : "photo"}? This cannot be undone.`}
                  onConfirm={deletePhoto.bind(null, photo.id, eventId)}
                  variant="danger"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: "90px" }}>
      <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</p>
      <p style={{ fontSize: "0.7rem", opacity: 0.6, letterSpacing: "0.05em" }}>{label.toUpperCase()}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

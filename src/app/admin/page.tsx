import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, type EventRow, type EventStatus } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { createEvent, logout } from "./actions";
import { EventForm } from "./EventForm";

type EventWithCounts = EventRow & {
  participant_count: number;
  upload_count: number;
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  inviting: "Inviting",
  confirmed: "Confirmed",
  live: "Live",
  gallery: "Gallery",
  archived: "Archived",
};

export default async function AdminDashboard() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const events = (await sql`
    SELECT
      events.*,
      COUNT(DISTINCT event_participants.id)::int AS participant_count,
      COUNT(DISTINCT photos.id)::int AS upload_count
    FROM events
    LEFT JOIN event_participants ON event_participants.event_id = events.id
    LEFT JOIN photos ON photos.event_id = events.id
    GROUP BY events.id
    ORDER BY events.created_at DESC
  `) as EventWithCounts[];

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 24px",
        gap: "32px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "40rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Admin</h1>
        <form action={logout}>
          <button
            type="submit"
            style={{
              background: "none",
              border: "1px solid rgba(128, 128, 128, 0.4)",
              borderRadius: "6px",
              padding: "6px 12px",
              color: "inherit",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            Log out
          </button>
        </form>
      </div>

      <details style={{ width: "100%", maxWidth: "40rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "12px" }}>
          + Create event
        </summary>
        <div style={{ marginTop: "16px" }}>
          <EventForm action={createEvent} submitLabel="Create event" />
        </div>
      </details>

      <div style={{ width: "100%", maxWidth: "40rem", display: "flex", flexDirection: "column", gap: "12px" }}>
        {events.length === 0 && <p style={{ opacity: 0.6, textAlign: "center" }}>No events yet.</p>}
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/admin/events/${event.id}`}
            style={{
              display: "block",
              border: "1px solid rgba(128, 128, 128, 0.3)",
              borderRadius: "10px",
              padding: "14px 16px",
              opacity: event.disabled ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
              <p style={{ fontWeight: 600 }}>
                {event.ppc_number ? `${event.ppc_number}: ` : ""}
                {event.name}
              </p>
              <span style={{ fontSize: "0.7rem", letterSpacing: "0.05em", opacity: 0.6, whiteSpace: "nowrap" }}>
                {STATUS_LABEL[event.status]}
                {event.disabled ? " · Disabled" : ""}
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "4px" }}>
              {event.event_date ? `${event.event_date} · ` : ""}
              {event.participant_count} participant{event.participant_count === 1 ? "" : "s"}
              {event.capacity ? ` / ${event.capacity} capacity` : ""} · {event.upload_count} uploaded
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}

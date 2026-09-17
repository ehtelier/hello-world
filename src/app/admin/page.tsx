import { headers } from "next/headers";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { sql, type EventRow } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { addAttendee, createEvent, deleteAttendee, logout, toggleDisabled } from "./actions";
import { DeleteEventButton } from "./DeleteEventButton";

type AttendeeRow = {
  id: string;
  event_id: string;
  code: string;
  name: string;
  created_at: string;
};

type CountRow = { attendee_id: string | null; count: number };

async function baseUrl() {
  const headerList = await headers();
  const host = headerList.get("host");
  return `https://${host}`;
}

export default async function AdminDashboard() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const events = (await sql`
    SELECT * FROM events ORDER BY created_at DESC
  `) as EventRow[];
  const origin = await baseUrl();

  const eventsWithDetails = await Promise.all(
    events.map(async (event) => {
      const attendees = (await sql`
        SELECT * FROM attendees WHERE event_id = ${event.id} ORDER BY created_at ASC
      `) as AttendeeRow[];

      const uploadCounts = (await sql`
        SELECT attendee_id, COUNT(*)::int AS count
        FROM photos WHERE event_id = ${event.id}
        GROUP BY attendee_id
      `) as CountRow[];

      const downloadCounts = (await sql`
        SELECT pd.attendee_id, COUNT(*)::int AS count
        FROM photo_downloads pd
        JOIN photos p ON p.id = pd.photo_id
        WHERE p.event_id = ${event.id}
        GROUP BY pd.attendee_id
      `) as CountRow[];

      const uploadMap = new Map(uploadCounts.map((row) => [row.attendee_id, row.count]));
      const downloadMap = new Map(downloadCounts.map((row) => [row.attendee_id, row.count]));

      const attendeesWithStats = await Promise.all(
        attendees.map(async (attendee) => ({
          ...attendee,
          url: `${origin}/e/${attendee.code}`,
          qr: await QRCode.toDataURL(`${origin}/e/${attendee.code}`, { margin: 1, width: 160 }),
          uploads: uploadMap.get(attendee.id) ?? 0,
          downloads: downloadMap.get(attendee.id) ?? 0,
        }))
      );

      return {
        ...event,
        url: `${origin}/e/${event.code}`,
        qr: await QRCode.toDataURL(`${origin}/e/${event.code}`, { margin: 1, width: 240 }),
        attendees: attendeesWithStats,
        unattributedUploads: uploadMap.get(null) ?? 0,
        unattributedDownloads: downloadMap.get(null) ?? 0,
      };
    })
  );

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
      <div style={{ width: "100%", maxWidth: "32rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

      <form
        action={createEvent}
        style={{
          width: "100%",
          maxWidth: "32rem",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          name="name"
          placeholder="PPC 001: Palais Royal"
          required
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(128, 128, 128, 0.4)",
            background: "transparent",
            color: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "12px 20px",
            borderRadius: "8px",
            border: "none",
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create event
        </button>
      </form>

      <div style={{ width: "100%", maxWidth: "32rem", display: "flex", flexDirection: "column", gap: "24px" }}>
        {eventsWithDetails.length === 0 && (
          <p style={{ opacity: 0.6, textAlign: "center" }}>No events yet.</p>
        )}
        {eventsWithDetails.map((event) => (
          <div
            key={event.id}
            style={{
              border: "1px solid rgba(128, 128, 128, 0.3)",
              borderRadius: "12px",
              padding: "16px",
              opacity: event.disabled ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.qr}
                alt={`QR code for ${event.name}`}
                width={96}
                height={96}
                style={{ borderRadius: "6px", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600 }}>{event.name}</p>
                <p style={{ fontFamily: "monospace", letterSpacing: "0.1em", fontSize: "0.9rem" }}>
                  {event.code} <span style={{ opacity: 0.5 }}>(general)</span>
                </p>
                <p style={{ fontSize: "0.75rem", opacity: 0.6, wordBreak: "break-all" }}>
                  {event.url}
                </p>
                {event.disabled && (
                  <p style={{ fontSize: "0.75rem", color: "#e5484d" }}>Disabled</p>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <form
                  action={async () => {
                    "use server";
                    await toggleDisabled(event.id, !event.disabled);
                  }}
                >
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: "none",
                      border: "1px solid rgba(128, 128, 128, 0.4)",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {event.disabled ? "Enable" : "Disable"}
                  </button>
                </form>
                <DeleteEventButton eventId={event.id} eventName={event.name} />
              </div>
            </div>

            <div style={{ marginTop: "16px", borderTop: "1px solid rgba(128, 128, 128, 0.2)", paddingTop: "12px" }}>
              <p style={{ fontSize: "0.75rem", letterSpacing: "0.1em", opacity: 0.5, marginBottom: "8px" }}>
                ATTENDEES — {event.attendees.length} · uploaded {event.unattributedUploads +
                  event.attendees.reduce((sum, a) => sum + a.uploads, 0)}
                , downloaded {event.unattributedDownloads +
                  event.attendees.reduce((sum, a) => sum + a.downloads, 0)}
              </p>

              {(event.unattributedUploads > 0 || event.unattributedDownloads > 0) && (
                <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "8px" }}>
                  Unattributed (via general code): {event.unattributedUploads} uploaded,{" "}
                  {event.unattributedDownloads} downloaded
                </p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {event.attendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attendee.qr}
                      alt={`QR code for ${attendee.name}`}
                      width={48}
                      height={48}
                      style={{ borderRadius: "4px", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{attendee.name}</p>
                      <p style={{ fontFamily: "monospace", fontSize: "0.75rem", opacity: 0.7 }}>
                        {attendee.code}
                      </p>
                      <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                        {attendee.uploads} uploaded · {attendee.downloads} downloaded
                      </p>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await deleteAttendee(attendee.id);
                      }}
                    >
                      <button
                        type="submit"
                        style={{
                          background: "none",
                          border: "1px solid rgba(229, 72, 77, 0.5)",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          color: "#e5484d",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>

              <form
                action={async (formData: FormData) => {
                  "use server";
                  await addAttendee(event.id, formData);
                }}
                style={{ display: "flex", gap: "8px", marginTop: "12px" }}
              >
                <input
                  type="text"
                  name="name"
                  placeholder="Attendee name"
                  required
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid rgba(128, 128, 128, 0.4)",
                    background: "transparent",
                    color: "inherit",
                    fontSize: "0.85rem",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid rgba(128, 128, 128, 0.4)",
                    background: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  + Add
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

import { headers } from "next/headers";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { sql, type EventRow } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { createEvent, logout, toggleDisabled } from "./actions";

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

  const eventsWithQr = await Promise.all(
    events.map(async (event) => ({
      ...event,
      url: `${origin}/e/${event.code}`,
      qr: await QRCode.toDataURL(`${origin}/e/${event.code}`, { margin: 1, width: 240 }),
    }))
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

      <div style={{ width: "100%", maxWidth: "32rem", display: "flex", flexDirection: "column", gap: "20px" }}>
        {eventsWithQr.length === 0 && (
          <p style={{ opacity: 0.6, textAlign: "center" }}>No events yet.</p>
        )}
        {eventsWithQr.map((event) => (
          <div
            key={event.id}
            style={{
              border: "1px solid rgba(128, 128, 128, 0.3)",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              opacity: event.disabled ? 0.5 : 1,
            }}
          >
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
                {event.code}
              </p>
              <p style={{ fontSize: "0.75rem", opacity: 0.6, wordBreak: "break-all" }}>
                {event.url}
              </p>
              {event.disabled && (
                <p style={{ fontSize: "0.75rem", color: "#e5484d" }}>Disabled</p>
              )}
            </div>
            <form
              action={async () => {
                "use server";
                await toggleDisabled(event.id, !event.disabled);
              }}
            >
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
                  whiteSpace: "nowrap",
                }}
              >
                {event.disabled ? "Enable" : "Disable"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}

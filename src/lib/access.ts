import { sql, type EventRow } from "@/lib/db";

export type ResolvedAccess = {
  event: EventRow;
  attendee: { id: string; name: string } | null;
};

type AttendeeAccessRow = {
  attendee_id: string;
  attendee_name: string;
  event_id: string;
  event_code: string;
  event_name: string;
  event_created_at: string;
  event_disabled: boolean;
  event_password_hash: string | null;
  event_expires_at: string | null;
};

// A code typed into the homepage or embedded in a QR link can be either an
// attendee's personal code or an event's general/shared code. Both resolve
// to the same event; only attendee codes carry a known identity, used to
// attribute uploads and downloads to a specific person.
export async function resolveAccess(rawCode: string): Promise<ResolvedAccess | null> {
  const code = rawCode.trim().toUpperCase();

  const [attendeeRow] = (await sql`
    SELECT
      attendees.id AS attendee_id,
      attendees.name AS attendee_name,
      events.id AS event_id,
      events.code AS event_code,
      events.name AS event_name,
      events.created_at AS event_created_at,
      events.disabled AS event_disabled,
      events.password_hash AS event_password_hash,
      events.expires_at AS event_expires_at
    FROM attendees
    JOIN events ON events.id = attendees.event_id
    WHERE attendees.code = ${code}
    LIMIT 1
  `) as AttendeeAccessRow[];

  if (attendeeRow) {
    return {
      event: {
        id: attendeeRow.event_id,
        code: attendeeRow.event_code,
        name: attendeeRow.event_name,
        created_at: attendeeRow.event_created_at,
        disabled: attendeeRow.event_disabled,
        password_hash: attendeeRow.event_password_hash,
        expires_at: attendeeRow.event_expires_at,
      },
      attendee: { id: attendeeRow.attendee_id, name: attendeeRow.attendee_name },
    };
  }

  const [eventRow] = (await sql`
    SELECT * FROM events WHERE code = ${code} LIMIT 1
  `) as EventRow[];

  if (eventRow) {
    return { event: eventRow, attendee: null };
  }

  return null;
}

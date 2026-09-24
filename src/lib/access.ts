import { sql, type EventRow } from "@/lib/db";

export type ResolvedAccess = {
  event: EventRow;
  participant: { id: string; eventParticipantId: string; name: string } | null;
};

type EventParticipantAccessRow = EventRow & {
  ep_id: string;
  ep_credential_status: "active" | "disabled";
  participant_id: string;
  participant_first_name: string;
  participant_last_name: string | null;
};

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

// A code typed into the homepage or embedded in a QR link can be either a
// participant's personal event credential or an event's general/shared
// code. Both resolve to the same event; only a participant credential
// carries a known identity, used to attribute uploads to a specific
// person. A disabled credential is treated as invalid, not as "general
// access" — disabling someone's credential should actually deny them.
export async function resolveAccess(rawCode: string): Promise<ResolvedAccess | null> {
  const code = rawCode.trim().toUpperCase();

  const [row] = (await sql`
    SELECT
      events.*,
      event_participants.id AS ep_id,
      event_participants.credential_status AS ep_credential_status,
      participants.id AS participant_id,
      participants.first_name AS participant_first_name,
      participants.last_name AS participant_last_name
    FROM event_participants
    JOIN participants ON participants.id = event_participants.participant_id
    JOIN events ON events.id = event_participants.event_id
    WHERE event_participants.code = ${code}
    LIMIT 1
  `) as EventParticipantAccessRow[];

  if (row) {
    if (row.ep_credential_status !== "active") {
      return null;
    }
    return {
      event: row,
      participant: {
        id: row.participant_id,
        eventParticipantId: row.ep_id,
        name: fullName(row.participant_first_name, row.participant_last_name),
      },
    };
  }

  const [eventRow] = (await sql`
    SELECT * FROM events WHERE code = ${code} LIMIT 1
  `) as EventRow[];

  if (eventRow) {
    return { event: eventRow, participant: null };
  }

  return null;
}

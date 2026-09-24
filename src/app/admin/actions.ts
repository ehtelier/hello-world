"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  sql,
  EVENT_STATUSES,
  INVITATION_STATUSES,
  ATTENDANCE_STATUSES,
  type EventStatus,
  type InvitationStatus,
  type AttendanceStatus,
} from "@/lib/db";
import { generateEventCode } from "@/lib/eventCode";
import { deleteObject } from "@/lib/r2";
import {
  clearAdminSession,
  createAdminSession,
  isAdminAuthenticated,
  passwordMatches,
} from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logout() {
  await clearAdminSession();
  redirect("/admin/login");
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

// Collisions are astronomically unlikely (31^8 possibilities) but a unique
// index backs this up regardless; retry a few times just in case.
async function withUniqueCode(insert: (code: string) => Promise<unknown>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateEventCode();
    try {
      await insert(code);
      return code;
    } catch (error) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505";
      if (!isUniqueViolation || attempt === 4) throw error;
    }
  }
  throw new Error("Failed to generate a unique code");
}

function text(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function intOrNull(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Shared by createEvent and updateEvent: every optional detail field on an
// event, beyond the required title.
function eventDetailFields(formData: FormData) {
  return {
    ppcNumber: text(formData, "ppc_number"),
    eventDate: text(formData, "event_date"),
    startTime: text(formData, "start_time"),
    endTime: text(formData, "end_time"),
    area: text(formData, "area"),
    capacity: intOrNull(formData, "capacity"),
    shootLocation: text(formData, "shoot_location"),
    shootTime: text(formData, "shoot_time"),
    discoverLocation: text(formData, "discover_location"),
    discoverTime: text(formData, "discover_time"),
    hangLocation: text(formData, "hang_location"),
    hangTime: text(formData, "hang_time"),
    meetingPointName: text(formData, "meeting_point_name"),
    meetingPointAddress: text(formData, "meeting_point_address"),
    meetingPointMapLink: text(formData, "meeting_point_map_link"),
    estimatedSteps: text(formData, "estimated_steps"),
  };
}

export async function createEvent(formData: FormData) {
  await requireAdmin();

  const name = text(formData, "name");
  if (!name) return;
  const f = eventDetailFields(formData);

  await withUniqueCode(
    (code) => sql`
      INSERT INTO events (
        code, name, ppc_number, event_date, start_time, end_time, area, capacity,
        shoot_location, shoot_time, discover_location, discover_time,
        hang_location, hang_time, meeting_point_name, meeting_point_address,
        meeting_point_map_link, estimated_steps
      ) VALUES (
        ${code}, ${name}, ${f.ppcNumber}, ${f.eventDate}, ${f.startTime}, ${f.endTime}, ${f.area}, ${f.capacity},
        ${f.shootLocation}, ${f.shootTime}, ${f.discoverLocation}, ${f.discoverTime},
        ${f.hangLocation}, ${f.hangTime}, ${f.meetingPointName}, ${f.meetingPointAddress},
        ${f.meetingPointMapLink}, ${f.estimatedSteps}
      )
    `
  );

  revalidatePath("/admin");
}

export async function updateEvent(eventId: string, formData: FormData) {
  await requireAdmin();

  const name = text(formData, "name");
  if (!name) return;
  const f = eventDetailFields(formData);

  await sql`
    UPDATE events SET
      name = ${name},
      ppc_number = ${f.ppcNumber},
      event_date = ${f.eventDate},
      start_time = ${f.startTime},
      end_time = ${f.endTime},
      area = ${f.area},
      capacity = ${f.capacity},
      shoot_location = ${f.shootLocation},
      shoot_time = ${f.shootTime},
      discover_location = ${f.discoverLocation},
      discover_time = ${f.discoverTime},
      hang_location = ${f.hangLocation},
      hang_time = ${f.hangTime},
      meeting_point_name = ${f.meetingPointName},
      meeting_point_address = ${f.meetingPointAddress},
      meeting_point_map_link = ${f.meetingPointMapLink},
      estimated_steps = ${f.estimatedSteps}
    WHERE id = ${eventId}
  `;

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

export async function setEventStatus(eventId: string, status: EventStatus) {
  await requireAdmin();
  if (!EVENT_STATUSES.includes(status)) return;
  await sql`UPDATE events SET status = ${status} WHERE id = ${eventId}`;
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

export async function toggleDisabled(eventId: string, nextDisabled: boolean) {
  await requireAdmin();
  await sql`UPDATE events SET disabled = ${nextDisabled} WHERE id = ${eventId}`;
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

export async function archiveEvent(eventId: string) {
  await requireAdmin();
  await sql`UPDATE events SET status = 'archived', archived_at = now() WHERE id = ${eventId}`;
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

export async function unarchiveEvent(eventId: string) {
  await requireAdmin();
  await sql`UPDATE events SET status = 'live', archived_at = NULL WHERE id = ${eventId}`;
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin");
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  await sql`DELETE FROM events WHERE id = ${eventId}`;
  revalidatePath("/admin");
  redirect("/admin");
}

export async function addParticipant(eventId: string, formData: FormData) {
  await requireAdmin();

  const firstName = text(formData, "first_name");
  if (!firstName) return;
  const lastName = text(formData, "last_name");

  const [participant] = (await sql`
    INSERT INTO participants (first_name, last_name)
    VALUES (${firstName}, ${lastName})
    RETURNING id
  `) as { id: string }[];

  await withUniqueCode(
    (code) => sql`
      INSERT INTO event_participants (event_id, participant_id, code)
      VALUES (${eventId}, ${participant.id}, ${code})
    `
  );

  revalidatePath(`/admin/events/${eventId}`);
}

export async function removeParticipant(eventParticipantId: string, eventId: string) {
  await requireAdmin();
  await sql`DELETE FROM event_participants WHERE id = ${eventParticipantId}`;
  revalidatePath(`/admin/events/${eventId}`);
}

export async function updateParticipantStatus(
  eventParticipantId: string,
  eventId: string,
  formData: FormData
) {
  await requireAdmin();

  const invitationStatus = String(formData.get("invitation_status") ?? "") as InvitationStatus;
  const attendanceStatus = String(formData.get("attendance_status") ?? "") as AttendanceStatus;
  if (!INVITATION_STATUSES.includes(invitationStatus) || !ATTENDANCE_STATUSES.includes(attendanceStatus)) {
    return;
  }

  await sql`
    UPDATE event_participants
    SET
      invitation_status = ${invitationStatus},
      attendance_status = ${attendanceStatus},
      date_accepted = CASE
        WHEN ${invitationStatus} = 'accepted' THEN COALESCE(date_accepted, now())
        ELSE date_accepted
      END
    WHERE id = ${eventParticipantId}
  `;
  revalidatePath(`/admin/events/${eventId}`);
}

export async function toggleCredential(
  eventParticipantId: string,
  eventId: string,
  nextStatus: "active" | "disabled"
) {
  await requireAdmin();
  await sql`UPDATE event_participants SET credential_status = ${nextStatus} WHERE id = ${eventParticipantId}`;
  revalidatePath(`/admin/events/${eventId}`);
}

export async function regenerateCredential(eventParticipantId: string, eventId: string) {
  await requireAdmin();
  await withUniqueCode(
    (code) => sql`UPDATE event_participants SET code = ${code} WHERE id = ${eventParticipantId}`
  );
  revalidatePath(`/admin/events/${eventId}`);
}

export async function deletePhoto(photoId: string, eventId: string) {
  await requireAdmin();

  const [photo] = (await sql`
    SELECT storage_key, thumb_key FROM photos WHERE id = ${photoId}
  `) as { storage_key: string; thumb_key: string | null }[];

  if (photo) {
    await deleteObject(photo.storage_key).catch(() => {});
    if (photo.thumb_key) {
      await deleteObject(photo.thumb_key).catch(() => {});
    }
  }

  await sql`DELETE FROM photos WHERE id = ${photoId}`;
  revalidatePath(`/admin/events/${eventId}`);
}

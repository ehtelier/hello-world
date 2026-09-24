import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient() {
  if (!client) {
    // The Neon integration was connected with a custom "database" prefix,
    // so Vercel named the injected variable database_DATABASE_URL rather
    // than plain DATABASE_URL. DATABASE_URL is kept as a fallback in case
    // the integration is ever reconnected without a prefix.
    const url = process.env.database_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error("database_DATABASE_URL is not set");
    }
    client = neon(url);
  }
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values);
}

export const EVENT_STATUSES = [
  "draft",
  "inviting",
  "confirmed",
  "live",
  "gallery",
  "archived",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const INVITATION_STATUSES = [
  "considering",
  "invited",
  "accepted",
  "declined",
  "cancelled",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["pending", "attended", "no_show"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type EventRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  disabled: boolean;
  password_hash: string | null;
  expires_at: string | null;
  ppc_number: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  capacity: number | null;
  status: EventStatus;
  shoot_location: string | null;
  shoot_time: string | null;
  discover_location: string | null;
  discover_time: string | null;
  hang_location: string | null;
  hang_time: string | null;
  meeting_point_name: string | null;
  meeting_point_address: string | null;
  meeting_point_map_link: string | null;
  estimated_steps: string | null;
  archived_at: string | null;
};

export type ParticipantRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  contact_info: string | null;
  date_added: string;
  ppc_pass: boolean;
  internal_notes: string | null;
  active: boolean;
};

export type EventParticipantRow = {
  id: string;
  event_id: string;
  participant_id: string;
  code: string;
  invitation_status: InvitationStatus;
  attendance_status: AttendanceStatus;
  credential_status: "active" | "disabled";
  date_invited: string;
  date_accepted: string | null;
};

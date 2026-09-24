-- Paris Photo Club database schema.
-- Run this once in the Neon SQL editor (or any Postgres client connected to
-- the database) to create the tables the app expects. Safe to re-run:
-- CREATE TABLE IF NOT EXISTS won't error if the tables already exist.

CREATE TABLE IF NOT EXISTS events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled      boolean NOT NULL DEFAULT false,
  password_hash text,
  expires_at    timestamptz
);

CREATE TABLE IF NOT EXISTS photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_key   text NOT NULL,
  thumb_key     text,
  filename      text NOT NULL DEFAULT 'file',
  mime_type     text NOT NULL,
  byte_size     bigint NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

-- Added after the initial table creation, for anyone re-running this file
-- against a database that already has the old photos table shape.
ALTER TABLE photos ADD COLUMN IF NOT EXISTS filename text NOT NULL DEFAULT 'file';

CREATE INDEX IF NOT EXISTS photos_event_id_idx ON photos(event_id);

-- Per-attendee access codes, so contributions (uploads) and downloads can be
-- attributed to a specific person instead of everyone sharing one event
-- code. The event's own `code` still works too, as a general/unattributed
-- fallback (uploads/downloads through it show up as "unattributed").
CREATE TABLE IF NOT EXISTS attendees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendees_event_id_idx ON attendees(event_id);

ALTER TABLE photos ADD COLUMN IF NOT EXISTS attendee_id uuid REFERENCES attendees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS photos_attendee_id_idx ON photos(attendee_id);

-- Download tracking (a photo_downloads table + view/download tracking
-- routes) was tried and then removed: it either undercounted (missing the
-- press-and-hold "Save to Photos" gesture entirely) or, once tracking was
-- moved to "photo opened full-screen," added a network round-trip to every
-- photo view for a metric that turned out not to be worth the UX cost.
-- Contribution tracking (uploads, via photos.attendee_id above) stayed.
--
-- If you ran an earlier version of this file, a now-unused photo_downloads
-- table and its indexes may still exist in the database. Harmless to leave
-- in place; drop it if you'd like to clean up:
--   DROP TABLE IF EXISTS photo_downloads;

-- When the photo/video was actually taken (read from EXIF metadata in the
-- browser before upload, or the file's own "last modified" date as a
-- fallback), rather than when it happened to be uploaded, so the gallery
-- can be ordered as the day actually unfolded regardless of upload order.
-- Nullable: older rows and any upload where this couldn't be determined
-- fall back to uploaded_at (handled with COALESCE wherever this is sorted).
ALTER TABLE photos ADD COLUMN IF NOT EXISTS taken_at timestamptz;
CREATE INDEX IF NOT EXISTS photos_taken_at_idx ON photos(event_id, taken_at);

-- ---------------------------------------------------------------------
-- Admin dashboard v2: persistent participants (per the organizer's
-- requirements doc). A "participant" is one real person's identity,
-- reusable across many events. "attendees" (per-event only, no identity
-- reuse) is replaced by participants + event_participants below.
-- ---------------------------------------------------------------------

-- Richer event fields. `name` is kept as the event's title (no rename, to
-- avoid touching every existing reference); `code` and `disabled` are
-- unchanged (disabled = access on/off, independent of `status` below,
-- which is purely an organizational/display stage per the spec: "DISABLE
-- != DELETE" and status changes don't themselves gate access yet).
ALTER TABLE events ADD COLUMN IF NOT EXISTS ppc_number text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity int;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE events ADD COLUMN IF NOT EXISTS shoot_location text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS shoot_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS discover_location text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS discover_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hang_location text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hang_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_point_name text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_point_address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_point_map_link text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS estimated_steps text;
-- archived_at marks the Archive action distinctly from disabled/deleted.
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- One row per real person, reused across every event they attend.
CREATE TABLE IF NOT EXISTS participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text NOT NULL,
  last_name     text,
  contact_info  text,
  date_added    timestamptz NOT NULL DEFAULT now(),
  ppc_pass      boolean NOT NULL DEFAULT false,
  internal_notes text,
  active        boolean NOT NULL DEFAULT true
);

-- One row per (participant, event): this is where the event-specific
-- passcode/QR credential and that person's invitation/attendance status
-- for that particular event live. A participant can have many of these
-- (one per event); an event can have many (one per participant).
CREATE TABLE IF NOT EXISTS event_participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id    uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  code              text UNIQUE NOT NULL,
  invitation_status text NOT NULL DEFAULT 'invited',
  attendance_status text NOT NULL DEFAULT 'pending',
  credential_status text NOT NULL DEFAULT 'active',
  date_invited      timestamptz NOT NULL DEFAULT now(),
  date_accepted     timestamptz,
  UNIQUE (event_id, participant_id)
);

CREATE INDEX IF NOT EXISTS event_participants_event_id_idx ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS event_participants_participant_id_idx ON event_participants(participant_id);

-- One-time migration from the old per-event-only attendees table, run only
-- if that table still has rows. Reuses each attendee's existing id as the
-- new participant's id, so photos.attendee_id values line up with
-- participants.id directly below with no join needed.
INSERT INTO participants (id, first_name, date_added)
SELECT id, name, created_at FROM attendees
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_participants (event_id, participant_id, code, date_invited)
SELECT event_id, id, code, created_at FROM attendees
ON CONFLICT (event_id, participant_id) DO NOTHING;

-- Photos now attribute to a participant directly (per the spec's Media ->
-- Event -> Participant model), not to a per-event-only attendee row.
ALTER TABLE photos ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES participants(id) ON DELETE SET NULL;
UPDATE photos SET participant_id = attendee_id
WHERE attendee_id IS NOT NULL AND participant_id IS NULL;
CREATE INDEX IF NOT EXISTS photos_participant_id_idx ON photos(participant_id);

-- attendees and photos.attendee_id are superseded by the above and no
-- longer read by the app, but left in place rather than dropped, in case
-- you want to double check the migration before removing them:
--   DROP TABLE IF EXISTS attendees;
--   ALTER TABLE photos DROP COLUMN IF EXISTS attendee_id;

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

-- Logged whenever someone actually taps "download" on a photo (not just
-- browses/previews it), so contribution vs. download activity can be
-- compared per attendee.
CREATE TABLE IF NOT EXISTS photo_downloads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id      uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  attendee_id   uuid REFERENCES attendees(id) ON DELETE SET NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_downloads_photo_id_idx ON photo_downloads(photo_id);
CREATE INDEX IF NOT EXISTS photo_downloads_attendee_id_idx ON photo_downloads(attendee_id);

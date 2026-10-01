# Paris Photo Club — Architecture & Decisions Log

This is the running record of technical decisions for the MVP. Update this
file whenever a decision changes instead of re-debating it from scratch.

## Product summary

Private, mobile-first web gallery for small Paris photo-walk outings.
Flow per outing: organizer creates an event, gets a unique short code (and a
QR code that encodes the direct link for that code). Attendees either scan
the QR code or type the code into the homepage, no account/app needed, then
upload original photos/videos straight from their camera roll. Everyone
browses the shared gallery and downloads untouched originals.

The homepage (`/`) itself is a fixed, generic entry point: a code-entry box
and nothing else. It never changes per event. Each event's actual gallery
lives at its own address, `/e/<code>`.

Non-negotiable: **uploaded originals are never compressed, resized, or
re-encoded.** Thumbnails are a separate, additional asset used only for
browsing.

## Guest-facing design system (permanent rules)

Established once the Cinzel/Montserrat pairing was retired in favor of a
single-typeface system. These apply to every participant-facing screen —
homepage, invitation, accepted, brief, live, gallery, archived — and are
permanent, not a per-screen style choice to re-litigate. **Not** binding on
the admin dashboard, which stays a plain, utilitarian back-office tool.

- **Montserrat is the only typeface.** No second/contrasting font for
  event names or anything else.
- **Event names get their identity through large scale, not a second
  font.** Hierarchy comes from size and weight, never a different
  typeface.
- **Utility/status language** (brand mark, PPC number, dates, stage
  labels, "MOMENTS" counts, etc.) **gets wide tracking, small size, and
  muted grey** (dial opacity down, don't introduce a separate color).
- **Primary actions are bright text + →**, never a conventional filled
  button — unless a native control is functionally necessary (a native
  `<input type="file">`, a `<select>`).
- **Secondary actions are quiet grey text** (lower opacity, smaller size),
  never their own button chrome.
- **Negative space does most of the visual work.** Reach for spacing and
  contrast before reaching for a border, box, or fill.
- **Motion stays extremely restrained**: fades/transitions only (e.g. the
  homepage's "WELCOME, &lt;NAME&gt;" swap before navigating). No flashy
  animation, no loading spinners, no modals for confirmation — see the
  Decline flow's inline typographic confirmation sheet instead of a native
  `confirm()` or a modal.
- **Native browser controls should be visually integrated** wherever
  possible without sacrificing usability/accessibility — transparent
  backgrounds, inherited color/font, underlines instead of borders — but
  stay real `<input>`/`<select>`/`<button>` elements with generous tap
  targets. Style them to disappear into the page; don't replace them with
  custom non-native widgets.

## Stack decisions (finalized)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend + hosting | Next.js on Vercel | Free tier is enough at this scale; deploys on git push; large beginner-friendly ecosystem. |
| Original + thumbnail file storage | Cloudflare R2 (S3-compatible API) | Zero egress fees, unconditionally — decisive for a product whose core action is "download the original file." Free tier: 10GB storage / 1M writes-per-month / 10M reads-per-month. |
| Metadata database | Vercel Postgres (Neon) | Same dashboard as hosting, one less account to manage; free tier is more than sufficient since only small metadata rows live here, never file bytes. |
| Thumbnail generation | `sharp` (Node) run server-side right after upload, output stored in R2 under a `thumbnails/` prefix | Keeps browsing fast without ever touching the original bytes. |
| Event access control | Random 8-character code per event (uppercase letters + digits, ambiguous characters like `0`/`O`/`1`/`I` excluded), used both as the URL path (`/e/<code>`) and as what someone types into the homepage's manual entry box | No accounts. Short enough to type by hand or read aloud, unlike a full 128-bit token, while still offering billions of combinations, more than enough for a small private club's threat model (casual outsiders, not a targeted attacker). Rate-limiting manual entry attempts is a deferred hardening item (see Privacy & security model). |
| QR code | Generated client- or server-side with the `qrcode` package, encoding the full `/e/<code>` URL | Printable/shareable, organizer downloads it as a PNG. Scanning it skips typing entirely; the same code also works if typed manually on the homepage. |
| Upload mechanism | Browser requests a presigned PUT URL from a Next.js API route, then uploads the file directly to R2 from the browser | Avoids Vercel serverless function body-size limits; server never proxies file bytes. |
| File picker | `<input type="file" accept="image/*,video/*" multiple>` — **no** `capture` attribute | Opens the camera roll (existing photos/videos) instead of forcing the live camera. |
| Admin auth | Single admin password in an environment variable, sets an `httpOnly` session cookie | You are the sole organizer for now; a full user system is unneeded complexity. |
| Downloads | Short-lived signed GET URLs from R2, generated per request | So "disable event" actually revokes access instead of just hiding a UI button. |

### Rejected / evaluated alternatives

- **Netlify** instead of Vercel: roughly equivalent; not chosen for a strong
  technical reason, but Vercel's built-in Postgres integration reduces the
  number of separate dashboards/accounts to manage.
- **AWS S3 / Supabase Storage** instead of R2: both charge for egress
  (bandwidth out). Since the core user action is downloading full-resolution
  originals, egress cost would scale directly with usage — R2's zero-egress
  model avoids that entirely while remaining S3-API-compatible.

## Privacy & security model

**Implemented from the start:**
- Random 8-character per-event codes (not sequential IDs), used for both the
  URL and manual entry.
- Storage keys namespaced per event (`events/<code>/...`) so galleries can
  never cross-contaminate even by bug.
- Organizer can instantly set an event to `disabled`; checked on every
  gallery/upload/download request.
- Downloads via short-lived signed URLs rather than permanently public
  files, so revocation is real.

**Deliberately deferred to post-MVP** (tracked here so we don't forget, not
because they don't matter):
- Rate-limiting manual code entry attempts on the homepage (protects against
  someone brute-forcing codes by typing guesses; not a concern for QR-code
  access since a code isn't guessable from the URL alone).
- Optional per-event password.
- Automatic expiration dates.
- Per-photo delete / consent takedown UI (manual DB edit is fine for the
  first few events).
- Video poster-frame thumbnails (MVP shows a generic video tile; upload and
  full-resolution download of video still works).
- HEIC preview conversion (iPhone originals may be HEIC; MVP stores/serves
  as-is — some Android browsers won't preview inline, download still works).
- Accounts, likes, notifications, native apps, "download all as zip."

## Build order

1. ✅ Next.js scaffold deployed to Vercel (placeholder page, live URL).
   Cloudflare R2 bucket + account API token created; R2 credentials added
   as Vercel environment variables. Vercel project `paris-photo-club`
   connected to this repo, with its Production environment's branch
   tracking set to `claude/paris-photo-club-platform-q1vmxe`.
   ✅ Homepage code-entry form built (`src/app/page.tsx`) and placeholder
   gallery route (`src/app/e/[code]/page.tsx`), ahead of the database work.
2. ✅ Neon Postgres database created and connected to the Vercel project
   (schema in `docs/schema.sql`, run once via the Neon SQL editor). Admin
   login (`/admin/login`) and dashboard (`/admin`) built: password-gated via
   `ADMIN_PASSWORD`, session is a signed cookie (HMAC keyed on the admin
   password, no separate secret needed). Dashboard creates events (generates
   an 8-character code, inserts into the database) and renders each event's
   QR code and shareable link. `/e/<code>` now looks up the real database
   row instead of showing a placeholder.
   ✅ Added an event delete action/button (with confirmation) alongside
   disable, for cleaning up test events.
3. ✅ Real uploads: `/e/<code>` requests a presigned R2 PUT URL from a server
   action (`src/app/e/[code]/actions.ts`), the browser uploads the original
   file straight to R2 (server never touches the bytes), then a second
   action inserts the `photos` row. The gallery grid renders real photos and
   videos via signed view URLs; tapping one downloads the untouched original
   via a signed URL with a forced `Content-Disposition: attachment`. This
   required a CORS policy on the R2 bucket, see below.
   ✅ Added a full-screen lightbox (`PhotoGrid.tsx`) so tapping a photo
   previews it instead of immediately downloading. There is no separate
   "download" action or link: the same signed view URL used for display is
   what press-and-hold (mobile) or right-click "Save Image" (desktop) saves,
   since showing the actual image, not forcing an attachment download, is
   what lets the OS's native "Save to Photos" work at all (a forced download
   lands in Files/Downloads instead). A per-event/per-attendee renamed
   filename and a tracked "download" route were both tried and removed,
   see below and the per-attendee tracking entry; the original filename and
   all embedded metadata (EXIF date, GPS, etc.) are simply whatever was
   uploaded, byte-for-byte untouched.
   ✅ Reworked the grid to a two-column masonry layout (photos keep their
   natural aspect ratio instead of being cropped to uniform squares) for a
   more editorial, magazine-like feel. The lightbox responds to a vertical
   swipe (up = next, down = previous), matching TikTok/Instagram-style feed
   navigation, instead of the original left/right swipe, and shows a
   `3 / 12` position counter instead of instructional text. The full-screen
   viewer also locks background scrolling (`document.body.style.overflow`
   plus `touch-action: none` on the viewer) so swiping through photos
   doesn't also scroll the grid underneath.
   ✅ Gallery order is by when each photo/video was actually taken, not
   upload order, so the gallery reads as the day unfolded regardless of who
   uploaded what when. The capture time is read client-side before upload
   (`src/lib/capturedAt.ts`, using the `exifr` package): EXIF
   `DateTimeOriginal`/`CreateDate` for photos when present, falling back to
   the file's own "last modified" date otherwise (used outright for videos,
   since video container metadata isn't parsed). Stored as `photos.taken_at`
   (nullable); sorting uses `COALESCE(taken_at, uploaded_at)` so older rows
   and anything without a readable date still sort sensibly.
   ✅ The lightbox credits whoever uploaded each photo: "Photo captured by
   `<first name>`", under a small divider below the position counter, for
   photos uploaded via an attendee's personal code (joined from
   `attendees.name` in `/e/[code]/page.tsx`; only the first word of the
   name is shown). Photos uploaded via the event's general/unattributed code
   have no attendee to credit, so the line is simply omitted for those.
   ✅ Fixed two upload issues found once uploading real videos: (1) multiple
   large videos uploaded at the same time could fail randomly, uploading
   several at once could exceed a phone's memory/connection, especially for
   video; `UploadForm.tsx` now uploads one file at a time instead of all in
   parallel, and reports per-file failures individually rather than failing
   the whole batch. (2) Videos had no preview in the grid (just a gray box):
   `src/lib/videoThumbnail.ts` grabs a frame from the video client-side
   (via a `<video>` + `<canvas>`, seeking slightly past frame 0 since that's
   often black) before upload, uploads it to R2 as a small JPEG, and stores
   its key as `photos.thumb_key` (a column that existed in the schema from
   the start but was unused until now). The grid shows that thumbnail with
   a small play icon overlay; the lightbox still plays the actual original
   video. Videos uploaded before this change have no thumbnail and fall
   back to the old (blank-looking) inline `<video>`.

   First attempt at this silently failed for some real videos, always
   falling back to the blank preview with no visible error (thumbnail
   generation failure is deliberately non-fatal, so it doesn't block the
   actual upload). Root cause: the helper `<video>` element used to grab
   the frame was never attached to the document, and mobile Safari in
   particular can be unreliable loading/seeking a detached video. Fixed by
   keeping it in the DOM (positioned off-screen) and, before seeking,
   attempting a muted play/pause, since some browsers only fully decode a
   frame once playback has actually started at least momentarily. Videos
   uploaded before this fix still show no thumbnail unless re-uploaded.
   ✅ Upload failures now show the real reason (HTTP status/response, or a
   network error message) directly on the page instead of a generic
   "something went wrong," since the actual file transfer goes straight
   from the browser to R2 and never touches our server, so a failure there
   never appears in Vercel's logs. Diagnosed a real large-video failure this
   way ("network error (Load failed)" — a dropped connection on weak
   cellular signal). `putFile` in `UploadForm.tsx` now retries a failed
   upload up to 3 times with a short growing delay before giving up, since
   large video files on mobile connections are meaningfully more exposed to
   transient drops than small photos; a definitive rejection (bad
   signature, expired URL) is not retried, only network errors and server
   (5xx) errors are.
4. ✅ Per-attendee access codes for contribution tracking. Each event keeps
   its original shared `code` (general/unattributed fallback access), and
   admins can now add named attendees to an event
   (`src/app/admin/actions.ts` → `addAttendee`), each getting their own
   unique code and QR. `src/lib/access.ts` (`resolveAccess`) is the single
   place that turns any code, attendee or general, into "which event, which
   attendee (if any)." `/e/[code]`'s upload actions use it, so uploads get
   attributed to whichever code someone actually used, and the admin
   dashboard shows a per-attendee upload count alongside their QR.

   Download tracking was also built (a `photo_downloads` table, a route
   fired when a photo opened full-screen, a dedup index) and then removed
   by request: press-and-hold "Save to Photos" is invisible to any website,
   so the only way to approximate it was logging on "photo opened
   full-screen," which meant every photo swiped past while browsing added a
   network round-trip. That cost to the browsing experience wasn't worth
   what was, at best, an approximation of a real download anyway.
   Contribution tracking (uploads) doesn't have this problem: an upload is
   a real, unambiguous action the server directly participates in.
5. ✅ Photo thumbnails, video thumbnails (see per-attendee/video sections
   above), and per-photo delete all landed as part of earlier stages above.
6. ✅ Admin overhaul, from the organizer's own requirements doc: a
   persistent **participant** identity (one record per real person, reused
   across every event they attend) replacing the old per-event-only
   attendee model, plus a much richer event record and real gallery
   moderation tools.

   **Data model.** `participants` (first/last name, contact info,
   `ppc_pass`, internal notes, active flag) is the durable identity.
   `event_participants` is the join: one row per (event, participant),
   holding that person's event-specific passcode/QR (`code`),
   `invitation_status` (superseded by the invitation lifecycle rebuild in
   stage 7 below — see there for the current vocabulary),
   `attendance_status` (pending/attended/no_show, deliberately a separate
   concept from invitation status per the spec), and `credential_status`
   (active/disabled). `photos.participant_id` now points at the durable
   `participants.id` directly (not at a per-event row), matching the
   spec's "Media → Event → Participant, don't store the name on media"
   model. `events` gained `ppc_number`, `event_date`, `start_time`,
   `end_time`, `area`, `capacity`, `status` (a `brief` stage was added
   between `confirmed` and `live` in stage 7 below), the optional SHOOT/
   DISCOVER/HANG itinerary fields, and meeting-point name/address/map-link
   text fields. `status` is deliberately independent of the
   existing `disabled` access flag: per the spec, "disable ≠ delete", and
   status is an organizational label that doesn't itself gate participant
   access yet (automatic status-driven behavior is explicitly deferred).
   The old `attendees` table and `photos.attendee_id` are superseded and no
   longer read by the app; a one-time migration in `docs/schema.sql` copies
   existing rows into the new tables (reusing the same ids, so no manual
   remapping needed) rather than discarding them, and the old table/column
   are left in place as an optional manual cleanup rather than dropped
   automatically.

   **Access resolution.** `resolveAccess` (`src/lib/access.ts`) now joins
   `event_participants` + `participants` instead of `attendees`, and
   treats a `disabled` credential as invalid access entirely (not as
   falling back to general/unattributed access) — disabling someone's
   credential is supposed to actually deny them, per the spec's credential
   controls.

   **Admin UI.** The dashboard (`/admin`) is now a slim event list (status,
   date, participant count vs. capacity, total uploads) plus a collapsible
   full create-event form; per-event management moved to a dedicated
   `/admin/events/[id]` page covering: editable event details (same form,
   reused via `EventForm.tsx`), a status dropdown, access disable/enable,
   archive/reactivate, delete (existing confirm pattern), a contribution
   summary (photos/videos/total/contributor count), the participant list
   with inline invitation+attendance status editors and credential controls
   (disable/reactivate, regenerate — which invalidates the old code by
   simply replacing it — remove from event with confirmation, each with
   its own QR), an add-participant form, and gallery moderation (every
   photo/video with contributor, type, size, upload date, a link to view
   the original, and delete with confirmation, which also removes the
   objects from R2, not just the database row). `ConfirmButton.tsx` and
   `AutoSubmitSelect.tsx` are small shared client components backing this
   (the latter exists because an auto-submitting `<select>` needs an
   actual Client Component boundary — an `onChange` handler cannot be
   attached to an element rendered directly by a Server Component, even a
   plain host element like `<select>`, only inside a `"use client"` file).

   **Deliberately deferred**, matching the requirements doc's own Phase 2/
   Later/"useful but not blocking" priority labels: The Brief and its
   draft/published gate, meeting-point photo upload (the text fields exist,
   the image upload+management flow doesn't), internal event notes,
   participant notes, invitation-overview count widgets, photographer
   filtering in the gallery, a dedicated participant detail/history page,
   the "reinvite an existing participant to a new event" search flow (for
   now, adding a participant to an event always creates a new participant
   record — the underlying no-duplicate-identity data model is in place,
   just not yet a UI for re-selecting someone across events), PPC Pass
   management beyond the stored flag, and storage-usage reporting.
7. ✅ Participant invitation lifecycle rebuild, and the BRIEF event stage,
   from the organizer's own lifecycle writeup. The key structural point:
   **there are two separate state machines, not one.** An event's `status`
   (`draft → inviting → confirmed → brief → live → gallery → archived`) is
   an organizer-facing stage that applies to the whole event. A
   participant's `invitation_status`
   (`invited → opened → accepted → declined/cancelled`) is per-person and
   independent — Amber can be `accepted` on an event that's still
   `inviting` while Jules is still `invited`. `opened` is set automatically
   by the participant's own first page view (`markInvitationOpened` in
   `src/app/e/[code]/actions.ts`), never by the organizer. Real timestamps
   (`invited_at`, `first_opened_at`, `accepted_at`, `declined_at`) are
   stored alongside the labels specifically so acceptance-rate/response-time
   metrics are possible later without an analytics system — see
   `docs/schema.sql`'s rename of `date_invited`/`date_accepted` and the two
   new columns.

   **The participant experience** is now: personal link arrives → opens it
   (silently recorded) → sees a minimal pre-acceptance screen (event name,
   date, time range, area — no gallery credential to remember yet) → taps
   **ACCEPT INVITATION** (or a quiet **Decline**) → immediately becomes the
   existing "YOU'RE IN ... the rest will follow" save-the-date screen, now
   with that exact eyebrow text (it used to say "YOU'RE INVITED" at this
   stage; that copy is reserved for the pre-accept screen's sibling case —
   someone using the event's general/unattributed code, which has no accept
   step at all) → silence until the organizer "releases the Brief"
   (`releaseBrief` in `src/app/admin/actions.ts`, available once the event
   is `confirmed`) → a dedicated full-screen reveal (`BriefScreen` in
   `src/app/e/[code]/page.tsx`) showing MEET/SHOOT/DISCOVER/HANG with real
   times and locations → `live` on the day itself (compact header now reads
   "TODAY", meeting point renamed "MEET HERE"/"Open in Maps" for clarity) →
   `gallery` (now shows a "`N` MOMENTS" count next to the upload/browse
   experience, upload button relabeled "+ Add photos") → `archived` (same
   moments count, plus a read-only SHOOT/DISCOVER/HANG location recap with
   no times — an artifact, not a live itinerary). A participant who
   declined or was cancelled sees a quiet dead-end screen instead of either
   the accept prompt or the save-the-date, so they're not asked twice.
   `estimated_steps` is dropped as a formal field (reads like a fitness app);
   the column stays in the database, unused, rather than being dropped
   outright. A new `meeting_point_time` field (separate from `shoot_time`)
   backs the Brief's "MEET 13:45" ahead of "SHOOT 14:00".

   **Deliberately deferred, still**: the meeting-point photograph on the
   Brief screen (needs its own upload+management flow, same as the earlier
   admin overhaul's deferred item), automatic time-based stage transitions
   (an organizer action drives every stage change; nothing fires on a
   clock), and an admin-side view of invitation acceptance-rate/response-time
   metrics (the timestamps exist now specifically so this is possible
   later, just not built yet).

### R2 bucket CORS policy (required for uploads to work)

Uploading goes straight from the attendee's browser to R2, which means the
browser makes a cross-origin request to the R2 bucket. Without a CORS
policy allowing that, the browser blocks the upload before it ever reaches
R2. Set this once in the Cloudflare dashboard: R2 → the `paris-photo-club`
bucket → Settings → CORS Policy → Add CORS Policy:

```json
[
  {
    "AllowedOrigins": ["https://paris-photo-club-eight.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace the origin with the site's actual live URL if it differs. Only
`PUT` needs CORS here: viewing and downloading happen via plain `<img>`/
`<a>` requests, which browsers don't subject to CORS the way they do
JavaScript-initiated uploads.

## Environment variables

Set in Vercel (Settings → Environment Variables), for Production and
Preview environments:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` — `paris-photo-club`
- `ADMIN_PASSWORD` — the password for `/admin`. Also doubles as the signing
  key for the admin session cookie, so changing it instantly invalidates any
  existing admin sessions.
- `R2_ENDPOINT` — the bucket's S3 API endpoint URL

These were actually entered in Vercel as all-lowercase (`r2_account_id`,
`r2_bucket_name`, etc.) rather than uppercase, from the very first setup
screen. `src/lib/r2.ts` checks both cases for each one, so it works either
way — no need to rename them, and no need to match case exactly if more are
ever added by hand.

Database connection variables are injected automatically by Vercel once
Neon is connected under the Storage tab, no manual copying needed. Because
the integration was connected with a custom prefix of `database`, the
actual variable name is **`database_DATABASE_URL`** (not plain
`DATABASE_URL`) — `src/lib/db.ts` checks that name first, with plain
`DATABASE_URL` as a fallback in case the integration is ever reconnected
without a prefix.

## Data model (initial sketch)

```
events
  id                     uuid pk
  code                   text unique, indexed   -- general/fallback access code
  name                   text                   -- event title, e.g. "PPC 001: Palais Royal"
  ppc_number             text nullable
  created_at             timestamptz
  disabled               boolean default false  -- access on/off; independent of status
  status                 text                   -- draft/inviting/confirmed/brief/live/gallery/archived
  archived_at            timestamptz nullable
  event_date             date nullable
  start_time, end_time   text nullable
  area                   text nullable          -- general area / arrondissement
  capacity               int nullable
  shoot_location, shoot_time,
  discover_location, discover_time,
  hang_location, hang_time                       -- optional itinerary, all text
  meeting_point_name, meeting_point_address,
  meeting_point_map_link, meeting_point_time      -- optional meeting info, all text
  password_hash          text nullable          -- deferred feature, column reserved
  expires_at             timestamptz nullable   -- deferred feature, column reserved

participants                                     -- one durable record per real person
  id            uuid pk
  first_name    text
  last_name     text nullable
  contact_info  text nullable
  date_added    timestamptz
  ppc_pass      boolean default false
  internal_notes text nullable                  -- admin-only; no UI yet
  active        boolean default true

event_participants                               -- join: one row per (event, participant)
  id                uuid pk
  event_id          uuid fk -> events.id
  participant_id    uuid fk -> participants.id
  code              text unique, indexed         -- this person's credential for this event
  invitation_status text   -- invited/opened/accepted/declined/cancelled
  attendance_status text   -- pending/attended/no_show (separate from invitation_status)
  credential_status text   -- active/disabled
  invited_at        timestamptz
  first_opened_at   timestamptz nullable  -- set automatically by their own first page view
  accepted_at       timestamptz nullable
  declined_at       timestamptz nullable

photos
  id            uuid pk
  event_id      uuid fk -> events.id
  participant_id uuid nullable fk -> participants.id  -- null = uploaded via the
                                                        -- event's general code
  storage_key   text                   -- R2 key of the original file
  thumb_key     text nullable          -- R2 key of the generated thumbnail
  filename      text                   -- original filename, for download naming
  mime_type     text
  byte_size     bigint
  uploaded_at   timestamptz
  taken_at      timestamptz nullable  -- when actually captured; gallery
                                       -- sorts by COALESCE(taken_at, uploaded_at)
```

Superseded, left in place (not dropped) rather than migrated destructively:
`attendees` (per-event-only identity, replaced by participants +
event_participants) and `photos.attendee_id` (replaced by
`photos.participant_id`). See the migration notes in `docs/schema.sql`.

## Open items / needs owner input before next stage

- Create free accounts: Vercel, Cloudflare (for R2). Neon/Postgres can be
  provisioned directly from the Vercel dashboard.
- Decide on a project/event domain or subdomain (can start on the default
  `*.vercel.app` URL and add a custom domain later).

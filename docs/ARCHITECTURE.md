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
   ✅ Added a full-screen swipeable lightbox (`PhotoGrid.tsx`) so tapping a
   photo previews it (with prev/next) instead of immediately downloading;
   this also fixes phones saving downloads to Files/Downloads instead of
   Photos, since press-and-hold on a shown image triggers the OS's native
   "Save to Photos" instead.
   ✅ Downloaded files are renamed to `<Event Name> <sequence>.<ext>` (e.g.
   `PPC 001 Marais 003.jpg`), numbered by upload order
   (`src/lib/downloadName.ts`). This only changes the filename in the
   download's `Content-Disposition` header — the original bytes and all
   embedded metadata (EXIF date, GPS, etc.) are never touched, which means
   phones still sort a saved photo into their camera roll by its original
   capture date, not by when it was downloaded. This was a deliberate
   tradeoff: fixing that sort-order would require stripping/rewriting EXIF
   data, which was ruled out to keep originals byte-for-byte untouched.
4. Thumbnail generation, image-first gallery grid polish (currently the grid
   just displays scaled-down originals, functional but not bandwidth-
   efficient for large photo counts).
5. Later: password protection, expiration dates, video poster thumbnails,
   per-photo delete, a proper full-size lightbox view (tapping a photo
   currently downloads it directly rather than previewing it first).

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
  id            uuid pk
  code          text unique, indexed   -- the 8-character random code
  name          text                   -- e.g. "PPC 001: Palais Royal"
  created_at    timestamptz
  disabled      boolean default false
  password_hash text nullable          -- deferred feature, column reserved
  expires_at    timestamptz nullable   -- deferred feature, column reserved

photos
  id            uuid pk
  event_id      uuid fk -> events.id
  storage_key   text                   -- R2 key of the original file
  thumb_key     text nullable          -- R2 key of the generated thumbnail
  mime_type     text
  byte_size     bigint
  uploaded_at   timestamptz
```

## Open items / needs owner input before next stage

- Create free accounts: Vercel, Cloudflare (for R2). Neon/Postgres can be
  provisioned directly from the Vercel dashboard.
- Decide on a project/event domain or subdomain (can start on the default
  `*.vercel.app` URL and add a custom domain later).

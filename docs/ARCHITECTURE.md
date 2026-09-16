# Paris Photo Club — Architecture & Decisions Log

This is the running record of technical decisions for the MVP. Update this
file whenever a decision changes instead of re-debating it from scratch.

## Product summary

Private, mobile-first web gallery for small Paris photo-walk outings.
Flow per outing: organizer creates an event → gets a unique link + QR code →
attendees scan it, no account/app needed → upload original photos/videos
straight from their camera roll → everyone browses the shared gallery and
downloads untouched originals.

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
| Event access control | 128-bit random token in the URL path (`/e/<token>`) | No accounts. Link = credential, same trust model as an unlisted Google Doc link. Not sequential/guessable. |
| QR code | Generated client- or server-side with the `qrcode` package from the event URL | Printable/shareable, organizer downloads it as a PNG. |
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
- Unguessable 128-bit per-event tokens (not sequential IDs).
- Storage keys namespaced per event (`events/<token>/...`) so galleries can
  never cross-contaminate even by bug.
- Organizer can instantly set an event to `disabled`; checked on every
  gallery/upload/download request.
- Downloads via short-lived signed URLs rather than permanently public
  files, so revocation is real.

**Deliberately deferred to post-MVP** (tracked here so we don't forget, not
because they don't matter):
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
2. DB schema + admin "create event" screen → generates token + QR.
3. R2 bucket + presigned upload flow + public gallery page at `/e/<token>`.
4. Thumbnail generation, image-first gallery grid.
5. Original-file download via signed URLs.
6. Disable/expire toggle in admin.
7. Later: password protection, video thumbnails, per-photo delete.

## Environment variables

Set in Vercel (Settings → Environment Variables), for Production and
Preview environments:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` — `paris-photo-club`
- `R2_ENDPOINT` — the bucket's S3 API endpoint URL

Database connection variables (`POSTGRES_URL` etc.) are injected
automatically by Vercel once a Postgres database is attached to the
project under the Storage tab — no manual copying needed.

## Data model (initial sketch)

```
events
  id            uuid pk
  token         text unique, indexed   -- the 128-bit random URL token
  name          text                   -- e.g. "PPC 001 — Palais Royal"
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

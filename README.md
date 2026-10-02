# Paris Photo Club

SHOOT → DISCOVER → HANG

A private, mobile-first web gallery for Paris Photo Club outings. Organizers
create an event and get a unique link + QR code; attendees scan it, upload
their original photos/videos straight from their camera roll, and everyone
browses and downloads the full-resolution originals. No accounts, no app
installs.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture
and decisions log — read that before making structural changes.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deployment

This project deploys to Vercel on every push. Environment variables (R2
storage credentials, database connection string) are configured in the
Vercel project's Settings → Environment Variables — never committed to the
repo.

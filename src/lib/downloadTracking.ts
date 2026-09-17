import { sql } from "@/lib/db";
import { resolveAccess, type ResolvedAccess } from "@/lib/access";

type PhotoRow = {
  id: string;
  event_id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  uploaded_at: string;
};

// Shared by the "view" route (fired the moment a photo opens full-screen,
// right before someone would press-and-hold to save it) and the "download"
// route (the explicit fallback link). Deduplicated per photo+attendee via a
// unique index, so opening a photo and also clicking Download doesn't
// double-count.
export async function verifyAndLogDownload(
  photoId: string,
  code: string
): Promise<{ access: ResolvedAccess; photo: PhotoRow } | null> {
  const access = await resolveAccess(code);
  if (!access || access.event.disabled) return null;

  const [photo] = (await sql`
    SELECT * FROM photos WHERE id = ${photoId} LIMIT 1
  `) as PhotoRow[];

  if (!photo || photo.event_id !== access.event.id) return null;

  await sql`
    INSERT INTO photo_downloads (photo_id, attendee_id)
    VALUES (${photo.id}, ${access.attendee?.id ?? null})
    ON CONFLICT (photo_id, attendee_id) DO NOTHING
  `;

  return { access, photo };
}

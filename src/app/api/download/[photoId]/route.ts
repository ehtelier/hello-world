import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { createDownloadUrl } from "@/lib/r2";
import { buildDownloadFilename } from "@/lib/downloadName";
import { resolveAccess } from "@/lib/access";

type PhotoRow = {
  id: string;
  event_id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  uploaded_at: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;
  const code = request.nextUrl.searchParams.get("code") ?? "";

  const access = await resolveAccess(code);
  if (!access || access.event.disabled) {
    return new Response("Not found", { status: 404 });
  }

  const [photo] = (await sql`
    SELECT * FROM photos WHERE id = ${photoId} LIMIT 1
  `) as PhotoRow[];

  if (!photo || photo.event_id !== access.event.id) {
    return new Response("Not found", { status: 404 });
  }

  await sql`
    INSERT INTO photo_downloads (photo_id, attendee_id)
    VALUES (${photo.id}, ${access.attendee?.id ?? null})
  `;

  const photosAsc = (await sql`
    SELECT id FROM photos WHERE event_id = ${access.event.id} ORDER BY uploaded_at ASC
  `) as { id: string }[];
  const sequence = photosAsc.findIndex((row) => row.id === photo.id) + 1;

  const downloadName = buildDownloadFilename(access.event.name, sequence || 1, photo.filename);
  const downloadUrl = await createDownloadUrl(photo.storage_key, downloadName, photo.mime_type);

  return Response.redirect(downloadUrl, 307);
}

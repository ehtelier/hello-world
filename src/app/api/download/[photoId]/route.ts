import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { createDownloadUrl } from "@/lib/r2";
import { buildDownloadFilename } from "@/lib/downloadName";
import { verifyAndLogDownload } from "@/lib/downloadTracking";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;
  const code = request.nextUrl.searchParams.get("code") ?? "";

  const result = await verifyAndLogDownload(photoId, code);
  if (!result) {
    return new Response("Not found", { status: 404 });
  }
  const { access, photo } = result;

  const photosAsc = (await sql`
    SELECT id FROM photos WHERE event_id = ${access.event.id} ORDER BY uploaded_at ASC
  `) as { id: string }[];
  const sequence = photosAsc.findIndex((row) => row.id === photo.id) + 1;

  const downloadName = buildDownloadFilename(access.event.name, sequence || 1, photo.filename);
  const downloadUrl = await createDownloadUrl(photo.storage_key, downloadName, photo.mime_type);

  return Response.redirect(downloadUrl, 307);
}

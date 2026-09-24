"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { createUploadUrl } from "@/lib/r2";
import { resolveAccess } from "@/lib/access";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 100) || "file";
}

async function requireActiveAccess(code: string) {
  const access = await resolveAccess(code);
  if (!access || access.event.disabled) {
    throw new Error("This event does not accept uploads.");
  }
  return access;
}

export async function requestUpload(code: string, filename: string, contentType: string) {
  const { event } = await requireActiveAccess(code);
  const type = contentType || "application/octet-stream";
  const key = `events/${event.code}/${randomUUID()}-${sanitizeFilename(filename)}`;
  const uploadUrl = await createUploadUrl(key, type);
  return { uploadUrl, storageKey: key };
}

export async function confirmUpload(
  code: string,
  storageKey: string,
  filename: string,
  contentType: string,
  byteSize: number,
  capturedAt: string | null,
  thumbKey: string | null
) {
  const { event, participant } = await requireActiveAccess(code);

  const takenAt = capturedAt ? new Date(capturedAt) : null;
  const validTakenAt = takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt : null;

  await sql`
    INSERT INTO photos (event_id, participant_id, storage_key, thumb_key, filename, mime_type, byte_size, taken_at)
    VALUES (
      ${event.id},
      ${participant?.id ?? null},
      ${storageKey},
      ${thumbKey},
      ${filename || "file"},
      ${contentType || "application/octet-stream"},
      ${byteSize},
      ${validTakenAt}
    )
  `;
  revalidatePath(`/e/${code}`);
}

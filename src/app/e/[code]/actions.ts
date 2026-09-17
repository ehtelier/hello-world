"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { createUploadUrl } from "@/lib/r2";

type EventLookup = { id: string; code: string; disabled: boolean };

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 100) || "file";
}

async function getActiveEvent(code: string): Promise<EventLookup> {
  const normalized = code.trim().toUpperCase();
  const [event] = (await sql`
    SELECT id, code, disabled FROM events WHERE code = ${normalized} LIMIT 1
  `) as EventLookup[];
  if (!event || event.disabled) {
    throw new Error("This event does not accept uploads.");
  }
  return event;
}

export async function requestUpload(code: string, filename: string, contentType: string) {
  const event = await getActiveEvent(code);
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
  byteSize: number
) {
  const event = await getActiveEvent(code);
  await sql`
    INSERT INTO photos (event_id, storage_key, filename, mime_type, byte_size)
    VALUES (
      ${event.id},
      ${storageKey},
      ${filename || "file"},
      ${contentType || "application/octet-stream"},
      ${byteSize}
    )
  `;
  revalidatePath(`/e/${code}`);
}

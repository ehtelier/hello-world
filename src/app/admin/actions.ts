"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { generateEventCode } from "@/lib/eventCode";
import {
  clearAdminSession,
  createAdminSession,
  isAdminAuthenticated,
  passwordMatches,
} from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function logout() {
  await clearAdminSession();
  redirect("/admin/login");
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

// Collisions are astronomically unlikely (31^8 possibilities) but a unique
// index backs this up regardless; retry a few times just in case.
async function withUniqueCode(insert: (code: string) => Promise<unknown>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateEventCode();
    try {
      await insert(code);
      return code;
    } catch (error) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505";
      if (!isUniqueViolation || attempt === 4) throw error;
    }
  }
  throw new Error("Failed to generate a unique code");
}

export async function createEvent(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await withUniqueCode((code) => sql`INSERT INTO events (code, name) VALUES (${code}, ${name})`);

  revalidatePath("/admin");
}

export async function toggleDisabled(eventId: string, nextDisabled: boolean) {
  await requireAdmin();
  await sql`UPDATE events SET disabled = ${nextDisabled} WHERE id = ${eventId}`;
  revalidatePath("/admin");
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  await sql`DELETE FROM events WHERE id = ${eventId}`;
  revalidatePath("/admin");
}

export async function addAttendee(eventId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await withUniqueCode(
    (code) => sql`INSERT INTO attendees (event_id, code, name) VALUES (${eventId}, ${code}, ${name})`
  );

  revalidatePath("/admin");
}

export async function deleteAttendee(attendeeId: string) {
  await requireAdmin();
  await sql`DELETE FROM attendees WHERE id = ${attendeeId}`;
  revalidatePath("/admin");
}

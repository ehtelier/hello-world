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

export async function createEvent(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // Collisions are astronomically unlikely (31^8 possibilities) but a
  // unique index backs this up regardless; retry a few times just in case.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateEventCode();
    try {
      await sql`INSERT INTO events (code, name) VALUES (${code}, ${name})`;
      break;
    } catch (error) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505";
      if (!isUniqueViolation || attempt === 4) throw error;
    }
  }

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

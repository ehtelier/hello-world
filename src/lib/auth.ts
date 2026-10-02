import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ppc_admin_session";
const SESSION_MESSAGE = "ppc-admin-authenticated";

function adminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not set");
  }
  return password;
}

function sessionToken(): string {
  return createHmac("sha256", adminPassword()).update(SESSION_MESSAGE).digest("hex");
}

export function passwordMatches(candidate: string): boolean {
  const expected = Buffer.from(adminPassword());
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (!cookie) return false;

  const expected = Buffer.from(sessionToken());
  const actual = Buffer.from(cookie);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

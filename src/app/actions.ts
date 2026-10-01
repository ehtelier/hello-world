"use server";

import { resolveAccess } from "@/lib/access";

// Checked inline from the homepage so a wrong code can be corrected right
// there ("that code wasn't recognized", try again) instead of navigating to
// a dead-end page.
export async function checkCode(code: string): Promise<boolean> {
  const access = await resolveAccess(code);
  return Boolean(access && !access.event.disabled);
}

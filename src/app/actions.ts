"use server";

import { resolveAccess } from "@/lib/access";

export type CodeCheckResult = {
  valid: boolean;
  // First name of the participant this code belongs to, for the brief
  // "WELCOME, <NAME>" acknowledgment on a personal code. null for an
  // event's general/unattributed code, or an invalid code.
  participantName: string | null;
};

// Checked inline from the homepage so a wrong code can be corrected right
// there ("that code wasn't recognized", try again) instead of navigating to
// a dead-end page.
export async function checkCode(code: string): Promise<CodeCheckResult> {
  const access = await resolveAccess(code);
  if (!access || access.event.disabled) {
    return { valid: false, participantName: null };
  }
  return { valid: true, participantName: access.participant?.name.split(" ")[0] ?? null };
}

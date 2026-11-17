// Sending an invitation through Resend (docs/spec/access/membership.md §3.4, §4.3).

import { env } from "cloudflare:workers";

export const RESEND_EMAILS = "https://api.resend.com/emails";

export type Email = { to: string; subject: string; text: string };

/** Sends an email as plain text. Gives true once Resend has accepted it, and false where it refused. */
export async function send(email: Email): Promise<boolean> {
  try {
    const response = await fetch(env.RESEND_URL ?? RESEND_EMAILS, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.INVITATIONS_FROM, to: [email.to], subject: email.subject, text: email.text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A moment as, say, "30 November 2026 at 18:05 UTC". */
export function utc(time: number): string {
  const d = new Date(time);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} at ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

// A stand-in for Resend (docs/spec/access/membership.md §4.7). It keeps each email sent, and can be
// told to refuse, as Resend does past the day's 100 emails.

export type Sent = { from: string; to: string[]; subject: string; text: string; key: string };

/** Every email the stand-in has accepted, the latest last. */
export const sent: Sent[] = [];
let refusing = false;

/** Makes the stand-in refuse every email until told otherwise. */
export function refuseEmails(refuse: boolean): void {
  refusing = refuse;
}

/** The stand-in's answer to the Worker's request to send an email. */
export async function emails(request: Request): Promise<Response> {
  if (refusing) return Response.json({ name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." }, { status: 429 });
  const email = (await request.json()) as Omit<Sent, "key">;
  sent.push({ ...email, key: request.headers.get("Authorization") ?? "" });
  return Response.json({ id: crypto.randomUUID() });
}

/** The latest email sent to an address, and the invitation and token its link holds. */
export function latestTo(address: string): { email: Sent; invitation: string; token: string } {
  const email = [...sent].reverse().find((e) => e.to.includes(address));
  if (!email) throw new Error(`No email was sent to ${address}.`);
  const link = /https:\/\/[^\s/]+\/invitations\/([^#\s]+)#(\S+)/.exec(email.text);
  if (!link) throw new Error("The email holds no invitation link.");
  return { email, invitation: link[1]!, token: link[2]! };
}

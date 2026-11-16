// The session cookie (docs/spec/access/accounts.md §3.2): `itinero_session`, marked Secure,
// HttpOnly and SameSite=Lax, so that no script on the page can read it.

import { SESSION_LIFE } from "./accounts.ts";

const COOKIE = "itinero_session";

/** The session a request carries, if any. */
export function sessionOf(request: Request): string | undefined {
  for (const pair of (request.headers.get("Cookie") ?? "").split(";")) {
    const [name, ...value] = pair.trim().split("=");
    if (name === COOKIE) return value.join("=") || undefined;
  }
  return undefined;
}

/** Sets the session on the device, for as long as it may go unused (§4.3). */
export function setSession(session: string): string {
  return `${COOKIE}=${session}; Path=/; Max-Age=${SESSION_LIFE / 1000}; Secure; HttpOnly; SameSite=Lax`;
}

/** Clears the session from the device (§4.4). */
export function clearSession(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

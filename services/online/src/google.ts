// Checking an ID token from Google, the one provider travellers sign in through
// (docs/spec/access/accounts.md §3.4, §4.2, steps 2 and 3).

import { fromBase64url } from "./bytes.ts";
import { accept, refuse, type Result } from "./result.ts";

/** Where Google publishes the public keys it signs ID tokens with, as a JSON Web Key Set. */
export const GOOGLE_KEYS = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** The claims of a checked ID token that the accounts component reads. */
export type Claims = { sub: string; email?: string; emailVerified: boolean; name?: string };

type Key = JsonWebKey & { kid?: string };

async function readKeys(response: Response): Promise<Key[]> {
  const set = (await response.json()) as { keys?: Key[] };
  return Array.isArray(set.keys) ? set.keys : [];
}

/**
 * Google's key set, from Cloudflare's cache for the time Google's response allows, or fetched
 * again where `fresh` is true, as when a token names a key the cached set does not hold.
 */
async function keySet(fresh: boolean): Promise<Key[]> {
  const cache = caches.default;
  if (!fresh) {
    const cached = await cache.match(GOOGLE_KEYS);
    if (cached) return readKeys(cached);
  }
  const response = await fetch(GOOGLE_KEYS);
  if (!response.ok) throw new Error(`Google's key set could not be fetched: status ${response.status}.`);
  await cache.put(GOOGLE_KEYS, response.clone());
  return readKeys(response);
}

async function keyNamed(kid: string): Promise<Key | undefined> {
  return (await keySet(false)).find((k) => k.kid === kid) ?? (await keySet(true)).find((k) => k.kid === kid);
}

function part(text: string): Record<string, unknown> | undefined {
  const bytes = fromBase64url(text);
  if (!bytes) return undefined;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks an ID token's signature against Google's keys, then its issuer, audience, expiry and
 * nonce, against the online side's own clock. Gives its claims, or refuses with `bad-token`.
 */
export async function checkIdToken(token: string, nonce: string, clientId: string, now: number): Promise<Result<Claims>> {
  const bad = (why: string) => refuse<Claims>("bad-token", `Google's sign-in could not be accepted, because ${why}.`);
  const parts = token.split(".");
  if (parts.length !== 3) return bad("the token is not in the form of an ID token");
  const [head, payload, signature] = parts as [string, string, string];
  const header = part(head);
  const claims = part(payload);
  const signed = fromBase64url(signature);
  if (!header || !claims || !signed) return bad("the token is not in the form of an ID token");
  if (header.alg !== "RS256" || typeof header.kid !== "string") return bad("the token is not signed as Google signs");

  const jwk = await keyNamed(header.kid);
  if (!jwk) return bad("the token is signed with a key Google does not hold");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signed, new TextEncoder().encode(`${head}.${payload}`));
  if (!valid) return bad("its signature does not check against Google's keys");

  if (typeof claims.iss !== "string" || !ISSUERS.includes(claims.iss)) return bad("it was not issued by Google");
  if (claims.aud !== clientId) return bad("it was made for another app");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return bad("it has expired");
  if (claims.nonce !== nonce) return bad("it was made for another sign-in");
  if (typeof claims.sub !== "string" || claims.sub === "") return bad("it names no Google account");

  const result: Claims = { sub: claims.sub, emailVerified: claims.email_verified === true || claims.email_verified === "true" };
  if (typeof claims.email === "string" && claims.email !== "") result.email = claims.email;
  if (typeof claims.name === "string" && claims.name.trim() !== "") result.name = claims.name;
  return accept(result);
}

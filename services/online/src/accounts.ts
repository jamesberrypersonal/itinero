// access/accounts: each traveller's account, signing in with Google, sessions, and the account
// behind every request. docs/spec/access/accounts.md specifies it, and its sections are cited.

import { env } from "cloudflare:workers";
import { codePoints, digest, fromBase64url, randomBytes, randomToken, toBase64url } from "./bytes.ts";
import { checkIdToken } from "./google.ts";
import { accept, refuse, type Result } from "./result.ts";

/** "u-" and 22 characters of base64url, unique and never reused (§3.3). */
export type AccountId = string;
export type Account = { id: AccountId; email: string; emailVerified: boolean; name: string; named: boolean };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A nonce is refused once it is this old (§4.1). */
export const NONCE_LIFE = 10 * MINUTE;
/** A session ends once it goes this long unused (§4.3). */
export const SESSION_LIFE = 180 * DAY;
/** A session's last use is written at most this often (§4.3). */
const TOUCH_EVERY = HOUR;
const NAME_LENGTH = 60;

type AccountRow = { id: string; email: string; email_verified: number; name: string; named: number };

function toAccount(row: AccountRow): Account {
  return { id: row.id, email: row.email, emailVerified: row.email_verified === 1, name: row.name, named: row.named === 1 };
}

// §4.1 The nonce: 16 random bytes and the time it was made, followed by their HMAC-SHA256 with
// NONCE_KEY, each in base64url. Making one writes nothing.

async function nonceKey(): Promise<CryptoKey> {
  const raw = fromBase64url(env.NONCE_KEY ?? "");
  if (!raw || raw.length !== 32) throw new Error("The Worker's secret NONCE_KEY is not 32 bytes in base64url.");
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function timeBytes(time: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(time));
  return bytes;
}

function joined(random: Uint8Array, time: Uint8Array): Uint8Array {
  const both = new Uint8Array(random.length + time.length);
  both.set(random);
  both.set(time, random.length);
  return both;
}

/** A new nonce, made at `now`, the online side's own clock. */
export async function makeNonce(now: number = Date.now()): Promise<string> {
  const random = randomBytes(16);
  const time = timeBytes(now);
  const code = new Uint8Array(await crypto.subtle.sign("HMAC", await nonceKey(), joined(random, time)));
  return [random, time, code].map(toBase64url).join(".");
}

/** Whether a nonce was made by the online side under 10 minutes ago. The HMAC check is constant-time. */
async function nonceChecks(nonce: string, now: number): Promise<boolean> {
  const parts = nonce.split(".").map(fromBase64url);
  if (parts.length !== 3) return false;
  const [random, time, code] = parts;
  if (!random || random.length !== 16 || !time || time.length !== 8 || !code) return false;
  if (!(await crypto.subtle.verify("HMAC", await nonceKey(), code, joined(random, time)))) return false;
  const made = Number(new DataView(time.buffer, time.byteOffset).getBigUint64(0));
  return made <= now + MINUTE && now - made < NONCE_LIFE;
}

// §4.2 Signing in.

export type SignedIn = { account: Account; session: string };

export async function signIn(provider: unknown, idToken: unknown, nonce: unknown, now: number = Date.now()): Promise<Result<SignedIn>> {
  if (provider !== "google" || typeof idToken !== "string" || typeof nonce !== "string") {
    return refuse("malformed", "A sign-in needs a provider of \"google\", an ID token and a nonce.");
  }
  // 1. The nonce's code checks, and it is under 10 minutes old.
  if (!(await nonceChecks(nonce, now))) {
    return refuse("bad-nonce", "The sign-in was not started by Itinero, or was started over 10 minutes ago. Try again.");
  }
  // 2 and 3. The token's signature, issuer, audience, expiry and nonce.
  const checked = await checkIdToken(idToken, nonce, env.GOOGLE_CLIENT_ID, now);
  if (!checked.ok) return checked;
  const claims = checked.value;

  // 4. One batch: storing the nonce's digest fails where it is held already, and then nothing of the
  // batch is written. The account is found by provider and subject, or made, and a session started.
  const email = claims.email?.toLowerCase();
  const name = startingName(claims.name, claims.email);
  const session = randomToken(32);
  const nonceDigest = await digest(nonce);
  const statements = [
    env.DB.prepare("INSERT INTO nonces (digest, made) VALUES (?1, ?2)").bind(nonceDigest, now),
    env.DB.prepare(
      `INSERT INTO accounts (id, provider, sub, email, email_verified, name, named, made)
       VALUES (?1, 'google', ?2, ?3, ?4, ?5, 0, ?6)
       ON CONFLICT (provider, sub) DO UPDATE SET
         email = CASE WHEN ?7 THEN excluded.email ELSE accounts.email END,
         email_verified = CASE WHEN ?7 THEN excluded.email_verified ELSE accounts.email_verified END
       RETURNING id, email, email_verified, name, named`,
    ).bind(`u-${randomToken(16)}`, claims.sub, email ?? "", claims.emailVerified ? 1 : 0, name, now, email === undefined ? 0 : 1),
    env.DB.prepare(
      "INSERT INTO sessions (digest, account, last_used) SELECT ?1, id, ?2 FROM accounts WHERE provider = 'google' AND sub = ?3",
    ).bind(await digest(session), now, claims.sub),
  ];
  let results: D1Result[];
  try {
    results = await env.DB.batch(statements);
  } catch (error) {
    const held = await env.DB.prepare("SELECT 1 FROM nonces WHERE digest = ?1").bind(nonceDigest).first();
    if (held) return refuse("bad-nonce", "This sign-in has been used already. Try again.");
    throw error;
  }
  const row = results[1]?.results[0] as AccountRow | undefined;
  if (!row) throw new Error("The account signed in to was not given back.");
  return accept({ account: toAccount(row), session });
}

/** A new account's name: the provider's, trimmed and cut to 60 characters, or its email address before the `@`. */
function startingName(name: string | undefined, email: string | undefined): string {
  const given = name?.trim() || email?.split("@")[0] || "Traveller";
  return Array.from(given).slice(0, NAME_LENGTH).join("").trim();
}

// §4.3 Sessions.

export type Authenticated = { account: Account; renewed: boolean };

/**
 * The account behind a session, or `no-session`. `renewed` is true where the session's last use was
 * written, which happens at most once an hour, so that the caller renews the device's cookie.
 */
export async function authenticate(session: string | undefined, now: number = Date.now()): Promise<Result<Authenticated>> {
  const none = refuse<Authenticated>("no-session", "You are not signed in. Sign in, and try again.");
  if (!session) return none;
  const sessionDigest = await digest(session);
  const row = await env.DB.prepare(
    `SELECT s.last_used, a.id, a.email, a.email_verified, a.name, a.named
     FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.digest = ?1`,
  )
    .bind(sessionDigest)
    .first<AccountRow & { last_used: number }>();
  if (!row) return none;
  if (now - row.last_used >= SESSION_LIFE) {
    await env.DB.prepare("DELETE FROM sessions WHERE digest = ?1").bind(sessionDigest).run();
    return none;
  }
  const renewed = now - row.last_used >= TOUCH_EVERY;
  if (renewed) await env.DB.prepare("UPDATE sessions SET last_used = ?2 WHERE digest = ?1").bind(sessionDigest, now).run();
  return accept({ account: toAccount(row), renewed });
}

/** The account behind a request, or `no-session` (§3.3, `ACC:ACCOUNTS-F4`). */
export async function whoSent(request: { session?: string }): Promise<Result<Account>> {
  const result = await authenticate(request.session);
  return result.ok ? accept(result.value.account) : result;
}

/** An account by its identifier (§3.3). */
export async function account(id: AccountId): Promise<Account | undefined> {
  const row = await env.DB.prepare("SELECT id, email, email_verified, name, named FROM accounts WHERE id = ?1").bind(id).first<AccountRow>();
  return row ? toAccount(row) : undefined;
}

// §4.4 Signing out.

export async function signOut(session: string | undefined): Promise<void> {
  if (session) await env.DB.prepare("DELETE FROM sessions WHERE digest = ?1").bind(await digest(session)).run();
}

// §4.5 Choosing a name.

export async function setName(id: AccountId, name: unknown): Promise<Result<string>> {
  if (typeof name !== "string") return refuse("malformed", "A name needs to be text.");
  const trimmed = name.trim();
  if (trimmed === "") return refuse("bad-name", "Your name is empty. Give a name of 1 to 60 characters.");
  if (codePoints(trimmed) > NAME_LENGTH) return refuse("bad-name", "Your name is longer than 60 characters.");
  await env.DB.prepare("UPDATE accounts SET name = ?2, named = 1 WHERE id = ?1").bind(id, trimmed).run();
  return accept(trimmed);
}

// §5 The daily task: forget sessions past their 180 days, and nonces past their 10 minutes.

export async function forgetExpired(now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE last_used <= ?1").bind(now - SESSION_LIFE),
    env.DB.prepare("DELETE FROM nonces WHERE made <= ?1").bind(now - NONCE_LIFE),
  ]);
}

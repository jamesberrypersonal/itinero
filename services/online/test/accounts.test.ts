// Every check in the verification of each requirement access/accounts claims, against the stand-in
// for Google, and each refusal of docs/spec/access/accounts.md §3.2 (§4.6).

import { createScheduledController, env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { account, makeNonce, NONCE_LIFE, SESSION_LIFE, whoSent } from "../src/accounts.ts";
import { digest } from "../src/bytes.ts";
import worker from "../src/index.ts";
import { answer } from "../src/answer.ts";
import { google, idToken, keyFetches, stranger, type Person } from "./google.ts";
import { api, expectRefused, json, nonce, rows, sessionSet, signIn } from "./helpers.ts";

const DAY = 24 * 60 * 60 * 1000;
let people = 0;
/** A new person at Google, unique to the test. */
function person(fields: Partial<Person> = {}): Person {
  people++;
  return { sub: `google-${people}`, email: `traveller${people}@example.com`, name: `Traveller ${people}`, ...fields };
}

async function signInWith(token: (n: string) => Promise<string>, n?: string): Promise<Response> {
  const given = n ?? (await nonce());
  return api("/api/auth/sign-in", { method: "POST", body: { provider: "google", idToken: await token(given), nonce: given } });
}

/** Sets a session's last use to `days` days ago. */
async function lastUsed(session: string, days: number): Promise<void> {
  await env.DB.prepare("UPDATE sessions SET last_used = ?2 WHERE digest = ?1").bind(await digest(session), Date.now() - days * DAY).run();
}

describe("ACC:ACCOUNTS-F1 — a traveller signs in with a Google account, and has the same account each time", () => {
  test("the first sign-in gives a new account, the second the same, and a second person a second", async () => {
    const first = person();
    const one = await signIn(first);
    expect(one.account).toMatch(/^u-[A-Za-z0-9_-]{22}$/);
    const again = await signIn(first);
    expect(again.account).toBe(one.account);
    expect(again.session).not.toBe(one.session);
    const two = await signIn(person());
    expect(two.account).not.toBe(one.account);
  });

  test("a token that has expired is refused, with the reason", async () => {
    const response = await signInWith((n) => idToken(person(), n, { expiresIn: -10 }));
    expect(await expectRefused(response, 401, "bad-token")).toMatch(/expired/);
  });

  test("a token made for another app is refused, with the reason", async () => {
    const response = await signInWith((n) => idToken(person(), n, { aud: "another-app.apps.googleusercontent.com" }));
    expect(await expectRefused(response, 401, "bad-token")).toMatch(/another app/);
  });

  test("a token signed with a key Google does not hold, or with a forged signature, is refused", async () => {
    const unknown = await signInWith((n) => idToken(person(), n, { signer: stranger }));
    expect(await expectRefused(unknown, 401, "bad-token")).toMatch(/key Google does not hold/);
    const borrowed = await signInWith((n) => idToken(person(), n, { signer: stranger, kid: google.kid }));
    expect(await expectRefused(borrowed, 401, "bad-token")).toMatch(/signature/);
  });

  test("a token from another issuer, or for another sign-in's nonce, is refused", async () => {
    await expectRefused(await signInWith((n) => idToken(person(), n, { iss: "https://accounts.example.com" })), 401, "bad-token");
    const other = await nonce();
    expect(await expectRefused(await signInWith(() => idToken(person(), other)), 401, "bad-token")).toMatch(/another sign-in/);
  });

  test("a token Google did not sign for Itinero writes no record", async () => {
    const before = [await rows("accounts"), await rows("sessions"), await rows("nonces")];
    await signInWith((n) => idToken(person(), n, { aud: "another-app" }));
    await signInWith((n) => idToken(person(), n, { signer: stranger }));
    expect([await rows("accounts"), await rows("sessions"), await rows("nonces")]).toEqual(before);
  });

  test("a nonce Itinero did not give, one used already, and one over 10 minutes old are refused", async () => {
    await expectRefused(await signInWith((n) => idToken(person(), n), "made-up.nonce.value"), 401, "bad-nonce");
    const real = await nonce();
    const [a, b, c] = real.split(".");
    const tampered = `${a}.${b}.${c!.slice(0, -2)}AA`;
    await expectRefused(await signInWith((n) => idToken(person(), n), tampered), 401, "bad-nonce");

    const used = await nonce();
    const someone = person();
    expect((await signInWith((n) => idToken(someone, n), used)).status).toBe(200);
    await expectRefused(await signInWith((n) => idToken(someone, n), used), 401, "bad-nonce");

    const old = await makeNonce(Date.now() - NONCE_LIFE - 1000);
    await expectRefused(await signInWith((n) => idToken(person(), n), old), 401, "bad-nonce");
  });

  test("Google's key set is fetched once, then taken from the cache", async () => {
    await signIn(person());
    const after = keyFetches;
    await signIn(person());
    expect(keyFetches).toBe(after);
  });
});

describe("ACC:ACCOUNTS-F2 — an account holds the email address its provider vouches for", () => {
  test("an account gives its Google account's address, as confirmed", async () => {
    const signed = await signIn(person({ email: "Sam.Taylor@Example.com" }));
    expect(signed.email).toBe("sam.taylor@example.com");
    const held = await account(signed.account);
    expect(held).toMatchObject({ email: "sam.taylor@example.com", emailVerified: true });
  });

  test("a changed address is the account's after the next sign-in", async () => {
    const sam = person({ email: "sam@example.com" });
    const first = await signIn(sam);
    const second = await signIn({ ...sam, email: "sam.taylor@example.org", emailVerified: false });
    expect(second.account).toBe(first.account);
    expect(await account(first.account)).toMatchObject({ email: "sam.taylor@example.org", emailVerified: false });
  });

  test("a sign-in whose token holds no address keeps the address the account holds", async () => {
    const sam = person({ email: "kept@example.com" });
    const first = await signIn(sam);
    const { email: _, ...noEmail } = sam;
    await signIn(noEmail);
    expect(await account(first.account)).toMatchObject({ email: "kept@example.com", emailVerified: true });
  });
});

describe("ACC:ACCOUNTS-F3 — a device stays signed in until its traveller signs out, or leaves it unused for 180 days", () => {
  test("a request with the session is made by the account", async () => {
    const signed = await signIn(person());
    const response = await api("/api/auth/name", { method: "PUT", session: signed.session, body: { name: "Sam" } });
    expect(response.status).toBe(200);
    expect(await account(signed.account)).toMatchObject({ name: "Sam" });
  });

  test("after signing out, the same session is refused, and the cookie is cleared", async () => {
    const signed = await signIn(person());
    const out = await api("/api/auth/sign-out", { method: "POST", session: signed.session });
    expect(out.status).toBe(204);
    expect(out.headers.get("Set-Cookie")).toMatch(/itinero_session=;.*Max-Age=0/);
    await expectRefused(await api("/api/auth/name", { method: "PUT", session: signed.session, body: { name: "Sam" } }), 401, "no-session");
  });

  test("a session last used 181 days before is refused, and forgotten; one used 179 days before works", async () => {
    const signed = await signIn(person());
    await lastUsed(signed.session, 179);
    expect((await whoSent({ session: signed.session })).ok).toBe(true);
    await lastUsed(signed.session, 181);
    const result = await whoSent({ session: signed.session });
    expect(result.ok ? undefined : result.refusal.code).toBe("no-session");
    expect(await env.DB.prepare("SELECT 1 FROM sessions WHERE digest = ?1").bind(await digest(signed.session)).first()).toBeNull();
  });

  test("signing out on one of two devices leaves the other's session working", async () => {
    const sam = person();
    const phone = await signIn(sam);
    const laptop = await signIn(sam);
    await api("/api/auth/sign-out", { method: "POST", session: phone.session });
    expect((await whoSent({ session: phone.session })).ok).toBe(false);
    const still = await whoSent({ session: laptop.session });
    expect(still.ok && still.value.id).toBe(laptop.account);
  });

  test("the session cookie is Secure, HttpOnly and SameSite=Lax, and lasts 180 days", async () => {
    const n = await nonce();
    const response = await api("/api/auth/sign-in", { method: "POST", body: { provider: "google", idToken: await idToken(person(), n), nonce: n } });
    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(new RegExp(`Max-Age=${SESSION_LIFE / 1000}`));
    expect(sessionSet(response)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("a session's last use is written at most once an hour, and the cookie renewed when it is", async () => {
    const signed = await signIn(person());
    const named = () => api("/api/auth/name", { method: "PUT", session: signed.session, body: { name: "Sam" } });
    expect((await named()).headers.get("Set-Cookie")).toBeNull();
    await env.DB.prepare("UPDATE sessions SET last_used = last_used - 2 * 3600 * 1000 WHERE digest = ?1").bind(await digest(signed.session)).run();
    expect((await named()).headers.get("Set-Cookie")).toMatch(/itinero_session=/);
    const lastUse = await env.DB.prepare("SELECT last_used FROM sessions WHERE digest = ?1").bind(await digest(signed.session)).first<{ last_used: number }>();
    expect(Date.now() - lastUse!.last_used).toBeLessThan(60_000);
  });

  test("the daily task forgets sessions past their 180 days and nonces past their 10 minutes", async () => {
    const kept = await signIn(person());
    const gone = await signIn(person());
    await lastUsed(gone.session, 181);
    await env.DB.prepare("INSERT INTO nonces (digest, made) VALUES ('old', ?1)").bind(Date.now() - NONCE_LIFE - 1000).run();
    await worker.scheduled(createScheduledController({ scheduledTime: Date.now() }), env, {} as ExecutionContext);
    expect(await env.DB.prepare("SELECT 1 FROM sessions WHERE digest = ?1").bind(await digest(kept.session)).first()).not.toBeNull();
    expect(await env.DB.prepare("SELECT 1 FROM sessions WHERE digest = ?1").bind(await digest(gone.session)).first()).toBeNull();
    expect(await env.DB.prepare("SELECT 1 FROM nonces WHERE digest = 'old'").first()).toBeNull();
  });
});

describe("ACC:ACCOUNTS-F4 — every request names its account, or is refused", () => {
  test("a request with a working session gives the account", async () => {
    const signed = await signIn(person({ name: "Ana" }));
    const result = await whoSent({ session: signed.session });
    expect(result.ok && result.value).toMatchObject({ id: signed.account, name: "Ana", named: false });
  });

  test("a request with no session, and one with a made-up session, are each refused, with the reason", async () => {
    for (const session of [undefined, "made-up-session"]) {
      const result = await whoSent(session === undefined ? {} : { session });
      expect(result.ok ? undefined : result.refusal).toMatchObject({ code: "no-session", message: expect.stringMatching(/not signed in/) });
    }
    await expectRefused(await api("/api/auth/name", { method: "PUT", body: { name: "Sam" } }), 401, "no-session");
    await expectRefused(await api("/api/auth/name", { method: "PUT", session: "made-up", body: { name: "Sam" } }), 401, "no-session");
  });
});

describe("ACC:ACCOUNTS-F5 — an account holds a name its traveller chooses, which a later sign-in never changes", () => {
  test("Sam Taylor signs in, chooses Sam, and keeps it after Google's name changes", async () => {
    const sam = person({ name: "Sam Taylor" });
    const first = await signIn(sam);
    expect(first).toMatchObject({ name: "Sam Taylor", named: false });

    const set = await api("/api/auth/name", { method: "PUT", session: first.session, body: { name: "  Sam " } });
    expect(await json(set)).toEqual({ name: "Sam" });
    expect(await account(first.account)).toMatchObject({ name: "Sam", named: true });

    const again = await signIn({ ...sam, name: "Samuel Taylor" });
    expect(again).toMatchObject({ name: "Sam", named: true });
  });

  test("an empty name, and one of 61 characters, are each refused, with the reason", async () => {
    const signed = await signIn(person());
    const name = (value: string) => api("/api/auth/name", { method: "PUT", session: signed.session, body: { name: value } });
    expect(await expectRefused(await name("   "), 400, "bad-name")).toMatch(/empty/);
    expect(await expectRefused(await name("a".repeat(61)), 400, "bad-name")).toMatch(/60 characters/);
    expect((await name("🧳".repeat(60))).status).toBe(200);
    expect(await account(signed.account)).toMatchObject({ name: "🧳".repeat(60), named: true });
  });

  test("setting the name an account already holds marks it chosen, and changes nothing else", async () => {
    const signed = await signIn(person({ name: "Ana Lima" }));
    await api("/api/auth/name", { method: "PUT", session: signed.session, body: { name: "Ana Lima" } });
    expect(await account(signed.account)).toMatchObject({ name: "Ana Lima", named: true });
  });

  test("an account whose provider gives no name starts with its address before the @, not yet chosen", async () => {
    const { name: _, ...nameless } = person({ email: "ana.lima@example.com" });
    expect(await signIn(nameless)).toMatchObject({ name: "ana.lima", named: false });
  });

  test("a provider's name over 60 characters is cut to 60", async () => {
    expect((await signIn(person({ name: "N".repeat(70) }))).name).toBe("N".repeat(60));
  });
});

describe("ACC:ACCOUNTS-NFR1 — Itinero holds no password, and nothing that lets a stolen copy sign anyone in", () => {
  test("nothing stored holds a password or a session, and a session taken from the stored copy is refused", async () => {
    const signed = await signIn(person());
    const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").all<{ name: string }>();
    for (const { name } of tables.results) {
      const columns = await env.DB.prepare(`PRAGMA table_info(${name})`).all<{ name: string }>();
      expect(columns.results.map((c) => c.name).join(",")).not.toMatch(/pass/i);
      const copy = JSON.stringify((await env.DB.prepare(`SELECT * FROM ${name}`).all()).results);
      expect(copy).not.toContain(signed.session);
    }
    const stored = await env.DB.prepare("SELECT digest FROM sessions").all<{ digest: string }>();
    for (const { digest: copied } of stored.results) {
      expect((await whoSent({ session: copied })).ok).toBe(false);
      await expectRefused(await api("/api/auth/name", { method: "PUT", session: copied, body: { name: "Thief" } }), 401, "no-session");
    }
  });

  test("a nonce taken from the stored copy is refused", async () => {
    await signIn(person());
    const stored = await env.DB.prepare("SELECT digest FROM nonces").all<{ digest: string }>();
    for (const { digest: copied } of stored.results) {
      await expectRefused(await signInWith((n) => idToken(person(), n), copied), 401, "bad-nonce");
    }
  });
});

describe("The refusals of §3.2", () => {
  test("a body not in the form given is refused with malformed", async () => {
    const signIns = ["not json", [], { provider: "apple", idToken: "x", nonce: "y" }, { provider: "google", nonce: "y" }];
    for (const body of signIns) await expectRefused(await api("/api/auth/sign-in", { method: "POST", body }), 400, "malformed");
    const signed = await signIn(person());
    await expectRefused(await api("/api/auth/name", { method: "PUT", session: signed.session, body: { name: 7 } }), 400, "malformed");
  });

  test("signing out with no session, or one already ended, succeeds and does nothing", async () => {
    expect((await api("/api/auth/sign-out", { method: "POST" })).status).toBe(204);
    expect((await api("/api/auth/sign-out", { method: "POST", session: "ended" })).status).toBe(204);
  });

  test("a request with no Itinero-Api, or a number lower than the oldest answered, is refused with update-first", async () => {
    for (const version of [undefined, "0", "1", "one"]) {
      const headers: Record<string, string> = version === undefined ? {} : { "Itinero-Api": version };
      const request = new Request("https://itinero.test/api/auth/nonce", { method: "POST", headers });
      await expectRefused(await answer(request), 426, "update-first");
    }
  });

  test("update-first is given before a session is looked for, and the request that opens a WebSocket is not refused for carrying no number", async () => {
    const before = await rows("sessions");
    const stale = new Request("https://itinero.test/api/auth/name", { method: "PUT", headers: { Cookie: "itinero_session=x", "Itinero-Api": "0" }, body: "{}" });
    await expectRefused(await answer(stale), 426, "update-first");
    expect(await rows("sessions")).toBe(before);
    const socket = new Request("https://itinero.test/api/auth/nonce", { method: "POST", headers: { Upgrade: "websocket" } });
    expect((await answer(socket)).status).toBe(200);
  });
});

describe("§3.2 — a nonce comes with Itinero's client identifier at Google", () => {
  test("the sign-in screen draws Google's button from the Worker's own variable", async () => {
    const answer = await json<{ nonce: string; google: string }>(await api("/api/auth/nonce", { method: "POST" }));
    expect(answer.google).toBe("itinero-test.apps.googleusercontent.com");
    expect(answer.nonce).toBeTypeOf("string");
  });
});

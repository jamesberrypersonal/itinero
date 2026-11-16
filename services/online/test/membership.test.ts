// Every check in the verification of each requirement access/membership claims, against the
// stand-in for Resend, and each refusal of docs/spec/access/membership.md §3.2 (§4.7).

import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import { digest } from "../src/bytes.ts";
import worker from "../src/index.ts";
import { createTrip, member, onChange, onTitle, trips, type Change, type Listed } from "../src/membership.ts";
import { api, expectRefused, json, signIn, type SignedIn } from "./helpers.ts";
import { latestTo, refuseEmails, sent } from "./resend.ts";

const DAY = 24 * 60 * 60 * 1000;

/** What the listener of onChange was given, as planner/trip-host would apply it. */
let changes: { trip: string; change: Change }[] = [];
let failNext = false;
let during: ((trip: string, change: Change) => Promise<void>) | undefined;

beforeEach(() => {
  changes = [];
  failNext = false;
  during = undefined;
  refuseEmails(false);
  onChange(async (trip, change) => {
    if (failNext) {
      failNext = false;
      throw new Error("The trip's grants could not be changed.");
    }
    changes.push({ trip, change });
    await during?.(trip, change);
  });
  onTitle(async (trip) => (trip.startsWith("chile") ? "Chile in March" : undefined));
});

let count = 0;
/** A traveller signed in with a Google account of their own. */
async function traveller(name: string, fields: { email?: string; emailVerified?: boolean } = {}): Promise<SignedIn> {
  count++;
  return signIn({ sub: `member-${count}`, email: fields.email ?? `${name.toLowerCase()}${count}@example.com`, name, emailVerified: fields.emailVerified ?? true });
}

let tripCount = 0;
/** A new trip, created by the traveller given. */
async function newTrip(creator: SignedIn): Promise<string> {
  tripCount++;
  const trip = `chile-${tripCount}`;
  await createTrip(trip, creator.account);
  return trip;
}

const inviteTo = (trip: string, by: SignedIn, email: string, access: { trip?: string; calendar?: string } = {}) =>
  api(`/api/trips/${trip}/invitations`, { method: "POST", session: by.session, body: { email, trip: access.trip ?? "view", calendar: access.calendar ?? "none" } });

const acceptAs = (who: SignedIn, invitation: string, token: string) =>
  api(`/api/invitations/${invitation}/accept`, { method: "POST", session: who.session, body: { token } });

/** Invites a traveller, who accepts, which must succeed. */
async function join(trip: string, by: SignedIn, who: SignedIn, access: { trip?: string; calendar?: string } = {}): Promise<void> {
  expect((await inviteTo(trip, by, who.email, access)).status).toBe(201);
  const { invitation, token } = latestTo(who.email);
  expect((await acceptAs(who, invitation, token)).status).toBe(200);
}

const listOf = async (trip: string, who: SignedIn) => json<{ members: Listed[]; invitations?: { id: string; email: string; expires: string }[] }>(await api(`/api/trips/${trip}/members`, { session: who.session }));

const makeAdminOf = (trip: string, by: SignedIn, who: SignedIn) => api(`/api/trips/${trip}/admins`, { method: "POST", session: by.session, body: { account: who.account } });
const removeFrom = (trip: string, by: SignedIn, account: string) => api(`/api/trips/${trip}/members/${account}`, { method: "DELETE", session: by.session });

describe("ACC:MEMBERSHIP-F1 — the traveller who creates a trip is its member and its admin for good", () => {
  test("a new trip's creator is its only member, an admin and the creator", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    const { members } = await listOf(trip, ana);
    expect(members).toEqual([{ account: ana.account, admin: true, creator: true, joined: expect.any(String), name: "Ana" }]);
    expect(await member(trip, ana.account)).toMatchObject({ admin: true, creator: true });
  });

  test("the creator makes a second member an admin, and the caller is told", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    changes = [];
    expect((await makeAdminOf(trip, ana, sam)).status).toBe(204);
    expect(await member(trip, sam.account)).toMatchObject({ admin: true, creator: false });
    expect(changes).toEqual([{ trip, change: { op: "admin", traveller: sam.account } }]);
    expect((await makeAdminOf(trip, ana, sam)).status).toBe(204);
    expect(changes).toHaveLength(2);
  });

  test("the second admin removing the creator, or taking away the creator's role, is refused, with the reason", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await makeAdminOf(trip, ana, sam);
    expect(await expectRefused(await removeFrom(trip, sam, ana.account), 409, "creator")).toMatch(/creator cannot be removed/);
    await expectRefused(await api(`/api/trips/${trip}/admins/${ana.account}`, { method: "DELETE", session: sam.session }), 404, "not-found");
    expect(await member(trip, ana.account)).toMatchObject({ admin: true, creator: true });
  });

  test("a member who is not an admin making a third member an admin is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const leo = await traveller("Leo");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await join(trip, ana, leo);
    await expectRefused(await makeAdminOf(trip, sam, leo), 403, "admin-only");
    expect(await member(trip, leo.account)).toMatchObject({ admin: false });
  });

  test("a listener that fails refuses the request, and making it again tells the devices", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    changes = [];
    failNext = true;
    expect((await makeAdminOf(trip, ana, sam)).status).toBe(500);
    expect((await makeAdminOf(trip, ana, sam)).status).toBe(204);
    expect(changes).toEqual([{ trip, change: { op: "admin", traveller: sam.account } }]);
  });
});

describe("ACC:MEMBERSHIP-F2 — an admin invites a traveller by email address, with their access to the trip and the calendar", () => {
  test("an invitation with view access to the trip and none to the calendar reaches the address", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    const response = await inviteTo(trip, ana, "  Sam.Taylor@Example.com ");
    expect(response.status).toBe(201);
    const given = await json<Record<string, unknown>>(response);
    expect(given).toEqual({ id: expect.stringMatching(/^i-/), email: "sam.taylor@example.com", trip: "view", calendar: "none", expires: expect.any(String) });
    expect(Object.keys(given)).not.toContain("token");
    const { email, invitation } = latestTo("sam.taylor@example.com");
    expect(invitation).toBe(given.id);
    expect(email).toMatchObject({ from: "Itinero <invitations@itinero.test>", subject: "You are invited to a trip on Itinero", key: "Bearer re_test" });
    expect(email.text).toMatch(/^Ana has invited you to Chile in March on Itinero\./);
    expect(email.text).toMatch(/expires on \d+ \w+ \d{4} at \d\d:\d\d UTC/);
    expect(Date.parse(given.expires as string) - Date.now()).toBeGreaterThan(14 * DAY - 60_000);
  });

  test("inviting the same address again, with edit access, means the first can no longer be accepted", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const first = latestTo(sam.email);
    await inviteTo(trip, ana, sam.email.toUpperCase(), { trip: "edit" });
    const second = latestTo(sam.email);
    expect(second.invitation).not.toBe(first.invitation);
    await expectRefused(await acceptAs(sam, first.invitation, first.token), 404, "bad-invitation");
    expect((await listOf(trip, ana)).invitations).toEqual([expect.objectContaining({ id: second.invitation })]);
  });

  test("a withdrawn invitation can no longer be accepted, and withdrawing it again does nothing", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email, { trip: "edit" });
    const { invitation, token } = latestTo(sam.email);
    expect((await api(`/api/trips/${trip}/invitations/${invitation}`, { method: "DELETE", session: ana.session })).status).toBe(204);
    expect((await api(`/api/trips/${trip}/invitations/${invitation}`, { method: "DELETE", session: ana.session })).status).toBe(204);
    await expectRefused(await acceptAs(sam, invitation, token), 404, "bad-invitation");
  });

  test("inviting an address a member's account holds is refused, with the reason", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    expect(await expectRefused(await inviteTo(trip, ana, sam.email.toUpperCase()), 409, "already-a-member")).toMatch(/already has that email address/);
    await expectRefused(await inviteTo(trip, ana, ana.email), 409, "already-a-member");
  });

  test("a member who is not an admin inviting an address, or withdrawing an invitation, is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    const before = sent.length;
    await expectRefused(await inviteTo(trip, sam, "leo@example.com"), 403, "admin-only");
    expect(sent.length).toBe(before);
    await inviteTo(trip, ana, "leo@example.com");
    const { invitation } = latestTo("leo@example.com");
    await expectRefused(await api(`/api/trips/${trip}/invitations/${invitation}`, { method: "DELETE", session: sam.session }), 403, "admin-only");
  });
});

describe("ACC:MEMBERSHIP-F3 — only an account holding the invited address accepts an invitation", () => {
  test("an account holding the address accepts, and is a member with the access invited", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam", { email: "Sam@Example.org" });
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, "sam@example.org", { trip: "edit", calendar: "view" });
    const { invitation, token } = latestTo("sam@example.org");
    changes = [];
    const accepted = await acceptAs(sam, invitation, token);
    expect(await json(accepted)).toEqual({ trip });
    expect(await member(trip, sam.account)).toMatchObject({ admin: false, creator: false });
    expect(changes).toEqual([{ trip, change: { op: "add", traveller: sam.account, trip: "edit", calendar: "view" } }]);
  });

  test("an account holding another address, or the address unconfirmed, is refused, with the reason", async () => {
    const ana = await traveller("Ana");
    const leo = await traveller("Leo");
    const unconfirmed = await traveller("Mia", { email: "mia@example.com", emailVerified: false });
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, "sam@example.com");
    const toSam = latestTo("sam@example.com");
    expect(await expectRefused(await acceptAs(leo, toSam.invitation, toSam.token), 403, "wrong-account")).toMatch(/sam@example\.com/);
    await inviteTo(trip, ana, "mia@example.com");
    const toMia = latestTo("mia@example.com");
    await expectRefused(await acceptAs(unconfirmed, toMia.invitation, toMia.token), 403, "wrong-account");
    expect(await member(trip, leo.account)).toBeUndefined();
    expect(changes.filter((c) => c.change.op === "add")).toEqual([]);
  });

  test("accepting the same invitation a second time is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const { invitation, token } = latestTo(sam.email);
    expect((await acceptAs(sam, invitation, token)).status).toBe(200);
    await expectRefused(await acceptAs(sam, invitation, token), 404, "bad-invitation");
  });

  test("an invitation sent 15 days before is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const { invitation, token } = latestTo(sam.email);
    await env.DB.prepare("UPDATE invitations SET expires = ?2 WHERE id = ?1").bind(invitation, Date.now() - DAY).run();
    await expectRefused(await acceptAs(sam, invitation, token), 404, "bad-invitation");
  });

  test("an acceptance whose listener fails leaves the invitation open, and accepting again gives the same add", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email, { trip: "edit" });
    const { invitation, token } = latestTo(sam.email);
    failNext = true;
    expect((await acceptAs(sam, invitation, token)).status).toBe(500);
    expect(await member(trip, sam.account)).toBeUndefined();
    expect((await acceptAs(sam, invitation, token)).status).toBe(200);
    expect(changes).toEqual([{ trip, change: { op: "add", traveller: sam.account, trip: "edit", calendar: "none" } }]);
  });

  test("an invitation withdrawn as it is accepted is refused, and the grant just added is taken away", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const { invitation, token } = latestTo(sam.email);
    during = async (_, change) => {
      if (change.op === "add") await api(`/api/trips/${trip}/invitations/${invitation}`, { method: "DELETE", session: ana.session });
    };
    await expectRefused(await acceptAs(sam, invitation, token), 404, "bad-invitation");
    expect(changes.map((c) => c.change.op)).toEqual(["add", "remove"]);
    expect(await member(trip, sam.account)).toBeUndefined();
  });

  test("an account already a member closes the invitation, and stays as it was", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await makeAdminOf(trip, ana, sam);
    await env.DB.prepare(
      "INSERT INTO invitations (id, trip, email, trip_level, calendar, sent_by, token_digest, expires, state) VALUES ('i-late', ?1, ?2, 'view', 'none', ?3, ?4, ?5, 'open')",
    ).bind(trip, sam.email, ana.account, await digest("late-token"), Date.now() + DAY).run();
    changes = [];
    expect((await acceptAs(sam, "i-late", "late-token")).status).toBe(200);
    expect(changes).toEqual([]);
    expect(await member(trip, sam.account)).toMatchObject({ admin: true });
    await expectRefused(await acceptAs(sam, "i-late", "late-token"), 404, "bad-invitation");
  });
});

describe("ACC:MEMBERSHIP-F4 — an admin removes a member, other than the creator", () => {
  test("an admin removes a member, who is then no longer one, and the caller is told", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const leo = await traveller("Leo");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await join(trip, ana, leo);
    changes = [];
    expect((await removeFrom(trip, ana, leo.account)).status).toBe(204);
    expect(await member(trip, leo.account)).toBeUndefined();
    expect(changes).toEqual([{ trip, change: { op: "remove", traveller: leo.account } }]);
    await expectRefused(await api(`/api/trips/${trip}/members`, { session: leo.session }), 404, "not-a-member");
    await expectRefused(await removeFrom(trip, ana, leo.account), 404, "not-a-member");
  });

  test("removing the creator is refused, with the reason", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    expect(await expectRefused(await removeFrom(trip, ana, ana.account), 409, "creator")).toMatch(/creator/);
  });

  test("a member who is not an admin removing another member is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const leo = await traveller("Leo");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await join(trip, ana, leo);
    await expectRefused(await removeFrom(trip, sam, leo.account), 403, "admin-only");
    expect(await member(trip, leo.account)).toBeDefined();
  });

  test("a removed admin, invited back, returns as a member who is not one", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await makeAdminOf(trip, ana, sam);
    await removeFrom(trip, ana, sam.account);
    await join(trip, ana, sam, { trip: "edit" });
    expect(await member(trip, sam.account)).toMatchObject({ admin: false, creator: false });
    const listed = (await listOf(trip, ana)).members.find((m) => m.account === sam.account);
    expect(listed?.removed).toBeUndefined();
    expect(await trips(sam.account)).toContain(trip);
  });
});

describe("ACC:MEMBERSHIP-F5 — the membership component says who is on a trip, and which of them are admins", () => {
  async function afterRemoval() {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const leo = await traveller("Leo");
    const trip = await newTrip(ana);
    await join(trip, ana, sam);
    await join(trip, ana, leo);
    await removeFrom(trip, ana, leo.account);
    return { ana, sam, leo, trip };
  }

  test("a member who is not an admin is given the two members left, each marked admin or not, and the creator", async () => {
    const { ana, sam, trip } = await afterRemoval();
    const listed = await listOf(trip, sam);
    const current = listed.members.filter((m) => m.removed === undefined);
    expect(current.map((m) => [m.name, m.admin, m.creator])).toEqual([["Ana", true, true], ["Sam", false, false]]);
    expect(current.map((m) => m.account)).toEqual([ana.account, sam.account]);
    expect(listed.invitations).toBeUndefined();
  });

  test("an admin is given an open invitation, with its expiry, and the other member is not", async () => {
    const { ana, sam, trip } = await afterRemoval();
    await inviteTo(trip, ana, "mia@example.com", { trip: "edit", calendar: "view" });
    expect((await listOf(trip, ana)).invitations).toEqual([{ id: expect.stringMatching(/^i-/), email: "mia@example.com", trip: "edit", calendar: "view", expires: expect.any(String) }]);
    expect((await listOf(trip, sam)).invitations).toBeUndefined();
  });

  test("each member's account gives the trip among its trips, in the order joined", async () => {
    const { ana, sam, trip } = await afterRemoval();
    const later = await newTrip(sam);
    expect(await trips(ana.account)).toEqual([trip]);
    expect(await trips(sam.account)).toEqual([trip, later]);
  });

  test("the member removed is given by name, marked as removed, and their account does not give the trip", async () => {
    const { sam, leo, trip } = await afterRemoval();
    const removed = (await listOf(trip, sam)).members.find((m) => m.account === leo.account);
    expect(removed).toMatchObject({ name: "Leo", admin: false, removed: expect.any(String) });
    expect(await trips(leo.account)).toEqual([]);
  });

  test("a member's name is the one their account holds", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    await api("/api/auth/name", { method: "PUT", session: ana.session, body: { name: "Ana L." } });
    expect((await listOf(trip, ana)).members[0]!.name).toBe("Ana L.");
  });
});

describe("ACC:MEMBERSHIP-NFR1 — an invitation cannot be guessed, and is useless to anyone else", () => {
  test("accepting with a made-up link is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const { invitation } = latestTo(sam.email);
    await expectRefused(await acceptAs(sam, "i-made-up", "made-up"), 404, "bad-invitation");
    await expectRefused(await acceptAs(sam, invitation, "made-up-token"), 404, "bad-invitation");
  });

  test("a token taken from the stored records, accepted by an account holding the address, is refused", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const { invitation, token } = latestTo(sam.email);
    const stored = await env.DB.prepare("SELECT * FROM invitations WHERE id = ?1").bind(invitation).first<Record<string, unknown>>();
    expect(JSON.stringify(stored)).not.toContain(token);
    await expectRefused(await acceptAs(sam, invitation, stored!.token_digest as string), 404, "bad-invitation");
    expect(await member(trip, sam.account)).toBeUndefined();
  });

  test("the token is 32 random bytes, and the link carries it after the #", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, "mia@example.com");
    const { email, token, invitation } = latestTo("mia@example.com");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(email.text).toContain(`https://itinero.test/invitations/${invitation}#${token}`);
  });
});

describe("The refusals of §3.2, and the daily task", () => {
  test("not-a-member, the same for a trip the account is not on and for one that does not exist", async () => {
    const ana = await traveller("Ana");
    const leo = await traveller("Leo");
    const trip = await newTrip(ana);
    const onTrip = await expectRefused(await api(`/api/trips/${trip}/members`, { session: leo.session }), 404, "not-a-member");
    const noTrip = await expectRefused(await api("/api/trips/no-such-trip/members", { session: leo.session }), 404, "not-a-member");
    expect(onTrip).toBe(noTrip);
    await expectRefused(await inviteTo(trip, leo, "x@example.com"), 404, "not-a-member");
    await expectRefused(await makeAdminOf(trip, ana, leo), 404, "not-a-member");
  });

  test("bad-email, for an address with no @, nothing before or after it, or over 254 characters", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    for (const email of ["sam.example.com", "@example.com", "sam@", `${"s".repeat(250)}@x.io`]) {
      expect(await expectRefused(await inviteTo(trip, ana, email), 400, "bad-email")).toMatch(/not an email address/);
    }
  });

  test("not-sent, when Resend refuses: nothing is written, and an earlier invitation stays open", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, sam.email);
    const first = latestTo(sam.email);
    refuseEmails(true);
    await expectRefused(await inviteTo(trip, ana, sam.email, { trip: "edit" }), 502, "not-sent");
    refuseEmails(false);
    expect((await listOf(trip, ana)).invitations?.map((i) => i.id)).toEqual([first.invitation]);
    expect((await acceptAs(sam, first.invitation, first.token)).status).toBe(200);
  });

  test("malformed, for bodies not in the forms given", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await newTrip(ana);
    for (const body of [{ email: "a@b.c", trip: "none", calendar: "none" }, { email: "a@b.c", trip: "view" }, { email: 1, trip: "view", calendar: "none" }, { email: "a@b.c", trip: "view", calendar: "none", admin: true }]) {
      await expectRefused(await api(`/api/trips/${trip}/invitations`, { method: "POST", session: ana.session, body }), 400, "malformed");
    }
    await expectRefused(await api(`/api/trips/${trip}/admins`, { method: "POST", session: ana.session, body: {} }), 400, "malformed");
    await expectRefused(await api("/api/invitations/i-x/accept", { method: "POST", session: sam.session, body: {} }), 400, "malformed");
    await expectRefused(await api(`/api/trips/${trip}/invitations`, { method: "POST", session: ana.session, body: "not json" }), 400, "malformed");
  });

  test("every request needs a session", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    await expectRefused(await api(`/api/trips/${trip}/members`), 401, "no-session");
    await expectRefused(await api("/api/invitations/i-x/accept", { method: "POST", body: { token: "t" } }), 401, "no-session");
  });

  test("the daily task closes open invitations past their expiry, and deletes those closed 90 days ago", async () => {
    const ana = await traveller("Ana");
    const trip = await newTrip(ana);
    await inviteTo(trip, ana, "old@example.com");
    await inviteTo(trip, ana, "new@example.com");
    const old = latestTo("old@example.com").invitation;
    await env.DB.prepare("UPDATE invitations SET expires = ?2 WHERE id = ?1").bind(old, Date.now() - DAY).run();
    await env.DB.prepare(
      "INSERT INTO invitations (id, trip, email, trip_level, calendar, sent_by, token_digest, expires, state, closed) VALUES ('i-gone', ?1, 'gone@example.com', 'view', 'none', ?2, 'x', 0, 'withdrawn', ?3)",
    ).bind(trip, ana.account, Date.now() - 91 * DAY).run();
    await worker.scheduled(createScheduledController({ scheduledTime: Date.now() }), env, {} as ExecutionContext);
    const states = await env.DB.prepare("SELECT email, state FROM invitations WHERE trip = ?1 ORDER BY email").bind(trip).all<{ email: string; state: string }>();
    expect(states.results).toEqual([{ email: "new@example.com", state: "open" }, { email: "old@example.com", state: "expired" }]);
  });
});

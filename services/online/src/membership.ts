// access/membership: who is on each trip, its creator and admins, invitations from sending to
// acceptance, and removing a member. docs/spec/access/membership.md specifies it, and its
// sections are cited.

import { env } from "cloudflare:workers";
import type { GrantChange, Level, TripLevel } from "@itinero/permissions";
import type { Account, AccountId } from "./accounts.ts";
import { digest, randomToken } from "./bytes.ts";
import { send, utc } from "./email.ts";
import { accept, refuse, type Result } from "./result.ts";

export type Member = { account: AccountId; admin: boolean; creator: boolean; joined: string };
export type Listed = Member & { name: string; removed?: string };
export type Change = GrantChange | { op: "admin"; traveller: AccountId };
export type Invitation = { id: string; email: string; trip: TripLevel; calendar: Level; expires: string };

const DAY = 24 * 60 * 60 * 1000;
/** An invitation not accepted within this time of being sent expires (§4.2). */
export const INVITATION_LIFE = 14 * DAY;
/** A closed invitation is kept this long (§5). */
export const INVITATION_KEPT = 90 * DAY;
const EMAIL_LENGTH = 254;

const iso = (time: number) => new Date(time).toISOString();

// §3.3 The listener of onChange, and the trip's title for the email. planner/trip-host gives both.

type Listener = (trip: string, change: Change) => Promise<void>;
type Titler = (trip: string) => Promise<string | undefined>;
let listener: Listener = async () => {};
let titler: Titler = async () => undefined;

/** Names the listener that applies to a trip's grants each change the membership component makes. */
export function onChange(next: Listener): void {
  listener = next;
}

/** Names the function that gives a trip's title, for the invitation email (§4.3). */
export function onTitle(next: Titler): void {
  titler = next;
}

type MemberRow = { account: string; admin: number; creator: number; joined: number; removed: number | null };

function toMember(row: MemberRow): Member {
  return { account: row.account, admin: row.admin === 1, creator: row.creator === 1, joined: iso(row.joined) };
}

// §4.1 Creating a trip, and admins.

export async function createTrip(trip: string, creator: AccountId, now: number = Date.now()): Promise<Member> {
  await env.DB.prepare("INSERT INTO members (trip, account, admin, creator, joined) VALUES (?1, ?2, 1, 1, ?3)").bind(trip, creator, now).run();
  return { account: creator, admin: true, creator: true, joined: iso(now) };
}

/** The member an account is on a trip, or undefined for an account not on it, a former member included. */
export async function member(trip: string, account: AccountId): Promise<Member | undefined> {
  const row = await env.DB.prepare("SELECT account, admin, creator, joined, removed FROM members WHERE trip = ?1 AND account = ?2 AND removed IS NULL")
    .bind(trip, account)
    .first<MemberRow>();
  return row ? toMember(row) : undefined;
}

/** The trips an account is a member of, in the order they were joined. */
export async function trips(account: AccountId): Promise<readonly string[]> {
  const rows = await env.DB.prepare("SELECT trip FROM members WHERE account = ?1 AND removed IS NULL ORDER BY joined, trip").bind(account).all<{ trip: string }>();
  return rows.results.map((r) => r.trip);
}

const notAMember = <T>() => refuse<T>("not-a-member", "You are not on this trip, or it does not exist.");
const adminOnly = <T>() => refuse<T>("admin-only", "Only an admin of the trip may do this.");

/** The member making a request about a trip, who must be on it, and an admin where `admin` is set. */
async function requester(trip: string, by: Account, admin: boolean): Promise<Result<Member>> {
  const m = await member(trip, by.id);
  if (!m) return notAMember();
  if (admin && !m.admin) return adminOnly();
  return accept(m);
}

export async function makeAdmin(trip: string, by: Account, target: unknown): Promise<Result<void>> {
  if (typeof target !== "string") return refuse("malformed", "Making an admin needs the account to make one.");
  const asker = await requester(trip, by, true);
  if (!asker.ok) return asker;
  if (!(await member(trip, target))) return refuse("not-a-member", "That traveller is not on this trip.");
  await env.DB.prepare("UPDATE members SET admin = 1 WHERE trip = ?1 AND account = ?2 AND removed IS NULL").bind(trip, target).run();
  await listener(trip, { op: "admin", traveller: target });
  return accept(undefined);
}

// §4.2 Inviting, and withdrawing.

function checkEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1 || email.length > EMAIL_LENGTH) return undefined;
  return email;
}

type InvitationRow = { id: string; trip: string; email: string; trip_level: TripLevel; calendar: Level; token_digest: string; expires: number; state: string };

function toInvitation(row: InvitationRow): Invitation {
  return { id: row.id, email: row.email, trip: row.trip_level, calendar: row.calendar, expires: iso(row.expires) };
}

export async function invite(trip: string, by: Account, fields: Record<string, unknown>, origin: string, now: number = Date.now()): Promise<Result<Invitation>> {
  const { email: given, trip: tripLevel, calendar } = fields;
  if (typeof given !== "string" || (tripLevel !== "view" && tripLevel !== "edit") || (calendar !== "none" && calendar !== "view" && calendar !== "edit") || Object.keys(fields).length !== 3) {
    return refuse("malformed", "An invitation needs an email address, view or edit access to the trip, and none, view or edit access to the calendar.");
  }
  const asker = await requester(trip, by, true);
  if (!asker.ok) return asker;
  const email = checkEmail(given);
  if (!email) return refuse("bad-email", "That is not an email address.");
  const held = await env.DB.prepare("SELECT 1 FROM members m JOIN accounts a ON a.id = m.account WHERE m.trip = ?1 AND m.removed IS NULL AND a.email = ?2")
    .bind(trip, email)
    .first();
  if (held) return refuse("already-a-member", "A member of this trip already has that email address.");

  const id = `i-${randomToken(16)}`;
  const token = randomToken(32);
  const expires = now + INVITATION_LIFE;
  const title = (await titler(trip)) ?? "a trip";
  const sent = await send({
    to: email,
    subject: "You are invited to a trip on Itinero",
    text: [
      `${by.name} has invited you to ${title} on Itinero.`,
      "",
      "Open this link to accept the invitation:",
      `${origin}/invitations/${id}#${token}`,
      "",
      `The invitation expires on ${utc(expires)}. Sign in with the Google account for ${email} to accept it.`,
      "",
    ].join("\n"),
  });
  if (!sent) return refuse("not-sent", "The invitation could not be sent. Try again later.");

  await env.DB.batch([
    env.DB.prepare("UPDATE invitations SET state = 'replaced', closed = ?3 WHERE trip = ?1 AND email = ?2 AND state = 'open'").bind(trip, email, now),
    env.DB.prepare(
      `INSERT INTO invitations (id, trip, email, trip_level, calendar, sent_by, token_digest, expires, state)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'open')`,
    ).bind(id, trip, email, tripLevel, calendar, by.id, await digest(token), expires),
  ]);
  return accept({ id, email, trip: tripLevel, calendar, expires: iso(expires) });
}

export async function withdraw(trip: string, by: Account, invitation: string, now: number = Date.now()): Promise<Result<void>> {
  const asker = await requester(trip, by, true);
  if (!asker.ok) return asker;
  await env.DB.prepare("UPDATE invitations SET state = 'withdrawn', closed = ?3 WHERE id = ?1 AND trip = ?2 AND state = 'open'").bind(invitation, trip, now).run();
  return accept(undefined);
}

// §4.4 Accepting.

function sameDigest(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
}

export async function acceptInvitation(invitation: string, by: Account, token: unknown, now: number = Date.now()): Promise<Result<{ trip: string }>> {
  if (typeof token !== "string") return refuse("malformed", "Accepting an invitation needs its token.");
  const bad = refuse<{ trip: string }>("bad-invitation", "This invitation cannot be accepted. It may have expired, or been withdrawn, replaced or accepted already. Ask an admin of the trip to invite you again.");
  const row = await env.DB.prepare("SELECT id, trip, email, trip_level, calendar, token_digest, expires, state FROM invitations WHERE id = ?1").bind(invitation).first<InvitationRow>();
  // 1. Known, open, not expired, and the token its own.
  if (!row || !sameDigest(await digest(token), row.token_digest) || row.state !== "open" || row.expires <= now) return bad;
  // 2. The account holds the invited address, confirmed by its provider.
  if (by.email !== row.email || !by.emailVerified) {
    return refuse("wrong-account", `This invitation was sent to ${row.email}. Sign in with the Google account for that address to accept it.`);
  }

  const close = env.DB.prepare("UPDATE invitations SET state = 'accepted', closed = ?2, accepted_by = ?3 WHERE id = ?1 AND state = 'open' AND expires > ?2").bind(row.id, now, by.id);
  if (await member(row.trip, by.id)) {
    await close.run();
    return accept({ trip: row.trip });
  }
  // The trip's grants change first, and its members last (§4).
  await listener(row.trip, { op: "add", traveller: by.id, trip: row.trip_level, calendar: row.calendar });
  const [closed] = await env.DB.batch([
    close,
    env.DB.prepare(
      `INSERT INTO members (trip, account, admin, creator, joined)
       SELECT ?1, ?2, 0, 0, ?3 FROM invitations WHERE id = ?4 AND state = 'accepted' AND accepted_by = ?2
       ON CONFLICT (trip, account) DO UPDATE SET removed = NULL, admin = 0, joined = excluded.joined`,
    ).bind(row.trip, by.id, now, row.id),
  ]);
  if (closed!.meta.changes === 0 && !(await member(row.trip, by.id))) {
    // The invitation closed in the same moment, such as by being withdrawn.
    await listener(row.trip, { op: "remove", traveller: by.id });
    return bad;
  }
  return accept({ trip: row.trip });
}

// §4.5 Removing a member.

export async function removeMember(trip: string, by: Account, target: string, now: number = Date.now()): Promise<Result<void>> {
  const asker = await requester(trip, by, true);
  if (!asker.ok) return asker;
  const removed = await member(trip, target);
  if (removed?.creator) return refuse("creator", "The trip's creator cannot be removed from it.");
  if (!removed) return refuse("not-a-member", "That traveller is not on this trip.");
  await listener(trip, { op: "remove", traveller: target });
  await env.DB.prepare("UPDATE members SET removed = ?3, admin = 0 WHERE trip = ?1 AND account = ?2 AND removed IS NULL").bind(trip, target, now).run();
  return accept(undefined);
}

// §4.6 Who is on a trip.

export type Members = { members: Listed[]; invitations?: Invitation[] };

export async function listMembers(trip: string, by: Account, now: number = Date.now()): Promise<Result<Members>> {
  const asker = await requester(trip, by, false);
  if (!asker.ok) return asker;
  const rows = await env.DB.prepare(
    `SELECT m.account, m.admin, m.creator, m.joined, m.removed, a.name
     FROM members m JOIN accounts a ON a.id = m.account WHERE m.trip = ?1 ORDER BY m.joined, m.account`,
  )
    .bind(trip)
    .all<MemberRow & { name: string }>();
  const members = rows.results.map((row): Listed => {
    const listed: Listed = { ...toMember(row), name: row.name };
    if (row.removed !== null) listed.removed = iso(row.removed);
    return listed;
  });
  if (!asker.value.admin) return accept({ members });
  const open = await env.DB.prepare(
    "SELECT id, trip, email, trip_level, calendar, token_digest, expires, state FROM invitations WHERE trip = ?1 AND state = 'open' AND expires > ?2 ORDER BY expires, id",
  )
    .bind(trip, now)
    .all<InvitationRow>();
  return accept({ members, invitations: open.results.map(toInvitation) });
}

// §5 The daily task: close open invitations past their expiry, and delete those closed 90 days ago.

export async function closeExpired(now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("UPDATE invitations SET state = 'expired', closed = ?1 WHERE state = 'open' AND expires <= ?1").bind(now),
    env.DB.prepare("DELETE FROM invitations WHERE state <> 'open' AND closed <= ?1").bind(now - INVITATION_KEPT),
  ]);
}

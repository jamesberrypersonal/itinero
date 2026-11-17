// A stand-in for the online side, for the trip store's unit tests (docs/spec/web/trip-store.md
// §4.7). Each trip runs the trip host's own logic, services/online/src/trip-core.ts, on Node's
// SQLite, so a catch-up holds what the real one does. Membership, invitations and sessions are
// kept in memory, as access/membership and access/accounts answer them. Each device has its own
// fetch, WebSocket and session, and a test can take a device offline, fail one request, end a
// session or refuse an older version.

import { DatabaseSync } from "node:sqlite";
import { TripCore, type Row, type Sql } from "../../../../../services/online/src/trip-core.ts";

type MemberRow = { account: string; admin: boolean; creator: boolean; joined: string; removed?: string };
type Open = { id: string; email: string; trip: "view" | "edit"; calendar: "none" | "view" | "edit"; expires: string; token: string };
type Hosted = { core: TripCore; members: Map<string, MemberRow>; invitations: Map<string, Open> };

function sqlOf(db: DatabaseSync): Sql {
  return {
    exec: (query, ...bindings) => {
      const statement = db.prepare(query);
      if (/^\s*(SELECT|WITH)/i.test(query)) return statement.all(...bindings) as Row[];
      statement.run(...bindings);
      return [];
    },
    transaction: (run) => {
      db.exec("BEGIN");
      try {
        const value = run();
        db.exec("COMMIT");
        return value;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const refusal = (status: number, code: string, message: string) => Response.json({ code, message }, { status });

/** A socket of one device, which the stand-in tells of each change to its trip. */
export class StandInSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;
  readonly trip: string;
  readonly account: string;
  private readonly online: Online;
  constructor(trip: string, account: string, online: Online) {
    this.trip = trip;
    this.account = account;
    this.online = online;
  }
  close(code = 1000): void {
    if (this.closed) return;
    this.closed = true;
    this.online.sockets.delete(this);
    queueMicrotask(() => this.onclose?.({ code }));
  }
  send(): void {}
}

export type Device = {
  fetch: typeof fetch;
  WebSocket: { new (url: string): WebSocket };
  /** Whether the device can reach the online side. */
  reachable: boolean;
  session: string;
};

export class Online {
  readonly trips = new Map<string, Hosted>();
  readonly sessions = new Map<string, string>();
  readonly names = new Map<string, string>();
  readonly sockets = new Set<StandInSocket>();
  /** Every request answered or failed, as `METHOD /path`. */
  readonly requests: string[] = [];
  oldestApi = 1;
  /** Fails the next request whose `METHOD /path` matches, as a lost connection would. */
  failNext: RegExp | undefined;
  /** Holds the next request whose `METHOD /path` matches until `release` is called, as a slow connection would. */
  holdNext: RegExp | undefined;
  private released: (() => void) | undefined;
  /** Lets a held request be answered. */
  release(): void {
    this.released?.();
  }
  private count = 0;

  /** A device signed in as an account, which the stand-in makes if it does not hold it. */
  device(account: string, name = account): Device {
    this.names.set(account, name);
    const session = `s-${++this.count}`;
    this.sessions.set(session, account);
    const online = this;
    const device: Device = {
      reachable: true,
      session,
      fetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const method = init?.method ?? "GET";
        const said = `${method} ${url.pathname}`;
        online.requests.push(said);
        if (!device.reachable) throw new TypeError("Failed to fetch");
        if (online.failNext?.test(said)) {
          online.failNext = undefined;
          throw new TypeError("Failed to fetch");
        }
        if (online.holdNext?.test(said)) {
          online.holdNext = undefined;
          await new Promise<void>((resolve) => (online.released = resolve));
        }
        const headers = new Headers(init?.headers);
        const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
        return online.answer(method, url.pathname, Number(headers.get("Itinero-Api")), device.session, body);
      },
      WebSocket: class {
        constructor(url: string) {
          const match = /\/api\/trips\/([^/]+)\/live$/.exec(new URL(url).pathname);
          const account = online.sessions.get(device.session);
          const socket = new StandInSocket(decodeURIComponent(match?.[1] ?? ""), account ?? "", online);
          const hosted = online.trips.get(socket.trip);
          const member = account && hosted?.members.get(account);
          queueMicrotask(() => {
            if (!device.reachable || !member || member.removed) {
              socket.closed = true;
              socket.onclose?.({ code: 1006 });
              return;
            }
            online.sockets.add(socket);
            socket.onopen?.();
          });
          return socket as unknown as WebSocket;
        }
      } as unknown as { new (url: string): WebSocket },
    };
    return device;
  }

  /** Ends a session online, as access/accounts does after 180 days unused. */
  endSession(session: string): void {
    this.sessions.delete(session);
  }

  private tell(trip: string, sequence: number): void {
    for (const socket of this.sockets) if (socket.trip === trip) socket.onmessage?.({ data: JSON.stringify({ sequence }) });
  }

  private answer(method: string, path: string, api: number, session: string, body: Record<string, unknown>): Response {
    if (!(api >= this.oldestApi)) return refusal(426, "update-first", "This version of Itinero is too old. Update it, and try again.");
    if (method === "POST" && path === "/api/auth/sign-out") {
      this.sessions.delete(session);
      return new Response(null, { status: 204 });
    }
    const account = this.sessions.get(session);
    if (!account) return refusal(401, "no-session", "You are not signed in. Sign in, and try again.");
    const notAMember = refusal(404, "not-a-member", "You are not on this trip, or it does not exist.");

    if (path === "/api/trips" && method === "GET") {
      const listed = [...this.trips.entries()]
        .filter(([, h]) => h.members.get(account) && !h.members.get(account)!.removed)
        .map(([trip, h]) => {
          const s = h.core.summary()!;
          return { trip, name: s.name, dates: { first: s.first, last: s.last } };
        });
      return Response.json({ trips: listed });
    }
    if (path === "/api/trips" && method === "POST") {
      const trip = `trip-${++this.count}`;
      const core = new TripCore(sqlOf(new DatabaseSync(":memory:")));
      const made = core.create(trip, { traveller: account, admin: true, creator: true }, String(body["name"]), String(body["first"]), String(body["last"]), body["countries"] as string[]);
      if (!made.ok) return Response.json(made.refusal, { status: 409 });
      this.trips.set(trip, { core, members: new Map([[account, { account, admin: true, creator: true, joined: new Date().toISOString() }]]), invitations: new Map() });
      return Response.json({ trip }, { status: 201 });
    }
    const accept = /^\/api\/invitations\/([^/]+)\/accept$/.exec(path);
    if (accept && method === "POST") {
      for (const [trip, hosted] of this.trips) {
        const open = hosted.invitations.get(accept[1]!);
        if (!open || open.token !== body["token"]) continue;
        hosted.invitations.delete(open.id);
        const result = hosted.core.grant({ op: "add", traveller: account, trip: open.trip, calendar: open.calendar });
        if (result.ok) this.tell(trip, result.value.sequence);
        hosted.members.set(account, { account, admin: false, creator: false, joined: new Date().toISOString() });
        return Response.json({ trip });
      }
      return refusal(404, "bad-invitation", "This invitation cannot be accepted.");
    }

    const match = /^\/api\/trips\/([^/]+)\/(.+)$/.exec(path);
    if (!match) return refusal(404, "not-found", "The online side answers no such request.");
    const trip = decodeURIComponent(match[1]!);
    const rest = match[2]!;
    const hosted = this.trips.get(trip);
    const row = hosted?.members.get(account);
    if (!hosted || !row || row.removed) return notAMember;
    const who = { traveller: account, admin: row.admin, creator: row.creator };
    const reply = <T>(result: { ok: true; value: T } | { ok: false; refusal: { code: string } }, wrap: (value: T) => unknown = (v) => v) => {
      if (!result.ok) {
        const status = ["no-view", "no-edit", "admin-only", "creator-only"].includes(result.refusal.code) ? 403 : result.refusal.code === "malformed" ? 400 : 409;
        return Response.json(result.refusal, { status });
      }
      return Response.json(wrap(result.value));
    };

    if (rest === "sync") return reply(hosted.core.sync(who, body["since"] as number | undefined, body["holdsCalendar"] === true));
    if (rest === "pages") return reply(hosted.core.pages(who, body["pages"] as string[]), (pages) => ({ pages }));
    if (rest === "bookings") return reply(hosted.core.bookings(who, body["bookings"] as string[]), (bookings) => ({ bookings }));
    if (rest === "changes") {
      const result = hosted.core.change(who, body["target"] as "pages", String(body["change"]), body["agreed"] as number | undefined);
      if (result.ok) this.tell(trip, result.value.sequence);
      return reply(result);
    }
    const buried = /^buried\/(.+)$/.exec(rest);
    if (buried) return reply(hosted.core.buried(who, decodeURIComponent(buried[1]!)), (page) => ({ page }));
    if (rest === "members" && method === "GET") {
      const members = [...hosted.members.values()].map((m) => ({ ...m, name: this.names.get(m.account) ?? m.account }));
      if (!row.admin) return Response.json({ members });
      const invitations = [...hosted.invitations.values()].map(({ token: _, ...open }) => open);
      return Response.json({ members, invitations });
    }
    if (!row.admin) return refusal(403, "admin-only", "Only an admin of the trip may do this.");
    if (rest === "invitations" && method === "POST") {
      const open: Open = {
        id: `i-${++this.count}`,
        email: String(body["email"]),
        trip: body["trip"] as Open["trip"],
        calendar: body["calendar"] as Open["calendar"],
        expires: "2027-01-01T00:00:00.000Z",
        token: `token-${this.count}`,
      };
      hosted.invitations.set(open.id, open);
      const { token: _, ...given } = open;
      return Response.json(given, { status: 201 });
    }
    const withdrawn = /^invitations\/(.+)$/.exec(rest);
    if (withdrawn && method === "DELETE") {
      hosted.invitations.delete(decodeURIComponent(withdrawn[1]!));
      return new Response(null, { status: 204 });
    }
    if (rest === "admins" && method === "POST") {
      const target = hosted.members.get(String(body["account"]));
      if (!target || target.removed) return refusal(404, "not-a-member", "That traveller is not on this trip.");
      target.admin = true;
      this.tell(trip, hosted.core.touch().sequence);
      return new Response(null, { status: 204 });
    }
    const removed = /^members\/(.+)$/.exec(rest);
    if (removed && method === "DELETE") {
      const target = hosted.members.get(decodeURIComponent(removed[1]!));
      if (!target || target.removed) return refusal(404, "not-a-member", "That traveller is not on this trip.");
      const result = hosted.core.grant({ op: "remove", traveller: target.account });
      target.removed = new Date().toISOString();
      target.admin = false;
      if (result.ok) this.tell(trip, result.value.sequence);
      for (const socket of [...this.sockets]) if (socket.trip === trip && socket.account === target.account) socket.close(4403);
      return new Response(null, { status: 204 });
    }
    return refusal(404, "not-found", "The online side answers no such request.");
  }

  /** The open invitation's token, as its email would give it. */
  tokenOf(trip: string, invitation: string): string {
    return this.trips.get(trip)!.invitations.get(invitation)!.token;
  }
}

/** A BroadcastChannel for the windows of one device, so two devices in one test do not hear each other. */
export function channelsOfOneDevice(): { new (name: string): BroadcastChannel } {
  const open = new Set<{ name: string; onmessage: ((event: MessageEvent) => void) | null }>();
  return class {
    onmessage: ((event: MessageEvent) => void) | null = null;
    readonly name: string;
    constructor(name: string) {
      this.name = name;
      open.add(this);
    }
    postMessage(data: unknown): void {
      for (const other of open) {
        if (other !== this && other.name === this.name) {
          const deliver = other.onmessage;
          queueMicrotask(() => deliver?.({ data } as MessageEvent));
        }
      }
    }
    close(): void {
      open.delete(this);
    }
  } as unknown as { new (name: string): BroadcastChannel };
}

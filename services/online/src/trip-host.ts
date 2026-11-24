// The Durable Object that holds one trip (docs/spec/planner/trip-host.md §3.3, §3.4). It runs the
// trip host's logic, in trip-core.ts, on its own SQLite database, and tells each open device of
// every change through a WebSocket it accepts for hibernation (§4.5).

import { DurableObject } from "cloudflare:workers";
import { loadRules, rulesVersion } from "@itinero/trip-time";
import type { GrantChange } from "@itinero/permissions";
import { TripCore, type Member, type Result, type Sql, type SqlValue, type Start, type Sync, type Target } from "./trip-core.ts";

/** The header the Worker names the account of a live socket in (§4.5). */
export const ACCOUNT_HEADER = "Itinero-Account";
/** The code a removed traveller's sockets are closed with (§4.3). */
export const REMOVED = 4403;

/**
 * Loads the time-zone rules the Worker carries into trip-time, the first time a change needs them,
 * and not as the Durable Object starts, so that catching a device up never waits on them (§4.1).
 */
async function ensureRules(): Promise<void> {
  if (rulesVersion() !== undefined) return;
  const file = await import("@itinero/trip-time/rules/2026f.json", { with: { type: "json" } });
  const loaded = loadRules(JSON.stringify(file.default));
  if (!loaded.ok) throw new Error(loaded.refusal.message);
}

export class TripHost extends DurableObject<Cloudflare.Env> {
  private readonly core: TripCore;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    const storage = ctx.storage;
    const sql: Sql = {
      exec: (query, ...bindings) => storage.sql.exec(query, ...bindings).toArray() as Record<string, SqlValue>[],
      transaction: (run) => storage.transactionSync(run),
    };
    this.core = new TripCore(sql);
  }

  async create(trip: string, creator: Member, name: string, first: string, last: string, countries: readonly string[]): Promise<Result<true>> {
    await ensureRules();
    return this.core.create(trip, creator, name, first, last, countries);
  }

  async change(who: Member, target: Target, change: string, agreed?: number): Promise<Result<{ sequence: number }>> {
    if (target === "calendar" || target === "bookings") await ensureRules();
    const result = this.core.change(who, target, change, agreed);
    if (result.ok) this.tell(result.value.sequence);
    return result;
  }

  /** Starts a checklist of the traveller's own on the trip (§4.8). */
  addChecklist(who: Member, id: string, start: Start): Result<{ sequence: number }> {
    const result = this.core.addChecklist(who, id, start);
    if (result.ok) this.tell(result.value.sequence);
    return result;
  }

  /** Deletes a checklist of the traveller's own, for good (§4.8). */
  deleteChecklist(who: Member, id: string): Result<{ sequence: number }> {
    const result = this.core.deleteChecklist(who, id);
    if (result.ok) this.tell(result.value.sequence);
    return result;
  }

  sync(who: Member, since: number | undefined, holdsCalendar: boolean): Result<Sync> {
    return this.core.sync(who, since, holdsCalendar);
  }

  pages(who: Member, ids: readonly string[]): Result<readonly string[]> {
    return this.core.pages(who, ids);
  }

  bookings(who: Member, ids: readonly string[]): Result<readonly string[]> {
    return this.core.bookings(who, ids);
  }

  buried(who: Member, page: string): Result<string> {
    return this.core.buried(who, page);
  }

  /** An `add` or a `remove` from access/membership (§4.3). A removed traveller's sockets are closed. */
  async grant(change: GrantChange): Promise<Result<{ sequence: number }>> {
    await ensureRules();
    const result = this.core.grant(change);
    if (!result.ok) return result;
    const { sequence, removed } = result.value;
    this.tell(sequence);
    if (removed !== undefined) {
      for (const socket of this.ctx.getWebSockets(removed)) socket.close(REMOVED, "You are no longer on this trip.");
    }
    return { ok: true, value: { sequence } };
  }

  /** For a member made an admin: raises the sequence, so every open device catches up (§4.3). */
  touch(): { sequence: number } {
    const result = this.core.touch();
    this.tell(result.sequence);
    return result;
  }

  summary(): { name: string; first: string; last: string } | undefined {
    return this.core.summary();
  }

  /** Accepts a live socket for hibernation, tagged with its traveller's account (§4.5). */
  override async fetch(request: Request): Promise<Response> {
    const account = request.headers.get(ACCOUNT_HEADER);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket" || !account) {
      return new Response("A live socket needs a WebSocket upgrade.", { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [account]);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** A device sends nothing the trip host reads. */
  override webSocketMessage(): void {}

  override webSocketClose(socket: WebSocket, code: number, reason: string): void {
    try {
      socket.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      // Closed already.
    }
  }

  /** Tells each open socket the trip's new sequence, and nothing else of the trip (§4.5). */
  private tell(sequence: number): void {
    const message = JSON.stringify({ sequence });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        // A socket closing as the message is sent is told nothing more.
      }
    }
  }
}

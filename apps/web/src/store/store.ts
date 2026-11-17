// web/trip-store: each trip's copy on a device, caught up with the trip held online, told of each
// change while a trip is open, and deleted on sign-out. docs/spec/web/trip-store.md specifies it,
// and its sections are cited throughout.
//
// `createStore` takes what it needs of the browser, so the unit tests give it stand-ins.

import { bookingFromText, type Booking } from "@itinero/bookings";
import { tripFromText, type Dates } from "@itinero/itinerary";
import { pageFromText, type Page } from "@itinero/pages";
import { grantsFromText, type Level, type TripLevel } from "@itinero/permissions";
import {
  allTrips,
  committed,
  deleteDatabase,
  deleteTrip,
  heldIds,
  openDatabase,
  readAccount,
  readTrip,
  writeAccount,
  type Held,
} from "./db.ts";
import type { Copy, Invitation, Member, Result, Summary, Target, TextRecord, TripRecord } from "./types.ts";

export type StoreDeps = {
  indexedDB: IDBFactory;
  fetch: typeof fetch;
  WebSocket: { new (url: string): WebSocket };
  BroadcastChannel: { new (name: string): BroadcastChannel };
  /** The site's own address, such as https://itinero.app. */
  origin: string;
  /** Whether the browser thinks the device is online as the store opens. */
  online: boolean;
  now: () => number;
  /** web/shell's side of a request (spec/web/shell.md §3.3). */
  shell: { API: number; API_HEADER: string; updateFirst(): void; online(): void };
};

export type Store = ReturnType<typeof createStore>;

type Answer = { kind: "answered"; status: number; body: unknown } | { kind: "refused"; refusal: Result<never> & { ok: false } } | { kind: "offline" };

/** The answer to a catch-up (spec/planner/trip-host.md §4.4). */
type SyncBody = {
  sequence: number;
  trip: { name: string; dates?: Dates; mine?: Dates };
  you: Copy["you"];
  grants?: string;
  calendar?: string | null;
  pages: { id: string; changed: number; text?: string }[];
  graveyard: Copy["graveyard"];
  bookings: { id: string; changed: number; text?: string }[];
};

const CHANNEL = "itinero";
/** Pages and bookings are fetched in groups of this many (§4.2). */
const GROUP = 100;
const BACKOFF_FIRST = 1_000;
const BACKOFF_MOST = 60_000;
/** The close code of a removed traveller's socket (spec/planner/trip-host.md §4.3). */
const REMOVED = 4403;

const offline = <T>(): Result<T> => ({ ok: false, refusal: { code: "offline", message: "This device has no connection. Connect it, and try again." } });
const updateFirst = <T>(): Result<T> => ({
  ok: false,
  refusal: { code: "update-first", message: "This version of Itinero is too old. Update it, and try again." },
});
const NO_DATES: Dates = { first: "", last: "" };

export function createStore(deps: StoreDeps) {
  let db: Promise<IDBDatabase> | undefined;
  let online = deps.online;
  /** The online side refused this version: nothing more is sent until the window reloads (§4). */
  let blocked = false;
  let signedOutHere = false;

  const tripListeners = new Set<(trips: readonly Summary[]) => void>();
  const onlineListeners = new Set<(online: boolean) => void>();
  const signedOutListeners = new Set<() => void>();
  const watchers = new Map<string, Set<(copy: Copy | undefined) => void>>();
  const sockets = new Map<string, { socket?: WebSocket | undefined; delay: number; timer?: ReturnType<typeof setTimeout> | undefined }>();
  const catching = new Map<string, Promise<void>>();
  let catchingAll: Promise<void> | undefined;

  const channel = new deps.BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    const data = event.data as { trip?: string; signedOut?: boolean };
    if (data.signedOut) void afterSignOut(false);
    else if (typeof data.trip === "string") void changed(data.trip, false);
  };

  function database(): Promise<IDBDatabase> {
    db ??= openDatabase(deps.indexedDB);
    return db;
  }

  function setOnline(now: boolean): void {
    if (online === now) return;
    online = now;
    for (const listener of onlineListeners) listener(now);
    if (now) for (const id of watchers.keys()) connect(id);
  }

  // --- Requests (§3.4, and the behaviour crossing every operation of §4) ---

  async function call(method: string, path: string, body?: unknown): Promise<Answer> {
    if (blocked) return { kind: "refused", refusal: updateFirst() as Result<never> & { ok: false } };
    const headers: Record<string, string> = { [deps.shell.API_HEADER]: String(deps.shell.API) };
    const init: RequestInit = { method, headers, credentials: "same-origin" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let response: Response;
    try {
      response = await deps.fetch(new URL(path, deps.origin).href, init);
    } catch {
      setOnline(false);
      return { kind: "offline" };
    }
    setOnline(true);
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text === "" ? undefined : JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (response.ok) return { kind: "answered", status: response.status, body: parsed };
    const refusal = parsed as { code: string; message: string; details?: Record<string, string> };
    if (refusal?.code === "update-first") {
      blocked = true;
      closeAllSockets();
      deps.shell.updateFirst();
    } else if (refusal?.code === "no-session") {
      await sessionEnded();
    }
    const out: Result<never> & { ok: false } = { ok: false, refusal: { code: refusal?.code ?? "failed", message: refusal?.message ?? "Something went wrong." } };
    if (refusal?.details) out.refusal.details = refusal.details;
    return { kind: "refused", refusal: out };
  }

  // --- Reading (§4.1) ---

  function build(held: Held): Copy | undefined {
    const record = held.trip;
    if (!record) return undefined;
    let unreadable = false;
    const read = <T>(result: { ok: true; value: T } | { ok: false }): T | undefined => {
      if (result.ok) return result.value;
      unreadable = true;
      return undefined;
    };
    const pages = held.pages
      .map((r) => read(pageFromText(r.text)))
      .filter((p): p is Page => p !== undefined)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const bookings = held.bookings.map((r) => read(bookingFromText(r.text))).filter((b): b is Booking => b !== undefined);
    const copy: Copy = {
      id: record.id,
      name: record.name,
      dates: record.dates,
      mine: record.mine,
      you: record.you,
      pages: { trip: record.id, pages },
      graveyard: record.graveyard,
      bookings,
      members: record.members,
      sequence: record.sequence,
      caughtUp: record.caughtUp,
    };
    if (record.calendar !== null) {
      const calendar = read(tripFromText(record.calendar));
      if (calendar) copy.calendar = calendar;
    }
    if (record.grants !== undefined) {
      const grants = read(grantsFromText(record.grants));
      if (grants) copy.grants = grants;
    }
    if (record.invitations) copy.invitations = record.invitations;
    if (unreadable) void markFromStart(record.id);
    return copy;
  }

  /** A record a package refused to read: the next catch-up starts from the beginning (§4.1). */
  async function markFromStart(id: string): Promise<void> {
    const store = (await database()).transaction("trips", "readwrite");
    const trips = store.objectStore("trips");
    const request = trips.get(id);
    request.onsuccess = () => {
      const record = request.result as TripRecord | undefined;
      if (record) trips.put({ ...record, fromStart: true });
    };
    await committed(store).catch(() => undefined);
  }

  async function trip(id: string): Promise<Copy | undefined> {
    return build(await readTrip(await database(), id));
  }

  async function trips(): Promise<readonly Summary[]> {
    const records = await allTrips(await database());
    return records
      .map((r) => ({ id: r.id, name: r.name, dates: r.dates, caughtUp: r.caughtUp }))
      .sort((a, b) => (a.dates.first < b.dates.first ? 1 : a.dates.first > b.dates.first ? -1 : 0));
  }

  /** Tells this window's listeners, and, where this window wrote, every other window (§4.6). */
  async function changed(id: string, here: boolean): Promise<void> {
    const listeners = watchers.get(id);
    if (listeners?.size) {
      const copy = await trip(id);
      for (const listener of listeners) listener(copy);
    }
    if (tripListeners.size) {
      const all = await trips();
      for (const listener of tripListeners) listener(all);
    }
    if (here) {
      const record = (await readTrip(await database(), id)).trip;
      channel.postMessage({ trip: id, sequence: record?.sequence ?? 0 });
    }
  }

  // --- Catching up (§4.2) ---

  /** Catches every trip up. One runs at a time, and a call while one runs waits for it. */
  function catchUpAll(): Promise<void> {
    catchingAll ??= runCatchUpAll().finally(() => {
      catchingAll = undefined;
    });
    return catchingAll;
  }

  async function runCatchUpAll(): Promise<void> {
    const base = await database();
    let account = await readAccount(base);
    if (account?.signOutOwed) {
      const answer = await call("POST", "/api/auth/sign-out");
      if (answer.kind === "offline") return;
      await writeAccount(base, { key: "me", signOutOwed: false });
      account = undefined;
    }
    if (!account?.account || blocked) {
      // Signed out, the device still takes newer time-zone rules once online (spec/web/shell.md §4.4).
      if (online) deps.shell.online();
      return;
    }
    const answer = await call("GET", "/api/trips");
    if (answer.kind !== "answered") return;
    const listed = (answer.body as { trips: { trip: string }[] }).trips.map((t) => t.trip);
    for (const held of await allTrips(base)) {
      if (!listed.includes(held.id)) {
        await deleteTrip(base, held.id);
        await changed(held.id, true);
      }
    }
    for (const id of listed) await catchUp(id);
    deps.shell.online();
  }

  /** Catches one trip up, one catch-up of a trip at a time. */
  function catchUp(id: string): Promise<void> {
    const before = catching.get(id) ?? Promise.resolve();
    const next = before.then(() => runCatchUp(id)).catch(() => undefined);
    catching.set(id, next);
    void next.finally(() => {
      if (catching.get(id) === next) catching.delete(id);
    });
    return next;
  }

  async function runCatchUp(id: string): Promise<void> {
    if (blocked) return;
    const base = await database();
    const held = (await readTrip(base, id)).trip;
    const since = held && !held.fromStart ? held.sequence : undefined;
    const body: Record<string, unknown> = { holdsCalendar: held !== undefined && !held.fromStart && held.calendar !== null };
    if (since !== undefined) body["since"] = since;

    // 1. The catch-up itself.
    const synced = await call("POST", `/api/trips/${encodeURIComponent(id)}/sync`, body);
    if (synced.kind === "refused") {
      if (synced.refusal.refusal.code === "not-a-member") {
        await deleteTrip(base, id);
        await changed(id, true);
      }
      return;
    }
    if (synced.kind === "offline") return;
    const sync = synced.body as SyncBody;

    // 2. Pages and bookings listed without their text that the device does not hold.
    const heldPages = await heldIds(base, "pages", id);
    const heldBookings = await heldIds(base, "bookings", id);
    const pageTexts = await fetchTexts(id, "pages", sync.pages.filter((p) => p.text === undefined && !heldPages.has(p.id)).map((p) => p.id));
    const bookingTexts = await fetchTexts(id, "bookings", sync.bookings.filter((b) => b.text === undefined && !heldBookings.has(b.id)).map((b) => b.id));
    if (!pageTexts || !bookingTexts) return;

    // 3. The members, and the open invitations for an admin.
    const membersAnswer = await call("GET", `/api/trips/${encodeURIComponent(id)}/members`);
    if (membersAnswer.kind !== "answered") return;
    const members = membersAnswer.body as { members: Member[]; invitations?: Invitation[] };

    // 4. One transaction.
    const transaction = base.transaction(["trips", "pages", "bookings"], "readwrite");
    const dates = sync.trip.dates ?? NO_DATES;
    const record: TripRecord = {
      id,
      name: sync.trip.name,
      dates,
      mine: sync.trip.mine ?? dates,
      you: sync.you,
      calendar: sync.calendar === undefined ? (held?.calendar ?? null) : sync.calendar,
      graveyard: sync.graveyard,
      members: members.members,
      sequence: sync.sequence,
      caughtUp: deps.now(),
    };
    if (sync.grants !== undefined) record.grants = sync.grants;
    if (members.invitations) record.invitations = members.invitations;
    transaction.objectStore("trips").put(record);
    writeTexts(transaction.objectStore("pages"), id, sync.pages, pageTexts, heldPages);
    writeTexts(transaction.objectStore("bookings"), id, sync.bookings, bookingTexts, heldBookings);
    await committed(transaction);
    await changed(id, true);
  }

  /** Fetches the text form of each page or booking named, in groups, or undefined where one fails. */
  async function fetchTexts(id: string, kind: "pages" | "bookings", ids: string[]): Promise<Map<string, string> | undefined> {
    const texts = new Map<string, string>();
    for (let at = 0; at < ids.length; at += GROUP) {
      const answer = await call("POST", `/api/trips/${encodeURIComponent(id)}/${kind}`, { [kind]: ids.slice(at, at + GROUP) });
      if (answer.kind !== "answered") return undefined;
      for (const text of (answer.body as Record<string, string[]>)[kind] ?? []) {
        const parsed = JSON.parse(text) as { id: string };
        texts.set(parsed.id, text);
      }
    }
    return texts;
  }

  /** Writes each page or booking given, and deletes each held that the catch-up did not list. */
  function writeTexts(
    store: IDBObjectStore,
    trip: string,
    listed: { id: string; changed: number; text?: string }[],
    fetched: Map<string, string>,
    held: Set<string>,
  ): void {
    const keep = new Set<string>();
    for (const entry of listed) {
      keep.add(entry.id);
      const text = entry.text ?? fetched.get(entry.id);
      if (text !== undefined) store.put({ trip, id: entry.id, text, changed: entry.changed } satisfies TextRecord);
    }
    for (const id of held) if (!keep.has(id)) store.delete([trip, id]);
  }

  // --- The open trip (§4.3) ---

  function watch(id: string, listener: (copy: Copy | undefined) => void): () => void {
    let set = watchers.get(id);
    if (!set) {
      set = new Set();
      watchers.set(id, set);
    }
    set.add(listener);
    void trip(id).then((copy) => {
      if (watchers.get(id)?.has(listener)) listener(copy);
    });
    connect(id);
    return () => {
      const current = watchers.get(id);
      current?.delete(listener);
      if (current && current.size === 0) {
        watchers.delete(id);
        disconnect(id);
      }
    };
  }

  function connect(id: string): void {
    if (!online || blocked || !watchers.has(id)) return;
    const held = sockets.get(id) ?? { delay: BACKOFF_FIRST };
    sockets.set(id, held);
    if (held.socket || held.timer) return;
    const url = new URL(`/api/trips/${encodeURIComponent(id)}/live`, deps.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let socket: WebSocket;
    try {
      socket = new deps.WebSocket(url.href);
    } catch {
      retry(id);
      return;
    }
    held.socket = socket;
    socket.onopen = () => {
      held.delay = BACKOFF_FIRST;
      void catchUp(id);
    };
    socket.onmessage = async (event: MessageEvent) => {
      const sequence = (JSON.parse(String(event.data)) as { sequence?: number }).sequence;
      const record = (await readTrip(await database(), id)).trip;
      if (typeof sequence === "number" && sequence > (record?.sequence ?? 0)) void catchUp(id);
    };
    socket.onclose = (event: CloseEvent) => {
      if (held.socket !== socket) return;
      held.socket = undefined;
      if (event.code === REMOVED) void catchUp(id);
      retry(id);
    };
  }

  /** Opens a closed socket again after 1 second, then twice as long each time, up to 1 minute. */
  function retry(id: string): void {
    const held = sockets.get(id);
    if (!held || !watchers.has(id) || blocked) return;
    held.timer = setTimeout(() => {
      held.timer = undefined;
      connect(id);
    }, held.delay);
    held.delay = Math.min(held.delay * 2, BACKOFF_MOST);
  }

  function disconnect(id: string): void {
    const held = sockets.get(id);
    if (!held) return;
    sockets.delete(id);
    if (held.timer) clearTimeout(held.timer);
    held.socket?.close(1000);
  }

  function closeAllSockets(): void {
    for (const id of [...sockets.keys()]) disconnect(id);
  }

  // --- Sending a change (§4.4) ---

  async function send(id: string, target: Target, change: string, agreed?: number): Promise<Result<{ sequence: number }>> {
    if (blocked) return updateFirst();
    if (!online) return offline();
    const body: Record<string, unknown> = { target, change };
    if (agreed !== undefined) body["agreed"] = agreed;
    const answer = await call("POST", `/api/trips/${encodeURIComponent(id)}/changes`, body);
    if (answer.kind === "offline") return offline();
    if (answer.kind === "refused") return answer.refusal;
    await catchUp(id);
    return { ok: true, value: answer.body as { sequence: number } };
  }

  // --- Signing in and out (§4.5) ---

  async function open(): Promise<{ account?: string }> {
    const base = await database();
    const record = await readAccount(base);
    if (record?.signOutOwed || !record?.account) {
      if (record?.signOutOwed && online) void catchUpAll();
      return {};
    }
    if (online) void catchUpAll();
    return { account: record.account };
  }

  async function signedIn(account: string): Promise<void> {
    signedOutHere = false;
    await writeAccount(await database(), { key: "me", account, signOutOwed: false });
    await catchUpAll();
  }

  /** Deletes the database, and makes it again holding only the account record (§4.5). */
  async function wipe(owed: boolean): Promise<void> {
    closeAllSockets();
    const open = db;
    db = undefined;
    if (open) (await open.catch(() => undefined))?.close();
    await deleteDatabase(deps.indexedDB);
    await writeAccount(await database(), { key: "me", signOutOwed: owed });
  }

  async function afterSignOut(here: boolean): Promise<void> {
    closeAllSockets();
    if (!here) {
      const open = db;
      db = undefined;
      if (open) (await open.catch(() => undefined))?.close();
    }
    for (const listeners of watchers.values()) for (const listener of listeners) listener(undefined);
    for (const listener of tripListeners) listener([]);
    for (const listener of signedOutListeners) listener();
  }

  async function signOut(): Promise<void> {
    channel.postMessage({ signedOut: true });
    await wipe(true);
    await afterSignOut(true);
    const answer = await call("POST", "/api/auth/sign-out");
    if (answer.kind !== "offline") await writeAccount(await database(), { key: "me", signOutOwed: false });
  }

  /** A session ended online: everything is deleted as on signing out, with nothing owed (§4.5). */
  async function sessionEnded(): Promise<void> {
    if (signedOutHere) return;
    signedOutHere = true;
    channel.postMessage({ signedOut: true });
    await wipe(false);
    await afterSignOut(true);
  }

  // --- §4.8 Creating a trip, the members and the graveyard ---

  async function request<T>(method: string, path: string, body: unknown, then: (value: unknown) => Promise<T>): Promise<Result<T>> {
    if (blocked) return updateFirst();
    if (!online) return offline();
    const answer = await call(method, path, body);
    if (answer.kind === "offline") return offline();
    if (answer.kind === "refused") return answer.refusal;
    return { ok: true, value: await then(answer.body) };
  }

  const trip_ = (id: string) => `/api/trips/${encodeURIComponent(id)}`;

  return {
    open,
    trips,
    trip,
    watch,
    onTrips(listener: (trips: readonly Summary[]) => void): () => void {
      tripListeners.add(listener);
      return () => tripListeners.delete(listener);
    },
    send,
    isOnline: () => online,
    onOnline(listener: (online: boolean) => void): () => void {
      onlineListeners.add(listener);
      return () => onlineListeners.delete(listener);
    },
    /** Tells the listener once this window, or another, has signed out (§4.6). */
    onSignedOut(listener: () => void): () => void {
      signedOutListeners.add(listener);
      return () => signedOutListeners.delete(listener);
    },
    signedIn,
    signOut,
    catchUpAll,
    /** The browser says the device has gone offline. */
    wentOffline: () => setOnline(false),

    create: (name: string, dates: Dates, countries: readonly string[]) =>
      request("POST", "/api/trips", { name, first: dates.first, last: dates.last, countries }, async (body) => {
        await catchUpAll();
        return { trip: (body as { trip: string }).trip };
      }),
    accept: (invitation: string, token: string) =>
      request("POST", `/api/invitations/${encodeURIComponent(invitation)}/accept`, { token }, async (body) => {
        await catchUpAll();
        return { trip: (body as { trip: string }).trip };
      }),
    invite: (id: string, email: string, tripLevel: TripLevel, calendar: Level) =>
      request("POST", `${trip_(id)}/invitations`, { email, trip: tripLevel, calendar }, async (body) => {
        await catchUp(id);
        return body as Invitation;
      }),
    withdraw: (id: string, invitation: string) =>
      request("DELETE", `${trip_(id)}/invitations/${encodeURIComponent(invitation)}`, undefined, async () => {
        await catchUp(id);
        return true as const;
      }),
    makeAdmin: (id: string, account: string) =>
      request("POST", `${trip_(id)}/admins`, { account }, async () => {
        await catchUp(id);
        return true as const;
      }),
    remove: (id: string, account: string) =>
      request("DELETE", `${trip_(id)}/members/${encodeURIComponent(account)}`, undefined, async () => {
        await catchUp(id);
        return true as const;
      }),
    buried: async (id: string, page: string): Promise<Result<Page>> => {
      const got = await request("GET", `${trip_(id)}/buried/${encodeURIComponent(page)}`, undefined, async (body) => (body as { page: string }).page);
      if (!got.ok) return got;
      const read = pageFromText(got.value);
      return read.ok ? read : { ok: false, refusal: read.refusal };
    },
  };
}

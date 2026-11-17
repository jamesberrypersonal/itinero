// planner/trip-host: the one copy of a trip, which every change is applied to.
// docs/spec/planner/trip-host.md specifies it, and its sections are cited throughout.
//
// This is the trip host's logic, over a trip's SQLite database. The Durable Object of trip-host.ts
// runs it on its own database, and the cost tests run it on Node's, where it can be timed. It
// imports nothing of Cloudflare's, and does no I/O but the database's, so each operation runs in
// one go, inside one transaction.

import {
  apply as applyToTrip,
  changeFromText as calendarChangeFromText,
  countries as allCountries,
  newTrip,
  travellerDates,
  tripFromText,
  tripToText,
  type Change as CalendarChange,
  type Dates,
  type Trip,
} from "@itinero/itinerary";
import {
  apply as applyToPages,
  changeFromText as pageChangeFromText,
  graveyard,
  newPages,
  pageToText,
  state as pageState,
  type Page,
  type Pages,
} from "@itinero/pages";
import {
  applyGrant,
  authorise,
  bookingLevel,
  grantChangeFromText,
  grantsFromText,
  grantsToText,
  newGrants,
  pageLevel,
  seen,
  widens,
  type Grant,
  type GrantChange,
  type Grants,
  type Who,
} from "@itinero/permissions";
import {
  apply as applyToBookings,
  bookingFromText,
  bookingToText,
  changeFromText as bookingChangeFromText,
  touches,
  type Booking,
} from "@itinero/bookings";

export type Refusal = { code: string; message: string; details?: Record<string, string> };
export type Result<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

/** A member of the trip, as the Worker gives it from access/membership (§3.3). */
export type Member = Who & { creator: boolean };
export type Target = "calendar" | "pages" | "grants" | "bookings";

/** What a catch-up gives a device (§4.4). */
export type Sync = {
  sequence: number;
  trip: { name: string; dates?: Dates; mine?: Dates };
  you: { admin: boolean; creator: boolean; grant: Grant };
  grants?: string;
  calendar?: string | null;
  pages: { id: string; changed: number; text?: string }[];
  graveyard: { id: string; title: string; went: number }[];
  bookings: { id: string; changed: number; text?: string }[];
};

/** A value SQLite stores. */
export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

/** A trip's SQLite database: a Durable Object's own, or Node's in the cost tests. */
export type Sql = {
  /** Runs one statement, and gives the rows it returns. */
  exec(query: string, ...bindings: SqlValue[]): Row[];
  /** Runs `run` in one transaction, which a thrown error rolls back. */
  transaction<T>(run: () => T): T;
};

// §4.1 The tables. The bookings table also keeps each booking's travellers, so a catch-up works out
// which bookings a traveller may see without reading every booking's text.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS trip (one INTEGER PRIMARY KEY CHECK (one = 1), text TEXT NOT NULL,
     changed INTEGER NOT NULL, sequence INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, parent TEXT,
     ord TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, buried INTEGER, country TEXT,
     changed INTEGER NOT NULL, seen_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS grants (one INTEGER PRIMARY KEY CHECK (one = 1), text TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, text TEXT NOT NULL,
     travellers TEXT NOT NULL, changed INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS creator (one INTEGER PRIMARY KEY CHECK (one = 1), account TEXT NOT NULL)`,
];

const accept = <T>(value: T): Result<T> => ({ ok: true, value });


/** Thrown inside a transaction to roll it back, and turned into the refusal it holds. */
class Refused extends Error {
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

/** The value of a Result, or a throw that rolls the transaction back with its refusal. */
function must<T>(result: { ok: true; value: T } | { ok: false; refusal: Refusal }): T {
  if (!result.ok) throw new Refused(result.refusal);
  return result.value;
}

export class TripCore {
  private readonly sql: Sql;
  trip = "";

  constructor(sql: Sql) {
    this.sql = sql;
    for (const statement of SCHEMA) sql.exec(statement);
  }

  /** Runs an operation in one transaction, rolling it back on a refusal. */
  private run<T>(operation: () => T): Result<T> {
    try {
      return accept(this.sql.transaction(operation));
    } catch (error) {
      if (error instanceof Refused) return { ok: false, refusal: error.refusal };
      throw error;
    }
  }

  // --- Reading the trip (§4.1) ---

  private exists(): boolean {
    return this.sql.exec("SELECT 1 AS one FROM trip").length > 0;
  }

  private sequence(): number {
    return Number(this.sql.exec("SELECT sequence FROM trip")[0]?.["sequence"] ?? 0);
  }

  private readTrip(): Trip {
    const row = this.sql.exec("SELECT text FROM trip")[0];
    if (!row) throw new Refused({ code: "not-a-member", message: "You are not on this trip, or it does not exist." });
    return must(tripFromText(String(row["text"])));
  }

  private readGrants(): Grants {
    return must(grantsFromText(String(this.sql.exec("SELECT text FROM grants")[0]?.["text"])));
  }

  private creator(): string | undefined {
    const row = this.sql.exec("SELECT account FROM creator")[0];
    return row ? String(row["account"]) : undefined;
  }

  /**
   * The trip's pages, built from their columns. Only the pages `withText` names, or every page
   * changed after `changedAfter`, hold their text. No function the trip host calls reads any other.
   */
  private readPages(withText: readonly string[] = [], changedAfter?: number): { pages: Pages; rows: Map<string, Row> } {
    const named = new Set(withText);
    const rows = this.sql.exec(
      `SELECT id, revision, parent, ord, title, buried, country, changed, seen_by,
         CASE WHEN changed > ?1 THEN text ELSE NULL END AS changed_text FROM pages ORDER BY id`,
      changedAfter ?? Number.MAX_SAFE_INTEGER,
    );
    const texts = new Map<string, string>();
    if (named.size > 0) {
      const ids = [...named];
      for (const row of this.sql.exec(`SELECT id, text FROM pages WHERE id IN (${ids.map(() => "?").join(", ")})`, ...ids)) {
        texts.set(String(row["id"]), String(row["text"]));
      }
    }
    const byId = new Map<string, Row>();
    const pages: Page[] = rows.map((row) => {
      const id = String(row["id"]);
      byId.set(id, row);
      const page: Page = {
        format: 1,
        id,
        trip: this.trip,
        revision: Number(row["revision"]),
        order: String(row["ord"]),
        title: String(row["title"]),
        text: texts.get(id) ?? (row["changed_text"] === null ? "" : String(row["changed_text"])),
      };
      if (row["parent"] !== null) page.parent = String(row["parent"]);
      if (row["buried"] !== null) page.buried = Number(row["buried"]);
      if (row["country"] !== null) page.country = String(row["country"]);
      return page;
    });
    return { pages: { trip: this.trip, pages }, rows: byId };
  }

  /** The member's place in the grants: one the grants do not hold is refused as not on the trip (§4). */
  private holds(grants: Grants, who: Member): void {
    if (!grants.grants.some((grant) => grant.traveller === who.traveller)) {
      throw new Refused({ code: "not-a-member", message: "You are not on this trip, or it does not exist." });
    }
  }

  // --- Writing (§4.1, §4.3) ---

  /** Raises the sequence by one, and gives the new one, which each record written is marked with. */
  private next(): number {
    const sequence = this.sequence() + 1;
    this.sql.exec("UPDATE trip SET sequence = ?1", sequence);
    return sequence;
  }

  private writeTrip(trip: Trip, changed: number): void {
    this.sql.exec("UPDATE trip SET text = ?1, changed = ?2", tripToText(trip), changed);
  }

  private writeGrants(grants: Grants): void {
    this.sql.exec("INSERT INTO grants (one, text) VALUES (1, ?1) ON CONFLICT (one) DO UPDATE SET text = excluded.text", grantsToText(grants));
  }

  /** Writes a page whole, its text included. */
  private writePage(page: Page, changed: number): void {
    this.sql.exec(
      `INSERT INTO pages (id, revision, parent, ord, title, text, buried, country, changed, seen_by)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)
       ON CONFLICT (id) DO UPDATE SET revision = excluded.revision, parent = excluded.parent, ord = excluded.ord,
         title = excluded.title, text = excluded.text, buried = excluded.buried, country = excluded.country,
         changed = excluded.changed`,
      page.id,
      page.revision,
      page.parent ?? null,
      page.order,
      page.title,
      page.text,
      page.buried ?? null,
      page.country ?? null,
      changed,
    );
  }

  // --- §4.2 Creating a trip ---

  create(trip: string, creator: Member, name: string, first: string, last: string, countries: readonly string[]): Result<true> {
    this.trip = trip;
    return this.run(() => {
      if (this.exists()) throw new Refused({ code: "malformed", message: "This trip has been created already." });
      const made = must(newTrip(trip, name));
      const dated = must(applyToTrip(made, { op: "trip-dates", dates: { first, last } }));
      const names = new Map(allCountries().map((country) => [country.code, country.name]));
      const chosen: { id: string; title: string; country: string }[] = [];
      for (const code of countries) {
        const title = names.get(code);
        if (title === undefined) throw new Refused({ code: "unknown-country", message: `${code} is not a country Itinero knows.` });
        if (!chosen.some((c) => c.country === code)) chosen.push({ id: `country-${code.toLowerCase()}`, title, country: code });
      }
      const pages = must(newPages(trip, chosen));
      const grants = must(applyGrant(newGrants(trip), pages, { op: "add", traveller: creator.traveller, trip: "edit", calendar: "edit" }));
      this.sql.exec("INSERT INTO trip (one, text, changed, sequence) VALUES (1, ?1, 1, 1)", tripToText(dated));
      for (const page of pages.pages) this.writePage(page, 1);
      this.writeGrants(grants);
      this.sql.exec("INSERT INTO creator (one, account) VALUES (1, ?1)", creator.traveller);
      return true as const;
    });
  }

  /** The trip's name and dates, for the list of trips (§4.2), and its title for an invitation's email. */
  summary(): { name: string; first: string; last: string } | undefined {
    if (!this.exists()) return undefined;
    const trip = this.readTrip();
    return { name: trip.name, first: trip.dates?.first ?? "", last: trip.dates?.last ?? "" };
  }

  // --- §4.3 Applying a change ---

  change(who: Member, target: Target, text: string, agreed?: number): Result<{ sequence: number }> {
    return this.run(() => {
      this.trip = this.readTrip().id;
      const grants = this.readGrants();
      this.holds(grants, who);
      switch (target) {
        case "calendar":
          return this.changeCalendar(who, grants, text);
        case "pages":
          return this.changePages(who, grants, text, agreed);
        case "grants":
          return this.changeGrants(who, grants, text);
        case "bookings":
          return this.changeBookings(who, grants, text);
        default:
          throw new Refused({ code: "malformed", message: `${String(target)} is not a part of a trip.` });
      }
    });
  }

  private changeCalendar(who: Member, grants: Grants, text: string): { sequence: number } {
    const change: CalendarChange = must(calendarChangeFromText(text));
    if (change.op === "rename" || change.op === "trip-dates") {
      if (this.creator() !== who.traveller) {
        throw new Refused({ code: "creator-only", message: "Only the trip's creator may change its name or its dates." });
      }
    } else if (change.op === "traveller-dates") {
      if (change.traveller !== who.traveller && !who.admin) {
        throw new Refused({ code: "own-dates-only", message: "Only an admin may change another traveller's dates." });
      }
    } else {
      must(authorise(grants, who, this.readPages().pages, { kind: "change-calendar" }));
    }
    const changed = must(applyToTrip(this.readTrip(), change));
    const sequence = this.next();
    this.writeTrip(changed, sequence);
    return { sequence };
  }

  private changePages(who: Member, grants: Grants, text: string, agreed?: number): { sequence: number } {
    const change = must(pageChangeFromText(text));
    const { pages } = this.readPages([change.id]);
    must(authorise(grants, who, pages, { kind: "change-page", change }));
    // §4.3 2. A move that widens who may see a page.
    if (change.op === "move") {
      const more = widens(grants, pages, change.id, change.to.parent === undefined ? {} : { parent: change.to.parent });
      if (more > 0 && more > (agreed ?? 0)) {
        const travellers = more === 1 ? "1 more traveller" : `${more} more travellers`;
        throw new Refused({
          code: "agree-first",
          message: `Moving this page there would let ${travellers} see it. Confirm, and move it again.`,
          details: { count: String(more) },
        });
      }
    }
    // §4.6 Who could see a page as it is deleted.
    let seenBy: string[] | undefined;
    if (change.op === "bury") {
      seenBy = grants.grants
        .map((grant) => grant.traveller)
        .filter((traveller) => pageLevel(grants, { traveller, admin: false }, pages, change.id) !== "none");
    }
    const applied = must(applyToPages(pages, change));
    const sequence = this.next();
    for (const page of applied.written) this.writePage(page, sequence);
    if (change.op === "bury") this.sql.exec("UPDATE pages SET seen_by = ?2 WHERE id = ?1", change.id, JSON.stringify(seenBy));
    if (change.op === "restore") this.sql.exec("UPDATE pages SET seen_by = NULL WHERE id = ?1", change.id);
    return { sequence };
  }

  private changeGrants(who: Member, grants: Grants, text: string): { sequence: number } {
    const change = must(grantChangeFromText(text));
    if (change.op === "add" || change.op === "remove") {
      throw new Refused({ code: "membership-only", message: "A traveller joins or leaves a trip only through an invitation or a removal." });
    }
    const { pages } = this.readPages();
    must(authorise(grants, who, pages, { kind: "grant", change }));
    const changed = must(applyGrant(grants, pages, change));
    const sequence = this.next();
    this.writeGrants(changed);
    return { sequence };
  }

  private changeBookings(who: Member, grants: Grants, text: string): { sequence: number } {
    const change = must(bookingChangeFromText(text));
    const id = change.op === "remove" ? change.id : change.booking.id;
    const row = this.sql.exec("SELECT text FROM bookings WHERE id = ?1", id)[0];
    const held: Booking | undefined = row ? must(bookingFromText(String(row["text"]))) : undefined;
    const { before, after } = touches(held, change);
    const { pages } = this.readPages();
    if (before.length > 0) must(authorise(grants, who, pages, { kind: "change-booking", travellers: before }));
    if (after.length > 0) must(authorise(grants, who, pages, { kind: "change-booking", travellers: after }));
    for (const traveller of after) {
      if (!before.includes(traveller) && !grants.grants.some((grant) => grant.traveller === traveller)) {
        throw new Refused({
          code: "unknown-traveller",
          message: "A booking can name only travellers on the trip.",
          details: { traveller },
        });
      }
    }
    const result = must(applyToBookings(held, change));
    const sequence = this.next();
    if (result === undefined) {
      this.sql.exec("DELETE FROM bookings WHERE id = ?1", id);
    } else {
      this.sql.exec(
        `INSERT INTO bookings (id, text, travellers, changed) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (id) DO UPDATE SET text = excluded.text, travellers = excluded.travellers, changed = excluded.changed`,
        id,
        bookingToText(result),
        JSON.stringify(result.travellers),
        sequence,
      );
    }
    return { sequence };
  }

  /**
   * An `add` or a `remove` from access/membership, applied with no check of who sent it, and safe to
   * repeat (§4.3). Gives the new sequence, and the traveller removed, whose sockets the caller closes.
   */
  grant(change: GrantChange): Result<{ sequence: number; removed?: string }> {
    return this.run(() => {
      this.trip = this.readTrip().id;
      const grants = this.readGrants();
      const held = grants.grants.some((grant) => grant.traveller === change.traveller);
      const { pages } = this.readPages();
      if (change.op === "add") {
        let next: Grants;
        if (held) {
          // Already on the trip: set their access to the trip and the calendar, and keep their exceptions.
          next = must(applyGrant(grants, pages, { op: "trip", traveller: change.traveller, level: change.trip }));
          next = must(applyGrant(next, pages, { op: "calendar", traveller: change.traveller, level: change.calendar }));
        } else {
          next = must(applyGrant(grants, pages, change));
        }
        const sequence = this.next();
        this.writeGrants(next);
        return { sequence };
      }
      if (change.op === "remove") {
        if (!held) return { sequence: this.sequence() };
        const next = must(applyGrant(grants, pages, change));
        const sequence = this.next();
        this.writeGrants(next);
        // Their own dates leave with them (spec/planner/itinerary.md §4.9).
        const trip = this.readTrip();
        if (trip.travellers.some((t) => t.traveller === change.traveller)) {
          this.writeTrip(must(applyToTrip(trip, { op: "traveller-dates", traveller: change.traveller })), sequence);
        }
        return { sequence, removed: change.traveller };
      }
      throw new Refused({ code: "malformed", message: "access/membership sends only an add or a remove." });
    });
  }

  /** Raises the sequence, and writes nothing else, for a member made an admin (§4.3). */
  touch(): { sequence: number } {
    return this.sql.transaction(() => ({ sequence: this.next() }));
  }

  // --- §4.4 Catching a device up ---

  sync(who: Member, since: number | undefined, holdsCalendar: boolean): Result<Sync> {
    return this.run(() => {
      const trip = this.readTrip();
      this.trip = trip.id;
      const grants = this.readGrants();
      this.holds(grants, who);
      const after = since ?? 0;
      const { pages, rows } = this.readPages([], after);
      const visible = seen(grants, who, pages);
      const tripRow = this.sql.exec("SELECT changed, sequence FROM trip")[0]!;
      const creator = this.creator() === who.traveller;
      // The traveller's own grant, with only the exceptions for pages they may see: an exception
      // for any other would name a page hidden from them (PLN:HOST-NFR1).
      const own = grants.grants.find((g) => g.traveller === who.traveller)!;
      const visibleIds = new Set(visible.pages.pages.map((page) => page.id));
      const grant: Grant = { ...own, pages: own.pages.filter((exception) => visibleIds.has(exception.page)) };

      const body: Sync = {
        sequence: Number(tripRow["sequence"]),
        trip: { name: trip.name },
        you: { admin: who.admin, creator, grant },
        pages: visible.pages.pages.map((page) => {
          const changed = Number(rows.get(page.id)!["changed"]);
          return changed > after ? { id: page.id, changed, text: pageToText(page) } : { id: page.id, changed };
        }),
        graveyard: graveyard(pages)
          .filter(({ page }) => who.admin || this.seenBy(rows.get(page.id)).includes(who.traveller))
          .map(({ page, went }) => ({ id: page.id, title: page.title, went })),
        bookings: [],
      };
      if (trip.dates) body.trip.dates = trip.dates;
      const mine = travellerDates(trip, who.traveller);
      if (mine) body.trip.mine = mine;
      if (who.admin) body.grants = grantsToText(grants);
      if (visible.calendar === "none") body.calendar = null;
      else if (Number(tripRow["changed"]) > after || !holdsCalendar) body.calendar = tripToText(trip);

      for (const row of this.sql.exec(
        "SELECT id, travellers, changed, CASE WHEN changed > ?1 THEN text ELSE NULL END AS text FROM bookings ORDER BY id",
        after,
      )) {
        const travellers = JSON.parse(String(row["travellers"])) as string[];
        if (bookingLevel(grants, who, travellers) === "none") continue;
        const entry: { id: string; changed: number; text?: string } = { id: String(row["id"]), changed: Number(row["changed"]) };
        if (row["text"] !== null) entry.text = String(row["text"]);
        body.bookings.push(entry);
      }
      return body;
    });
  }

  private seenBy(row: Row | undefined): string[] {
    const value = row?.["seen_by"];
    return typeof value === "string" ? (JSON.parse(value) as string[]) : [];
  }

  /** The text form of each page named that the traveller may see. Any other is left out (§4.4). */
  pages(who: Member, ids: readonly string[]): Result<readonly string[]> {
    return this.run(() => {
      this.trip = this.readTrip().id;
      const grants = this.readGrants();
      this.holds(grants, who);
      const wanted = [...new Set(ids)].filter((id) => typeof id === "string").slice(0, 1000);
      const { pages } = this.readPages(wanted);
      const visible = new Set(seen(grants, who, pages).pages.pages.map((page) => page.id));
      return pages.pages.filter((page) => wanted.includes(page.id) && visible.has(page.id)).map(pageToText);
    });
  }

  /** The text form of each booking named that the traveller may see. Any other is left out (§4.4). */
  bookings(who: Member, ids: readonly string[]): Result<readonly string[]> {
    return this.run(() => {
      this.trip = this.readTrip().id;
      const grants = this.readGrants();
      this.holds(grants, who);
      const wanted = [...new Set(ids)].filter((id) => typeof id === "string").slice(0, 1000);
      if (wanted.length === 0) return [];
      const rows = this.sql.exec(
        `SELECT text, travellers FROM bookings WHERE id IN (${wanted.map(() => "?").join(", ")}) ORDER BY id`,
        ...wanted,
      );
      return rows
        .filter((row) => bookingLevel(grants, who, JSON.parse(String(row["travellers"])) as string[]) !== "none")
        .map((row) => String(row["text"]));
    });
  }

  // --- §4.6 The graveyard ---

  /** A page in the graveyard, to an admin. */
  buried(who: Member, id: string): Result<string> {
    return this.run(() => {
      this.trip = this.readTrip().id;
      const grants = this.readGrants();
      this.holds(grants, who);
      const { pages } = this.readPages([id]);
      must(authorise(grants, who, pages, { kind: "read-buried", page: id }));
      if (pageState(pages, id) !== "graveyard") {
        throw new Refused({ code: "not-in-graveyard", message: "That page is not in the graveyard." });
      }
      return pageToText(pages.pages.find((page) => page.id === id)!);
    });
  }
}

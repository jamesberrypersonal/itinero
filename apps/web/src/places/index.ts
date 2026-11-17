// web/places: the places whose time zone a device knows, every airport and the towns of each
// country its trips visit, fetched in the background and found with no connection.
// docs/spec/web/places.md specifies it, and its section numbers are cited throughout.

import { countriesOf, type CopyCountries } from "./needs.ts";
import { findAirport, searchTowns, TownIndex, type AirportsFile, type IndexFile, type Place, type TownsFile } from "./search.ts";

export type { Place } from "./search.ts";
export type { CopyCountries } from "./needs.ts";

/** What the places component needs of web/trip-store (spec/web/trip-store.md §3.3). */
export type TripSource = {
  trips(): Promise<readonly { id: string }[]>;
  trip(id: string): Promise<CopyCountries | undefined>;
  onTrips(listener: (trips: readonly { id: string }[]) => void): () => void;
  isOnline(): boolean;
  onOnline(listener: (online: boolean) => void): () => void;
};

export type PlacesRefusal = { code: "offline" | "unknown-country"; message: string };
export type PlacesResult<T> = { ok: true; value: T } | { ok: false; refusal: PlacesRefusal };

/** The cache that holds the places' files, which no version deletes and signing out leaves (§3.4). */
const CACHE = "itinero-places";
/** The countries a traveller fetched by choosing them, recorded in the cache (§4.1). */
const CHOSEN = "/places/chosen.json";
/** The header a kept file's version is stored in, so it is compared without reading the file. */
const VERSION_HEADER = "Itinero-Places-Version";

let source: TripSource | undefined;
let unsubscribe: (() => void) | undefined;
let syncing: Promise<void> | undefined;
let syncAgain = false;

let airports: Promise<AirportsFile | undefined> | undefined;
const countries = new Map<string, Promise<TownIndex | undefined>>();

// The cache is opened as the page loads. WebKit keeps a cache first opened later in a page's life,
// once its last window closes, but empties it, so a device would lose the places it fetched in the
// session it first fetched them in. Milestone Web-1.2's browser tests found this.
void openCache();

/**
 * Starts keeping the countries the device's trips visit, once the trip store has opened. It works
 * them out again whenever the trip store says the trips or the connection have changed (§4.1).
 */
export function startPlaces(trips: TripSource): void {
  unsubscribe?.();
  source = trips;
  const offTrips = trips.onTrips(() => sync());
  const offOnline = trips.onOnline(() => sync());
  unsubscribe = () => {
    offTrips();
    offOnline();
  };
  sync();
}

/** The airport whose code is `code`, with its letters made capitals, or undefined (§4.2). */
export async function airport(code: string): Promise<Place | undefined> {
  airports ??= readKept<AirportsFile>("/places/airports.json");
  const file = await airports;
  return file && findAirport(file, code);
}

/** The towns of every country held that match `words`, at most `limit` of them (§4.3). */
export async function towns(words: string, limit = 10): Promise<readonly Place[]> {
  const indexes: TownIndex[] = [];
  for (const country of await held()) {
    let index = countries.get(country);
    if (!index) {
      index = readKept<TownsFile>(countryPath(country)).then((file) => file && new TownIndex(file));
      countries.set(country, index);
    }
    const read = await index;
    if (read) indexes.push(read);
  }
  return searchTowns(indexes, words, limit);
}

/** The countries whose towns the device holds, in byte order. */
export async function held(): Promise<readonly string[]> {
  const cache = await openCache();
  if (!cache) return [];
  const held: string[] = [];
  for (const request of await cache.keys()) {
    const match = /^\/places\/([A-Z]{2})\.json$/.exec(new URL(request.url).pathname);
    if (match) held.push(match[1]!);
  }
  return held.sort();
}

/**
 * Fetches a country's towns, stores them, and records the country as chosen, so that §4.1 keeps it
 * up to date (§4.4). Refuses with `offline` where the device has no connection.
 */
export async function fetchCountry(country: string): Promise<PlacesResult<true>> {
  const offline = refuse("offline", "This device has no connection. Connect it, and try again.");
  if (!(source?.isOnline() ?? navigator.onLine)) return offline;
  try {
    const index = await fetchIndex();
    if (!index) return offline;
    if (!(country in index.countries)) {
      return refuse("unknown-country", `Itinero holds no towns for the country ${country}.`);
    }
    if (!(await fetchFile(countryPath(country), index.version))) return offline;
    await recordChosen(country);
    return { ok: true, value: true };
  } catch {
    return offline;
  }
}

function refuse(code: PlacesRefusal["code"], message: string): PlacesResult<never> {
  return { ok: false, refusal: { code, message } };
}

function countryPath(country: string): string {
  return `/places/${country}.json`;
}

// --- Keeping the countries the trips visit (§4.1) ---

/** Works out and fetches what the device needs, one sync at a time. A call during one runs another after. */
function sync(): void {
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = syncOnce()
    .catch(() => undefined) // A fetch that fails is tried again when the trips or the connection change.
    .finally(() => {
      syncing = undefined;
      if (syncAgain) {
        syncAgain = false;
        sync();
      }
    });
}

async function syncOnce(): Promise<void> {
  const trips = source;
  if (!trips?.isOnline()) return;
  const copies: CopyCountries[] = [];
  for (const { id } of await trips.trips()) {
    const copy = await trips.trip(id);
    if (copy) copies.push(copy);
  }
  const needed = countriesOf(copies, await readChosen());
  const index = await fetchIndex();
  if (!index) return;
  // One at a time: the airports, then each country needed that is not held, or is of an older version.
  await fetchIfOlder("/places/airports.json", index.version);
  for (const country of needed) {
    if (country in index.countries) await fetchIfOlder(countryPath(country), index.version);
  }
}

async function fetchIfOlder(path: string, version: string): Promise<void> {
  const kept = await (await openCache())?.match(path);
  const keptVersion = kept?.headers.get(VERSION_HEADER);
  if (keptVersion !== null && keptVersion !== undefined && keptVersion >= version) return;
  await fetchFile(path, version);
}

// --- The files, in Cache Storage (§3.4) ---

function openCache(): Promise<Cache | undefined> {
  return typeof caches === "undefined" ? Promise.resolve(undefined) : caches.open(CACHE).catch(() => undefined);
}

async function fetchIndex(): Promise<IndexFile | undefined> {
  const response = await fetch("/places/index.json", { cache: "no-store" });
  return response.ok ? ((await response.json()) as IndexFile) : undefined;
}

/** Fetches a file, and keeps it with its version. Gives whether it did. */
async function fetchFile(path: string, version: string): Promise<boolean> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return false;
  const text = await response.text();
  const cache = await openCache();
  if (!cache) return false;
  await cache.put(path, new Response(text, { headers: { "Content-Type": "application/json", [VERSION_HEADER]: version } }));
  // The next search reads the file afresh.
  if (path === "/places/airports.json") airports = undefined;
  else countries.delete(/([A-Z]{2})\.json$/.exec(path)![1]!);
  return true;
}

async function readKept<T>(path: string): Promise<T | undefined> {
  const kept = await (await openCache())?.match(path);
  if (!kept) return undefined;
  try {
    return (await kept.json()) as T;
  } catch {
    return undefined;
  }
}

async function readChosen(): Promise<string[]> {
  return (await readKept<string[]>(CHOSEN)) ?? [];
}

async function recordChosen(country: string): Promise<void> {
  const chosen = new Set(await readChosen());
  if (chosen.has(country)) return;
  chosen.add(country);
  const cache = await openCache();
  await cache?.put(CHOSEN, new Response(JSON.stringify([...chosen].sort()), { headers: { "Content-Type": "application/json" } }));
}

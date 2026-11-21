// The device's copies, in IndexedDB (docs/spec/web/trip-store.md §3.4, §4.1): one database,
// `itinero`, at version 1, with four object stores. Every read and write is one transaction.

import type { AccountRecord, TextRecord, TripRecord } from "./types.ts";

export const DATABASE = "itinero";
const VERSION = 1;

/** A promise of an IndexedDB request's result. */
export function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** A promise that a transaction is applied, or why it was not. */
export function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("The transaction was aborted."));
  });
}

/** Opens the database, making its object stores the first time. */
export function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("account", { keyPath: "key" });
      db.createObjectStore("trips", { keyPath: "id" });
      db.createObjectStore("pages", { keyPath: ["trip", "id"] });
      db.createObjectStore("bookings", { keyPath: ["trip", "id"] });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another window deleting the database, on signing out, asks every window to let go of it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => undefined;
  });
}

/** Deletes the database. It waits until every window has closed its own connection. */
export function deleteDatabase(factory: IDBFactory): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Every record of one trip in a store keyed by the trip and an identifier. */
export function ofTrip(trip: string): IDBKeyRange {
  return IDBKeyRange.bound([trip], [trip, []]);
}

export type Held = { trip: TripRecord | undefined; pages: TextRecord[]; bookings: TextRecord[] };

/** A trip's records, read in one transaction (§4.1). */
export async function readTrip(db: IDBDatabase, id: string): Promise<Held> {
  const transaction = db.transaction(["trips", "pages", "bookings"], "readonly");
  const [trip, pages, bookings] = await Promise.all([
    done(transaction.objectStore("trips").get(id) as IDBRequest<TripRecord | undefined>),
    done(transaction.objectStore("pages").getAll(ofTrip(id)) as IDBRequest<TextRecord[]>),
    done(transaction.objectStore("bookings").getAll(ofTrip(id)) as IDBRequest<TextRecord[]>),
  ]);
  return { trip, pages, bookings };
}

export async function readAccount(db: IDBDatabase): Promise<AccountRecord | undefined> {
  return done(db.transaction("account", "readonly").objectStore("account").get("me") as IDBRequest<AccountRecord | undefined>);
}

export async function writeAccount(db: IDBDatabase, record: AccountRecord): Promise<void> {
  const transaction = db.transaction("account", "readwrite");
  transaction.objectStore("account").put(record);
  await committed(transaction);
}

/** Whether the device holds a trip. */
export async function holds(db: IDBDatabase, id: string): Promise<boolean> {
  return (await done(db.transaction("trips", "readonly").objectStore("trips").getKey(id))) !== undefined;
}

export async function allTrips(db: IDBDatabase): Promise<TripRecord[]> {
  return done(db.transaction("trips", "readonly").objectStore("trips").getAll() as IDBRequest<TripRecord[]>);
}

/** The identifiers of the pages, or the bookings, held for a trip. */
export async function heldIds(db: IDBDatabase, store: "pages" | "bookings", trip: string): Promise<Set<string>> {
  const keys = (await done(db.transaction(store, "readonly").objectStore(store).getAllKeys(ofTrip(trip)))) as [string, string][];
  return new Set(keys.map(([, id]) => id));
}

/** Deletes a trip and everything held of it, in one transaction. */
export async function deleteTrip(db: IDBDatabase, id: string): Promise<void> {
  const transaction = db.transaction(["trips", "pages", "bookings"], "readwrite");
  transaction.objectStore("trips").delete(id);
  transaction.objectStore("pages").delete(ofTrip(id));
  transaction.objectStore("bookings").delete(ofTrip(id));
  await committed(transaction);
}

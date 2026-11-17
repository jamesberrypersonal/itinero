// The trip store of this window, over the browser's own IndexedDB, fetch, WebSocket and
// BroadcastChannel (docs/spec/web/trip-store.md §3.3, §3.4).

import * as shell from "../shell/index.ts";
import { createStore } from "./store.ts";

export type { Copy, Invitation, Member, Result, Summary, Target } from "./types.ts";

/** Every 60 seconds while the device is offline, the trip store tries again, to learn it is back (§4.2). */
const RETRY_OFFLINE = 60_000;

const store = createStore({
  indexedDB,
  fetch: (input, init) => fetch(input, init),
  WebSocket,
  BroadcastChannel,
  origin: location.origin,
  online: navigator.onLine,
  now: () => Date.now(),
  shell,
});

// §4.2 The trip store catches every trip up each time the browser says it is online, and each time a
// window of Itinero comes to the front.
addEventListener("online", () => void store.catchUpAll());
addEventListener("offline", () => store.wentOffline());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void store.catchUpAll();
});
setInterval(() => {
  if (!store.isOnline()) void store.catchUpAll();
}, RETRY_OFFLINE);

export const {
  open,
  trips,
  trip,
  watch,
  onTrips,
  send,
  isOnline,
  onOnline,
  onSignedOut,
  signedIn,
  signOut,
  catchUpAll,
  create,
  accept,
  invite,
  withdraw,
  makeAdmin,
  remove,
  buried,
} = store;

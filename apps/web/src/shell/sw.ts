// The service worker, built to /sw.js (docs/spec/web/shell.md §4.1). It holds one version of
// Itinero whole, in a cache of its own, and answers the page's requests for its files with no
// connection. It is written by hand, with no library, and imports nothing, so the build only
// strips its types and writes in its version.

declare const self: ServiceWorkerGlobalScope;

/** The version this service worker holds, written in by the build (§4.6). */
const VERSION = "__ITINERO_VERSION__";
const CACHE = `itinero-${VERSION}`;
/** A version's cache. The others named `itinero-`, the rules and the places, outlive every version. */
const VERSION_CACHE = /^itinero-[0-9a-f]{12}$/;

type Listing = { version: string; files: string[] };

// Install: fetch /version.json, then every file it lists. Any file failing fails the install, which
// the browser tries again on the next launch.
self.addEventListener("install", (event) => {
  event.waitUntil(install());
});

async function install(): Promise<void> {
  const response = await fetch("/version.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`/version.json gave ${response.status}`);
  const listing = (await response.json()) as Listing;
  // A version deployed since this script was fetched would mix two versions' files.
  if (listing.version !== VERSION) throw new Error(`/version.json names ${listing.version}, not ${VERSION}`);
  const cache = await caches.open(CACHE);
  try {
    await cache.addAll(listing.files.map((file) => new Request(file, { cache: "reload" })));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

// Activate: delete every other version's cache, and take control of the window that installed this
// version, which opened before any service worker did. Without it, that window would use no service
// worker, and the next version would take over at once rather than wait for it to close.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => VERSION_CACHE.test(name) && name !== CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: a page gets the cached index.html, and a file of the version comes from the cache. Every
// other request, to the online side or for the newest rules, goes to the network untouched.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/time-zone-rules.json") return;
  const key = request.mode === "navigate" ? "/" : url.pathname;
  event.respondWith(fromCache(key, request));
});

async function fromCache(key: string, request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  return (await cache.match(key)) ?? fetch(request);
}

// Messages from a window: which version this is, and, only when the traveller asks, to take over
// every open window (§4.7).
self.addEventListener("message", (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === "version") event.ports[0]?.postMessage(VERSION);
  else if (data?.type === "skip-waiting") void self.skipWaiting();
});

export {};

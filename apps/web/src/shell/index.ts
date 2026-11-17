// web/shell: what makes the web app an app. It registers the service worker, loads the time-zone
// rules before any time is shown, asks the browser to keep what Itinero stores, and starts a new
// version when the traveller asks. docs/spec/web/shell.md specifies it, and its section numbers
// are cited throughout.

import { loadRules, rulesVersion } from "@itinero/trip-time";
import * as builtRules from "virtual:itinero-rules";
import { suggestInstall } from "./install.ts";
import { chooseRules, isNewer, releaseOf } from "./rules.ts";

export { API, API_HEADER } from "./api.ts";

export type ShellState = {
  /** The version running. */
  version: string;
  /** The service worker holds every file of this version. */
  offlineReady: boolean;
  /** A new version is held, and opens once every window closes. */
  updateWaiting: boolean;
  /** The online side no longer answers this version (§4.7). */
  updateRequired: boolean;
  /** The IANA release of the rules loaded, such as "2026a". */
  rulesVersion: string;
  /** An iPhone or an iPad, not opened from the home screen. */
  suggestInstall: boolean;
};

/** The cache that keeps the newest rules fetched, which no version deletes (§4.4). */
const RULES_CACHE = "itinero-rules";
const RULES_PATH = "/time-zone-rules.json";
/** The header the shell stores a kept rules file's release in, so it is chosen without reading it. */
const RULES_RELEASE = "Itinero-Rules-Release";
/** Set once the shell has asked the browser to keep what Itinero stores (§4.2). */
const PERSIST_ASKED = "itinero-persist-asked";

let state: ShellState | undefined;
let started: Promise<ShellState> | undefined;
const listeners = new Set<(state: ShellState) => void>();

let registration: ServiceWorkerRegistration | undefined;

/** Starts the shell, before any screen shows a time (§4.2). It waits on nothing on the network. */
export function start(): Promise<ShellState> {
  started ??= begin();
  return started;
}

/** Tells `listener` each time any field of the state changes, until the function it gives is called. */
export function onChange(listener: (state: ShellState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The state as it stands, once `start` has resolved. */
export function current(): ShellState | undefined {
  return state;
}

/**
 * The device has connected. web/trip-store calls it on connecting, and the shell after `start`
 * where the device is online. It fetches Itinero's newest rules (§4.4), and checks for a new
 * version (§4.1, §4.7).
 */
export function online(): void {
  checkForUpdate();
  // Each call fetches afresh, rather than joining one in flight: rules published since that one
  // left would otherwise wait for the next connection.
  void fetchNewestRules();
}

/** The online side refused this version with `update-first`. web/trip-store calls it (§4.7). */
export function updateFirst(): void {
  set({ updateRequired: true });
  checkForUpdate();
}

/**
 * Starts the new version in every window of Itinero, from the notice of §3.1. web/screens calls it,
 * and only the traveller's choice does, so their unsaved text is lost only once they choose (§4.7).
 */
export function applyUpdate(): void {
  if (!state?.updateWaiting) return;
  registration?.waiting?.postMessage({ type: "skip-waiting" });
}

async function begin(): Promise<ShellState> {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  state = {
    version: builtVersion(),
    offlineReady: false,
    updateWaiting: false,
    updateRequired: false,
    rulesVersion: "",
    suggestInstall: suggestInstall(navigator.userAgent, standalone),
  };
  void registerWorker();
  // The service worker may change the state while the rules load, so the rules' release is set
  // into the state as it then stands.
  const rulesVersion = await loadNewestRules();
  set({ rulesVersion });
  askToPersist();
  if (navigator.onLine) queueMicrotask(online);
  return state!;
}

/** The version the build wrote into index.html, or "development" under Vite's server (§4.6). */
function builtVersion(): string {
  const written = document.querySelector<HTMLMetaElement>('meta[name="itinero-version"]')?.content;
  return written && /^[0-9a-f]{12}$/.test(written) ? written : "development";
}

function set(patch: Partial<ShellState>): void {
  if (!state) return;
  const changed = (Object.keys(patch) as (keyof ShellState)[]).some((key) => patch[key] !== state![key]);
  if (!changed) return;
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

// --- The time-zone rules (§4.4) ---

/** Cache Storage, where the browser offers it: only on a secure origin. */
function rulesCache(): Promise<Cache> | undefined {
  return typeof caches === "undefined" ? undefined : caches.open(RULES_CACHE);
}

/** Loads the newer of the version's own rules and the newest fetched, and gives its release. */
async function loadNewestRules(): Promise<string> {
  const cache = await rulesCache()?.catch(() => undefined);
  const kept = await cache?.match(RULES_PATH);
  const keptRelease = kept?.headers.get(RULES_RELEASE) ?? undefined;
  if (kept && chooseRules(builtRules.release, keptRelease) === "fetched") {
    const result = loadRules(await kept.text());
    if (result.ok) return result.value.version;
    await cache!.delete(RULES_PATH);
  }
  const response = await fetch(builtRules.url);
  const result = loadRules(await response.text());
  if (!result.ok) throw new Error(`The version's own time-zone rules were refused: ${result.refusal.message}`);
  return result.value.version;
}

/** Fetches Itinero's newest rules, and keeps and loads them where they are newer than those loaded. */
async function fetchNewestRules(): Promise<void> {
  try {
    const response = await fetch(RULES_PATH, { cache: "no-store" });
    if (!response.ok) return;
    const file = await response.text();
    const release = releaseOf(file);
    if (release === undefined || !isNewer(release, rulesVersion())) return;
    const cache = await rulesCache();
    if (!cache) return;
    await cache.put(
      RULES_PATH,
      new Response(file, { headers: { "Content-Type": "application/json", [RULES_RELEASE]: release } }),
    );
    const result = loadRules(file);
    if (!result.ok) {
      await cache.delete(RULES_PATH);
      return;
    }
    set({ rulesVersion: result.value.version });
  } catch {
    // No connection after all. The next call of online() tries again.
  }
}

let names: Promise<readonly string[]> | undefined;

/**
 * Every zone and alias the rules loaded name, in byte order, for a traveller choosing a time's zone
 * by hand (spec/web/screens.md §4.5). It reads the rules file again, once, when first asked.
 */
export function zoneNames(): Promise<readonly string[]> {
  names ??= (async () => {
    const cache = await rulesCache()?.catch(() => undefined);
    const kept = await cache?.match(RULES_PATH);
    const file = kept && kept.headers.get(RULES_RELEASE) === rulesVersion() ? await kept.text() : await (await fetch(builtRules.url)).text();
    const parsed = JSON.parse(file) as { zones: Record<string, unknown>; aliases: Record<string, unknown> };
    return [...Object.keys(parsed.zones), ...Object.keys(parsed.aliases)].sort();
  })().catch(() => {
    names = undefined;
    return [];
  });
  return names;
}

// --- Keeping what Itinero stores (§4.2) ---

function askToPersist(): void {
  try {
    if (localStorage.getItem(PERSIST_ASKED) !== null) return;
    localStorage.setItem(PERSIST_ASKED, new Date().toISOString());
  } catch {
    // Storage refused, such as in a private window: ask each time instead.
  }
  void navigator.storage?.persist?.().catch(() => false);
}

// --- The service worker (§4.1, §4.2, §4.7) ---

async function registerWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  // A window controlled by a service worker reloads when another takes over, so that every window
  // runs the version the traveller started. A window opened before any service worker does not.
  let controlled = container.controller !== null;
  container.addEventListener("controllerchange", () => {
    if (controlled) location.reload();
    controlled = true;
  });
  try {
    // Registering again, where a service worker is registered, has the browser check for a new one.
    registration = await container.register("/sw.js", { scope: "/" });
  } catch {
    return;
  }
  const watched = registration;
  watched.addEventListener("updatefound", () => watchInstalling(watched));
  watchInstalling(watched);
  refreshWaiting();
  const ready = await container.ready;
  if (ready.active) set({ offlineReady: (await versionOf(ready.active)) === state?.version });
}

function watchInstalling(watched: ServiceWorkerRegistration): void {
  const worker = watched.installing;
  if (!worker) return;
  worker.addEventListener("statechange", async () => {
    refreshWaiting();
    if (worker.state === "activated" && watched.active === worker) {
      set({ offlineReady: (await versionOf(worker)) === state?.version });
    }
  });
}

function refreshWaiting(): void {
  set({ updateWaiting: registration?.waiting != null });
}

/** Asks the browser to check for a new service worker. One that fails, such as on a lost
 * connection, is made again on the next call of `online()` (§4.7). */
function checkForUpdate(): void {
  registration?.update().catch(() => undefined);
}

/** Asks a service worker the version it holds. */
function versionOf(worker: ServiceWorker): Promise<string | undefined> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(undefined), 2000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(typeof event.data === "string" ? event.data : undefined);
    };
    worker.postMessage({ type: "version" }, [channel.port2]);
  });
}

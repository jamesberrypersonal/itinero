# The web app's shell

**Assumes** [shell.md](../../requirements/web/shell.md) — what the shell promises, and the web app's other two components.

## 1. Purpose

The shell is the part of the web app that makes it an app: the files a browser downloads, the
service worker that opens them with no connection, the manifest that lets a phone add Itinero to its
home screen, and the time-zone rules. It starts Itinero, and hands over to `web/trip-store` and
`web/screens` once it is ready.

## 2. Scope

The shell covers the web app's build, the files it serves, opening with no connection, new
versions, adding Itinero to a home screen, asking the browser to keep what Itinero stores, and the
time-zone rules file on the device.

Four things act on it:

- **A traveller's browser** downloads and opens the files, and runs the service worker (§3.4).
- **`web/screens`** asks the shell whether Itinero is ready offline, whether a new version waits
  or is required, and whether to say how to add Itinero to an iPhone's home screen (§3.3).
- **`web/trip-store`** tells the shell when the device connects, and when the online side refuses
  the version running (§3.3).
- **A maintainer** builds and deploys the web app with the online side (§4.6).

Deliberately absent:

- every trip, and anything of a traveller's, which `web/trip-store` holds
- every screen, which `web/screens` draws
- notifications

The web app is built with Preact and Vite, and served by Itinero's own Worker (ADR-0018, the web
app is built with Preact, and served by Itinero's own Worker). Every time is read with rules the
web app carries itself (ADR-0008, trip-time carries its own copy of the time-zone rules).

## 3. Interface

### 3.1 User interface

The shell shows three things of its own, which `web/screens` places:

- **a notice that Itinero is ready offline**, once the service worker holds every file of the
  version
- **a notice on an iPhone that Itinero is not on the home screen**, saying to tap Share, then Add
  to Home Screen, so that its trips stay when the phone goes unused for some days. It also says the
  traveller signs in once more there, since Itinero on the home screen keeps its own storage (§4.3)
- **a notice that a new version is required**, once the online side refuses the version running,
  with a button that starts the new version (§4.7)

### 3.2 Application interface

The shell serves these files, each from Itinero's own address:

| Path | Holds |
|---|---|
| `/`, and any path outside `/api/` that names no file | `index.html`, which loads the app |
| `/assets/...` | The built scripts, styles, fonts and images, each named with a hash of its contents |
| `/manifest.webmanifest` | The web app manifest (§4.3) |
| `/sw.js` | The service worker (§4.1) |
| `/version.json` | `{ "version": ..., "files": [ ... ] }`: the version, and every file it needs |
| `/time-zone-rules.json` | The newest rules file of `shared/trip-time` (§4.4) |

Every request of the online side has a path beginning `/api/`, such as `/api/auth/sign-in` and
`/api/trips`. Those paths are the Worker's, and the shell never answers them. Every screen's
address is outside `/api/`, such as `/trips/{trip}/members` and `/invitations/{invitation}`. A
screen's address therefore always gives `index.html`, whether a traveller opens it from a link or
reloads it.

### 3.3 Programming interface

The package `@itinero/web` holds the shell in `src/shell/`. It gives the other components:

```ts
type ShellState = {
  version: string;          // the version running
  offlineReady: boolean;    // the service worker holds every file of this version
  updateWaiting: boolean;   // a new version is held, and opens once every window closes
  updateRequired: boolean;  // the online side no longer answers this version (§4.7)
  rulesVersion: string;     // the IANA release of the rules loaded, such as "2026a"
  suggestInstall: boolean;  // an iPhone or an iPad, not opened from the home screen
};

function start(): Promise<ShellState>;                        // before any screen shows a time
function onChange(listener: (state: ShellState) => void): () => void;
function online(): void;                                      // web/trip-store calls it on connecting

const API: number;                                            // sent with every request (§4.7)
function updateFirst(): void;                                 // web/trip-store calls it when refused
function applyUpdate(): void;                                 // web/screens calls it from the notice
```

### 3.4 Systems this drives

The shell drives four parts of the browser:

- **A service worker** is a script the browser runs apart from the page, which can answer the page's
  requests for files. A service worker is installed for a site, and a new one waits until no window
  of the site uses the old one before it takes over.
- **Cache Storage** holds responses the service worker keeps, by name, in caches the site names.
- **The web app manifest** is a file that tells a phone the app's name, icons and how it opens when
  added to the home screen.
- **The Storage API's `navigator.storage.persist()`** asks the browser to keep a site's stored data
  rather than clear it when space runs short. Safari on an iPhone clears a site's stored data after
  some days unused, unless the site was opened from the home screen.

The MDN Web Docs on service workers, Cache Storage, web app manifests and the Storage API give the
detail.

## 4. Behaviour

### 4.1 The service worker

*Plumbing:* `/sw.js` is written by hand, with no library (`WEB:SHELL-F1`, `WEB:SHELL-F2`).

- **Install.** The service worker fetches `/version.json`, then every file it lists, into a cache
  named `itinero-<version>`. The install fails, and is tried again on the next launch, if any file
  fails.
- **Wait.** A new service worker, once installed, waits while any window uses the old one. It
  calls `skipWaiting`, which ends the wait and lets it take over open windows, only when a window
  asks it to (§4.7). Otherwise it takes over once no window uses the old one.
- **Activate.** Once it takes over, it deletes every cache named `itinero-` but its own.
- **Fetch.** It answers a request for a page with the cached `index.html`, and a request for any
  other file its version lists from the cache. Every other request, including every request to the
  online side and for `/time-zone-rules.json`, goes to the network untouched.

A version's files are all named by their contents' hash, apart from `index.html`, so two versions
never share a name for different contents, and a version is always used whole.

### 4.2 start

*Porcelain:* `start()` runs as the page opens, before any screen shows a time (`WEB:SHELL-F4`). It:

1. registers `/sw.js`, if no service worker is registered
2. loads the rules into trip-time, as §4.4 gives
3. asks `navigator.storage.persist()`, once per device, and does not wait for the answer
   (`WEB:SHELL-F3`)
4. gives the `ShellState`

`offlineReady` is true once the service worker holding this version is active. `updateWaiting` is
true while a newer service worker waits. `onChange` tells its listener each time any field of the
`ShellState` changes.

### 4.3 Adding Itinero to a home screen

*Porcelain:* `/manifest.webmanifest` names the app Itinero, with `display` set to `standalone`,
`start_url` set to `/`, and icons of 192 and 512 pixels, and a maskable icon. `index.html` links to
it, and carries the `apple-touch-icon` that Safari reads (`WEB:SHELL-F3`).

`suggestInstall` is true where the browser's user agent names an iPhone or an iPad, and
`navigator.standalone` is not true. `web/screens` shows the notice of §3.1 while it is true, on the
home page and on the list of trips.

An iPhone keeps two stores for Itinero apart: one for Itinero opened from the home screen, and one
for Itinero in Safari. The session is in one store only. A traveller who signed in in Safari, such
as from an invitation's email, therefore signs in once more the first time they open Itinero from
the home screen. The notice says so.

### 4.4 The time-zone rules

*Porcelain:* the shell holds the rules file in two places (`WEB:SHELL-F4`):

- **the version's own**, built into the version's files by the build (§4.6)
- **the newest fetched**, in a cache named `itinero-rules`, which no version deletes

At `start`, it loads the newer of the two with trip-time's `loadRules`. One file is newer than
another where its `version` compares later as text, since IANA releases sort so. A file that
trip-time refuses with `bad-rules` is deleted, and the version's own is loaded.

`online()` fetches `/time-zone-rules.json` with no caching by the browser. Where the file fetched
is newer than the one loaded, the shell stores it in `itinero-rules`, loads it, and tells its
listeners, so that `web/screens` redraws every time. `web/trip-store` calls `online()` each time
the device connects, and the shell calls it after `start` where the device is online.

### 4.5 The test suite

The suite runs with `npm test` in `apps/web/`, and the recipe `just test-web` runs it from anywhere
in the repository. It covers all three of the web app's components.

- **Unit tests**, with Node's built-in test runner, cover choosing the newer rules file and
  `suggestInstall`.
- **Browser tests**, with Playwright in Chromium, WebKit and Firefox, open Itinero, go offline,
  reopen it, and open every screen (`WEB:SHELL-F1`). They publish a second version and confirm it
  takes over only once every window closes (`WEB:SHELL-F2`). They publish a third whose online side
  refuses the second, and confirm the notice, and that `applyUpdate` starts it in every window
  (`WEB:SHELL-F5`).
- **Timing tests** measure the time from opening to `start` resolving, and fail above 300
  milliseconds on the machine running them. The check on a phone of `WEB:SHELL-NFR1` is made by
  hand before each release.

### 4.6 The build

*Plumbing:* `npm run build` in `apps/web/` runs Vite, which writes the version into `apps/web/dist/`.
The build:

1. bundles the web app's TypeScript, Preact and every package it imports
2. copies the newest rules file of `@itinero/trip-time` into the version's files, and, apart from
   them, to `/time-zone-rules.json`
3. writes `version.json`, naming the version by the hash of the version's files, and listing them

`/time-zone-rules.json` is not one of the version's files, so newer rules change no version's name.
A maintainer publishes newer rules without a new version with `npm run build-rules` in `apps/web/`.
It writes `/time-zone-rules.json` alone, from the newest rules file of `@itinero/trip-time`, and a
deploy then serves it beside the version already served (`WEB:SHELL-F4`).

The online side's Wrangler configuration serves `apps/web/dist/` as the Worker's static files. It
passes every path under `/api/` to the Worker, and answers any other path it does not hold with
`index.html`. Deploying the online side deploys the web app
with it (ADR-0018).

### 4.7 A version the online side no longer answers

*Porcelain:* each version holds `API`, a whole number (`WEB:SHELL-F5`). It names the form of request
and record the version was built to send and to read. `web/trip-store` and `web/screens` send it
with every request to the online side, in a header named `Itinero-Api`. The online side refuses a
number lower than the oldest it answers, with `update-first`, as `spec/access/accounts.md` §4.7
gives.

A maintainer raises `API`, and the oldest number the online side answers, in the same change. They
do so only when an older version could not read what the online side would give it, or would send
what the online side could not read, such as a record in a new format. A deploy carries the web app
and the online side together, so the online side never refuses the version deployed with it
(ADR-0018).

`updateFirst()` sets `updateRequired`, tells the listeners of `onChange`, and asks the browser to
check for a new service worker. `web/trip-store` calls it on an `update-first` refusal. Once the new
version is held, `updateWaiting` is true. A check that fails, such as on a lost connection, is made
again each time `online()` is called.

`applyUpdate()` asks the waiting service worker to take over, with a message it answers by calling
`skipWaiting`. Each window of Itinero reloads when the browser tells it that the service worker in
control has changed, so every window then runs the new version. `applyUpdate()` does nothing while
`updateWaiting` is false. The shell never calls it itself, so a traveller's unsaved text is lost
only once they choose to update.

## 5. Resources

| Resource | Path | Owned by |
|---|---|---|
| The web app's package | `apps/web/`, as `@itinero/web` | Whoever keeps the web app's roadmap |
| The shell | `apps/web/src/shell/` | Whoever keeps the web app's roadmap |
| The service worker | `apps/web/src/shell/sw.ts`, built to `/sw.js` | Whoever keeps the web app's roadmap |
| The manifest and icons | `apps/web/public/` | Whoever keeps the web app's roadmap |
| The built version | `apps/web/dist/`, never committed | Whoever keeps the web app's roadmap |
| A version's cache on a device | Cache Storage, `itinero-<version>` | The device's browser |
| The newest rules on a device | Cache Storage, `itinero-rules` | The device's browser |
| The recipe | `test-web`, in the `justfile` at the repository root | Whoever keeps the web app's roadmap |

The package's runtime dependencies are Preact and the packages of every component the web app
shows: `@itinero/trip-time`, `@itinero/itinerary`, `@itinero/pages`, `@itinero/permissions` and
`@itinero/bookings`. Its development dependencies are TypeScript, Vite and Playwright.

## 6. Quality attributes

- **Offline** (`WEB:SHELL-F1`). Every file a version needs is cached before it is reported ready.
- **One version at a time** (`WEB:SHELL-F2`). Files are named by their contents, and a new service
  worker takes over an open window only when the traveller asks, from the notice of §4.7.
- **Never out of step with the online side** (`WEB:SHELL-F5`). A version too old is refused before
  anything is read or written for it, and says so.
- **Small** (`WEB-NFR2`). Preact, and Vite leaving out code nothing uses, keep the version's files
  small. The rules file and the map of country borders are the largest of them.
- **Quick to start** (`WEB:SHELL-NFR1`). `start` reads two cached files and loads one, and waits for
  nothing on the network.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [WEB:SHELL-F1](../../requirements/web/shell.md#^web-shell-f1) | The service worker of §4.1. |
| [WEB:SHELL-F2](../../requirements/web/shell.md#^web-shell-f2) | A cache for each version, and `skipWaiting` called only when the traveller asks, in §4.1. |
| [WEB:SHELL-F3](../../requirements/web/shell.md#^web-shell-f3) | The manifest and `suggestInstall`, in §4.3, and `persist`, in §4.2. |
| [WEB:SHELL-F4](../../requirements/web/shell.md#^web-shell-f4) | The two rules files, and `online`, in §4.4. |
| [WEB:SHELL-F5](../../requirements/web/shell.md#^web-shell-f5) | `API`, `updateFirst` and `applyUpdate`, in §4.7. The refusal is `access/accounts`, and the notice is `web/screens`. |
| [WEB:SHELL-NFR1](../../requirements/web/shell.md#^web-shell-nfr1) | `start`, which waits on nothing on the network (§4.2, §6). |
| [WEB-F1](../../requirements/web/web.md#^web-f1) | The manifest, and the notice for an iPhone (§4.3). Every screen fitting a phone is `web/screens`. |
| [WEB-F3](../../requirements/web/web.md#^web-f3) | Asking the browser to keep what Itinero stores, and saying how to add Itinero to an iPhone's home screen (§4.2, §4.3). Holding each trip is `web/trip-store`. |
| [WEB-F8](../../requirements/web/web.md#^web-f8) | The rules built into each version, and the newest fetched, in §4.4. |
| [WEB-NFR2](../../requirements/web/web.md#^web-nfr2) | Building each version small (§4.6, §6). The map of country borders is `web/screens`. |
| [WEB-NFR3](../../requirements/web/web.md#^web-nfr3) | The browser tests in three engines (§4.5). The other components' tests run in the same three. |
| [SHR:TRIP-TIME-NFR1](../../requirements/shared/trip-time.md#^shr-trip-time-nfr1) | Bundling, fetching and storing the rules file (§4.4). |
| [SHR:TRIP-TIME-NFR2](../../requirements/shared/trip-time.md#^shr-trip-time-nfr2) | One rules file on every device that has been online since it was published (§4.4). |

## 8. Open

- **A version that fails to install.** A device whose service worker keeps failing to install a new
  version keeps the old one. Telling the traveller, after some number of tries, is not designed.

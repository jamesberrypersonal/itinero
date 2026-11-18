# The web app's roadmap

**Kept by:** James Berry

The web app is what travellers use on a computer or a phone, including reading a trip with no
connection. Phase 0 designs it: its requirements, its components and their specifications, before
any of it is built. It ends with a trial on a real phone, of what the design cannot settle on paper.
Phase 1 builds it, one component at a time.

The web app shows what the planner holds and what the access system allows. Its design follows the
planner's, made in Milestone Planner-0.2, and the access system's, made in Milestone Access-0.1.
Each part of a system is named by its address, the system and the part's own name, such as
`web/shell`.

## Completed

### Phase 1 — Build

#### Milestone Web-1.5 — The calendar, and the screens an admin manages a trip on

- The rest of `web/screens` is built, as its specification gives it: the calendar, one day to a row
  on a phone and one week to a row on a computer, with each stretch drawn pencilled and resized by
  dragging its ends, and stretches and firm items, travel among them, added from a day. An admin's
  members screen lists the open invitations, invites an address and withdraws an invitation, and
  opens each member, to set their access to the trip, the calendar and each branch of pages, make
  them an admin, or remove them. A page is moved by dragging it in the tree.
- A traveller who is not an admin is offered each change their own grant allows, on every screen.
- Its test suite proves `WEB:SCREENS-F3`, `WEB:SCREENS-F6`, `ACC-F9` and `PLN-F13` by the
  verification each carries, the check of `WEB:SCREENS-F8` that removing a traveller asks first,
  and the checks of `WEB:SCREENS-F1` on the calendar and the screens an admin manages a trip on, in
  Chromium, WebKit and Firefox, against the online side in Wrangler. Its unit tests prove the
  calendar's order of firm items and bookings, and `WEB:SCREENS-NFR2`.

#### Milestone Web-1.4 — The screens a traveller reads a trip on

- The first screens of `web/screens` are built, as its specification gives them: signing in and
  choosing a name, accepting an invitation, the list of trips and a new trip, a trip's home page,
  its bookings with a form for each kind, its pages with their search and deleted pages, the list
  of its members, and the settings. Each screen of a trip has a bar of links to its other screens,
  along the foot of a phone and down the side of a computer.
- The map of country borders, `npm run build-borders`, is built from Natural Earth's countries at
  1:50 million, and is 416 kilobytes as sent. The home page finds the phone's country in it, on the
  phone.
- `POST /api/auth/nonce`, which gives the single-use value a sign-in sends back, also gives
  Itinero's client identifier at Google. The sign-in screen draws Google's button with it.
- Its test suite proves `WEB:SCREENS-F2`, `WEB:SCREENS-F4`, `WEB:SCREENS-F5`, `WEB:SCREENS-F7` and
  `WEB:SCREENS-F10` by the verification each carries. It proves `WEB:SCREENS-F1`, `WEB:SCREENS-F8`
  and `WEB:SCREENS-F9` except the checks left to Milestone Web-1.5. Its tests run in Chromium,
  WebKit and Firefox, against the online side in Wrangler, Cloudflare's tool that runs it on a
  computer, with stand-ins for Google and for Resend, the service that sends invitations.
- The suite proves the checks of `WEB:SHELL-F5` that need a trip's copy and the screens. It deploys
  a new version whose online side refuses the version the device is running.
- The suite proves `BKG-F2`, `BKG-F3`, `BKG-F4` and `BKG-F6`, and the check of `BKG-F5` that a
  removed booking is gone from every traveller's bookings page. `BKG-NFR1`, `BKG:LIST-NFR2` and
  `WEB:SCREENS-NFR1` hold in each engine on the computer running the tests, and their checks on a
  phone are left to Milestone Web-1.5.

#### Milestone Web-1.3 — A trip's copy on a device

- `web/trip-store` is built in `@itinero/web`, as its specification gives it, with each trip's copy
  in IndexedDB, a live socket for each trip a window shows, and a BroadcastChannel between windows.
  The trip store starts `web/places` once it opens.
- Its test suite proves each requirement of `web/trip-store` by the verification it carries: on
  Node.js against a stand-in running `planner/trip-host`'s own logic, and in Chromium, WebKit and
  Firefox against the online side in Wrangler. A trip of 500 pages and 300 bookings is read in under
  10 milliseconds. The check of `WEB:STORE-NFR1` on a phone is left to Milestone Web-1.5.
- `PLN:ITINERARY-NFR1`, `PLN:PAGES-NFR1` and `ACC:PERMISSIONS-NFR1` hold on a copy read with no
  connection, in the same three engines, on devices set to two languages and two time zones, with
  the same results as on Node.js. The checks on a phone are left to Milestone Web-1.5.

#### Milestone Web-1.2 — Places

- The build of the places, `npm run build-places`, makes every country's towns from GeoNames and
  every airport from OurAirports, each airport in the time zone of the nearest town in its country.
  Its files, built from the data of 2026-11-16, are in `apps/web/places/`, and each build of the web
  app serves them beside its own files.
- `web/places` is built in `@itinero/web`, as its specification gives it. Each town in its files
  carries its population.
- Its test suite proves each requirement of `web/places` by the verification it carries, except the
  check of `WEB:PLACES-NFR1` on a phone. Its tests of fetching run in Chromium, WebKit and Firefox,
  with a stand-in for the trip store.

#### Milestone Web-1.1 — The shell

- `@itinero/web` is started, in `apps/web/`, with Preact and Vite, and is served by the Worker of
  the online side as its static files. Every path under `/api/` goes to the Worker, and every other
  path to the web app.
- `web/shell` is built in it, as its specification gives it, with a service worker written by hand,
  the web app's manifest and icons, and the time-zone rules: those each version carries, and the
  newest fetched.
- Its test suite proves each requirement of `web/shell` by the verification it carries, in
  Chromium, WebKit and Firefox, against a stand-in for the online side. It leaves the checks that
  need a phone, or the trip store and the screens, to later milestones.
- `SHR:TRIP-TIME-NFR1` holds with no connection in the same three engines, with the rules the shell
  keeps. The check on a phone is left to Milestone Web-1.5.
- The Worker's own module exports only its handlers.

### Phase 0 — Design

#### Milestone Web-0.2 — A trial on a real phone

- A trial app and a trial Worker, deployed to Cloudflare's free plan, signed a traveller in with
  Google, held one page in a Durable Object, Cloudflare's object with storage of its own that
  handles one request at a time, brought an iPhone's copy of the page up to date, and
  showed it with no connection. Nothing of the trial became `@itinero/web` or the online side.
- Google's button signs a traveller in from an iPhone's home screen as it does in Safari. It opens
  a second window, which gives back to Itinero the ID token, Google's signed statement of who signed
  in (`spec/web/screens.md` §4.1). The online side therefore needs no way of its own to send a
  traveller to Google's sign-in page and back.
- Adding Itinero to an iPhone's home screen carries Safari's session into it, so a traveller signed
  in in Safari need not sign in once more there (`spec/web/shell.md` §4.3).
- Itinero, added to an iPhone's home screen and brought up to date, opens and shows its page with
  no connection after the phone is restarted.
- A Durable Object on the free plan is not held to the 10 milliseconds of processor time a Worker
  is. It loaded the rules file in 6 to 23 milliseconds, and read 500 rows in 1 to 4
  (`spec/planner/trip-host.md` §4.7).
- Nothing the trial found changes a decision.

#### Milestone Web-0.1 — Reading and changing a trip

- The web app is registered.
- A trip can be read on a phone with no connection, and changed only with one (ADR-0004, a trip
  is read-only offline).
- The web app fetches, stores and loads the time-zone rules file that `shared/trip-time` uses
  (ADR-0008, trip-time carries its own copy of the time-zone rules).
- A trip's copy on a device is protected by the device's own lock, every device keeps one, and
  signing out deletes it (ADR-0017, a trip's copy on a device is protected by the device's own
  lock, and deleted when its traveller signs out).
- The web app has its requirements. A traveller uses Itinero in the browser of a phone or a
  computer, and adds it to a phone's home screen. A device with no connection shows every trip it
  holds, says when each was brought up to date, and offers no change. The home page finds the
  phone's country on the phone itself, and never sends it.
- The web app is built with Preact and Vite, and served by Itinero's own Worker (ADR-0018, the web
  app is built with Preact, and served by Itinero's own Worker).
- The web app is divided into three components: `web/shell`, `web/trip-store` and `web/screens`.
  Each has its requirements and its specification, and all three are built as one package,
  `@itinero/web`.
- A place's time zone is filled in from a list of places on the device: every airport, and the
  towns of each country the device's trips visit (ADR-0019, a place's time zone is filled in from a
  list of places, kept on the phone one country at a time). A fourth component, `web/places`,
  holds it, in the same package.

## Pending

### Phase 1 — Build

#### Milestone Web-1.5 — The calendar, and the screens an admin manages a trip on

**Waits on:** Milestone Access-1.4

- Prove the web app's own requirements on a phone and on a computer. Prove there too the
  requirements of the planner, access and bookings systems that only a phone can prove.
- Prove the checks of `web/shell` that need a phone: adding Itinero to the home screen of an Android
  phone and of an iPhone, and the browser keeping Itinero's storage, for `WEB:SHELL-F3`, and opening
  Itinero ten times, each within 300 milliseconds, on a phone at least four years old, for
  `WEB:SHELL-NFR1`. Milestone Web-1.1 proved the rest of `web/shell` in three browser engines, and
  moved these checks here, since they need a phone.
- Prove `WEB:PLACES-NFR1` on a phone at least four years old, by the check of its verification.
  Milestone Web-1.2 proved the rest of `web/places`, and moved this check here, since it needs a
  phone.
- Prove `WEB:SCREENS-F9` with Google's own button, signing in on a phone and on a computer, and
  `BKG:LIST-NFR2`, `BKG-NFR1` and `WEB:SCREENS-NFR1` on a phone at least four years old. Milestone
  Web-1.4 proved the rest of them, and moved these checks here, since they need a phone and
  Itinero's client identifier from Google.
- Prove `WEB:STORE-NFR1` on a phone at least four years old, and `PLN:ITINERARY-NFR1`,
  `PLN:PAGES-NFR1` and `ACC:PERMISSIONS-NFR1` on a phone with no connection, by the checks of their
  verifications that need a phone. Milestone Web-1.3 proved the rest of them, and moved these checks
  here, since they need a phone.
- Prove `SHR:TRIP-TIME-NFR1` on a phone, by the checks of its verification. Milestone Web-1.1
  proved it with no connection in three browser engines, and moved the check on a phone here.

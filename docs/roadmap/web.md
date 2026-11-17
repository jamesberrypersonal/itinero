# The web app's roadmap

**Kept by:** James Berry

The web app is what travellers use on a computer or a phone, including reading a trip with no
connection. Phase 0 designs it: its requirements, its components and their specifications, before
any of it is built. It ends with a trial on a real phone, of what the design cannot settle on paper.
Phase 1 builds it, one component at a time.

The web app shows what the planner holds and what the access system allows. Its design follows
theirs, in Milestone Planner-0.2 and Milestone Access-0.1.

## Completed

### Phase 1 — Build

#### Milestone Web-1.2 — Places

- The build of the places, `npm run build-places`, makes every country's towns from GeoNames and
  every airport from OurAirports, each airport in the time zone of the nearest town in its country.
  Its files, built from the data of 2026-11-16, are in `apps/web/places/`, and each build of the web
  app serves them beside its version.
- `web/places` is built in `@itinero/web`, as its specification gives it. Each town in its files
  carries its population, so that the towns of two countries are ordered against each other.
- Its test suite proves each requirement of `web/places` by the verification it carries, the fetch
  tests in Chromium, WebKit and Firefox against a stand-in trip store, except the check of
  `WEB:PLACES-NFR1` on a phone.

#### Milestone Web-1.1 — The shell

- `@itinero/web` is started, in `apps/web/`, with Preact and Vite, and is served by the Worker of
  the online side as its static files. Every path under `/api/` goes to the Worker, and every other
  path to the web app.
- `web/shell` is built in it, as its specification gives it, with a service worker written by hand,
  the web app's manifest and icons, and the two copies of the time-zone rules on a device.
- Its test suite proves each requirement of `web/shell` by the verification it carries, in
  Chromium, WebKit and Firefox, against a stand-in for the online side. It leaves the checks that
  need a phone, or the trip store and the screens, to later milestones.
- `SHR:TRIP-TIME-NFR1` holds with no connection in the same three engines, with the rules the shell
  keeps. The check on a phone is left to Milestone Web-1.5.
- The Worker's own module exports only its handlers, since the Workers runtime reads each named
  export as an entrypoint. Wrangler could not start the Worker before.

### Phase 0 — Design

#### Milestone Web-0.2 — A trial on a real phone

- A trial app and a trial Worker, deployed to Cloudflare's free plan, signed a traveller in with
  Google, held one page in a Durable Object, brought an iPhone's copy of the page up to date, and
  showed it with no connection. Nothing of the trial became `@itinero/web` or the online side.
- Google's button signs a traveller in from an iPhone's home screen as it does in Safari, in a
  second window that gives the ID token back to Itinero (`spec/web/screens.md` §4.1). The online
  side therefore needs no request for a sign-in through Google's own page.
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
  list of places, kept on the phone one country at a time). `web/places` holds it.

## Pending

### Phase 1 — Build

#### Milestone Web-1.3 — A trip's copy on a device

**Waits on:** Milestone Planner-1.4, Milestone Access-1.3

- Build `web/trip-store`, as its specification gives it, and start `web/places` from it, as
  `spec/web/places.md` §3.3 gives.
- Prove each requirement of `web/trip-store` by the verification it carries.
- Prove `PLN:ITINERARY-NFR1` on a phone with no connection, by the checks of its verification that
  need one. Milestone Planner-1.2 proved the rest of `planner/itinerary`, and moved these checks
  here, since they need a trip's copy on the device.
- Prove `PLN:PAGES-NFR1` on a phone with no connection, by the checks of its verification that
  need one. Milestone Planner-1.3 proved the rest of `planner/pages`, and moved these checks here,
  for the same reason.
- Prove `ACC:PERMISSIONS-NFR1` on a phone with no connection and in a browser, by the checks of its
  verification that need them. Milestone Access-1.2 proved the rest of `access/permissions`, and
  moved these checks here, for the same reason.

#### Milestone Web-1.4 — The screens a traveller reads a trip on

**Waits on:** Milestone Bookings-1.5

- Build the first screens of `web/screens`, as its specification gives them: signing in and
  choosing the name other travellers see, accepting an invitation, the list of trips and a new trip,
  the home page, the bookings, the pages of research with their search, and the settings.
- Prove the checks of `WEB:SHELL-F5` that need a trip's copy and the screens: that every trip the
  device holds still opens while a new version is required, that no screen offers to change one,
  and that the new version brings every trip up to date. Milestone Web-1.1 proved the rest of
  `WEB:SHELL-F5`, and moved these checks here, since they need the trip store and the screens. Its
  browser test of `WEB:SHELL-F1` opens each new screen with no connection.
- Prove the requirements of `web/screens` those screens meet, by the verification each carries:
  `WEB:SCREENS-F1`, `WEB:SCREENS-F2`, `WEB:SCREENS-F4`, `WEB:SCREENS-F5`, and `WEB:SCREENS-F7` to
  `WEB:SCREENS-F10`.
- Prove `BKG:LIST-NFR2` on a phone at least four years old, by the checks of its verification.
  Milestone Bookings-1.5 proved the rest of `bookings/list`, and moved these checks here, since they
  need a phone.
- Prove the bookings system's requirements that need the bookings page or a phone, by the
  verification each carries: `BKG-F2`, `BKG-F3`, `BKG-F4`, `BKG-F6` and `BKG-NFR1`, and the check
  of `BKG-F5` that a removed booking is gone from every traveller's bookings page. Milestone
  Planner-1.4 proves the rest of the bookings system.

#### Milestone Web-1.5 — The calendar, and the screens an admin manages a trip on

- Build the rest of `web/screens`: the calendar, the members and their access, inviting a traveller,
  and the graveyard of deleted pages. An admin is a traveller who may manage the trip.
- Prove `WEB:SCREENS-F3` and `WEB:SCREENS-F6`, and the non-functional requirements of
  `web/screens`, by the verification each carries.
- Prove the web app's own requirements on a phone and on a computer. Prove there too the
  requirements of the planner, access and bookings systems that only a phone can prove.
- Prove the checks of `web/shell` that need a phone: adding Itinero to the home screen of an
  Android phone and of an iPhone, and the browser keeping Itinero's storage, for `WEB:SHELL-F3`,
  and opening Itinero ten times within 300 milliseconds on a phone at least four years old, for
  `WEB:SHELL-NFR1`. Milestone Web-1.1 proved the rest of `web/shell` in three browser engines, and
  moved these checks here, since they need a phone.
- Prove `WEB:PLACES-NFR1` on a phone at least four years old, by the check of its verification.
  Milestone Web-1.2 proved the rest of `web/places`, and moved this check here, since it needs a
  phone.
- Prove `SHR:TRIP-TIME-NFR1` on a phone, by the checks of its verification. Milestone Web-1.1
  proved it with no connection in three browser engines, and moved the check on a phone here.

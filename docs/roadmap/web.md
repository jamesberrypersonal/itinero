# The web app's roadmap

**Kept by:** James Berry

The web app is what travellers use on a computer or a phone, including reading a trip with no
connection. Phase 0 designs it: its requirements, its components and their specifications, before
any of it is built. It ends with a trial on a real phone, of what the design cannot settle on paper.
Phase 1 builds it, one component at a time.

The web app shows what the planner holds and what the access system allows. Its design follows
theirs, in Milestone Planner-0.2 and Milestone Access-0.1.

## Completed

### Phase 0 — Design

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

### Phase 0 — Design

#### Milestone Web-0.2 — A trial on a real phone

- Write a trial app and a trial Worker, deployed to Cloudflare's free plan, that do one thing of
  each kind the design rests on: sign a traveller in with Google, hold one page in a Durable Object,
  catch a phone up, and show the page with no connection. The trial is thrown away. Nothing of it
  becomes `@itinero/web` or the online side.
- Try signing in with Google's button on an iPhone, in Safari and from the home screen, and on an
  Android phone. Close the item that `spec/web/screens.md` §8 and `spec/access/accounts.md` §8 leave
  open. Where the button fails from the home screen, add the request it needs to
  `spec/access/accounts.md`.
- Add the trial app to an iPhone's home screen, catch it up, and confirm it opens and shows its page
  with no connection, after the phone is restarted.
- Measure the processor time of the trial's Durable Object on the free plan. Measure a request that
  loads a file the size of the time-zone rules, and one that reads 500 rows. Close the item that
  `spec/planner/trip-host.md` §8 leaves open.
- Record what the trial found in each specification it changes, and in a decision record where it
  changes a decision.

### Phase 1 — Build

#### Milestone Web-1.1 — The shell

**Waits on:** Milestone Planner-1.1, Milestone Access-1.1

- Start `@itinero/web`, in `apps/web/`, with Preact and Vite, served by the Worker of the online
  side.
- Build `web/shell` in it, as its specification gives it: launching with no connection, adding it
  to a phone's home screen, and keeping the time-zone rules up to date.
- Prove each requirement of `web/shell` by the verification it carries.

#### Milestone Web-1.2 — Places

- Write the build that makes the lists of airports and towns, and build `web/places`, as its
  specification gives them.
- Prove each requirement of `web/places` by the verification it carries.

#### Milestone Web-1.3 — A trip's copy on a device

**Waits on:** Milestone Planner-1.4, Milestone Access-1.3

- Build `web/trip-store`, as its specification gives it.
- Prove each requirement of `web/trip-store` by the verification it carries.

#### Milestone Web-1.4 — The screens a traveller reads a trip on

**Waits on:** Milestone Bookings-1.5

- Build the first screens of `web/screens`, as its specification gives them: signing in and
  choosing a name, accepting an invitation, the list of trips and a new trip, the home page, the bookings, the pages of
  research with their search, and the settings.
- Prove the requirements of `web/screens` those screens meet, by the verification each carries:
  `WEB:SCREENS-F1`, `WEB:SCREENS-F2`, `WEB:SCREENS-F4`, `WEB:SCREENS-F5`, and `WEB:SCREENS-F7` to
  `WEB:SCREENS-F10`.

#### Milestone Web-1.5 — The calendar, and the screens an admin manages a trip on

- Build the rest of `web/screens`: the calendar, the members and their access, inviting a traveller,
  and the graveyard.
- Prove `WEB:SCREENS-F3` and `WEB:SCREENS-F6`, and the non-functional requirements of
  `web/screens`, by the verification each carries.
- Prove the web app's own requirements, and those of the planner, access and bookings systems that
  need a phone, on a phone and on a computer.

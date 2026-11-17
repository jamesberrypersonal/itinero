# The screens

**Assumes** [screens.md](../../requirements/web/screens.md) — what the screens promise, and the parts of a trip they show.

## 1. Purpose

The screens are the part of the web app a traveller sees and uses. They draw each trip's copy, which
`web/trip-store` gives, with Preact, and turn each thing a traveller does into a change for the
trip's packages, sent through the trip store. They also find the country the phone is in, on the
phone itself.

## 2. Scope

The screens cover signing in and out, the list of trips, creating a trip, a trip's home page, its
calendar, its bookings, its pages and graveyard, its members and their access, the traveller's
choice of clock and date order, and finding the phone's country.

Three things act on them:

- **A traveller**, through the screens of §3.1.
- **`web/trip-store`** gives each trip's copy, and tells the screens when it changes or the device
  goes offline.
- **`web/shell`** says when Itinero is ready offline, when a new version waits or is required, and
  when to suggest adding Itinero to an iPhone's home screen.

Deliberately absent:

- keeping or catching up a copy, or sending a request, which `web/trip-store` does. The only
  requests the screens send themselves are those of signing in and of choosing a name (§4.1, §4.8)
- deciding what a traveller may do. The screens ask `access/permissions` only to choose what to
  offer, and the copy held online decides
- the rules of each part of a trip, which the planner's, the access system's and the bookings
  system's packages hold
- finding the city the phone is in

The screens are written in TypeScript with Preact, built with Vite as part of `@itinero/web`
(ADR-0018, the web app is built with Preact, and served by Itinero's own Worker). A trip's home page
follows each traveller's own dates, and finds the country on the phone (ADR-0014, a trip opens on a
home page for each traveller). The calendar is shown only to a traveller an admin grants it, and
bookings have a page of their own (ADR-0013, a trip's bookings have a page of their own, and its
calendar is seen only by the travellers an admin chooses).

## 3. Interface

### 3.1 User interface

Each screen has an address in the web app, so a traveller can return to it, and a link can name it:

| Address | Screen |
|---|---|
| `/sign-in` | Signing in with Google (§4.1) |
| `/` | The list of trips, and a new trip (§4.2) |
| `/trips/{trip}` | The trip's home page (§4.3) |
| `/trips/{trip}/calendar` | The calendar, for a traveller granted it (§4.4) |
| `/trips/{trip}/bookings` and `/trips/{trip}/bookings/{booking}` | The bookings page, and one booking (§4.5) |
| `/trips/{trip}/pages` and `/trips/{trip}/pages/{page}` | The tree of pages, and one page (§4.6) |
| `/trips/{trip}/search` | Searching the pages (§4.6) |
| `/trips/{trip}/graveyard` | The deleted pages the traveller could see (§4.6) |
| `/trips/{trip}/members` | The members, and for an admin their access and the invitations (§4.7) |
| `/settings` | The traveller's name, the clock and date order, and signing out (§4.8) |
| `/name` | Choosing a name, at the first sign-in (§4.1) |
| `/invitations/{invitation}` | Accepting an invitation, from its email (§4.7) |

Every screen of a trip has a bar along its foot on a phone, and down its side on a computer, linking
to the home page, the calendar where the traveller is granted it, the bookings, the pages and the
members. Each also has a menu, holding the settings, the list of trips and signing out. A screen
wider than 720 pixels lays itself out for a computer.

### 3.2 Application interface

None. Every request but those of signing in and choosing a name goes through `web/trip-store`
(§3.4).

### 3.3 Programming interface

None. The screens are the top of the web app, and nothing calls them.

### 3.4 Systems this drives

- **`web/trip-store`**, through its functions in `spec/web/trip-store.md` §3.3.
- **`access/accounts`**, for signing in, with `POST /api/auth/nonce` and `POST /api/auth/sign-in`,
  and for choosing a name, with `PUT /api/auth/name`, as `spec/access/accounts.md` gives.
- **Google Identity Services**, Google's script that draws the Sign in with Google button and gives
  the web app an ID token: a signed statement from Google of who signed in, which
  `access/accounts` checks. Google's own documentation for Sign in with Google gives the detail.
- **The Geolocation API**, the browser's `navigator.geolocation`, which gives the device's position
  once the traveller allows it, with or without a connection where the device has its own fix.

## 4. Behaviour

Behaviour crossing every screen:

- **Offline.** While `web/trip-store`'s `isOnline()` is false, every screen of a trip shows a bar
  saying it is offline, and when the copy was last caught up, from `caughtUp`. Every control that
  changes the trip is left out, not greyed (`WEB:SCREENS-F1`).
- **A version too old.** While `web/shell`'s `updateRequired` is true, every screen shows a bar in
  place of the offline one. It says Itinero needs a new version before it can reach the
  traveller's trips, and that they should copy any text they are writing somewhere safe first. Its
  button, Update now, calls the shell's `applyUpdate`, and shows once `updateWaiting` is true. Every
  control that changes a trip is left out, as offline, except the editor a traveller already has
  open, which keeps its text until the traveller updates. Updating reloads every window, which the
  bar says (`WEB:SHELL-F5`).
- **What to offer.** A control that changes something is shown only where `access/permissions`'
  `authorise` allows it. It is asked of the copy's grants, its pages and `you`, the traveller's own
  roles and grant (`spec/web/trip-store.md` §3.3). Where the copy held online still refuses a
  change, the screen shows the refusal's message.
- **Revisions.** A page, a firm item and a booking each carry a `revision`, which each change to it
  raises. A form keeps the revision it was opened from, and sends it with its change. The copy held
  online refuses a change made from an older revision with `stale`, giving the item as it now
  stands and its revision.
- **Times.** Every time is written with trip-time's `format`, and every duration with
  `formatDuration`, in the traveller's style: their choice of clock and date order, in §4.8
  (`WEB:SCREENS-F7`).
- **Asking first.** A delete or a removal opens a dialog, drawn by the web app rather than the
  browser's own, saying what will go, with Cancel as its first choice (`WEB:SCREENS-F8`).

### 4.1 Signing in and out

*Invoked from:* opening Itinero with no account, a trip's menu, and `/settings`.

The sign-in screen first asks `POST /api/auth/nonce`, which gives a nonce and Itinero's client
identifier at Google. It loads Google Identity Services, and draws its button with that identifier.
The button opens Google's sign-in in a second window and gives the ID token back to the screen. It
does so from an iPhone's home screen as well as in Safari, as Milestone Web-0.2's trial showed. On a
computer, where the screen is wider than 720 pixels and the device also has no touch screen, so that
a tablet held sideways is not counted, it says that the trips it opens stay on the computer until
the traveller signs out (`WEB:SCREENS-F9`). A sign-in asks `POST /api/auth/nonce`, gives the nonce
to Google, and sends the ID token with `POST /api/auth/sign-in`. On success it calls the trip
store's `signedIn`. Where the sign-in gives `named` as false, it opens `/name` first. Otherwise it
opens the screen the traveller came for, such as an invitation, or the list of trips.

`/name` asks for the name other travellers will see, filled with the `name` the sign-in gave, and
sends it with `PUT /api/auth/name`. Until it is saved, the name the sign-in gave is kept in
`localStorage` as `itinero-name-owed`. While it is kept, the screens open `/name` before any other
screen, starting from that name. Saving the name, or signing out, deletes it. A `bad-name` refusal
shows its message beside the box. Once the name is set, the screen the traveller came for opens, so
an invitation is accepted only after its new member has chosen their name (`WEB:SCREENS-F10`,
`ACC-F13`). `/name` offers no way to any other screen until the name is saved. A traveller who
closes Itinero there keeps `named` false, and is asked again the next time Itinero opens.

Signing out calls the trip store's `signOut`, which deletes every trip, and opens the sign-in
screen.

### 4.2 The list of trips

*Invoked from:* `/`, and from signing in.

The list shows each trip of the trip store's `trips`, with its name and dates, newest first. While
`web/shell`'s `suggestInstall` is true, it shows the notice that says how to add Itinero to the home
screen.

A new trip asks for its name, its first and last dates, and its countries, chosen from the
itinerary's `countries()` by typing part of a name (`PLN-F10`). It calls the trip store's `create`,
which catches up and lists the new trip.

### 4.3 The home page

*Invoked from:* opening a trip.

The home page shows (`WEB:SCREENS-F2`):

- **the traveller's day.** Today is the device's own date, read from its clock and time zone.
  Against the traveller's own dates, from the copy's `mine`, it says `3 days to go`, `Day 4 of 8`,
  or `Your trip is over`
- **their bookings.** Of the bookings naming the traveller, those of the bookings package's `onDate`
  for today, then the first three of its `notOver` whose `first` is after today. `notOver` takes the
  moment now, from the device's clock, made as `spec/bookings/list.md` §4.4 gives
- **their country**, once found, as below

The country is found only when the traveller taps Find the country I'm in. The screen then asks
`navigator.geolocation.getCurrentPosition`, with a position up to ten minutes old allowed, and the
phone's coarse position enough. It finds the country holding the position in the map of country
borders (§5.1), and links to the pages' `countryPage` for it, where the copy holds it. Once the
traveller has allowed the position, the screen finds the country each time the home page opens. That
the traveller allowed it is kept in the browser's `localStorage` as `itinero-find-country`. The
position and the country are held only in the page's memory, and never stored or sent (`WEB-F6`).

A traveller sets their own dates from the home page, within the trip's, as a `traveller-dates`
change, and the trip's creator changes the trip's dates there, as a `trip-dates` change. A refusal
naming the travellers whose dates would fall outside shows each of them (`PLN-F14`).

A position in no country and not near one, such as far out at sea, shows no country (§5.1). A
country the trip has no page for, or a page hidden from the traveller, shows the country's name
without a link.

The sign-in screen, the list of trips and the settings each end with a line holding the shell's
notice that Itinero is ready offline, its version and the release of its time-zone rules. The
sign-in screen and the list of trips show the shell's notice for an iPhone, so that a traveller
adds Itinero to the home screen before signing in.

### 4.4 The calendar

*Invoked from:* the calendar in a trip's bar, shown only where the copy holds a calendar.

The calendar lists the trip's days from its first date to its last, or across the itinerary's
`extent` where the trip has no dates, one week to a row on a computer and one day to a row on a
phone (`WEB:SCREENS-F3`). Each day shows:

- the countries of the itinerary's `layout` for the day
- each stretch covering it, as a band drawn with a dashed edge, which marks it pencilled
- its firm items and its bookings, as solid cards, in one order. The day's firm items whose `when` is
  a `day` come first, as `layout` gives them. Every other firm item and every booking follow, sorted
  together by trip-time's `sort` on the firm item's `when` and the booking's `starts`. A booking
  shows on every date from its extent's `first` to its `last` (`PLN-F5`)

A stretch or a firm item that names a page links to it, and the link shows not available where the
pages' `state` is not `tree`, being in the graveyard or absent, or the page is hidden (`PLN-F11`). A
traveller with edit access to the calendar drags a stretch's ends to resize it, or taps it to change
its place or dates, and adds a stretch or a firm item from a day (`PLN-F1`, `PLN-F3`, `PLN-F4`). A
firm item of travel asks how it goes, and for each end its place and its time, with the zone filled
in as §4.5 gives. The calendar shows its duration, the itinerary's `travelDuration`, as trip-time's
`formatDuration` writes it. A firm item's form sends a `change-firm` with the revision it was opened
from. A `stale` refusal shows the item as it now stands, from `details.item`, beside the traveller's
own, to start again from (`PLN:ITINERARY-F11`). A traveller with no calendar in their copy has no
calendar in their bar, and its address opens the home page.

### 4.5 The bookings

*Invoked from:* the bookings in a trip's bar, and a booking on the home page or the calendar.

The bookings page lists the copy's bookings, which are those naming the traveller, or every booking
for an admin, in the order of the bookings' `order`, under the date of
each one's `first`, with its `last` where they differ (`BKG-F3`). It scrolls on opening to the
first booking of `notOver`. Each booking shows its `label`, its times, and its travellers.

A booking's own screen shows every detail, among them a reference, a link to the provider's page and
a page of the trip, where it has them. A flight shows each leg with `legDurations`, and each
connection with `connections`, and a journey its `journeyDuration` (`BKG:FLIGHT-F3`). Its
reference is a button that copies it with the browser's `navigator.clipboard`. Its link opens in a
new tab, and its page opens as §4.6 gives (`WEB:SCREENS-F4`). A page the traveller may not see, or
one in the graveyard, is shown as Not available, without its title (`ACC-F8`).

Adding a booking asks first for its kind, then shows that kind's form (`BKG-F1`). The booking names,
to start, only the traveller adding it. They choose any others from the copy's members. A time asks
for its precision, its date, its clock times and its time zone. The zone is filled in from
`web/places`, the component that knows the time zone of each airport and town the device holds: from
an airport's code for a flight, and from the town typed for a journey's ends, a stay or an activity,
which `towns` suggests as the traveller types. The traveller can choose another zone from
trip-time's zones, by typing part of a city's name, and does so for a place `web/places` does not
hold (`WEB-F9`). A firm item's times on the calendar are filled in in the same way. The form sends
an `add`, or a `change` with the revision the screen was opened from, as the bookings'
`changeToText` writes it. A `stale` refusal shows the booking as it now stands, from
`details.booking`, beside the traveller's own, to start again from (`BKG-F5`).

### 4.6 The pages

*Invoked from:* the pages in a trip's bar, a link, a search, and the home page's country.

The tree of pages is the pages' `tree` of the copy, each branch folded or open. A traveller with
edit access drags a page to move it. The move is sent with no `agreed`. Where the copy held online
refuses it with `agree-first`, the screen says how many more travellers will see the page, from
`details.count`. It sends the move again, with `agreed` set to that number, once the traveller
confirms (`ACC-F9`). The device never counts them itself, because a copy holds only its own
traveller's access unless they are an admin.

A page shows its title and its text drawn from Markdown with micromark, with its extension for
GitHub's tables and lists. micromark writes no HTML found in the text, which is shown as the text it
is (`WEB:SCREENS-NR4`). It also empties the destination of every link that is not an `http:`, an
`https:` or a `mailto:` address, or an address within the page. The screens leave micromark's
settings for both as they are.

micromark gives the page as HTML, and the screens then go through its links. Where the pages'
`linkTarget` reads a page's identifier from a link's destination, the link is to a page of the
trip. It opens that page where the page
is in the copy's tree, and otherwise shows Page not available, without a title (`PLN-F9`,
`ACC-F8`). Every other link opens in a new tab, with no referrer.

A page is edited as its Markdown text, in a plain text box, with the formatted page beside it on a
computer and a tab to switch on a phone. Saving sends a `write` with the revision the editor was
opened from. A `stale` refusal shows the traveller's text and the page's text as it now stands, side
by side, from `details.text`, and the traveller saves again from the revision `details.revision`
gives (`PLN-F16`).

Search runs the pages' `search` over the copy, with or without a connection, and lists each page
found with the words around each match (`PLN-F12`). The graveyard lists the titles of the copy's
`graveyard`, each with the number of pages that went with it. An admin, online, opens a page there
with the trip store's `buried`, and restores it with a `restore` change (`PLN-F13`).

### 4.7 The members and their access

*Invoked from:* the members in a trip's bar, and the link in an invitation's email.

The members screen lists the copy's members by name, with the creator and the admins marked
(`ACC-F2`). A former member, one with `removed`, is not listed there. Every other screen names a
traveller in the same way, such as each traveller a booking names, and writes a former member's
name followed by `(left the trip)`. A booking form offers only the members still on the trip.

An admin also sees the open invitations, from the copy's `invitations`, and each member's access,
from the copy's `grants`. Online, an admin can:

- invite an address, with view or edit access to the trip and none, view or edit for the calendar
  (`ACC-F3`)
- withdraw an invitation, make a member an admin, or remove a member (`ACC-F11`)
- open a member, and set their access to the trip, their level for the calendar, and their level
  for any page, which covers the branch beneath it (`ACC-F5`, `ACC-F7`)

Where `access/permissions`' `applyGrant` refuses a level for a page with `hidden-above`, the screen
names the page above, whose level the admin must open up first.
Inviting, withdrawing, making an admin and removing are the trip store's `invite`, `withdraw`,
`makeAdmin` and `remove`. Every other change is a grant change to the trip, sent with the trip
store's `send`.

`/invitations/{invitation}` takes the token from the address the email gave, asks the traveller to
sign in where they have not, and to choose their name where they have not (§4.1), and accepts with
the trip store's `accept`. A
`wrong-account` refusal says which address the invitation was sent to.

### 4.8 The clock and date order

*Invoked from:* `/settings`.

The settings list the countries whose places the device holds, offer to fetch another while online
with `web/places`' `fetchCountry`, and say `Place names from GeoNames, under CC BY 4.0`.

The settings show the traveller's name, which they change online with `PUT /api/auth/name`. A trip
store catch-up then brings the new name to every trip's members (`WEB:SCREENS-F10`).

The traveller chooses a 12-hour or a 24-hour clock, and day first or month first (`WEB:SCREENS-F7`).
Until they choose, the clock follows the `hourCycle` the browser's `Intl.DateTimeFormat` gives for
the device's language, and the date order follows where that format puts the day. The choice is
kept in `localStorage` as `itinero-style`, which signing out leaves in place, since it holds nothing
of any trip.

### 4.9 The test suite

The screens' tests run in the suite of `apps/web/`, which `spec/web/shell.md` §4.5 describes.

- **Unit tests** cover the home page's day, the calendar's order of firm items and bookings, the
  default style, writing dates, finding a country, at positions inside, outside and near the border
  of each of a sample of countries, and the map's size.
- **Browser tests**, with Playwright, run every verification of `requirements/web/screens.md` that
  needs no real phone, at 360 pixels wide and at 1280, and watch every request for a position or a
  country (`WEB-F6`). They run against the online side in Wrangler, with stand-ins for Google's
  key set and for Resend, so a test signs travellers in with ID tokens of its own and accepts
  invitations from the emails the stand-in keeps. Google's own button cannot be drawn in a test, so
  a test gives the sign-in screen the token as the button would. The tests set the device's clock,
  its position and its connection. They also deploy a new version whose online side refuses the
version the device is running.
- **Safety tests** draw pages whose text holds HTML of every kind, and links to `javascript:` and
  `data:` addresses, and confirm none is drawn as HTML or kept as a link (`WEB:SCREENS-NR4`).
- **Timing tests** draw the home page of a trip of 500 pages and 300 bookings, and fail above 500
  milliseconds on the machine running them. The check on a phone of `WEB:SCREENS-NFR1` is made by
  hand before each release.

## 5. Resources

### 5.1 The map of country borders

The map is built from Natural Earth's countries at a scale of 1:50 million, which is in the public
domain. A build script, `npm run build-borders` in `apps/web/`, reads its shapefile and writes
`apps/web/src/screens/borders.json`:

- one entry for each country, keyed by its ISO 3166-1 alpha-2 code, taken from the field Natural
  Earth names `ISO_A2_EH`
- each entry's outline as rings of points, with each coordinate rounded to two decimal places, about
  a kilometre
- each entry's bounding box, so that a position is tested only against the countries whose box
  holds it

A position is in a country where it is inside an odd number of the country's rings, counted by
casting a ray east from it. Where two countries hold it, the one with the smaller bounding box is
the one, since an enclave, such as Vatican City inside Italy, is drawn inside the country around it.
The map draws each coast coarsely, and puts the centre of a coastal city such as Lisbon at sea. A
position in no country, but within about 10 kilometres of one, is therefore in the nearest. The file
is one of the files of each version of the web app, which `web/shell`'s service worker keeps on the
device before Itinero says it is ready offline. The country is therefore found with no connection
from the first launch. The screens read the file into memory only once the traveller first asks for
their country (`WEB:SCREENS-NFR2`).

Natural Earth draws each border as it stands on the ground. A traveller in a disputed place is shown
the country that holds it.

### 5.2 Where it lives

| Resource | Path | Owned by |
|---|---|---|
| The screens | `apps/web/src/screens/` | Whoever keeps the web app's roadmap |
| The map of country borders | `apps/web/src/screens/borders.json`, built by `npm run build-borders` | Whoever keeps the web app's roadmap |
| The traveller's style | `localStorage`, `itinero-style` | The device's browser |
| Finding the country on opening | `localStorage`, `itinero-find-country` | The device's browser |
| A name not yet chosen | `localStorage`, `itinero-name-owed`, deleted once the name is chosen or on signing out | The device's browser |

The screens' runtime dependencies are Preact, micromark and its extension for GitHub's Markdown,
and the packages of the trip's parts, which `spec/web/shell.md` §5 lists.

## 6. Quality attributes

- **Nothing a page writes runs** (`WEB:SCREENS-NR4`). micromark writes no HTML from a page's text,
  and empties the destination of a link that would run a script. Every link outside the trip opens
  in a new tab with no referrer.
- **The location stays on the phone** (`WEB-F6`). The country is found from a file already on the
  phone, and neither the position nor the country is stored or sent.
- **Nothing offered that would be refused** (`WEB:SCREENS-F1`). Controls follow `authorise` and the
  connection.
- **Quick to draw** (`WEB:SCREENS-NFR1`). The home page reads only today's and the next bookings,
  and the calendar and the bookings page draw the rows on screen first.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [WEB:SCREENS-F1](../../requirements/web/screens.md#^web-screens-f1) | The layouts of §3.1, and offline, in §4. |
| [WEB:SCREENS-F2](../../requirements/web/screens.md#^web-screens-f2) | The home page, in §4.3, and the map of §5.1. |
| [WEB:SCREENS-F3](../../requirements/web/screens.md#^web-screens-f3) | The calendar, in §4.4. |
| [WEB:SCREENS-F4](../../requirements/web/screens.md#^web-screens-f4) | The bookings page, a booking's screen and its forms, in §4.5. |
| [WEB:SCREENS-F5](../../requirements/web/screens.md#^web-screens-f5) | The pages, search and graveyard, in §4.6. |
| [WEB:SCREENS-F6](../../requirements/web/screens.md#^web-screens-f6) | The members screen, in §4.7, with each member's access from an admin's copy, and asking before a move, in §4.6. |
| [WEB:SCREENS-F7](../../requirements/web/screens.md#^web-screens-f7) | The style of §4.8, used for every time (§4). |
| [WEB:SCREENS-F8](../../requirements/web/screens.md#^web-screens-f8) | Asking first, in §4. |
| [WEB:SCREENS-F9](../../requirements/web/screens.md#^web-screens-f9) | Signing in and out, in §4.1. |
| [WEB:SCREENS-F10](../../requirements/web/screens.md#^web-screens-f10) | `/name` at the first sign-in, before an invitation is accepted (§4.1, §4.7), and changing the name in the settings (§4.8). |
| [ACC-F13](../../requirements/access/access.md#^acc-f13) | Asking for a name at the first sign-in, and changing it later (§4.1, §4.8). |
| [WEB:SHELL-F5](../../requirements/web/shell.md#^web-shell-f5) | The bar and its button, and no control that changes a trip while a new version is required (§4). |
| [WEB:SCREENS-NFR1](../../requirements/web/screens.md#^web-screens-nfr1) | Drawing what is on screen first (§6), and the timing tests of §4.9. |
| [WEB:SCREENS-NFR2](../../requirements/web/screens.md#^web-screens-nfr2) | The map's rounded coordinates (§5.1). |
| [WEB-F1](../../requirements/web/web.md#^web-f1) | Every screen at a phone's width and a computer's (§3.1). Adding Itinero to a home screen is `web/shell`. |
| [WEB-F2](../../requirements/web/web.md#^web-f2) | The offline bar, and no control that changes the trip (§4). The copy is `web/trip-store`. |
| [WEB-F4](../../requirements/web/web.md#^web-f4) | Drawing each copy the trip store gives as it changes (§1). Taking the change is `web/trip-store`. |
| [WEB-F5](../../requirements/web/web.md#^web-f5) | The notice on a computer at sign-in (§4.1). Deleting the trips is `web/trip-store`. |
| [WEB-F6](../../requirements/web/web.md#^web-f6) | Finding the country on the phone, and never storing or sending it (§4.3, §5.1). |
| [WEB-F7](../../requirements/web/web.md#^web-f7) | The style of §4.8. |
| [WEB-F9](../../requirements/web/web.md#^web-f9) | Filling each zone in from `web/places`, and letting the traveller choose another (§4.5). |
| [WEB-NFR1](../../requirements/web/web.md#^web-nfr1) | Drawing the home page within 500 milliseconds (§6). Opening and reading the copy are `web/shell` and `web/trip-store`. |
| [WEB-NFR2](../../requirements/web/web.md#^web-nfr2) | The map of §5.1, at most 500 kilobytes. The rest of the download is `web/shell`. |
| [WEB-NFR3](../../requirements/web/web.md#^web-nfr3) | The browser tests of §4.9, in the three engines `spec/web/shell.md` §4.5 names. |
| [PLN-F1](../../requirements/planner/planner.md#^pln-f1) | Stretches shown pencilled, and moved and resized (§4.4). |
| [PLN-F2](../../requirements/planner/planner.md#^pln-f2) | Each day's countries (§4.4). |
| [PLN-F3](../../requirements/planner/planner.md#^pln-f3) | Adding a firm item from a day (§4.4). |
| [PLN-F4](../../requirements/planner/planner.md#^pln-f4) | Entering travel's two ends, and showing its duration (§4.4). |
| [PLN-F5](../../requirements/planner/planner.md#^pln-f5) | Firm items and bookings in one order, apart from the stretches, on every date each covers (§4.4). |
| [PLN-F6](../../requirements/planner/planner.md#^pln-f6) | Drawing each change as the trip store takes it (§1). |
| [PLN-F7](../../requirements/planner/planner.md#^pln-f7) | Pages drawn from Markdown, and edited as text (§4.6). |
| [PLN-F8](../../requirements/planner/planner.md#^pln-f8) | The tree, moving a page, and asking before a delete (§4, §4.6). |
| [PLN-F9](../../requirements/planner/planner.md#^pln-f9) | Opening a page from a link (§4.6). |
| [PLN-F10](../../requirements/planner/planner.md#^pln-f10) | Choosing a new trip's countries (§4.2). |
| [PLN-F11](../../requirements/planner/planner.md#^pln-f11) | Opening a stretch's or a firm item's page (§4.4). |
| [PLN-F12](../../requirements/planner/planner.md#^pln-f12) | Search, with or without a connection (§4.6). |
| [PLN-F13](../../requirements/planner/planner.md#^pln-f13) | The graveyard, and an admin's restore (§4.6). |
| [PLN-F14](../../requirements/planner/planner.md#^pln-f14) | Setting the trip's dates when it is created, and each traveller's own (§4.2, §4.3). |
| [PLN-F15](../../requirements/planner/planner.md#^pln-f15) | The home page's day, bookings and country (§4.3). |
| [PLN:ITINERARY-F11](../../requirements/planner/itinerary.md#^pln-itinerary-f11) | Both versions of a firm item, side by side, on a `stale` refusal (§4.4). |
| [PLN-F16](../../requirements/planner/planner.md#^pln-f16) | Both texts, side by side, on a `stale` refusal (§4.6). |
| [BKG-F1](../../requirements/bookings/bookings.md#^bkg-f1) | The form of each kind, naming the traveller adding it to start (§4.5). |
| [BKG-F3](../../requirements/bookings/bookings.md#^bkg-f3) | The bookings page, opening at the first not yet over (§4.5). |
| [BKG-F4](../../requirements/bookings/bookings.md#^bkg-f4) | A booking's screen, with its reference copied in one tap (§4.5). |
| [BKG-F5](../../requirements/bookings/bookings.md#^bkg-f5) | Asking before a removal, and showing the booking as it stands on `stale` (§4, §4.5). |
| [BKG-NFR1](../../requirements/bookings/bookings.md#^bkg-nfr1) | Drawing the rows on screen first (§6). |
| [BKG:FLIGHT-F3](../../requirements/bookings/flight.md#^bkg-flight-f3) | Each leg's duration and each connection on a flight's screen (§4.5). |
| [ACC-F1](../../requirements/access/access.md#^acc-f1) | Google's sign-in button, and signing in (§4.1). |
| [ACC-F2](../../requirements/access/access.md#^acc-f2) | Every member listed, with the admins marked (§4.7). |
| [ACC-F3](../../requirements/access/access.md#^acc-f3) | Inviting, and accepting from the email (§4.7). |
| [ACC-F5](../../requirements/access/access.md#^acc-f5) | Granting the calendar, and showing it only where the copy holds it (§4.4, §4.7). |
| [ACC-F7](../../requirements/access/access.md#^acc-f7) | Setting a member's level for a branch (§4.7). |
| [ACC-F8](../../requirements/access/access.md#^acc-f8) | Page not available, without a title (§4.6). |
| [ACC-F9](../../requirements/access/access.md#^acc-f9) | Saying how many more will see a moved page, and asking first (§4.6). |
| [ACC-F11](../../requirements/access/access.md#^acc-f11) | Removing a member, after asking first (§4, §4.7). |
| [SHR:TRIP-TIME-F8](../../requirements/shared/trip-time.md#^shr-trip-time-f8) | Choosing the style every time is written in (§4.8). |

## 8. Open

None. Nothing in this specification is undecided.

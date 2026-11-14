# The web app

What the web app promises to travellers. The web app is what travellers use to plan and follow a
trip, on a computer or a phone, in its browser. It shows what the planner, the access system and
the bookings system hold, and keeps a copy of each trip on the device to read with no connection.
The component registry, `components.md`, gives it the prefix `WEB`.

Two roles appear below, the traveller and the admin, which `requirements/README.md` defines. A
device is a phone or a computer a traveller signs in on. A trip, its calendar and its pages are the
planner's, the system that holds each trip. A trip's bookings are the bookings system's. Which
traveller may see or change each part of a trip is the access system's. Their requirements, in
`requirements/planner/planner.md`, `requirements/bookings/bookings.md` and
`requirements/access/access.md`, promise what a traveller can do with a trip. This document
promises what the web app adds: how it reaches a device, what it keeps there, and how it behaves
with no connection.

A device's copy of a trip holds what its traveller may see of the trip: their pages, the calendar
where an admin has granted it, and their bookings. A traveller reads it with no connection, and
changes a trip only with one (ADR-0004, a trip can be read without a connection, but changed only
with one).

---

## Functional requirements

### WEB-F1 — A traveller uses Itinero in the browser of a phone or a computer, and can add it to a phone's home screen

A traveller opens Itinero at its web address in the browser of a phone or a computer, with nothing
to install from an app store. Every screen fits and works on a phone's screen and on a computer's.
On a phone, a traveller can add Itinero to the home screen, from where it opens on its own, without
the browser's address bar. ^web-f1

- **Verification:** on a running system,
    - open Itinero on an iPhone in Safari, on an Android phone in Chrome, and on a computer, and
      confirm each signs in and opens a trip
    - on each phone, add Itinero to the home screen, open it from there, and confirm it opens
      without the address bar
    - on a phone held upright, open the home page, the calendar, the bookings page and a page of
      research, and confirm none needs scrolling sideways

> **What does this buy?** One app serves every traveller on every device, and costs nothing to put
> in an app store (ADR-0015, Itinero's online side runs on Cloudflare's free plan).

> **Why add it to the home screen?** On an iPhone, a site not added to the home screen can have its
> stored data cleared by Safari after some days unused. The copy of a trip lasts only once it is
> added (`WEB-F3`).

### WEB-F2 — A device with no connection shows every trip it holds, says when each was brought up to date, and offers no way to change it

A device with no connection opens every trip it holds, with every part of it its traveller may see,
as the trip stood when the device was last brought up to date. Each screen of the trip says that it
is offline, and when that was. While offline, the web app shows no way to change the trip. ^web-f2

- **Verification:** on a trip through Chile, with a traveller signed in on a phone,
    - bring the phone up to date, then take it offline, and confirm it opens the trip, with its home
      page, its bookings and its pages
    - confirm each screen says it is offline, and when the phone was last brought up to date
    - confirm no screen offers to change a page, a booking or the calendar
    - close the app, reopen it with no connection, and confirm the trip opens as before

> **What does this buy?** A traveller reads their trip on a bus, on a trek or in a country with no
> local SIM card, and knows how far to trust what they read (ADR-0004).

> **What about a change made while the traveller is reading?** The change waits on the copy held
> online, and reaches the phone once it connects (`WEB-F4`).

### WEB-F3 — A trip's copy stays on a device however long it goes unopened, until its traveller signs out

A trip's copy stays on a device for as long as its traveller is signed in there, however long the
device goes without opening the trip or connecting. On a phone, this holds once Itinero is added to
the home screen, and the web app tells a traveller on a phone how to add it until they have. ^web-f3

- **Verification:** on the trip of `WEB-F2`,
    - on an iPhone with Itinero added to the home screen, leave the app unopened and the phone
      offline for 14 days, then open it, and confirm the trip opens
    - on an iPhone using Itinero in Safari alone, confirm the web app says how to add it to the home
      screen, and why
    - on a computer, leave Itinero unopened for 14 days, then open it with no connection, and
      confirm the trip opens

> **What does this buy?** A traveller on a long trek, or a long stretch with no signal, keeps their
> trip however long they are offline (ADR-0017, a trip's copy on a device is protected by the
> device's own lock, and deleted when its traveller signs out).

### WEB-F4 — An open trip shows each change as soon as it is made, and a device catches up each time it connects

While a device has a trip open and a connection, a change any traveller makes to what the device's
traveller may see appears on it within a few seconds, without reloading. A device that connects
after time offline brings each trip it holds up to date at once. ^web-f4

- **Verification:** on the trip of `WEB-F2`, with two travellers each on their own device,
    - as the first, rename a page both may see, and confirm the second's device shows the new title
      within five seconds, without reloading
    - take the second's device offline, change a booking naming both, connect the device, and
      confirm it shows the change within five seconds, and says it is up to date

> **What does this buy?** Travellers planning together see each other's work as it happens
> (`PLN-F6`), and a phone that finds signal is brought up to date without being asked.

### WEB-F5 — Signing out deletes every trip from the device

When a traveller signs out on a device, the web app deletes every trip it holds there before
signing out. A device whose session has ended, after going unused for long enough, deletes every
trip it holds the next time it connects. Signing in on a computer says that its trips stay on it
until the traveller signs out. ^web-f5

- **Verification:** on the trip of `WEB-F2`,
    - on a phone, sign out, take the phone offline, and confirm no trip opens and nothing of the
      trip is left in the browser's storage for Itinero's site
    - on a phone whose session has ended while it was offline, connect it, and confirm every trip is
      deleted, and it asks the traveller to sign in
    - sign in on a computer, and confirm it says its trips stay on it until the traveller signs out

> **What does this buy?** A shared or borrowed computer keeps nothing once its traveller signs out,
> and a phone left unused does not keep a trip for ever (ADR-0017).

> **What protects the copy while the traveller is signed in?** The device's own lock, and nothing
> of Itinero's (`WEB-NR3`).

### WEB-F6 — The home page finds the country the phone is in on the phone itself, with or without a connection

When a traveller lets the web app read the phone's location, the home page works out the country the
phone is in on the phone, with or without a connection. No request the web app sends holds the
phone's location, or the country worked out from it. A traveller who does not let it read the
location sees no country, and the rest of the home page as usual. ^web-f6

- **Verification:** on the trip of `WEB-F2`, which holds a page made for Chile,
    - with the phone offline in Chile, open the home page, and confirm it links to the page for
      Chile
    - with the phone online, watch every request it sends while the home page is open, and confirm
      none holds the location or the country
    - refuse the location, and confirm the home page shows the traveller's day and bookings, and no
      country

> **What does this buy?** A traveller landing in a new country finds its research at once, even
> before buying a local SIM card, and nobody learns where they are (`PLN-F15`, ADR-0014, a trip
> opens on a home page for each traveller).

### WEB-F7 — Every time shows in the local time of its place, in the clock and date order the traveller chooses

Every date and time the web app shows is in the local time of the place it happens, with that
place's time zone, as `shared/trip-time` writes it. A traveller chooses a 12-hour or a 24-hour
clock, and whether a date is written day first or month first. Until they choose, both follow the
device's own settings. ^web-f7

- **Verification:** on a trip with a flight from Santiago to Madrid,
    - on a device set to a 24-hour clock, confirm the flight leaves at 23:40 Santiago time and
      arrives at 16:35 Madrid time
    - choose a 12-hour clock, and confirm it leaves at 11:40 pm and arrives at 4:35 pm
    - choose month first, and confirm the dates are written so
    - change the device's own time zone to Tokyo's, and confirm every time is unchanged

> **What does this buy?** A traveller reads each time as the clocks of its place will show it, in
> the form they read most easily (`SHR:TRIP-TIME-F8`).

### WEB-F8 — Every device uses the same time-zone rules, and works offline from its first launch

The web app carries the time-zone rules `shared/trip-time` needs, so that it orders and measures
times with no connection from its first launch. Whenever a device is online, it takes newer rules
if Itinero has them. Every device online since Itinero last published new rules uses the same
rules. ^web-f8

- **Verification:** on a running system,
    - open Itinero for the first time, take the device offline, and confirm a trip's times are shown
      and ordered
    - publish newer rules, bring the device online, and confirm it uses them
    - with the device offline, publish newer rules again, and confirm it keeps the rules it has
      until it connects

> **What does this buy?** Two travellers on one trip never see the same train at different times
> because their devices hold different rules (ADR-0008, trip-time carries its own copy of the
> time-zone rules, `SHR:TRIP-TIME-NFR2`).

### WEB-F9 — Entering an airport or a town fills in its time zone, with or without a connection

When a traveller enters an airport's three-letter code, or a town of 1,000 people or more in a
country their trips visit, the web app fills in its time zone beside the time, with or without a
connection. The traveller can choose another zone. For a place the web app does not know, they
choose the zone by hand. ^web-f9

- **Verification:** on a trip through Chile, on a phone with no connection,
    - add a flight from `SCL` to `PUQ`, and confirm the zones `America/Santiago` and
      `America/Punta_Arenas` are filled in
    - add a bus from Puerto Natales, and confirm `America/Punta_Arenas` is filled in
    - change the bus's zone to `America/Santiago`, and confirm the change is kept
    - add a stay in a town of Peru, which no trip visits, and confirm the zone is chosen by hand

> **What does this buy?** A traveller copies a booking in as the confirmation gives it, without
> knowing the name of every place's time zone (ADR-0019, a place's time zone is filled in from a
> list of places, kept on the phone one country at a time).

> **Why only the countries a trip visits?** The towns of the whole world would be several megabytes
> on every phone. Each trip needs only a few countries, and every airport is held, since a flight
> often leaves from outside them.

---

## Non-functional requirements

### WEB-NFR1 — A trip opens quickly on a phone with no connection

A trip holding 500 pages and 300 bookings opens on its home page within two seconds of tapping
Itinero on a phone with no connection. ^web-nfr1

- **Verification:** on a phone at least four years old, with no connection, and a trip holding
  500 pages and 300 bookings,
    - open Itinero from the home screen, and confirm the trip's home page shows within two seconds

> **What does this buy?** A traveller opens their trip at a desk or a gate, with people waiting
> (`BKG-NFR1`).

### WEB-NFR2 — The web app's first download is small enough for a slow connection

Opening Itinero for the first time, ready to read a trip with no connection afterwards, downloads at
most 3 megabytes before any trip, compressed as it is sent. ^web-nfr2

- **Verification:** on a running system,
    - with an empty browser, open Itinero, sign in, and measure every byte downloaded before a trip
      is fetched, and confirm it is at most 3 megabytes

> **What does this buy?** A traveller can set Itinero up on hotel Wi-Fi or a roaming connection. The
> map of country borders and the time-zone rules both travel in this download (`WEB-F6`, `WEB-F8`).

### WEB-NFR3 — The web app works in the browsers travellers' devices have

Every requirement of this document holds in the two newest versions of Safari on iPhone, Chrome on
Android, and Chrome, Safari, Firefox and Edge on a computer. ^web-nfr3

- **Verification:**
    - run every verification of this document in each of those browsers, and confirm each passes

> **What does this buy?** A companion joins a trip on whatever phone or computer they already have.

---

## Non-requirements

| Identifier | The web app does not | Because |
|---|---|---|
| **WEB-NR1** | Come as an app from Apple's or Google's app store | A place in Apple's store costs $99 a year, and Itinero costs nothing to run beyond its domain name (ADR-0015, Itinero's online side runs on Cloudflare's free plan) |
| **WEB-NR2** | Change a trip with no connection | A trip changes only while the device is online (ADR-0004, a trip can be read without a connection, but changed only with one) |
| **WEB-NR3** | Lock a device's copy with a PIN, a fingerprint or encryption of its own | The device's own lock protects the copy (ADR-0017, a trip's copy on a device is protected by the device's own lock, and deleted when its traveller signs out) |
| **WEB-NR4** | Sign a lost device out from another device | Each device signs out for itself, for now (`ACC:ACCOUNTS-NR3`) |
| **WEB-NR5** | Send reminders or notifications, such as a flight leaving in three hours | Notifications need a decision of their own on what to send, and when |
| **WEB-NR6** | Show Itinero in any language but English | Dates and times are written in English alone, for now (`SHR:TRIP-TIME-NR3`) |
| **WEB-NR7** | Find the city a traveller is in | Finding the city needs a far larger list of places held on the phone (`PLN-NR7`) |

^web-nr

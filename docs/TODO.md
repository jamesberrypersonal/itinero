# The live work list

What needs active work, and what waits on a decision. `documentation-system.md` gives the list's
rules. When an item is done, it leaves this list for `CHANGELOG.md` in the commit that finishes it.

*Next free:* TODO-18

## Tags

| Tag | Means |
|---|---|
| access | Accounts, invitations and permissions |
| access/accounts | Travellers' accounts, and signing in with a Google account |
| access/membership | Who is on each trip: its admins, the invitations that bring travellers in, and removing them |
| access/permissions | What each traveller may see and change of a trip's pages, calendar and bookings |
| bookings | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them |
| bookings/activity | A tour, a ticket or a table, at one place, on a date and perhaps at a time |
| bookings/flight | A flight, in one or more legs, each leaving and arriving in its own airport's local time |
| bookings/journey | A train, a bus, a ferry or a hired car, from one place to another, with a time at each end |
| bookings/list | A trip's bookings: adding, changing and removing each one, the travellers it names, and the order they happen in |
| bookings/stay | One or more nights' stay, such as a hotel or a flat, from check-in to check-out |
| planner | The trip planner |
| planner/itinerary | The itinerary: a trip's pencilled stretches and firm items |
| planner/pages | The pages of a trip |
| planner/trip-host | The copy of each trip held online, in a Durable Object of its own, which applies every change and keeps each traveller's devices up to date |
| shared/doc-check | The documentation checker |
| shared/doc-scaffold | The scaffolder that starts new documents |
| shared/trip-time | Local dates and times, and time zones |
| web | The web app, on a computer and on a phone |
| web/places | The places a device knows the time zone of: every airport, and the towns of each country its trips visit |
| web/screens | What travellers see and use: the home page, the calendar, the bookings page, the pages of research and the trip's members |
| web/shell | The installable app itself: launching with no connection, adding it to a phone's home screen, and keeping the time-zone rules up to date |
| web/trip-store | Each trip's copy on a device: catching it up, telling it of changes as they happen, sending changes, and deleting it on sign-out |
| docs | The documentation system, and the tools authors use with it |

## Items

### TODO-4 — Let a traveller change a trip while offline

*Tags:* web, planner/itinerary
*Written:* 2026-11-11

*Problem:* A traveller with no connection can read a trip but cannot change it.

*Reason:* ADR-0004 (a trip can be read without a connection, but changed only with one) kept the
trip held online as the only copy anyone changes. That way, two changes never need reconciling.

*Proposal:* Decide how changes made on two phones while apart are reconciled. Record it in a
decision record that supersedes ADR-0004.

*Releases:* Nothing is planned for it yet.

### TODO-6 — Show a time in another time zone

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* A traveller sees each time only in the local time of its place, and cannot see it in
another time zone, such as their home's.

*Reason:* Converting imprecise values, such as an afternoon in Paris seen in Tokyo time, raised
questions that were left for later (`SHR:TRIP-TIME-NR2`).

*Proposal:* Decide which time zones a traveller can pick, and how each kind of value converts.
Then add the requirements to trip-time.

*Releases:* Nothing is planned for it yet.

### TODO-7 — Write dates and times in languages other than English

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* trip-time writes dates and times only in English.

*Reason:* The first requirements for trip-time keep to English (`SHR:TRIP-TIME-NR3`). Which
other languages travellers need is not known yet.

*Proposal:* Decide which languages to support first, and add the requirements to trip-time.

*Releases:* Nothing is planned for it yet.

### TODO-11 — Find the city a traveller is in, for the home page

*Tags:* planner, web
*Written:* 2026-11-14

*Problem:* A trip's home page links to the page for the country the traveller is in, but not to the
page for their city.

*Reason:* The phone works out its country from its own location, with a small map of country
borders held on it (ADR-0014, a trip opens on a home page for each traveller). Finding the city
needs a far larger list of places on the phone, and pages that remember the place they are about.
The country was enough to start with (`PLN-NR7`).

*Proposal:* Decide where the list of places comes from, and how a page records its place. Then
add the requirements to the planner and the web app.

*Releases:* Nothing is planned for it yet.

### TODO-13 — Merge two travellers' edits to one page automatically

*Tags:* planner/pages, planner/trip-host, web
*Written:* 2026-11-14

*Problem:* When two travellers edit the same page at once, the second save is refused, and the
second traveller combines the two texts by hand.

*Reason:* Refusing a save made from an older version of a page loses no work, and is simple to
build (`PLN-NR8`). Merging edits as they are made changes how a page's text is stored and sent.

*Proposal:* Look into merging edits automatically, such as with a CRDT, a data type built so that
edits made at once on two devices always combine into the same text. Record the choice in a
decision record scoped `planner`.

*Releases:* Nothing is planned for it yet.

### TODO-14 — Read a booking in from its confirmation email

*Tags:* bookings, bookings/flight, bookings/stay
*Written:* 2026-11-14

*Problem:* A traveller copies every booking in by hand, from a confirmation they already hold as
an email.

*Reason:* Reading confirmations from many airlines and hotels is the largest part of the bookings
system, and travellers needed their bookings before it could be built (ADR-0016, a trip's bookings
are entered by hand, as one of four kinds, and kept with the trip online). It left open whether
Itinero should import bookings at all.

*Proposal:* Decide whether Itinero should import bookings at all. If it should, decide how a
confirmation reaches Itinero, such as by forwarding it to an address of the trip, and how its
booking is matched to a trip and its travellers, and record it in a decision record scoped
`bookings`.

*Releases:* Nothing is planned for it yet.

### TODO-15 — Hold a file with a booking, such as a ticket or a boarding pass

*Tags:* bookings, bookings/list, web
*Written:* 2026-11-14

*Problem:* A booking holds text only, so a traveller opens a ticket's file from their email, which
may need a connection.

*Reason:* Files would fill the free plan's storage, and every phone's copy of a trip, faster than
every other part of a trip together (`BKG-NR2`).

*Proposal:* Decide whether a booking should hold files at all. If it should, decide where files are
kept, how large one may be, and whether each phone keeps a copy of its traveller's files to read
with no connection, and record it in a decision record scoped `bookings`.

*Releases:* Nothing is planned for it yet.

### TODO-16 — Sign a lost device out from another device

*Tags:* access/accounts, web
*Written:* 2026-11-14

*Problem:* A traveller who loses a phone cannot sign it out from another device, so the lost phone
keeps its copy of every trip, and its session, until it goes 180 days unused.

*Reason:* Each device signs out for itself (`ACC:ACCOUNTS-NR3`). A device's copy is protected by
the device's own lock alone (ADR-0017, a trip's copy on a device is protected by the device's own
lock, and deleted when its traveller signs out).

*Proposal:* Consider listing the devices a traveller is signed in on, and letting them sign out
any or all of them, so that each deletes its copy the next time it connects. Decide it in a
decision record scoped `access/accounts` and `web`.

*Releases:* Nothing is planned for it yet.

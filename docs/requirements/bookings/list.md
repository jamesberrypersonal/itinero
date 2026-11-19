# The bookings list

What the component `bookings/list` promises to the components that use it, and through them to
travellers. The bookings list holds a trip's bookings. It checks and applies each change to a
booking, gives the travellers each booking names, and orders a trip's bookings by when they happen.
Its callers are `planner/trip-host`, the component that holds each trip online, and the web app,
the system travellers use on a computer or a phone. The component registry, `components.md`, gives
it the prefix `BKG:LIST`.

A booking is one of four kinds, a flight, a stay, a journey or an activity, and each kind is a
component of its own: `bookings/flight`, `bookings/stay`, `bookings/journey` and
`bookings/activity`. The bookings list holds what every booking has, whatever its kind:

- **an identifier**, unique among the trip's bookings
- **a revision**, which counts the changes made to the booking
- **the travellers it names**, each by their account
- **its details**: a booking reference, who it is booked with, a link, notes, and perhaps a page of
  the trip

Every time a booking holds is a value of `shared/trip-time`, the component that holds dates and
times in the local time of their place.

---

## Functional requirements

### BKG:LIST-F1 — A booking is added, changed and removed by one change at a time, each checked whole before anything changes

Adding, changing and removing a booking are each one change. A change is checked whole, with the
checks of the booking's kind, before anything is made. A change refused leaves the booking as it
was, and the refusal says why in one sentence. A booking keeps its kind for as long as it is held. ^bkg-list-f1

- **Verification:** on a trip holding a flight,
    - add a stay, and confirm it is held with revision 1
    - change the flight's notes, and confirm its revision is 2
    - change the flight with legs that arrive before they leave, and confirm it is refused, with the
      reason, and the flight unchanged
    - change the flight into a stay, and confirm it is refused
    - remove the stay, and confirm it is no longer held

> **What does this buy?** A booking is never left half changed, and a traveller is told what to
> correct (`BKG-F1`, `BKG-F5`).

### BKG:LIST-F2 — A booking names one or more travellers, each once, and gives them for each access check

Each booking names between 1 and 50 travellers, each no more than once. The bookings list gives,
for any change, the travellers the booking names before the change and after it, so that the caller
can ask whether the traveller making the change may make it. ^bkg-list-f2

- **Verification:**
    - add a booking naming no traveller, and confirm it is refused
    - add a booking naming the same traveller twice, and confirm it is refused
    - change a booking's travellers from the first and second to the first alone, and confirm the
      travellers given are the first and second before, and the first after

> **What does this buy?** Access to a booking follows the travellers it names (`ACC-F6`). A
> change that takes a traveller off a booking is checked against both lists, so nobody adds or
> removes themselves past their access (`BKG-F5`).

> **Does the bookings list check that each traveller is on the trip?** No. Who is on the trip is the
> access system's. The trip host checks it.

### BKG:LIST-F3 — A change made from an older revision of a booking is refused, with the booking as it stands

A change or a removal names the revision of the booking it was made from. Where the booking has
been changed since, the change is refused, and the refusal holds the booking as it now stands. ^bkg-list-f3

- **Verification:** on a booking at revision 3,
    - change it from revision 3, and confirm it is accepted, at revision 4
    - change it from revision 3 again, and confirm it is refused, holding the booking at revision 4
    - remove it from revision 3, and confirm it is refused in the same way

> **What does this buy?** Two travellers correcting one booking at once never lose a change
> silently (`BKG-F5`).

### BKG:LIST-F4 — A trip's bookings are ordered by when each starts, whatever their time zones

The bookings list orders any set of bookings by when each starts, in one order across every time
zone. Bookings that start together are ordered by their titles, then by their identifiers, so the
same bookings always come in the same order. ^bkg-list-f4

- **Verification:** with a stay checking in at 15:00 on 1 December, Santiago time, a flight leaving
  Madrid at 10:00 on 1 December, Madrid time, and two activities on 2 December with no time,
    - confirm the order is the flight, the stay, then the two activities by title
    - reverse the set given, and confirm the order is the same

> **What does this buy?** The bookings page, the calendar and the home page show bookings in the
> order they are lived (`BKG-F3`, `PLN-F5`, `PLN-F15`).

> **Where does a booking with no time come?** A booking on a date with no time comes first on its
> date, as `shared/trip-time` orders a whole date (`SHR:TRIP-TIME-F7`).

### BKG:LIST-F5 — Each booking gives the dates it covers, and the bookings list finds those on a date and those not yet over

Each booking gives the first and last local dates it covers. The bookings list gives the bookings
covering a date, and the bookings not yet over at a moment, each in the order of `BKG:LIST-F4`. ^bkg-list-f5

- **Verification:** with a stay from 9 December to 11:00 on 12 December, and an overnight bus
  leaving at 22:00 on 12 December and arriving at 06:00 on 13 December, all in one time zone,
    - confirm the stay covers 9 to 12 December, and the bus 12 to 13 December
    - confirm the bookings on 12 December are the stay, then the bus
    - at 23:00 on 12 December, confirm the bookings not yet over are the bus alone

> **What does this buy?** The calendar shows each booking on every day it covers, the home page
> lists a traveller's bookings for today and the next ones, and the bookings page opens at the
> first booking not yet over (`PLN-F5`, `PLN-F15`, `BKG-F3`).

> **When is a booking over?** Once its end has certainly passed. A booking with no end is over once
> its start has.

### BKG:LIST-F6 — A booking holds its reference, who it is booked with, a link, notes and a page, each checked

Each booking may hold a booking reference, who it is booked with, a link, notes, and a page of the
trip. Each is checked when the booking is added or changed: a reference of at most 64 characters,
a name of at most 200, a link to a secure web address, and notes of at most 4,000 characters. ^bkg-list-f6

- **Verification:**
    - add a booking with each detail, and confirm each is held as given
    - add a booking with a link that is not a secure web address, such as one starting `http:`, and
      confirm it is refused, with the reason
    - add a booking with notes of 4,001 characters, and confirm it is refused, with the reason

> **What does this buy?** A traveller has the reference and the notes at a desk (`BKG-F4`), and a
> link on a booking never leads to an unsecured page.

> **Does the bookings list check that the page exists?** No. A page is `planner/pages`', and the web
> app shows a page that is gone, or hidden from the traveller, as not available (`ACC-F8`).

### BKG:LIST-F7 — A booking, and a change to one, are written as text and read back unchanged

The bookings list writes a booking, and a change to one, as text, and reads the text back into the
same booking or change. A booking stored once reads back under any later time-zone rules. The same
booking always gives the same text. ^bkg-list-f7

- **Verification:**
    - write a booking of each kind as text, read it back, and confirm it equals the booking
    - write a booking, load later time-zone rules, read it back, and confirm it equals the booking
    - write the same booking twice, and confirm both texts are the same

> **What does this buy?** The copy of a trip held online and the copy on each phone store the same
> text, and a booking stored years ago still opens (`BKG-F6`).

---

## Non-functional requirements

### BKG:LIST-NFR1 — The bookings list gives the same results on every device, with no connection

Every result the bookings list gives depends only on what it is given and the time-zone rules
loaded. It needs no connection, and never reads the device's time zone or clock. ^bkg-list-nfr1

- **Verification:**
    - run the test suite with no network, and confirm every test passes
    - run it under two device time zones, such as London's and Tokyo's, and confirm every result is
      the same

> **What does this buy?** A phone with no connection orders a traveller's bookings exactly as the
> copy held online does (`BKG-F6`).

### BKG:LIST-NFR2 — The bookings list orders a thousand bookings quickly on a phone

The bookings list orders 1,000 bookings, and finds those not yet over, within 50 milliseconds on a
phone. ^bkg-list-nfr2

- **Verification:** on a phone,
    - order 1,000 bookings of every kind, and confirm it takes under 50 milliseconds
    - find the bookings not yet over among them, and confirm it takes under 50 milliseconds

> **What does this buy?** The bookings page opens within a second, with time to spare for drawing
> it (`BKG-NFR1`).

---

## Non-requirements

| Identifier | The bookings list does not | Because |
|---|---|---|
| **BKG:LIST-NR1** | Store a booking, or send one between devices | `planner/trip-host` stores each trip online, and the web app keeps the copy on a phone |
| **BKG:LIST-NR2** | Decide who may see or change a booking | `access/permissions` decides, from the travellers the bookings list gives (`BKG:LIST-F2`) |
| **BKG:LIST-NR3** | Check the details of a kind | Each kind's component checks its own, and the bookings list applies their checks |
| **BKG:LIST-NR4** | Find a place's time zone | The web app fills it in, and the traveller may change it (`BKG-NR7`) |

^bkg-list-nr

# The trip host

What the component `planner/trip-host` promises to the components that use it, and through them to
travellers. The trip host holds the one copy of each trip online, which every change is applied to.
It holds the trip's calendar, its pages, its grants of access and its bookings, applies each
change a traveller makes once the change is allowed, and keeps each traveller's devices up to date
with what they may see. The component registry, `components.md`, gives it the prefix `PLN:HOST`.

Three roles appear below. A device is the app a traveller uses, on a computer or a phone, which the
web app provides. The traveller and the admin are the roles `requirements/README.md` defines.

The parts of a trip are those the planner's requirements define, in
`requirements/planner/planner.md`:

- **The calendar** holds the pencilled stretches and the unbooked firm items.
- **The pages** hold the travellers' research, in a tree, with a graveyard for deleted pages.
- **The grants** hold the access each traveller has been given to the trip, its pages and its
  calendar.
- **The bookings** hold what the trip's travellers have booked, such as flights and stays, each
  naming the travellers it is for. `requirements/bookings/bookings.md` defines them.

A change is one edit to any of these, such as moving a stretch, rewriting a page or giving a
traveller access to the calendar. A trip's sequence counts every change applied to it, across all
four.

---

## Functional requirements

### PLN:HOST-F1 — A traveller creates a trip, with its name, its dates and a page for each country chosen

A signed-in traveller creates a trip with a name, its first and last dates, and the countries it
will visit. The trip host makes the trip, with a page at the top for each country, and makes the
traveller its creator and admin. ^pln-host-f1

- **Verification:** on a running system, as a signed-in traveller,
    - create a trip named Patagonia, from 1 to 20 December 2026, visiting Chile and Argentina
    - confirm the trip opens with its name and dates, and the pages Chile and Argentina at the top
    - confirm the traveller is its creator and an admin, with edit access to its calendar

> **What does this buy?** A traveller starts a trip in one step, with its research already
> arranged by country (`PLN-F10`, `PLN-F14`).

### PLN:HOST-F2 — Each change is applied only once it is allowed, one at a time, in the order it arrives

The trip host applies a change only from a traveller on the trip whose access allows it. It applies
a trip's changes one at a time, in the order they arrive, each raising the trip's sequence by one.
A change it refuses leaves the trip as it was, and the refusal says why. ^pln-host-f2

- **Verification:** on the trip of `PLN:HOST-F1`, with a second traveller holding view access to the
  trip,
    - as the creator, pencil in Chile from 1 to 10 December, and confirm the sequence rises by one
    - as the second traveller, rename the page Chile, and confirm it is refused, because they may
      only view it
    - from two devices at once, send ten changes each, and confirm all twenty are applied, each
      with its own sequence
    - as a signed-in traveller not on the trip, send any change, and confirm it is refused

> **What does this buy?** Every traveller works from the one copy of the trip, and no change a
> traveller may not make ever reaches it (`PLN-F6`, `ACC-NFR1`).

### PLN:HOST-F3 — A rewrite of a page made from an older version is refused, with the text as it stands

When a traveller saves a page's text, made from a version older than the page's own, the trip host
refuses the save. It gives the device the page's text as it now stands. ^pln-host-f3

- **Verification:** on the trip of `PLN:HOST-F1`, with two devices editing the page Chile,
    - save from the first, then from the second, and confirm the second is refused, with the first's
      text
    - save from the second again, from the version it was given, and confirm it is accepted

> **What does this buy?** Two travellers writing up the same page at once never lose either's work
> without being told (`PLN-F16`).

### PLN:HOST-F4 — A move that lets more travellers see a page is applied only once the traveller confirms

A move of a page to a place where more travellers may see it is refused unless the device says how
many more the traveller agreed to. The refusal says how many more would see it. ^pln-host-f4

- **Verification:** on a trip with a page Surprise hidden from two travellers, and a page Chile
  they may see,
    - move Surprise under Chile, and confirm it is refused, saying two more travellers would see it
    - move it again, agreeing to two more, and confirm it is applied
    - move a page that no more travellers would see, and confirm it is applied with nothing agreed

> **What does this buy?** A move never shares a page by accident (`ACC-F9`).

### PLN:HOST-F5 — A device catches up on everything it may see that changed while it was away

A device that reconnects, giving the last sequence it holds, is given what has changed since that it
may now hold. That is every page, and the calendar, that it may see and that changed. It also learns
which pages it holds that it may no longer see, and drops them. A device that gives no sequence is
given everything it may hold. ^pln-host-f5

- **Verification:** on the trip of `PLN:HOST-F1`, with the second traveller's device offline,
    - as the creator, rename Chile and hide Argentina from the second traveller
    - bring the device back online, and confirm it holds the new title, and no longer holds
      Argentina
    - grant the second traveller view access to the calendar, bring the device back again, and
      confirm it now holds the calendar
    - on a new device, sign in as the second traveller, and confirm it is given the whole trip they
      may see

> **What does this buy?** A phone carries the trip as it stands, with nothing its traveller may no
> longer see (`ACC-F12`, ADR-0004, a trip is read-only offline).

### PLN:HOST-F6 — A device with the trip open is told of each change at once

While a device has a trip open with a connection, the trip host tells it of each change to the trip
as it is applied, so that the device catches up. ^pln-host-f6

- **Verification:** with two devices holding the trip of `PLN:HOST-F1` open,
    - from the first, rename Chile, and confirm the second shows the new title within 2 seconds
    - close the second, rename Chile again, reopen it, and confirm it shows the newer title

> **What does this buy?** Travellers planning together see each other's changes as they are made
> (`PLN-F6`).

### PLN:HOST-F7 — A traveller who joins or is removed gains or loses the trip at once

When a traveller accepts an invitation, the trip host gives them the access to the trip and to the
calendar the invitation named. When an admin removes a traveller, the trip host takes away all their
access, and each of their devices deletes its copy of the trip the next time it
connects. ^pln-host-f7

- **Verification:** on the trip of `PLN:HOST-F1`,
    - invite a traveller with view access to the trip, have them accept, and confirm they see every
      page, and not the calendar
    - with their phone offline, remove them, then bring the phone online, and confirm the trip is no
      longer on it

> **What does this buy?** Joining and leaving a trip take effect everywhere, with nothing left
> behind on a removed traveller's phone (`ACC-F3`, `ACC-F11`).

### PLN:HOST-F8 — An admin reads and restores a page in the graveyard

The trip host gives an admin the title and text of any page in the trip's graveyard, and restores a
page an admin asks it to. It refuses either for a traveller who is not an admin. ^pln-host-f8

- **Verification:** on the trip of `PLN:HOST-F1`, with the page Argentina deleted,
    - as the creator, read Argentina, and confirm its text reads as it was written
    - as a traveller who is not an admin, read it, and confirm it is refused
    - as the creator, restore it, and confirm it returns at the top of the trip

> **What does this buy?** A branch of research deleted by mistake is recovered (`PLN-F13`).

### PLN:HOST-F9 — The trip host holds a trip's bookings, and gives each device only those its traveller may see

The trip host holds a trip's bookings beside its calendar, pages and grants. It applies a change to
a booking only from a traveller who may change the booking both before and after the change, and
only where every traveller the booking names is on the trip. A device is given, and keeps, only the
bookings its traveller may see. ^pln-host-f9

- **Verification:** on the trip of `PLN:HOST-F1`, with a second and a third traveller holding edit
  access to the trip,
    - as the second traveller, add a flight naming themselves and the third, and confirm the
      sequence rises by one
    - as the second traveller, take the third off the flight, and confirm it is accepted
    - as the third traveller, change the flight, and confirm it is refused
    - add a booking naming a traveller not on the trip, and confirm it is refused, with the reason
    - with the third traveller's device offline, add them to the flight again, bring the device
      back, and confirm it holds the flight
    - take them off it again, bring the device back, and confirm it no longer holds the flight

> **What does this buy?** A booking is kept with the trip it belongs to, and reaches only the
> travellers it names and the admins (`BKG-F1`, `BKG-F5`, `ACC-F6`), as every other part of a trip
> does (ADR-0016, a trip's bookings are entered by hand, as one of four kinds, and kept with the
> trip online).

---

## Non-functional requirements

### PLN:HOST-NFR1 — Nothing leaves the trip host that the traveller asking may not see

The trip host gives a traveller's device nothing of a trip that the traveller may not see: no page,
no title, no part of the calendar and no other traveller's grants. That holds whatever the device
asks for. ^pln-host-nfr1

- **Verification:** with a device altered to send any request, as a traveller with no access to the
  page Argentina or to the calendar,
    - ask for Argentina by its identifier, and confirm it is refused
    - ask for the calendar, and confirm it is refused
    - catch up from the start, and confirm nothing given names Argentina, a stretch, or another
      traveller's access

> **What does this buy?** Access means nothing if one request can get round it (`ACC-NFR1`).

### PLN:HOST-NFR2 — A trip used by a few travellers costs nothing to host

A trip used by up to ten travellers, each with the trip open for a few hours a day, stays within
the free plan Itinero's online side runs on. ^pln-host-nfr2

- **Verification:**
    - with ten devices holding a trip open for four hours, making a change a minute between them,
      confirm the day's requests and storage stay within the free plan's daily limits

> **What does this buy?** Itinero is personal software, and costs nothing to run beyond its domain
> name (ADR-0015, Itinero's online side runs on Cloudflare's free plan, and travellers sign in with
> Google alone).

---

## Non-requirements

| Identifier | The trip host does not | Because |
|---|---|---|
| **PLN:HOST-NR1** | Accept a change from a device with no connection, or merge changes made while apart | A trip changes only while the traveller is online (ADR-0004, a trip is read-only offline) |
| **PLN:HOST-NR2** | Merge two travellers' edits to one page | Merging edits as they are made is future work (`PLN-NR8`) |
| **PLN:HOST-NR4** | Decide who may make a change | `access/permissions` decides. The trip host asks it before every change |
| **PLN:HOST-NR5** | Give a traveller a copy of a trip to keep outside Itinero | Exporting a trip is future work |

^pln-host-nr

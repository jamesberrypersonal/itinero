# The bookings system

What the bookings system promises to travellers. The bookings system holds a trip's bookings, each
for the travellers it names, and the bookings page that lists them. The component registry,
`components.md`, gives it the prefix `BKG`.

Two roles appear below, the traveller and the admin, which `requirements/README.md` defines. A trip
is the planner's, the system that holds each trip. Which traveller may see or change a booking is
promised by the access system, the system that handles accounts, invitations and who may see each
part of a trip, in `ACC-F6`.

A booking is something booked, fixed to a date, such as a flight, a stay or a tour. It becomes a
booking only once it is booked. Until then it is a firm item on the trip's calendar, such as a bus
not yet booked (ADR-0013, a trip's bookings have a page of their own, and its calendar is seen only
by the travellers an admin chooses). Each booking is one of four kinds:

| Kind | Is | Such as |
|---|---|---|
| **Flight** | One or more flights booked together, each leaving one airport and arriving at another | LATAM from Santiago to Punta Arenas on 6 December, leaving at 07:05 |
| **Stay** | One or more nights in one place, from check-in to check-out | Three nights at a hotel in Puerto Natales, from 9 to 12 December |
| **Journey** | A train, a bus, a ferry or a hired car, from one place to another | A bus from Punta Arenas to Puerto Natales on 9 December, leaving at 13:00 |
| **Activity** | Something booked at one place, such as a tour, a ticket or a table | A day's tour of Torres del Paine on 10 December |

A booking's times are in the local time of the place each one happens, as `shared/trip-time`, the
component that holds a trip's dates and times, holds them. The web app fills in each place's time
zone where it knows the place, and the traveller may choose another (`BKG-NR7`).

---

## Functional requirements

### BKG-F1 — A traveller adds a booking of one of four kinds, naming the travellers on the trip it is for

A traveller with edit access to a trip adds a booking to it: a flight, a stay, a journey or an
activity. The booking names one or more travellers on the trip. A traveller who is not an admin
names themselves among them. ^bkg-f1

- **Verification:** on a trip through Chile with three travellers, as the first, with edit access
  to the trip and no access to the calendar,
    - add a flight from Santiago to Punta Arenas naming the first two travellers, and confirm it is
      accepted
    - add a stay naming the second traveller alone, and confirm it is refused, with the reason
    - add a journey naming nobody, and confirm it is refused, with the reason
    - as an admin, add an activity naming the third traveller alone, and confirm it is accepted
    - as a traveller with view access to the trip, add any booking, and confirm it is refused

> **What does this buy?** Each traveller keeps what they booked in the trip it belongs to, for
> exactly the people it is for, without needing to see the trip's calendar.

> **Why must a traveller name themselves?** A booking is seen only by the travellers it names and
> the admins (`ACC-F6`). A traveller adding a booking for others alone would lose it the moment
> they added it.

> **Is there a kind for anything else?** An activity is the form for a booking that fits no other
> kind, such as a guide hired for a day.

### BKG-F2 — Every time of a booking is in the local time of the place it happens

Each time a booking holds is in the local time of its own place. A flight leaves and arrives in the
local time of each airport, and a journey in the local time of each end. A stay's check-in and
check-out, and an activity's time, are in the local time of where they are. A flight and a journey
say how long each part takes. ^bkg-f2

- **Verification:** on the trip of `BKG-F1`,
    - add a flight leaving Santiago at 23:40 on 1 December, Santiago time, and arriving in Madrid at
      16:35 on 2 December, Madrid time, and confirm it reads as both, taking 12 hours 55 minutes
    - add a journey with no arrival time, and confirm it is accepted, with no duration given
    - add a journey arriving before it leaves, and confirm it is refused, with the reason
    - add a stay checking out on the day it checks in, and confirm it is refused, with the reason

> **What does this buy?** A confirmation gives each time in the local time of its place. The
> traveller copies each one in as printed, and the booking reads as the confirmation does.

> **What if a time is not known exactly?** A stay's check-in can be a whole date, a window such as
> 15:00 to 22:00, or a time. A journey's arrival can be left out. A flight's times are always
> exact, because a timetable gives them so.

### BKG-F3 — The bookings page lists a traveller's bookings in the order they happen, opening at the first not yet over

The bookings page lists every booking the traveller may see, under the date each one starts, in the
order they happen, whatever time zone each is in. A booking that runs over several days, such as a
stay, shows its last date too. The page opens at the first booking not yet over, and the bookings
before it stay on the page. ^bkg-f3

- **Verification:** on the trip of `BKG-F1`, as the first traveller, with the flight of `BKG-F2`,
  a tour in Santiago at 09:00 on 1 December, and a stay in Santiago from 29 November to 1
  December,
    - confirm the page lists the stay, then the tour, then the flight
    - confirm the stay shows both 29 November and 1 December
    - on 1 December at 12:00, Santiago time, open the page, and confirm it opens at the flight, with
      the stay and the tour above it
    - add a booking naming only the third traveller, as an admin, and confirm the first traveller's
      page does not list it

> **What does this buy?** A traveller on the road opens one page and sees what comes next, in the
> order they will live it.

> **Is a booking that is over removed?** No. A booking stays until a traveller removes it
> (`BKG-F5`), so a traveller can look back at a stay's address after leaving.

### BKG-F4 — A booking holds the details a traveller needs on the day

Each booking holds, as well as the details of its kind, its booking reference, who it is booked
with, a link, and notes. It can name one page of the trip, such as the page for the city it is in.
Each detail is optional. ^bkg-f4

- **Verification:** on the trip of `BKG-F1`, with a page Puerto Natales,
    - add a stay with the reference `K7Q2ZP`, booked with a hotel, a link to its website, notes
      saying to ring on arrival, and the page Puerto Natales, and confirm the stay shows each one
    - open the link and the page from the stay, and confirm each opens
    - as a traveller named by the stay who may not see the page, confirm the stay shows that its
      page is not available to them
    - add a stay with no reference, link, notes or page, and confirm it is accepted

> **What does this buy?** At a check-in desk, the traveller has the reference and the notes in
> front of them, without searching their email.

> **Can a booking hold the ticket itself?** No. A booking holds text only. A link can lead to the
> ticket (`BKG-NR2`).

### BKG-F5 — A traveller named by a booking changes or removes it, and is told of a change made meanwhile

A traveller named by a booking, with edit access to the trip, changes the booking or removes it.
So does an admin. A traveller who is not an admin keeps themselves among the travellers a booking
names. A change made from an older version of the booking, which another traveller has changed
since, is refused, and shows the booking as it now stands. ^bkg-f5

- **Verification:** on the trip of `BKG-F1`, with its flight,
    - as the second traveller, change the flight's seat, and confirm it is accepted
    - as the third traveller, change the flight, and confirm it is refused
    - as the first traveller, take themselves off the flight, and confirm it is refused, with the
      reason
    - as the first and the second traveller at once, each change the flight from the same version,
      and confirm the second change is refused, showing the first's
    - as an admin, remove the flight, and confirm it is gone from the page of every traveller

> **What does this buy?** The people on a booking keep it right, and two of them correcting it at
> once never lose a change without being told.

> **Can a removed booking be restored?** No (`BKG-NR5`).

### BKG-F6 — A traveller reads their bookings with no connection

A traveller's phone holds every booking they may see, whole, as of the last time it connected. The
bookings page, and each booking with all its details, read with no connection. ^bkg-f6

- **Verification:** on the trip of `BKG-F1`, as the first traveller, signed in on a phone,
    - connect the phone, then take it offline, and confirm the bookings page lists the flight, with
      its reference and notes
    - as the second traveller, change the flight's notes while the phone is offline, and confirm the
      phone still shows the notes as they were
    - connect the phone, and confirm it shows the new notes

> **What does this buy?** Bookings are needed most where there is no signal, such as at a border
> crossing or on landing.

> **Can a traveller add a booking with no connection?** No. A trip changes only with a connection
> (ADR-0004, a trip is read-only offline).

---

## Non-functional requirements

### BKG-NFR1 — The bookings page of a trip with many bookings opens quickly on a phone with no connection

The bookings page of a trip holding 300 bookings the traveller may see opens within one second, on
a phone with no connection. ^bkg-nfr1

- **Verification:** on a phone at least four years old, with no connection, and a trip holding 300
  bookings of every kind,
    - open the bookings page, and confirm it shows its bookings within one second

> **What does this buy?** A long trip with a group holds hundreds of bookings, and a traveller
> opens the page at a desk or a gate, with people waiting.

---

## Non-requirements

| Identifier | The bookings system does not | Because |
|---|---|---|
| **BKG-NR1** | Read a booking in from a confirmation email | Travellers enter bookings by hand first. Importing, first for flights and stays, is future work (ADR-0016, a trip's bookings are entered by hand, as one of four kinds, and kept with the trip online) |
| **BKG-NR2** | Hold a file with a booking, such as a PDF ticket or a boarding pass | Files would fill the free plan's storage and every phone's copy. Holding them is future work (ADR-0016) |
| **BKG-NR3** | Make a booking, or check one with the company that holds it | Itinero records bookings made elsewhere |
| **BKG-NR4** | Track what a booking costs | Travellers chose not to track spending in Itinero (`PLN-NR3`) |
| **BKG-NR5** | Keep a removed booking so that it can be restored | A booking is a few lines, and the company's confirmation still holds them |
| **BKG-NR6** | Turn a firm item into a booking, or check a booking against the stretches pencilled in | Nothing turns one into the other, and a booking and a stretch can disagree (ADR-0013) |
| **BKG-NR7** | Find the time zone of an airport or a place | The web app fills it in from its list of places, and the bookings system holds the zone it is given (`WEB-F9`) |
| **BKG-NR8** | Show a flight's live status, such as a delay or a gate | Live status comes from a paid service, and Itinero costs nothing to run (ADR-0015) |

^bkg-nr

# The stay booking

What the component `bookings/stay` promises to the components that use it, and through them to
travellers. A stay booking holds one or more nights in one place, such as a hotel, a hostel or a
flat, from check-in to check-out. The component registry, `components.md`, gives it the prefix
`BKG:STAY`.

What every booking has, whatever its kind, such as the travellers it names and its booking
reference, is promised by `bookings/list`, the component that holds a trip's bookings. Every time
is a value of `shared/trip-time`, the component that holds dates and times in the local time of
their place. It holds six kinds of value: an exact time like 15:00, an approximate time like around
11:00, a window like 15:00 to 22:00, a part of a day like the afternoon, a whole date, and a date
whose time is to be decided.

---

## Functional requirements

### BKG:STAY-F1 — A stay has a name, perhaps an address, and a check-in and a check-out at least one night apart

A stay holds the name of where the traveller stays, perhaps its address, and when they check in
and check out, both in the local time of the stay. Check-out is on a later date than check-in, and
at most 366 nights after it. ^bkg-stay-f1

- **Verification:**
    - add a stay at Hostal Lady Florence, checking in on 9 December and out on 12 December, both
      in Punta Arenas time, and confirm it is held as given
    - add a stay checking out on the date it checks in, and confirm it is refused, with the reason
    - add a stay of 367 nights, and confirm it is refused, with the reason
    - add a stay checking in in one time zone and out in another, and confirm it is refused

> **What does this buy?** A traveller has where they sleep each night, and when they must leave,
> as the confirmation gives it (`BKG-F2`).

> **What about a room booked for the day only?** It is not a stay. It is an activity, which can last
> some hours of one day (`BKG:ACTIVITY-F1`).

### BKG:STAY-F2 — A stay's check-in and check-out can each be as precise as the confirmation

A stay's check-in and check-out can each be any kind of value `shared/trip-time` holds: a whole
date, a window, an exact or an approximate time, a part of a day, or a date whose time is to be
decided. ^bkg-stay-f2

- **Verification:**
    - add a stay checking in between 15:00 and 22:00 on 9 December, and checking out by around
      11:00 on 12 December, and confirm both are held as given
    - add a stay checking in on 9 December with the time to be decided, and confirm it is accepted

> **What does this buy?** A confirmation often gives a check-in window and a check-out time, and
> sometimes neither. A traveller copies in what it says, and no more.

### BKG:STAY-F3 — A stay says how many nights it is, and covers every date from check-in to check-out

A stay gives the number of nights from its check-in date to its check-out date. It covers every
date from check-in to check-out, both included. ^bkg-stay-f3

- **Verification:** on the stay of `BKG:STAY-F1`,
    - confirm it is 3 nights
    - confirm it covers 9, 10, 11 and 12 December

> **What does this buy?** The calendar shows the stay on each day of it, and on the day the
> traveller leaves (`PLN-F5`, `BKG:LIST-F5`).

---

## Non-functional requirements

The stay booking makes no promise of its own about how well it does what it does. How quickly a
trip's bookings are ordered is promised by `bookings/list`, in `BKG:LIST-NFR2`.

---

## Non-requirements

| Identifier | The stay booking does not | Because |
|---|---|---|
| **BKG:STAY-NR1** | Hold the rooms booked, or how many guests | These belong in the booking's notes, for now |
| **BKG:STAY-NR2** | Find a stay on a map from its address | A map needs a connection, and a service to find places. The address is text |

^bkg-stay-nr

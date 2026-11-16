# The journey booking

What the component `bookings/journey` promises to the components that use it, and through them to
travellers. A journey booking holds a booked train, bus, ferry or hired car, from one place to
another. The component registry, `components.md`, gives it the prefix `BKG:JOURNEY`.

What every booking has, whatever its kind, such as the travellers it names and its booking
reference, is promised by `bookings/list`, the component that holds a trip's bookings. Every time
is a value of `shared/trip-time`, the component that holds dates and times in the local time of
their place. Its values range from an exact time like 13:00 to a whole date with no time.

---

## Functional requirements

### BKG:JOURNEY-F1 — A journey goes by train, bus, ferry or hired car, from one place to another, leaving at a time and perhaps arriving at another

A journey holds how it goes, by train, bus, ferry or hired car, and the places it leaves from and
arrives at. It holds when it leaves, and perhaps when it arrives, each in the local time of its own
place. For a hired car, it leaves when the car is collected, and arrives when the car is returned. ^bkg-journey-f1

- **Verification:**
    - add a bus from Punta Arenas to Puerto Natales, leaving at 13:00 on 9 December and arriving at
      16:00, and confirm it is held as given
    - add a ferry leaving on 14 December with no time and no arrival, and confirm it is accepted
    - add a hired car collected in Santiago at 10:00 on 20 December, Santiago time, and returned in
      Mendoza at 18:00 on 27 December, Mendoza time, and confirm it is held as given
    - add a journey by plane, and confirm it is refused, because a flight is a booking of its own
      kind

> **What does this buy?** A traveller copies a ticket or a hire agreement in as it reads, with each
> end in its own local time (`BKG-F2`).

> **Why can a journey have no arrival?** A bus ticket often gives only when it leaves.

### BKG:JOURNEY-F2 — A journey that arrives before it leaves is refused, and one that arrives says how long it takes

A journey whose arrival is certainly before its departure, in the time that really passes, is
refused. A journey that holds both times gives how long it takes, as the shortest and the longest it
can be where either time covers more than a moment, such as a window. A journey of more than 366 days
is refused. ^bkg-journey-f2

- **Verification:**
    - on the bus of `BKG:JOURNEY-F1`, confirm it takes 3 hours
    - add a train leaving at 10:00 and arriving at 09:00 the same day, in one time zone, and confirm
      it is refused, with the reason
    - add a train leaving between 10:00 and 11:00 and arriving at 14:00, and confirm it gives the time
      it takes as 3 to 4 hours

> **What does this buy?** A time copied into the wrong day is caught when it is entered, and a
> traveller sees how long they will be on the road.

> **Why does a journey leaving at around 10:00 take a time with no range?** `shared/trip-time`
> counts an approximate time as its stated time, since "around 10:00" has no edge to measure from
> (`SHR:TRIP-TIME-F5`). A train leaving at around 10:00 and arriving at 14:00 takes 4 hours.

### BKG:JOURNEY-F3 — A journey can hold who runs it, its service and the traveller's seat, as written on the ticket

A journey can hold who runs it, such as a bus company or a car hire firm, its service, such as a
train's number, and the seat, such as a coach and seat number, each as text. ^bkg-journey-f3

- **Verification:**
    - add a train run by SNCF, service `TGV 6611`, seat `coach 12, seat 45`, and confirm each is held
      as given
    - add a journey with none of the three, and confirm it is accepted

> **What does this buy?** A traveller finds their train and their seat on the platform from the
> booking alone (`BKG-F4`).

---

## Non-functional requirements

The journey booking makes no promise of its own about how well it does what it does. How quickly a
trip's bookings are ordered is promised by `bookings/list`, in `BKG:LIST-NFR2`.

---

## Non-requirements

| Identifier | The journey booking does not | Because |
|---|---|---|
| **BKG:JOURNEY-NR1** | Hold the stops a journey makes on the way | A journey is booked from one place to another, and stops belong in its notes, for now |
| **BKG:JOURNEY-NR2** | Hold a seat for each traveller apart | A ticket for several travellers gives their seats together, as one line of text |

^bkg-journey-nr

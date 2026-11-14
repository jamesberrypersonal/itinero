# The flight booking

What the component `bookings/flight` promises to the components that use it, and through them to
travellers. A flight booking holds one or more flights booked together, such as a flight to Madrid
with a change in São Paulo. Each flight of the booking is a leg. The component registry,
`components.md`, gives it the prefix `BKG:FLIGHT`.

What every booking has, whatever its kind, such as the travellers it names and its booking
reference, is promised by `bookings/list`, the component that holds a trip's bookings. Every time
is a value of `shared/trip-time`, the component that holds dates and times in the local time of
their place.

---

## Functional requirements

### BKG:FLIGHT-F1 — A flight booking is one or more legs, each with its flight number, its two airports, and its times in each airport's local time

A flight booking holds 1 to 8 legs, in the order they are flown. Each leg holds its flight number,
the airport it leaves and the airport it arrives at, and an exact time for each, in the local time
of that airport. An airport is named by its three-letter code, and perhaps by a name. ^bkg-flight-f1

- **Verification:**
    - add a flight of one leg, `LA 800` from `SCL` at 07:05 on 6 December, Santiago time, to `PUQ`
      at 10:30, Punta Arenas time, and confirm it is held as given
    - add a flight of two legs, Santiago to São Paulo and São Paulo to Madrid, and confirm it is
      held with both, in order
    - add a flight of no legs, and of nine, and confirm each is refused, with the reason
    - add a leg leaving at around 07:00, and confirm it is refused, because a leg's times are exact
    - add a leg with the flight number `LATAM`, and confirm it is refused, with the reason

> **What does this buy?** A traveller copies a flight from its confirmation, leg by leg, and reads
> each time as the airport's clocks will show it (`BKG-F2`).

> **Why must a leg's times be exact?** A timetable gives a flight's times to the minute, so a time
> that is not exact is a mistake in copying.

### BKG:FLIGHT-F2 — A leg that arrives before it leaves, or leaves before the leg before it arrives, is refused

A leg whose arrival is before its departure is refused. So is a leg that leaves before the leg
before it has arrived. Both are measured in the time that really passes, across time zones. Each
refusal names the leg. ^bkg-flight-f2

- **Verification:**
    - add a leg leaving Santiago at 23:40 on 1 December, Santiago time, and arriving in Madrid at
      16:35 on 2 December, Madrid time, and confirm it is accepted
    - add a leg arriving in Madrid at 16:35 on 1 December, and confirm it is refused, naming the leg
    - add two legs, the second leaving São Paulo before the first arrives there, and confirm it is
      refused, naming the second leg

> **What does this buy?** A time copied into the wrong day is caught when it is entered, not at the
> airport.

### BKG:FLIGHT-F3 — A flight booking says how long each leg takes, and how long each connection is

A flight booking gives how long each leg takes, and how long the traveller waits between one leg's
arrival and the next leg's departure, in the time that really passes. ^bkg-flight-f3

- **Verification:** on a flight from Santiago to São Paulo, leaving at 08:00 Santiago time and
  arriving at 12:00 São Paulo time on the same day, then on to Madrid at 14:30,
    - confirm the first leg takes 4 hours
    - confirm the connection in São Paulo is 2 hours 30 minutes

> **What does this buy?** A traveller sees at once whether a connection is tight, which local times
> alone do not show (`BKG-F2`).

### BKG:FLIGHT-F4 — A flight booking can hold each traveller's seat on each leg

A flight booking can hold a seat for each traveller it names, on each leg. A seat for a traveller
the booking does not name, or for a leg it does not hold, is refused. ^bkg-flight-f4

- **Verification:** on a two-leg flight naming two travellers,
    - give the first traveller seat `23A` on the first leg, and confirm it is held
    - give a seat to a traveller the flight does not name, and confirm it is refused
    - give the first traveller two seats on the first leg, and confirm it is refused

> **What does this buy?** Each traveller on a shared booking finds their own seat on it
> (`BKG-F5`).

---

## Non-functional requirements

The flight booking makes no promise of its own about how well it does what it does. How quickly a
trip's bookings are ordered is promised by `bookings/list`, in `BKG:LIST-NFR2`.

---

## Non-requirements

| Identifier | The flight booking does not | Because |
|---|---|---|
| **BKG:FLIGHT-NR1** | Find an airport's time zone, or check that its code names a real airport | The traveller chooses each time zone, and checking codes needs a list of airports kept up to date (`BKG-NR7`) |
| **BKG:FLIGHT-NR2** | Show a flight's live status, such as a delay or a gate | Live status comes from a paid service (`BKG-NR8`) |
| **BKG:FLIGHT-NR3** | Hold a flight's terminal, baggage allowance or fare class | These belong in the booking's notes, for now |

^bkg-flight-nr

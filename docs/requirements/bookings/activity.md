# The activity booking

What the component `bookings/activity` promises to the components that use it, and through them to
travellers. An activity booking holds something booked at one place, such as a tour, a ticket for a
show or a museum, or a table at a restaurant. It is also the form for any booking that fits no other
kind, such as a guide hired for a day. The component registry, `components.md`, gives it the prefix
`BKG:ACTIVITY`.

What every booking has, whatever its kind, such as the travellers it names and its booking
reference, is promised by `bookings/list`, the component that holds a trip's bookings. Every time
is a value of `shared/trip-time`, the component that holds dates and times in the local time of
their place. Its values range from an exact time like 20:30 to a whole date with no time.

---

## Functional requirements

### BKG:ACTIVITY-F1 — An activity is a tour, a ticket, a table or something else, with a title, perhaps a place, and a start as precise as its booking

An activity holds what sort it is, a tour, a ticket, a table or something else, and a title. It
can hold where it is. It holds when it starts, as any kind of value `shared/trip-time` holds, in the
local time of its place, and perhaps when it ends. ^bkg-activity-f1

- **Verification:**
    - add a tour titled Torres del Paine full day, starting at 07:30 on 10 December and ending at
      19:00, and confirm it is held as given
    - add a table titled Dinner at La Mesita Grande, at around 20:30 on 11 December, with no end,
      and confirm it is accepted
    - add a ticket for a museum on 3 December with no time, and confirm it is accepted
    - add an activity with an empty title, and confirm it is refused, with the reason

> **What does this buy?** Anything else a traveller books has a home among the trip's bookings,
> shown in order with the rest (`BKG-F1`, `BKG-F3`).

> **What sort should a guide hired for a day be?** Something else. The sort sets only how the web
> app marks the activity, and nothing else depends on it.

### BKG:ACTIVITY-F2 — An activity that ends before it starts is refused, and one that ends covers every date to its end

An activity whose end is certainly before its start, in the time that really passes, is refused. An
activity of more than 366 days is refused. An activity covers every date from its start to its end,
both included. ^bkg-activity-f2

- **Verification:**
    - on the tour of `BKG:ACTIVITY-F1`, change its end to 06:00 on 10 December, and confirm it is
      refused, with the reason
    - add a three-day trek starting on 14 December and ending on 16 December, both with no time, and
      confirm it covers 14, 15 and 16 December

> **What does this buy?** A trek or a cruise shows on each of its days, and a time copied into the
> wrong day is caught when it is entered (`BKG:LIST-F5`).

---

## Non-functional requirements

The activity booking makes no promise of its own about how well it does what it does. How quickly a
trip's bookings are ordered is promised by `bookings/list`, in `BKG:LIST-NFR2`.

---

## Non-requirements

| Identifier | The activity booking does not | Because |
|---|---|---|
| **BKG:ACTIVITY-NR1** | Hold a sort of activity beyond tour, ticket, table and something else | The sort only marks an activity, and the title says what it is |
| **BKG:ACTIVITY-NR2** | Hold an activity that happens at several places, such as a tour with a different place at its end | The place is text, which can name both |

^bkg-activity-nr

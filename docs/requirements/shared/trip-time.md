# Trip time

What the shared component `shared/trip-time` promises to the components that use it, such as the
planner's itinerary, and through them to travellers. trip-time holds the dates and times of a trip
in the local time of the place each one happens. It sorts them, measures the time between them,
and writes them as text. The component registry, `components.md`, gives it the prefix
`SHR:TRIP-TIME`.

Two roles appear below. A caller is a component that uses trip-time. The traveller is the role
`requirements/README.md` defines.

A time zone is the set of clock rules a place follows, including the days its clocks go forward
and back, such as Paris time. trip-time holds six kinds of value, and every value belongs to one
time zone:

| Kind | Such as |
|---|---|
| **Exact time** | A train leaving Lyon at 09:10 on 3 June, Paris time |
| **Whole date** | A night at a hotel in Kyoto on 3 June |
| **Date with time to be decided** | A museum visit on 3 June, at a time not yet chosen |
| **Part of a day** | The afternoon of 3 June |
| **Approximate time** | Around 14:00 on 3 June |
| **Window** | Between 14:00 and 16:00 on 3 June, such as a check-in window |

A span is a start and an end, each one a value, such as a flight leaving Paris and landing in New
York. A value whose kind is not an exact time or a whole date is imprecise.

---

## Functional requirements

### SHR:TRIP-TIME-F1 — Every value is held in the local time of its place, to the minute

trip-time holds each of the six kinds of value in the local time of the time zone the caller gives
it. An exact time is held to the minute. trip-time refuses a time zone it does not know, and says
why. ^shr-trip-time-f1

- **Verification:** for each of the six kinds, with the time zones of Paris, New York and Tokyo,
    - create a value, read it back, and confirm its kind, local date, local times and time zone
      are unchanged
    - create a value with an unknown time zone, and confirm it is refused, with the reason

> **What does this buy?** A ticket, a timetable and a booking all give times in the local time of
> the place. A traveller copies them in as printed, and reads them back as printed.

> **Who decides a value's time zone?** The caller does. The itinerary, for instance, knows that a
> train leaves from Lyon, and gives trip-time Paris time. trip-time does not look a place up
> (`SHR:TRIP-TIME-NR1`).

> **Why imprecise kinds?** A traveller often plans before the details are known. A bus "in the
> morning" or a visit "some time on Tuesday" is still worth putting in the plan.

### SHR:TRIP-TIME-F2 — A value keeps its local clock time when its time zone's rules change

When the rules of a value's time zone change after the value is created, the value keeps its local
date and clock time. Its moment, as measured anywhere else, moves with the new rules. ^shr-trip-time-f2

- **Verification:** create an exact time of 09:10 on a summer date, Paris time, then
    - replace Paris's rules with rules that end daylight saving, and confirm the value still reads
      09:10, Paris time
    - confirm its order against an exact time in New York follows the new rules

> **What does this buy?** The train still leaves at the time printed on the ticket. A country that
> changes its clocks changes the timetables with them, so the local clock time is what stays true.

### SHR:TRIP-TIME-F3 — A local time that never happens is refused, with the reason and the nearest valid times

On the day a time zone's clocks go forward, trip-time refuses any value whose local time falls in
the hour that is skipped. The refusal says why, and gives the last valid time before the gap and
the first after it. ^shr-trip-time-f3

- **Verification:** with Paris time, on 29 March 2026, when the clocks go from 02:00 to 03:00,
    - create an exact time of 02:30, and confirm it is refused, with the reason
    - confirm the refusal gives 01:59 and 03:00
    - create exact times of 01:59 and 03:00, and confirm both are accepted

> **What does this buy?** A time that never happens is a typing mistake or a misread timetable.
> Moving it silently would put a train on the plan at a time the traveller never entered. The
> refusal lets the traveller check the ticket, and fix the time.

> **Does this apply to imprecise values?** Only to the clock times a traveller enters, such as an
> approximate time or a window's ends. A part of a day or a whole date that contains the skipped
> hour is accepted.

### SHR:TRIP-TIME-F4 — A local time that happens twice means its first occurrence, unless marked as the second

On the day a time zone's clocks go back, a local time in the repeated hour happens twice. trip-time
takes such a value to mean the first occurrence. A caller can mark it as the second. ^shr-trip-time-f4

- **Verification:** with Paris time, on 25 October 2026, when the clocks go from 03:00 back to
  02:00,
    - create an exact time of 02:30, and confirm it sorts before an exact time of 02:15 marked as
      the second occurrence
    - mark the 02:30 as the second occurrence, and confirm it now sorts after the 02:15
    - create an exact time of 02:30 on any other date, and confirm it cannot be marked as a
      second occurrence

> **What does this buy?** A repeated hour is rare, and comes once a year at most, in the middle of
> the night. A default lets nearly every traveller ignore it. The mark keeps the plan right for
> the night bus that does leave in the second 02:30.

### SHR:TRIP-TIME-F5 — A span gives the time that passes between its start and its end

trip-time gives the duration of a span as the time that actually passes, even when its start and
end are in different time zones. When either end is imprecise, the duration is the shortest and
the longest it could be. An approximate time counts as its stated time. ^shr-trip-time-f5

- **Verification:** create each span, and confirm its duration
    - leaving Paris at 10:00 and landing in New York at 12:30, on 3 June 2026: 8 hours 30 minutes
    - leaving at 01:00 and arriving at 04:00, Paris time, on 29 March 2026: 2 hours
    - leaving in the morning and arriving around 15:00, Paris time, on 3 June 2026: 3 to 9 hours
    - leaving between 14:00 and 16:00 and arriving at 18:00, Paris time, on 3 June 2026: 2 to 4
      hours

> **What does this buy?** A traveller sees how long a journey really takes, which the clock times
> at each end hide. A flight leaving at 10:00 and landing at 12:30 is not a two-and-a-half-hour
> flight.

> **Why count an approximate time as its stated time?** "Around 15:00" has no edge to measure
> from. Taking it as 15:00 gives a duration a traveller reads the way they meant it.

### SHR:TRIP-TIME-F6 — A span that certainly ends before it starts is refused

trip-time refuses a span whose end is before its start, whatever each end's possible times. A span
whose end only might come before its start is accepted. ^shr-trip-time-f6

- **Verification:** create each span, and confirm it is refused or accepted
    - leaving Paris at 10:00 and landing in New York at 03:00, on 3 June 2026: refused, with the
      reason
    - leaving in the morning and arriving around 11:00, Paris time, on 3 June 2026: accepted
    - leaving and arriving at 10:00, Paris time, on 3 June 2026: accepted

> **What does this buy?** An end before its start is a mistake, most often a wrong date or a
> wrong time zone, and it would give a negative duration. Refusing it then catches the mistake
> while the traveller still has the booking in front of them.

### SHR:TRIP-TIME-F7 — Values in any mix of time zones sort into one order

trip-time sorts any set of values by the moment each one happens, whatever their time zones. Each
kind of value sorts at one moment, which the table below gives. Of two values at the same moment,
an exact time sorts before an imprecise one. Values still tied keep the order the caller gave
them. ^shr-trip-time-f7

| Kind | Sorts at |
|---|---|
| **Exact time** | Its time |
| **Whole date** | The start of its date, ahead of every other value at that moment |
| **Date with time to be decided** | The end of its date, after every other value on that date |
| **Part of a day** | The start of its hours: morning from 06:00 to 12:00, afternoon from 12:00 to 18:00, evening from 18:00 to 22:00, and night from 22:00 to 06:00 the next day |
| **Approximate time** | Its stated time |
| **Window** | Its start |

- **Verification:** sort each set, and confirm its order
    - an exact time of 08:00 on 3 June 2026, Paris time, and one of 09:00 the same day, Tokyo
      time: Tokyo first
    - an exact time of 12:00 and the afternoon of the same date, Paris time: the exact time first
    - the whole date 3 June 2026, an exact time of 00:00 on it, and a date with time to be decided
      on it, all Paris time: in that order
    - the night of 3 June and an exact time of 02:00 on 4 June 2026, Paris time: the night first
    - two windows that start at the same moment, given in each order: in the order given

> **What does this buy?** A trip crosses time zones, and its plan must still read in the order
> things happen. A traveller flying east sees the hotel check-in after the landing, not before
> it.

> **Why fixed hours for each part of a day?** Imprecise values need a place in the order, and a
> traveller needs to predict it. Fixed hours are the same everywhere, so the afternoon in Paris
> sorts exactly as the afternoon in Tokyo does.

> **Which day of a trip does a value belong to?** trip-time does not say. An overnight bus could
> belong to the day it leaves, or the day it arrives. The itinerary decides
> (`SHR:TRIP-TIME-NR7`).

### SHR:TRIP-TIME-F8 — Every value is written as text in one form, in its local time, with its time zone

trip-time writes each kind of value as text in one form, in the value's local time, with its time
zone named. It follows the clock style and the date style the traveller chose. The text is in
English. ^shr-trip-time-f8

- **Verification:** write each of the six kinds as text, then confirm that
    - each kind is written in one form, which names the value's time zone
    - an exact time reads 14:30 with the 24-hour clock, and 2:30 pm with the 12-hour clock
    - a date reads 3 June 2026 with the day first, and June 3, 2026 with the month first
    - the same value gives the same text every time it is written

> **What does this buy?** Every screen of the app shows a time the same way. A traveller learns the
> form once, and never mistakes one kind of value for another, such as an approximate time for
> an exact one.

> **Where does the traveller choose the styles?** Outside trip-time. The caller passes the styles
> the traveller chose.

### SHR:TRIP-TIME-F9 — trip-time says how a value relates to now, in the value's own time zone

trip-time says how far a value is from the current moment, such as "in 3 hours", "tomorrow" or
"2 days ago". It works out today, tomorrow and yesterday in the value's own time zone. ^shr-trip-time-f9

- **Verification:** with the current moment fixed at 23:00 on 2 June 2026, Paris time,
    - confirm an exact time of 02:00 on 3 June, Paris time, is in 3 hours
    - confirm the whole date 4 June, Paris time, is the day after tomorrow
    - confirm the whole date 3 June, Tokyo time, is today, because it is already 06:00 on 3 June in
      Tokyo
    - confirm the whole date 1 June, Paris time, is yesterday

> **What does this buy?** On the road, "the bus leaves in 40 minutes" is what a traveller needs,
> not a clock time to subtract from their own.

> **Where does the current moment come from?** The device's clock. trip-time needs no connection
> to say how far away a value is (`SHR:TRIP-TIME-NFR1`).

---

## Non-functional requirements

### SHR:TRIP-TIME-NFR1 — trip-time works without a connection

Everything trip-time promises works on a device with no connection, using the time zone rules the
device holds. The device brings its rules up to date whenever it is online. ^shr-trip-time-nfr1

- **Verification:** on a phone,
    - disconnect it, and confirm each of `SHR:TRIP-TIME-F1` to `SHR:TRIP-TIME-F9` still holds
    - reconnect it after a change to a time zone's rules is published, and confirm the phone takes
      the new rules

> **What does this buy?** A traveller reads a trip on a phone with no connection (ADR-0004, a trip
> is read-only offline). Every time in the trip has to sort, read and count down there as well.

> **What if the device's rules are out of date?** trip-time uses them anyway, and gives no warning
> (`SHR:TRIP-TIME-NR6`). Countries change their rules rarely, and announce the change months
> ahead.

### SHR:TRIP-TIME-NFR2 — A value reads and sorts the same on every device, whatever time zone the device is set to

The text, the order and the durations trip-time gives do not depend on the time zone the device is
set to. ^shr-trip-time-nfr2

- **Verification:** on two devices, one set to London time and one to Tokyo time,
    - write the same values as text, and confirm the text is the same
    - sort the same values, and confirm the order is the same
    - measure the same spans, and confirm the durations are the same

> **What does this buy?** Two travellers on one trip often have devices set to different time
> zones, such as one who has just landed. Both read the same plan.

> **Why state it?** A device's own time zone is the one most easily used by mistake. The mistake
> shows only on a device set to another time zone, and a test run on one device never catches it.

---

## Non-requirements

| Identifier | trip-time does not | Because |
|---|---|---|
| **SHR:TRIP-TIME-NR1** | Find the time zone of a place | The caller gives each value's time zone. Finding it from a place is future work |
| **SHR:TRIP-TIME-NR2** | Show a value in any time zone but its own | Future work. A traveller reads each value in the local time of its place |
| **SHR:TRIP-TIME-NR3** | Write text in any language but English | Future work |
| **SHR:TRIP-TIME-NR4** | Hold seconds, or anything finer | Tickets, timetables and bookings give minutes |
| **SHR:TRIP-TIME-NR5** | Use any calendar but the Gregorian | Every booking and timetable a traveller copies in uses it |
| **SHR:TRIP-TIME-NR6** | Warn that the device's time zone rules may be out of date | The rules change rarely, and are announced months ahead (`SHR:TRIP-TIME-NFR1`) |
| **SHR:TRIP-TIME-NR7** | Decide which day of a trip a value belongs to | Which day an overnight bus belongs to is the itinerary's choice |

^shr-trip-time-nr

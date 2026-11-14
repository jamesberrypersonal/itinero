# The itinerary component

What the component `planner/itinerary` promises to the components that use it, and through them to
travellers. The itinerary holds a trip's calendar: the stretches a traveller pencils in, and the
firm items fixed to a date. It applies each change to a trip, and lays the trip out day by day. The
component registry, `components.md`, gives it the prefix `PLN:ITINERARY`.

Two roles appear below. A caller is a component that uses the itinerary, such as the web app. The
traveller is the role `requirements/README.md` defines.

The parts of a trip are those the planner's requirements define, in `requirements/planner/planner.md`.
A trip has a name, and holds stretches and firm items:

- **A place** is a country, or somewhere in one, such as Paris in France.
- **A stretch** is a place and the dates a traveller expects to be there, pencilled in. Its dates
  run from its first day to its last, both included.
- **A firm item** is something fixed to a date, such as a booked tour. It has a date, or a time that
  includes its date.
- **A firm item of travel** goes from one place to another, by a way of travelling such as a train.

Times are held by `shared/trip-time`, the component that holds a trip's dates and times in the
local time of their place. Four of its kinds of value hold a time: an exact time like 09:10, an
approximate time like around 14:00, a window like 14:00 to 16:00, and a part of a day like the
afternoon. trip-time works each time out from its copy of the world's time-zone rules, which is
updated as countries change their clocks (ADR-0008, trip-time carries its own copy of the
time-zone rules).

A change is one edit to a trip, such as moving a stretch or adding a firm item. A trip's revision
counts the changes applied to it.

---

## Functional requirements

### PLN:ITINERARY-F1 — A trip holds any arrangement of stretches, each changed freely

The itinerary adds a stretch to a trip, moves or resizes it to any dates, changes its place, and
removes it. It accepts stretches that leave gaps between them or that overlap, and a trip with no
stretches. It refuses a stretch whose last day is before its first, or whose dates do not exist,
and says why. ^pln-itinerary-f1

- **Verification:** on a new trip,
    - add France from 1 to 5 June 2026 and New York from 5 to 8 June, and confirm both read back
      unchanged
    - move New York to 10 to 12 June, and confirm the gap from 6 to 9 June is accepted
    - add Paris from 3 to 5 June, and confirm its overlap with France is accepted
    - add a stretch from 5 to 3 June, and one on 30 February, and confirm each is refused, with the
      reason

> **What does this buy?** The traveller pencils in a trip roughly and changes it often
> (`PLN-F1`). The itinerary never stands in the way of a half-built plan.

> **Why accept gaps and overlaps?** A rough plan has loose ends on purpose (ADR-0009, a trip's
> calendar is pencilled in).

> **Are any dates refused?** A stretch covers at most 366 days, and its dates fall between 1970 and
> 9999. A longer stay is two stretches.

### PLN:ITINERARY-F2 — Every place names a country, and each day gives the countries covering it

Every place names a country, and may also name somewhere in it. The itinerary refuses a country it
does not know. For each day, it gives the country of every stretch covering that day, each country
once. ^pln-itinerary-f2

- **Verification:** on a trip with France from 1 to 5 June 2026, Lyon in France from 1 to 3 June,
  and New York in the United States from 5 to 8 June,
    - confirm 2 June gives France, once
    - confirm 5 June gives France, then the United States
    - confirm 9 June gives no country
    - add a stretch in a country that does not exist, and confirm it is refused, with the reason

> **What does this buy?** The calendar shows which country each day is in (`PLN-F2`). A traveller
> planning several countries sees each one's share of the trip.

> **In what order are a day's countries given?** In the order of the stretches covering the day,
> by their first day. The stretch a traveller reaches first comes first.

### PLN:ITINERARY-F3 — A firm item has a title, and a date or a time in local time

The itinerary adds, changes and removes firm items. A firm item has a title, and either a date or a
time that includes its date. A time is of one of the four kinds that hold a time, in the time zone
the caller gives. The itinerary refuses a time that trip-time refuses, with trip-time's reason. ^pln-itinerary-f3

- **Verification:** on a new trip,
    - add a decided day to move on from Lyon on 3 June 2026, with no time, and confirm it reads back
      unchanged
    - add a museum visit on the afternoon of 4 June, Paris time, and confirm it reads back unchanged
    - add a dinner at 02:30 on 29 March 2026, Paris time, in the hour Paris's clocks skip, and
      confirm it is refused, with trip-time's reason
    - remove the museum visit, and confirm the trip no longer holds it

> **What does this buy?** The few fixed points of a trip are held exactly as they were booked
> (`PLN-F3`). A booking with no time, such as a park ticket for a day, needs no time made up.

> **Who decides a time's zone?** The caller does, from what the traveller chose. The itinerary
> does not look a place up (`PLN:ITINERARY-NR3`).

### PLN:ITINERARY-F4 — A firm item of travel holds where it goes, how, and when it leaves and arrives

A firm item of travel names the place it leaves, the place it reaches, and how the traveller
travels: by flight, train, bus, ferry, car, or another way. Its date or time is when it leaves. It
can also have a date or a time it arrives. The itinerary refuses travel that certainly arrives
before it leaves, whatever an imprecise time turns out to be. It gives the duration of travel that
has a time at both ends. ^pln-itinerary-f4

- **Verification:** on a new trip,
    - add a flight from Paris to New York leaving at 10:00 on 5 June 2026, Paris time, and arriving
      at 12:30, New York time, and confirm its duration is 8 hours 30 minutes
    - add a train from Lyon to Paris on 3 June, with no times, and confirm it is accepted, with no
      duration
    - add a flight leaving at 10:00 and arriving at 03:00 the same day, both Paris time, and
      confirm it is refused, with the reason

> **What does this buy?** A traveller copies a ticket's times in as printed, in each end's local
> time, and sees how long the journey really takes (`PLN-F4`).

> **Is travel needed between two stretches?** No. The itinerary holds travel only as a traveller
> adds it (ADR-0009, a trip's calendar is pencilled in).

### PLN:ITINERARY-F5 — The itinerary lays out a range of days, each with its stretches and its firm items in order

Given a range of dates, the itinerary lists each day in it. Each day gives the stretches covering
it, their countries, and its firm items. A day's firm items are in the order they happen, whatever
time zone each is in, with those that have only a date first. A firm item shows on every day from
its date to the last date it reaches, such as the day travel arrives. The itinerary also gives the
first and the last dates any stretch or firm item covers. ^pln-itinerary-f5

- **Verification:** on a trip with France from 1 to 5 June 2026 and New York from 5 to 8 June,
    - lay out 4 to 6 June, and confirm it gives three days, with France on 4 June, France and New
      York on 5 June, and New York on 6 June
    - add a coffee at 08:00 on 5 June, Paris time, a flight leaving Paris at 10:00 on 5 June, and a
      check-in between 14:00 and 16:00 on 5 June, New York time, and confirm 5 June lists coffee,
      flight, check-in
    - add a bus leaving New York at 22:30 on 8 June and arriving in Montreal at 07:00 on 9 June,
      and confirm it is listed on both days
    - confirm the itinerary gives the first and last dates any stretch or firm item covers

> **What does this buy?** The calendar shows what is fixed against the rough plan around it, and
> a day crossing time zones reads in the order it is lived (`PLN-F5`).

> **Why a range of days, rather than the whole trip?** A calendar shows a month or a week at a
> time. A trip with a stretch pencilled in years ahead would otherwise lay out every day between.
> A range covers at most 366 days.

### PLN:ITINERARY-F6 — The same changes, applied in the same order, give the same trip

The itinerary applies a change to a trip and gives the changed trip. Every change it applies
raises the trip's revision by one. A change sets whole fields, so of two changes to the same field,
the later one stands. Two copies of a trip that apply the same changes in the same order, under
the same time-zone rules, hold the same trip, wherever each is held. ^pln-itinerary-f6

- **Verification:** on two copies of the same trip,
    - apply the same ten changes, in the same order, to each, and confirm the two trips are equal
    - confirm each revision is ten more than it was
    - move one stretch twice, to two different dates, and confirm the second move stands

> **What does this buy?** A change a traveller makes is applied to the one copy of the trip held
> online, and every other traveller sees the same result (`PLN-F6`).

> **Who applies a change to the copy held online?** The component that holds it. That component is
> not yet registered.

### PLN:ITINERARY-F7 — A refused change leaves the trip as it was, and says why

The itinerary refuses a change it cannot apply, such as one naming a stretch the trip does not
hold. The refusal says what was refused and why. A refused change leaves the trip and its
revision unchanged. ^pln-itinerary-f7

- **Verification:** on a trip with one stretch,
    - move a stretch the trip does not hold, and confirm it is refused, with the reason
    - add the same stretch a second time, and confirm the second is refused, with the reason
    - confirm that after each refusal, the trip and its revision are unchanged

> **What does this buy?** A traveller whose change is refused keeps the trip as it was, and can see
> what to fix. No change is ever half applied.

### PLN:ITINERARY-F8 — A trip is written as text, and read back unchanged

The itinerary writes a trip as text, and reads that text back as the same trip. It reads back text
it wrote under an older copy of the time-zone rules. It refuses text that is not a trip it wrote,
and says why. ^pln-itinerary-f8

- **Verification:**
    - write a trip holding every kind of stretch and firm item as text, read it back, and confirm
      the two trips are equal
    - read back a trip written under one copy of the time-zone rules after loading another, and
      confirm every local time is unchanged
    - read back text that is not a trip, and confirm it is refused, with the reason

> **What does this buy?** A trip is stored online and copied to each phone for reading with no
> connection (ADR-0004, a trip is read-only offline). Both copies read the same trip.

### PLN:ITINERARY-F9 — A stretch or a firm item names at most one page of its trip

A stretch or a firm item can name one page of the trip, which the caller gives. The itinerary keeps
the name the caller gave, and lays it out with the stretch or the firm item. It keeps the name
after that page is deleted. ^pln-itinerary-f9

- **Verification:** on a new trip,
    - add a stretch naming a page, and confirm it reads back naming that page
    - change the stretch to name no page, and confirm it reads back naming none
    - add a firm item naming a page, lay out its day, and confirm the item names the page

> **What does this buy?** A traveller follows a stretch or a booking to its research (`PLN-F11`).

> **Does the itinerary know whether the page exists?** No. The pages are a component of their
> own, `planner/pages`. A caller showing the link asks it, and shows a deleted page as gone.

---

## Non-functional requirements

### PLN:ITINERARY-NFR1 — The itinerary works without a connection, and the same on every device

Everything the itinerary promises works on a device with no connection. Its results do not depend
on the time zone the device is set to. ^pln-itinerary-nfr1

- **Verification:**
    - on a phone with no connection, confirm `PLN:ITINERARY-F5` and `PLN:ITINERARY-F8` still hold
    - on two devices, one set to London time and one to Tokyo time, lay out the same days of the
      same trip, and confirm the results are the same

> **What does this buy?** A traveller reads a trip on a phone with no connection (ADR-0004, a trip
> is read-only offline). Two travellers whose phones are set to different time zones read the same
> calendar.

---

## Non-requirements

| Identifier | The itinerary does not | Because |
|---|---|---|
| **PLN:ITINERARY-NR1** | Store a trip, or send a change from one device to another | The component that holds the copy online does that. It is not yet registered |
| **PLN:ITINERARY-NR2** | Decide who may see or change a trip | The access system, which handles accounts and invitations, decides |
| **PLN:ITINERARY-NR3** | Find the time zone of a place | The caller gives each time's zone (`SHR:TRIP-TIME-NR1`) |
| **PLN:ITINERARY-NR4** | Warn of a gap, an overlap, or two stretches in a row with no travel between them | A rough plan has loose ends on purpose (`PLN-NR1`) |
| **PLN:ITINERARY-NR5** | Merge changes made on two devices while apart | A trip changes only while the traveller is online (ADR-0004, a trip is read-only offline) |
| **PLN:ITINERARY-NR6** | Hold a trip's pages | The pages are a component of their own, `planner/pages` |

^pln-itinerary-nr

# The screens

What the component `web/screens` promises to travellers. The screens are everything a traveller sees
and uses in Itinero: signing in, the list of trips, a trip's home page, its calendar, its bookings,
its pages of research, the traveller's own checklists and templates, and, for an admin, its members
and their access. The component registry,
`components.md`, gives it the prefix `WEB:SCREENS`.

What a traveller can do with a trip is promised by the planner, the bookings system and the access
system, in `requirements/planner/planner.md`, `requirements/bookings/bookings.md` and
`requirements/access/access.md`. The screens promise how the web app presents it. Each trip's copy
on the device comes from `web/trip-store`, the component that keeps it there. A device is a phone or
a computer a traveller signs in on.

---

## Functional requirements

### WEB:SCREENS-F1 — Every screen fits a phone and a computer, says when the device is offline, and offers no change while it is

Every screen fits the width of a phone held upright and of a computer's window, with nothing to
scroll sideways. While the device is offline, every screen of a trip says so, and when the trip was
last brought up to date, and offers no way to change anything. ^web-screens-f1

- **Verification:** on a trip through Chile,
    - open every screen on a phone 360 pixels wide, and confirm none scrolls sideways
    - take the device offline, open every screen of the trip, and confirm each says it is offline,
      with the time the trip was last brought up to date
    - confirm no screen shows a button, a field or a gesture that changes the trip

> **What does this buy?** A traveller reads a trip anywhere, and is never offered a change that
> cannot be made (`WEB-F1`, `WEB-F2`).

### WEB:SCREENS-F2 — The home page shows the traveller's day, their bookings for today and next, and the page for the country they are in

A trip opens on its home page, for the traveller looking. It shows how many days are left until
their first date, which day of their trip today is, or that their trip is over. It lists their
bookings for today, and their next three after today. Once the traveller asks it to, it finds the
country the phone is in on the phone itself, and links to the trip's page for that country, where
they may see it. ^web-screens-f2

- **Verification:** on a trip from 1 to 20 December, with a traveller whose own dates are 6 to 13
  December, a tour for them on 9 December and a flight for them on 11 December,
    - on 3 December, confirm the home page says 3 days are left
    - on 9 December, confirm it says day 4 of 8, lists the tour for today and the flight next
    - with the phone offline in Chile, tap to find the country, allow the location, and confirm the
      home page links to the page for Chile
    - confirm no request the phone sends holds its location or the country
    - on 14 December, confirm it says the trip is over

> **What does this buy?** A traveller sees what matters to them that day, on the road, without
> anyone else's plan (`PLN-F15`, `WEB-F6`).

> **Why only once the traveller asks?** A phone asks the traveller before it lets any site read its
> location. Asking only when they tap keeps the request from appearing before they know what it is
> for.

### WEB:SCREENS-F3 — The calendar shows each day's countries, stretches, firm items and bookings, and is shown only to a traveller granted it

The calendar shows each day of the trip with the countries of the stretches that cover it, each
stretch pencilled, and the day's firm items and bookings standing apart from them, in the order they
happen. A stretch or a firm item that names a page opens it. A traveller with no access to the
calendar is shown no calendar, and no sign of one. ^web-screens-f3

- **Verification:** on a trip with Chile pencilled from 1 to 10 December, Santiago in Chile from 1
  to 3 December naming the page Santiago, a firm item on 4 December, and a booked flight on 5
  December,
    - as a traveller granted the calendar, confirm 2 December shows Chile, and both stretches as
      pencilled, and 5 December the flight standing apart
    - tap Santiago's stretch, and confirm it opens the page Santiago
    - as a traveller with no access to the calendar, confirm no screen shows the calendar, or offers
      to open it

> **What does this buy?** A traveller granted the calendar sees the rough plan and what is fixed
> against it (`PLN-F1`, `PLN-F2`, `PLN-F5`, `ACC-F5`).

### WEB:SCREENS-F4 — The bookings page lists the traveller's bookings and opens at the next, and each booking is added and changed in a form of its kind

The bookings page lists the traveller's bookings under the date each starts, and opens at the first
booking not yet over. A traveller adds and changes a booking in a form for its kind, which asks only
for that kind's details. Each booking shows its details, how long each part takes where it has
parts, and its reference, which one tap copies. ^web-screens-f4

- **Verification:** on a trip with a stay, a tour and a two-leg flight, as a traveller they all name,
    - open the bookings page after the tour, and confirm it opens at the flight, with the stay and
      the tour above it
    - open the flight, and confirm it shows each leg's duration and the connection between them
    - tap the flight's reference, and confirm it is copied
    - add a journey, and confirm the form asks for how it goes, where it leaves from and arrives at,
      and its times, and not for a flight number

> **What does this buy?** A traveller finds what comes next at once, and enters a booking as the
> confirmation gives it (`BKG-F1`, `BKG-F3`, `BKG-F4`, `BKG:FLIGHT-F3`).

### WEB:SCREENS-F5 — Pages show their text formatted, open the pages they link to, and are searched with no connection

A page shows its Markdown text formatted, with no HTML of its own run. A link to another page of the
trip opens that page, and a link to a page the traveller may not see says only that it is not
available. The trip's pages are shown as their tree, and are searched with or without a connection.
A traveller who saves a page another traveller changed meanwhile is shown both texts. ^web-screens-f5

- **Verification:** on a trip whose page Chile holds a table, a link to Santiago and a link to a
  restaurant's website,
    - open Chile, and confirm the table is drawn as a table, and the links as links
    - put an HTML script in a page's text, open the page, and confirm the text is shown and the
      script never runs
    - follow the link to Santiago, and confirm Santiago opens
    - as a traveller who may not see Santiago, confirm the link says its page is not available,
      without its title
    - with no connection, search for a word of Santiago's text, and confirm Santiago is found
    - save Chile from an older version than another traveller's save, and confirm both texts are
      shown

> **What does this buy?** Research reads as it was written, and a page's text can never run code on
> another traveller's device (`PLN-F7`, `PLN-F9`, `PLN-F12`, `PLN-F16`, `ACC-F8`).

### WEB:SCREENS-F6 — An admin manages the trip's members and their access, and every traveller sees who is on it

Every traveller sees the trip's members, with its admins marked. An admin invites a traveller by
email address, with view or edit access to the trip and a level for the calendar. An admin
withdraws an invitation, makes a member an admin, removes a member, and changes a member's access
to the trip, the calendar or a branch of pages. A move that lets more travellers see a page says how
many, and asks first. ^web-screens-f6

- **Verification:** on a trip with an admin and two travellers,
    - as a traveller who is not an admin, confirm they see every member, with the admin marked, and
      no way to change anyone's access
    - as the admin, invite an address with view access and no calendar, and confirm the invitation
      is listed
    - give the first traveller no access to the page Santiago, and confirm it is accepted
    - as a traveller, move a page seen by fewer travellers under Chile, and confirm the screen says
      how many more will see it, and asks first

> **What does this buy?** An admin manages who sees what from the trip itself (`ACC-F2`, `ACC-F3`,
> `ACC-F5`, `ACC-F7`, `ACC-F9`, `ACC-F11`).

### WEB:SCREENS-F7 — Every time is written in its place's local time, in the clock and date order the traveller chooses

Every date and time is written in the local time of the place it happens, as `shared/trip-time`
writes it. A traveller chooses a 12-hour or a 24-hour clock, and whether dates are written day first
or month first. Until they choose, both follow the device's own settings. The choice is the
device's, and stays after signing out. ^web-screens-f7

- **Verification:**
    - on a device set to a 24-hour clock, confirm a train shows 09:10
    - choose a 12-hour clock, and confirm it shows 9:10 am
    - sign out and back in, and confirm the 12-hour clock is kept

> **What does this buy?** A traveller reads every time in the form they read most easily
> (`WEB-F7`, `SHR:TRIP-TIME-F8`).

### WEB:SCREENS-F8 — Deleting a page, a checklist or a template, removing a booking and removing a traveller each ask first

Before deleting a page, a checklist or a template, removing a booking or removing a traveller from
the trip, the screens ask the traveller to confirm, saying what will go. Deleting a page says how many pages beneath it go
with it. ^web-screens-f8

- **Verification:**
    - delete a page with three pages beneath it, and confirm the screen says four pages will go, and
      asks first
    - decline, and confirm nothing is deleted
    - remove a booking, remove a traveller, delete a checklist and delete a template, and confirm
      each asks first

> **What does this buy?** A slip of the finger never removes something a traveller then has to
> enter again, or an admin has to restore (`PLN-F8`, `BKG-NR5`). A deleted checklist or template
> cannot be restored at all (`PLN-F17`, `PLN-F18`).

### WEB:SCREENS-F9 — A traveller signs in with Google, and signs out, and a computer says its trips stay until they do

The sign-in screen offers Google's own sign-in button. Signing in on a computer says that its trips
stay on it until the traveller signs out. Signing out is offered from every trip's menu. ^web-screens-f9

- **Verification:**
    - sign in on a phone with a Google account, and confirm the list of trips opens
    - sign in on a computer, and confirm the screen says its trips stay until the traveller signs out
    - sign out from a trip's menu, and confirm the sign-in screen opens

> **What does this buy?** A traveller signs in with an account they already have, and knows to sign
> out of a shared computer (`ACC-F1`, `WEB-F5`).

### WEB:SCREENS-F10 — A traveller signing in for the first time chooses their name before anything else, and changes it later

A traveller signing in for the first time, from an invitation or not, is asked for their name before
any other screen opens. The name starts as the one their Google account gives. A traveller changes
their name in their settings while online. Every screen names each traveller by their name. ^web-screens-f10

- **Verification:** with a Google account named Sam Taylor that has never signed in,
    - open an invitation for its address, sign in, and confirm the next screen asks for a name,
      starting as Sam Taylor, before the invitation is accepted
    - change it to Sam, and confirm the invitation is then accepted, and the trip opens
    - confirm the members screen, and each booking naming them, show Sam
    - in the settings, change the name to Sam T, and confirm every screen shows Sam T

> **What does this buy?** A new member is known by the name they chose from their first moment on
> the trip (`ACC-F13`).

### WEB:SCREENS-F11 — A trip's checklists have a screen of their own, where the traveller starts, ticks and arranges theirs

A trip's checklists have a screen of their own, apart from the pages, which every screen of the trip
links to. It lists the traveller's own checklists on the trip, in their order, each with how many of
its items are ticked. A traveller starts a checklist there, empty or from one of their templates,
and saves one as a template. In a checklist, they tick and untick items, and add, change, reorder
and remove them. A ticked item keeps its place, marked as done. ^web-screens-f11

- **Verification:** on a trip, as a traveller whose library holds Before leaving, with four items,
    - open the checklists from the trip's bar, start a checklist from Before leaving, and confirm it
      is listed with 0 of 4 ticked
    - tick the second item, and confirm it stays second, marked as done, and the list says 1 of 4
    - add an item, move it to the top, and rewrite it, and confirm each is shown at once
    - save the checklist as a template, and confirm the library lists it
    - with the device offline, confirm the checklists are shown, and no control ticks or changes
      them

> **What does this buy?** A traveller works through their own lists for a trip in one place, apart
> from the research the travellers share (`PLN-F18`, ADR-0024, a traveller's checklists are their
> own).

> **Why does a ticked item keep its place?** The traveller gave the order. An item that moved as it
> was ticked would put another under their finger.

### WEB:SCREENS-F12 — A traveller keeps their templates on a screen of their own, reached from any trip

A traveller's library has a screen of its own, which every screen's menu links to, whichever trip
is open, and which the checklists of a trip link to. It lists the traveller's templates, in their
order, each with how many items it holds. A traveller adds, renames, arranges and deletes templates
there, and adds, changes, reorders and removes each template's items. ^web-screens-f12

- **Verification:** as a traveller with a library holding Before leaving,
    - open the library from the menu of a trip, and from the list of trips, and confirm each lists
      Before leaving with its number of items
    - add the template Packing, give it three items, and move it to the top, and confirm the library
      lists Packing first, with 3 items
    - confirm a template offers no way to tick an item
    - with the device offline, confirm the library is shown, and no control changes it

> **What does this buy?** A traveller keeps the lists they use for every trip in one place, outside
> any trip (`PLN-F17`).

### WEB:SCREENS-F13 — Until their trip starts, the home page lists the traveller's checklists not yet done

Before the first of the traveller's own dates, the home page lists each of their checklists on the
trip with an item not yet ticked, in their order, each with how many of its items are ticked, and
each opening that checklist. From their first date on, the home page lists no checklist. ^web-screens-f13

- **Verification:** on a trip with a traveller whose own dates are 6 to 13 December, with the
  checklists Before leaving, 2 of 5 ticked, and Packing, 4 of 4 ticked,
    - on 3 December, confirm the home page lists Before leaving, 2 of 5, and not Packing
    - tap Before leaving, and confirm it opens
    - on 6 December, confirm the home page lists no checklist

> **What does this buy?** In the days before leaving, a traveller sees what is left to do as soon as
> they open the trip (`PLN-F18`).

> **Why not once the trip has started?** On the road the home page is about the day: its bookings
> and the country. A checklist is still a tap away in the trip's bar.

---

## Non-functional requirements

### WEB:SCREENS-NFR1 — The home page is drawn quickly from the device's copy

Given a trip's copy holding 500 pages and 300 bookings, the screens draw its home page within 500
milliseconds, on a phone. ^web-screens-nfr1

- **Verification:** on such a phone, with no connection,
    - open the trip ten times, and confirm the home page is drawn within 500 milliseconds of its
      copy being given each time

> **What does this buy?** With the shell and the trip store, a trip opens within two seconds
> (`WEB-NFR1`).

### WEB:SCREENS-NFR2 — The map of country borders is small

The map of country borders the home page uses is at most 500 kilobytes, compressed as it is sent. ^web-screens-nfr2

- **Verification:**
    - measure the map as the web app serves it, and confirm it is at most 500 kilobytes

> **What does this buy?** The first download stays within 3 megabytes (`WEB-NFR2`).

---

## Non-requirements

| Identifier | The screens do not | Because |
|---|---|---|
| **WEB:SCREENS-NR1** | Show any language but English | Itinero is in English alone, for now (`WEB-NR6`) |
| **WEB:SCREENS-NR2** | Show a map of the trip, or of where a booking is | A map needs a connection and a service to draw it. Places are text |
| **WEB:SCREENS-NR3** | Link to the page for the city the phone is in | Finding the city is future work (`WEB-NR7`) |
| **WEB:SCREENS-NR4** | Run any HTML written in a page's text | A page's text could otherwise run code on another traveller's device |

^web-screens-nr

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

### WEB:SCREENS-F14 — The form for a new page starts with the headings a traveller researches under

The form for a new page, at the top of the trip or beneath another page, opens with its text
holding the headings the pages component gives a new page (`PLN:PAGES-F11`). The traveller writes
beneath them, rewrites them or deletes them before saving, and the page saved holds the text as
the traveller left it. ^web-screens-f14

- **Verification:** on a trip with the page Chile,
    - open the form for a new page at the top of the trip, and confirm its text holds General Info,
      Getting Around, Things to Do, Places to See, Food to Eat, with Dishes to Try and Where to Eat
      beneath it, and Nightlife, and not Emergency Info
    - open the form for a new page beneath Chile, and confirm its text holds the same headings
    - delete Nightlife, write a line under Getting Around, save, and confirm the page shows the
      headings and the line as left

> **What does this buy?** Every city and every place a traveller adds starts laid out like the
> trip's country pages, so the research is in the same place on each (`PLN-F7`).

### WEB:SCREENS-F15 — A firm item's address shows on its card, and opens the device's maps app

The form of a firm item, travel or not, offers an address of one line, which the traveller may
leave empty. The calendar shows a firm item's address on its card. A tap on the address opens the
device's maps app, searching for the address as written. With no connection, the address still
shows, and the traveller can copy it (ADR-0025, a firm item may hold an address). ^web-screens-f15

- **Verification:** on a trip with Chile pencilled from 1 to 10 December,
    - add a hike on 4 December with the address "Hotel Las Torres, Torres del Paine", and confirm
      its card shows the address
    - add a dinner on 4 December with the address left empty, and confirm its card shows none
    - on an iPhone, tap the hike's address, and confirm Apple Maps opens, searching for it
    - on a computer that is not a Mac, tap it, and confirm Google Maps opens, searching for it
    - with no connection, confirm the hike's card still shows its address
    - change the hike's address, save, and confirm the card shows the new one

> **What does this buy?** On the day, a traveller reaches the trailhead or the restaurant from the
> item itself, with no page written for it (`PLN-F3`).

### WEB:SCREENS-F16 — A page dragged in the tree goes before, after or beneath the page it is dropped on

A traveller who may move a page drags it in the tree onto another page's row. Dropped on the top
of the row, the page goes before that page, among its siblings. Dropped on the bottom, it goes
after that page. Dropped on the middle, it goes beneath that page, after the last page there. While
the page is held, the tree shows where it would go. ^web-screens-f16

- **Verification:** on a trip whose page Chile holds Santiago, Puerto Natales and Punta Arenas, in
  that order, on a phone and on a computer,
    - drag Punta Arenas onto the top of Santiago's row, and confirm Chile holds Punta Arenas,
      Santiago and Puerto Natales, in that order
    - drag Punta Arenas onto the bottom of Puerto Natales's row, and confirm it is last again
    - drag Puerto Natales onto the middle of Santiago's row, and confirm it is beneath Santiago

> **What does this buy?** A traveller puts a country's cities in the order they visit them, with
> one gesture (`PLN-F8`).

> **What of the bottom of a row whose branch is open?** The pages beneath it show directly below
> it, so a page dropped there goes first beneath it, where the tree shows the line.

### WEB:SCREENS-F17 — A page lists the pages beneath it, and links to the pages before and after it

Under its text, a page lists the pages directly beneath it, in the tree's order, each opening that
page. It then links to the page before it and the page after it, among the pages beside it in the
tree, where it has them. A page the traveller may not see is neither listed nor linked. ^web-screens-f17

- **Verification:** on a trip whose page Chile holds Santiago, Puerto Natales and Punta Arenas, in
  that order,
    - open Chile, and confirm it lists Santiago, Puerto Natales and Punta Arenas beneath its text
    - tap Puerto Natales, and confirm it opens, linking to Santiago before it and Punta Arenas
      after it
    - tap Punta Arenas, and confirm it opens
    - open Santiago, and confirm it links to Puerto Natales after it, and to no page before it
    - as a traveller who may not see Puerto Natales, confirm Chile lists Santiago and Punta Arenas
      alone, and Santiago links to Punta Arenas after it

> **What does this buy?** A traveller goes from one city to the next in one tap, without going back
> through the country's page or the tree (`PLN-F8`).

> **Why the pages before and after, and not every page beside it?** A country of many cities would
> repeat its whole list on each city. The page above already lists them, one tap back.

### WEB:SCREENS-F18 — The tree keeps open the branches a traveller opened, on that device, until they sign out

The tree of a trip's pages opens with each branch the traveller left open on that device. It keeps
them after they leave the tree, and after Itinero is closed and opened again. Each trip keeps its
own. Signing out forgets them. ^web-screens-f18

- **Verification:** on two trips, each with a page Chile holding Santiago,
    - on the first trip, open Chile's branch, open Santiago, go back to the tree, and confirm
      Chile's branch is open
    - open the second trip's tree, and confirm its Chile is folded
    - close Itinero, open the first trip's tree again, and confirm Chile's branch is open
    - fold Chile, open the tree again, and confirm Chile is folded
    - open Chile's branch, sign out and back in, and confirm Chile is folded

> **What does this buy?** A traveller working through one country's cities opens the country once
> (`PLN-F8`).

> **Why keep them after Itinero closes?** A phone closes an app in the background whenever it needs
> the memory, so a traveller reading between two cities would find the tree folded again. The
> branches hold nothing of the trip but which pages are open, and go with the trips on signing out.

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

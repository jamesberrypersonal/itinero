# The planner

What the planner system promises to travellers. The planner holds each trip: a calendar the
traveller pencils the trip in on, the dates that are fixed, the pages where travellers write up
their research, and each traveller's own checklists. The component registry, `components.md`, gives it the prefix `PLN`.

Two roles appear below, the traveller and the admin, which `requirements/README.md` defines. Which
traveller may see or change each part of a trip is promised by the access system, the system that
handles accounts, invitations and who may see each page, not here.

A trip is built from these parts:

| Part | Is | Such as |
|---|---|---|
| **Trip** | One journey, with a name | Twelve days in France, the United States and Canada in June 2026 |
| **Place** | A country, or somewhere in one | France, or Paris in France |
| **Stretch** | A place, and the dates a traveller expects to be there, pencilled in | Paris, from 3 to 5 June |
| **Firm item** | Something decided but not booked, fixed to a date, with a time if it has one | A bus from New York to Montreal on 8 June, not yet booked |
| **Booking** | Something booked, fixed to a date, for the travellers it names | A booked flight from Paris to New York on 5 June, leaving at 10:00 |
| **Page** | Research a traveller writes by hand, belonging to one trip | Notes on where to eat in Lyon |
| **Graveyard** | The pages travellers have deleted from a trip, kept so that they can be restored | A city's notes, deleted with the city |
| **Checklist** | A title and a list of items, each ticked or not, belonging to one traveller on one trip | Before leaving: passport valid for six months, copies of documents, travel insurance |
| **Template** | A checklist a traveller keeps for themselves, outside any trip, to start a trip's checklists from | The same Before leaving, kept for every trip |

A trip's calendar holds pencilled stretches and firm items. A trip's bookings have a page of their
own, and the calendar shows them too (ADR-0013). A day of a trip is one calendar date. A firm item's
time is in the local time of the place it happens. The web app fills in that place's time zone
where it knows the place, and the traveller may choose another (`PLN-NR5`). Times are held by `shared/trip-time`, the
component that holds a trip's dates and times. It holds four kinds of value with a time: an exact
time like 09:10, an approximate time like around 14:00, a window like 14:00 to 16:00, and a part of
a day like the afternoon.

---

## Functional requirements

### PLN-F1 — A traveller pencils a trip in on a calendar, as stretches they move freely

A traveller creates a trip and gives it a name. They pencil in stretches on the trip's calendar,
each a place and the dates they expect to be there. The traveller moves and resizes any stretch at
any time. The calendar shows each stretch so that it reads as distinct from a firm item. ^pln-f1

- **Verification:** on a running system,
    - create a trip, and pencil in France from 1 to 5 June 2026, Lyon in France from 1 to 3 June,
      New York in the United States from 5 to 8 June, and Montreal in Canada from 9 to 12 June
    - confirm the calendar shows all four stretches on their dates, each distinct from a firm item
    - move Montreal to 10 to 13 June, confirm the other stretches are unchanged, then move it back
    - create a second trip with nothing pencilled in, and confirm it is accepted

> **What does this buy?** A traveller plans the rough shape of a trip before anything is booked.
> They see it on a calendar, and change their mind as often as they like.

> **Is a gap or an overlap a mistake?** No. A gap between two stretches and two stretches that
> overlap are both accepted, and nothing warns of either (`PLN-NR1`).

### PLN-F2 — The calendar shows which country each day of a trip is in

The calendar shows, for each day, the country of every stretch that covers it. A day covered by
stretches in two countries shows both. ^pln-f2

- **Verification:** on the trip of `PLN-F1`,
    - confirm 2 June shows France, once
    - confirm 5 June shows France and the United States
    - confirm 9 June shows Canada
    - move Montreal to 10 to 13 June, and confirm 9 June shows no country

> **What does this buy?** A trip across several countries is first planned country by country. The
> traveller sees at a glance roughly when they will be in each one.

> **Does a country hold anything, such as its entry rules?** No. A country is a name on a stretch
> (ADR-0013, a trip's calendar is pencilled in, and its bookings have a page of their own).

### PLN-F3 — A traveller adds firm items, each fixed to a date

A traveller adds a firm item to a trip, with a title and a date. A firm item can also have a time,
of any of the four kinds with a time, in the local time of the place it happens. ^pln-f3

- **Verification:** on the trip of `PLN-F1`,
    - add a museum visit on the afternoon of 4 June, Paris time, and confirm it reads back with its
      date and time
    - add 3 June, the day the traveller has decided to move on from Lyon, as a firm item with no
      time, and confirm it is accepted
    - change the museum visit to 2 June, and confirm it moves to 2 June

> **What does this buy?** Only a few things in a loosely planned trip are fixed, but those few must
> not be missed. A traveller records each one where they will see it.

> **What counts as a firm item?** Anything decided and fixed to a date but not booked, such as a
> day to move on, or a bus not yet booked. Something booked is a booking, which has a page of its
> own.

### PLN-F4 — A firm item of travel records how the traveller travels, and when they leave and arrive, each in local time

A firm item can be travel from one place to another. A traveller records how they travel: by
flight, train, bus, ferry, car, or another way. They can also record when it leaves and when it
arrives, each in the time zone the traveller chooses for that end. The planner shows how long the
travel takes. It refuses travel that certainly arrives before it leaves, whatever an imprecise time
turns out to be, and says why. ^pln-f4

- **Verification:** on the trip of `PLN-F1`,
    - add a planned flight from Paris to New York leaving at 10:00 on 5 June, Paris time, and
      arriving at 12:30, New York time, and confirm it reads 10:00 Paris time, 12:30 New York time,
      taking 8 hours 30 minutes
    - add a train from Lyon to Paris on 3 June, with no times, and confirm it is accepted
    - add travel leaving at 10:00 and arriving at 03:00 the same day, both Paris time, and confirm
      it is refused, with the reason

> **What does this buy?** A timetable gives each end of a journey in the local time of its place.
> The traveller copies both in as printed, and sees how long the journey really takes.

> **Is travel needed between every two stretches?** No. Travel appears on the calendar only once a
> traveller adds it, as a firm item or as a booking (ADR-0013, a trip's calendar is pencilled in,
> and its bookings have a page of their own).

### PLN-F5 — The calendar shows firm items and bookings apart from the pencilled stretches, in the order they happen

The calendar shows each firm item, and each booking the traveller may see, on the day of its local
date, so that it stands out from the stretches around it. Travel that runs overnight shows on every
day it covers. The firm items of each day, with its bookings, are listed in the order they happen,
whatever time zone each is in. ^pln-f5

- **Verification:** on the trip of `PLN-F1`, with the flight of `PLN-F4`,
    - confirm the flight shows on 5 June, apart from the pencilled stretches of France and New York
    - add a booking for a hotel check-in between 14:00 and 16:00 on 5 June, New York time, and a
      coffee at 08:00 on 5 June, Paris time, and confirm 5 June lists coffee, flight, check-in
    - add a bus leaving New York at 22:30 on 8 June and arriving in Montreal at 07:00 on 9 June,
      and confirm it shows on both days

> **What does this buy?** The traveller sees what is fixed against the rough plan around it. A day
> that crosses time zones still reads in the order it is lived.

> **What if a firm item falls outside its place's stretch?** The calendar shows both as they stand.
> A flight from New York on 10 June, with New York pencilled in until 8 June, moves neither of them.

> **Where does the order come from?** From the order `shared/trip-time` gives, which places each
> kind of value at one moment (`SHR:TRIP-TIME-F7`).

### PLN-F6 — A change one traveller makes is seen by every other traveller on the trip

When a traveller changes a trip, every other traveller who can see that part of the trip sees the
change within a few seconds, if they have the trip open with a connection. Otherwise, they see it
the next time they open the trip with a connection. ^pln-f6

- **Verification:** with two travellers on the same trip, each on their own device,
    - have the first pencil in a stretch, and confirm the second sees it on opening the trip
    - have the first move a firm item to another day, and confirm the second sees it on the new day
    - have the second change a planned flight's time, and confirm the first sees the new time
    - with both holding the trip open, have the first rename a page, and confirm the second sees the
      new title within 2 seconds, without reopening the trip

> **What does this buy?** Travellers plan a trip together. Each one has to be able to trust that
> the plan they open is the one everyone else is working from.

> **What about a phone with no connection?** It shows the trip as it stood when the phone was last
> online, and accepts no changes (ADR-0004, a trip is read-only offline).

### PLN-F7 — A traveller writes research on the pages of a trip

A traveller adds any number of pages to a trip, each with a title and text written by hand in
Markdown, the plain-text format for headings, lists, tables, checklists and links. A page's text can
hold links to other websites. The planner imposes no structure on the text. Every page belongs to
one trip. ^pln-f7

- **Verification:** on a running system,
    - add a page titled "Eating in Lyon" to a trip, write text holding a heading, a checklist, a
      table and a link to a restaurant's website, and confirm the page reads back as written
    - follow the link, and confirm it opens the restaurant's website
    - open another trip, and confirm the page is not among its pages

> **What does this buy?** Most of the planning for a trip is research: where to stay, what to see,
> where to eat. The traveller keeps it beside the trip it is for, rather than in a separate
> spreadsheet.

> **How are a trip's pages arranged?** In a tree, with links between any two (`PLN-F8`,
> `PLN-F9`).

### PLN-F8 — A trip's pages form a tree, which a traveller rearranges freely

Each page of a trip sits under at most one other page, or at the top of the trip, nested to any
depth. A traveller moves a page, with every page beneath it, to the top or under any other page,
except a page beneath it.
The pages under one page keep the order the traveller gives them. Deleting a page moves it, with
every page beneath it, to the trip's graveyard, once the traveller confirms, having been told how
many pages that is. ^pln-f8

- **Verification:** on a trip with the pages Chile, Santiago under Chile, and Eating in Santiago
  under Santiago,
    - move Santiago to the top, and confirm Eating in Santiago moves with it
    - try to move Chile under Eating in Santiago, and confirm it is refused, with the reason
    - add a page W trek under Chile, put Santiago under Chile before it, and confirm the pages under
      Chile read Santiago, W trek
    - delete Santiago, and confirm the planner asks first, saying one page beneath it will go
    - confirm the delete, and confirm Santiago and Eating in Santiago have both left the tree for
      the graveyard

> **What does this buy?** A long trip's research stays grouped, such as a country's cities under
> the country, without the planner choosing the groups (ADR-0011, a trip's pages form a tree).

> **Why does deleting a page take the pages beneath it?** They usually belong with it, such as a
> city's notes under the city. The confirmation guards against deleting a whole branch by mistake,
> and an admin can restore a branch even after a delete the traveller confirmed (`PLN-F13`).

### PLN-F9 — A page links to any other page of its trip, and the link survives renaming and moving

A page's text can link to any other page of the same trip, in any branch of the tree, as many times
as the traveller likes. Following a link opens the page it points to. The link still points to its
page after that page is renamed or moved. A link to a page in the graveyard stays in the text, and
shows that its page is in the graveyard. ^pln-f9

- **Verification:** on the trip that `PLN-F8`'s verification sets up, as it stands before Santiago
  is deleted, with a page Transport at the
  top,
    - link Transport's text to Santiago and to W trek, and confirm each link opens its page
    - rename Santiago to Santiago de Chile, move it to the top, and confirm the link still opens it
    - delete W trek, and confirm its link stays in Transport's text, shown as pointing to a page in
      the graveyard

> **What does this buy?** Research cuts across the tree. A page on transport links to each city it
> mentions, wherever each sits.

### PLN-F10 — A traveller creating a trip chooses its countries, and each gets a page

A traveller creating a trip can choose the countries it will visit. The planner creates a page at
the top of the trip for each, titled with the country's name. Each is then an ordinary page. ^pln-f10

- **Verification:** on a running system,
    - create a trip, choosing Chile and Argentina, and confirm it has a page titled Chile and one
      titled Argentina, both at the top
    - rename, move and delete the Argentina page, and confirm each is accepted
    - create a trip choosing no countries, and confirm it has no pages

> **What does this buy?** Research for a trip across several countries starts country by country.
> The traveller begins with a place for each.

### PLN-F11 — A stretch or a firm item links to a page of its trip

A traveller links a stretch or a firm item on the trip's calendar to one page of the same trip.
Following the link opens the page. ^pln-f11

- **Verification:** on a trip with Santiago pencilled in, a page titled Santiago, and a page Eating
  in Santiago beneath it,
    - link the stretch to the page, and confirm following the link opens it
    - link a planned market visit to the page Eating in Santiago, and confirm following the link
      opens it
    - delete the page Santiago, and confirm the stretch shows that its page is in the graveyard

> **What does this buy?** The research for where the traveller is, or for what is booked, is one
> step from the calendar.

> **Who may read or change a page?** The access system, which handles accounts and invitations,
> decides page by page.

### PLN-F12 — A traveller searches the text of every page of a trip, with or without a connection

A traveller searches a trip's pages for a word or a phrase. The planner lists every page in the
tree whose title or text holds it, with the words around its matches, whether capitals and accents
match or not. Search works the same on a phone with no connection, over the pages the phone holds:
the pages of the tree the traveller may see. It never finds a page in the graveyard. ^pln-f12

- **Verification:** on the trip that `PLN-F8`'s verification sets up, as it stands before Santiago
  is deleted, with "Try the empanadas in
  Valparaíso" in the text of Eating in Santiago,
    - search for "empanadas", and confirm Eating in Santiago is listed, with the words around the
      match
    - search for "EMPANADAS", and for "valparaiso" with no accent, and confirm each lists Eating in
      Santiago
    - with no connection, search for "empanadas", and confirm the same result
    - delete Eating in Santiago, search for "empanadas", and confirm nothing is listed

> **What does this buy?** A long trip gathers a lot of research. A traveller who remembers a word,
> but not the page it is on, finds it in one step, on the road as well as at home.

### PLN-F13 — A traveller sees the deleted pages they could see as a list, and an admin reads and restores them

Each traveller on a trip sees its graveyard as a list of the deleted pages they could see before the
delete. Each is listed with its title and the number of pages that went with it. Only an admin can
open a page in the graveyard to read it, or restore it. A restored page returns, with every page
that went to the graveyard with it, under its old parent. A deleted page whose parent is in the
graveyard is not listed, and is restored only after the page above it. Nothing deletes a page from
the graveyard. ^pln-f13

- **Verification:** on the trip that `PLN-F8`'s verification sets up, with Santiago deleted,
    - as a traveller who is not an admin, and who could see Santiago, confirm the graveyard lists
      Santiago, with one page beneath it, and confirm opening it is refused
    - as a traveller who could not see Santiago, confirm the graveyard does not list it
    - as an admin, open Santiago and Eating in Santiago, and confirm each reads as it was written
    - restore Santiago, and confirm it returns under Chile with Eating in Santiago beneath it, and
      that links to it open it again
    - delete Santiago, then Chile, and confirm the graveyard lists Chile, and not Santiago
    - restore Chile, then Santiago, and confirm Santiago returns under Chile

> **What does this buy?** A branch of research deleted by mistake, such as a country's, is not
> lost. Restoring it is left to an admin, because who may read each page is set page by page.

> **Why is a page restored only after the page above it?** Restored alone, it could return only to
> the top of the trip. Travellers its branch was hidden from could see it there (ADR-0021, a
> deleted page is restored only to its old place).

> **Is the graveyard on a phone with no connection?** No. The phone's copy of a trip holds only the
> pages in the tree, so the graveyard never makes it larger. With no connection, a link to a page in
> the graveyard shows only that its page is not on the phone.

### PLN-F14 — A trip has its own first and last dates, and each traveller has theirs within them

The traveller who creates a trip sets its first and last dates. Each traveller, on joining the trip,
can set their own first and last dates, which fall within the trip's. A traveller who sets none has
the trip's dates. The planner refuses a traveller's dates outside the trip's, and refuses to change
the trip's dates so that a traveller's would fall outside them, naming each such traveller. ^pln-f14

- **Verification:** on a running system,
    - create a trip from 1 to 20 December, and confirm those are its dates
    - join it as a second traveller, set 6 to 13 December, and confirm they are accepted
    - set 28 November to 3 December as the second traveller's dates, and confirm it is refused,
      with the reason
    - change the trip to 8 to 20 December, and confirm it is refused, naming the second traveller

> **What does this buy?** A companion joining for one week of a month has a trip of their own
> length, and the home page counts their days, not everyone's (`PLN-F15`).

> **Why not work the dates out from the calendar?** A traveller who may not see the calendar would
> learn its span from them (ADR-0014, a trip opens on a home page for each traveller).

### PLN-F15 — A trip opens on a home page for each traveller, with their own day, bookings and country

Opening a trip shows a home page for the traveller looking. Before their first date, it says how
many days are left until it. During their dates, it says which day of their trip today is. After
their last date, it says their trip is over. It lists their bookings for today, and their next
ones. When the traveller lets the app read the phone's location, it links to the trip's page for
the country they are in. The location never leaves the phone. ^pln-f15

- **Verification:** on the trip of `PLN-F14`, as the second traveller, with a booked tour on 9
  December for them and a booked flight on 9 December for the first traveller only,
    - on 3 December, confirm the home page says 3 days are left
    - on 9 December, confirm it says day 4 of 8, and lists the tour, and not the flight
    - with the phone in Chile, and the trip holding a page made for Chile, confirm the home page
      links to that page
    - confirm no request the phone sends holds its location
    - on 14 December, confirm it says the trip is over

> **What does this buy?** A traveller opening a trip sees what matters to them that day, on the
> road, without seeing anyone else's plan.

> **Why the country, and not the city?** Finding the city on the phone needs far more data held
> there. The country is all the home page knows, for now (`PLN-NR7`).

### PLN-F16 — A traveller's edit to a page another traveller changed meanwhile is refused, and shows both texts

When a traveller saves a page that another traveller changed after the first began editing it, the
planner refuses the save, and loses neither text. It shows the traveller both, theirs and the page
as it now stands, for them to combine and save again. ^pln-f16

- **Verification:** with two travellers editing Eating in Santiago at once, each on their own
  device,
    - have the first save, then the second, and confirm the second's save is refused
    - confirm the second is shown their own text and the first's, and can save a text combining both
    - confirm the first's save stands in the meantime

> **What does this buy?** Two travellers writing up the same research at once never lose either's
> work without being told.

> **Why not combine the two texts automatically?** It is a larger design, and future work
> (`PLN-NR8`).

### PLN-F17 — A traveller keeps checklist templates of their own, outside any trip

A traveller keeps any number of templates, each a checklist with a title and items in the order
they give. A template belongs to the traveller and to no trip. Only that traveller sees it or
changes it. A traveller can also save a checklist of a trip as a new template. They arrange their
templates in the order they choose, and delete one for good once they confirm. ^pln-f17

- **Verification:** on a running system, with a traveller on two trips, and another traveller who
  is an admin of both,
    - add a template titled "Before leaving", with the items "Passport valid for six months",
      "Copies of documents" and "Travel insurance", and confirm it reads back with its items in that
      order
    - open each trip in turn, and confirm the template can be started on each
    - sign in as the admin, and confirm the template is shown on neither trip
    - on one trip, save a checklist as a template, and confirm the new template holds its title and
      items, none ticked, at the end of the library
    - move the new template above Before leaving, and confirm the library lists it first
    - delete the new template, confirm the traveller is asked first, and confirm it is then gone
    - on a phone with no connection, confirm the library reads as it was last changed

> **What does this buy?** A traveller writes a list they keep for every trip once, rather than once
> for each trip.

> **Can a template hold anything but a checklist?** No. A template holds a title and a list of
> items. A page still belongs to one trip (`PLN-NR4`).

### PLN-F18 — A traveller starts checklists of their own on a trip, and ticks their items

A traveller adds any number of checklists to a trip, each empty or copied from one of their
templates, with no item ticked. They tick and untick each item, and add, change, reorder and
remove items. They arrange their checklists on the trip in the order they choose, and delete one
for good once they confirm. A checklist and the template it was copied from change apart from each
other. A checklist is its traveller's alone, and no other traveller on the trip sees it, an admin
included. A traveller who leaves a trip and rejoins it finds their checklists as they left
them. ^pln-f18

- **Verification:** on a running system, with the template of `PLN-F17`'s verification, and a trip
  with two travellers, the second an admin,
    - as the first traveller, start a checklist on the trip from Before leaving, and confirm it
      holds the template's three items, none ticked
    - tick Passport valid for six months, and confirm the checklist shows one of its three items
      ticked
    - add the item "Order pesos" to the checklist, and confirm the template still holds three items
    - remove Travel insurance from the template, and confirm the checklist still holds it
    - sign in as the admin, and confirm the trip shows them none of the first traveller's
      checklists
    - as the admin, remove the first traveller from the trip, then invite them back, and confirm
      they find the checklist as they left it
    - as the first traveller, delete the checklist, confirm they are asked first, and confirm it is
      then gone
    - on the first traveller's phone with no connection, confirm the checklist reads as it was last
      ticked

> **What does this buy?** Each traveller keeps track of what they themselves must do before and
> during a trip, such as checking their own passport, starting from the list they keep rather than
> from nothing.

> **Why does an admin not see a traveller's checklists?** A checklist holds what one traveller has
> to do, and how far they have got. It is theirs, like a list kept in a pocket (ADR-0024, a
> traveller's checklists are their own).

> **Can a traveller tick an item with no connection?** No. A trip changes only while the traveller
> is online, and a tick is a change (`PLN-NR2`).

> **Where does a list the travellers share go?** On a page, in Markdown, where each traveller who
> may see the page sees the same ticks (`PLN-F7`).

---

## Non-functional requirements

The planner makes no promise of its own about how well it does what it does. Reading a trip on a
phone with no connection is promised for the web app, the system travellers use on a computer or a
phone (ADR-0004, a trip is read-only offline).

---

## Non-requirements

| Identifier | The planner does not | Because |
|---|---|---|
| **PLN-NR1** | Warn of a gap between stretches, an overlap, or two stretches in a row with no travel between them | A rough plan has loose ends on purpose (ADR-0013, a trip's calendar is pencilled in, and its bookings have a page of their own) |
| **PLN-NR2** | Accept a change to a trip from a device with no connection | A trip changes only while the traveller is online (ADR-0004, a trip is read-only offline) |
| **PLN-NR3** | Track what a trip costs, or what a traveller spends | Travellers chose not to track spending in Itinero |
| **PLN-NR4** | Hold a page that belongs to more than one trip, or to none | Pages shared between trips, such as a country's, are future work |
| **PLN-NR5** | Find the time zone of a place by itself | The web app fills it in from its list of places, and the planner holds the zone it is given (`WEB-F9`) |
| **PLN-NR6** | Hold facts about a country, such as its entry rules or emergency numbers | A country is a name on a stretch, for now (ADR-0013, a trip's calendar is pencilled in, and its bookings have a page of their own) |
| **PLN-NR7** | Find the city a traveller is in | Finding the city needs a list of places held on the phone. It is future work |
| **PLN-NR8** | Combine two travellers' edits to one page automatically | Merging edits as they are typed is future work |
| **PLN-NR9** | Share a checklist or a template with another traveller | A traveller's checklists are their own (ADR-0024, a traveller's checklists are their own) |

^pln-nr

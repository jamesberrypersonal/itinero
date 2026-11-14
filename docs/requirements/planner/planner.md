# The planner

What the planner system promises to travellers. The planner holds each trip: a calendar the
traveller pencils the trip in on, the dates that are fixed, and the pages where travellers write up
their research. The component registry, `components.md`, gives it the prefix `PLN`.

Two roles appear below, the traveller and the admin, which `requirements/README.md` defines. Which
traveller may see or change each part of a trip is promised by the access system, the system that
handles accounts, invitations and who may see each page, not here.

A trip is built from these parts:

| Part | Is | Such as |
|---|---|---|
| **Trip** | One journey, with a name | Twelve days in France, the United States and Canada in June 2026 |
| **Place** | A country, or somewhere in one | France, or Paris in France |
| **Stretch** | A place, and the dates a traveller expects to be there, pencilled in | Paris, from 3 to 5 June |
| **Firm item** | Something fixed to a date, with a time if it has one | A booked flight from Paris to New York on 5 June, leaving at 10:00 |
| **Page** | Research a traveller writes by hand, belonging to one trip | Notes on where to eat in Lyon |
| **Graveyard** | The pages travellers have deleted from a trip, kept so that they can be restored | A city's notes, deleted with the city |

A trip's calendar is pencilled in, and only its firm items are fixed (ADR-0010). A day of a trip is
one calendar date. A firm item's time is in the local time of the place it happens. The traveller
chooses that place's time zone, because the planner does not find it (`PLN-NR5`). Times are held by
`shared/trip-time`, the component that holds a trip's dates and times. It holds four kinds of value
with a time: an exact time like 09:10, an approximate time like around 14:00, a window like 14:00 to
16:00, and a part of a day like the afternoon.

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
> (ADR-0010, a trip's calendar is pencilled in).

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

> **What counts as a firm item?** Anything fixed to a date, such as a booked tour, a booked table,
> or a day the traveller has decided to move on.

### PLN-F4 — A firm item of travel records how the traveller travels, and when they leave and arrive, each in local time

A firm item can be travel from one place to another. A traveller records how they travel: by
flight, train, bus, ferry, car, or another way. They can also record when it leaves and when it
arrives, each in the time zone the traveller chooses for that end. The planner shows how long the
travel takes. It refuses travel that certainly arrives before it leaves, whatever an imprecise time
turns out to be, and says why. ^pln-f4

- **Verification:** on the trip of `PLN-F1`,
    - add a flight from Paris to New York leaving at 10:00 on 5 June, Paris time, and arriving at
      12:30, New York time, and confirm it reads 10:00 Paris time, 12:30 New York time, taking 8
      hours 30 minutes
    - add a train from Lyon to Paris on 3 June, with no times, and confirm it is accepted
    - add travel leaving at 10:00 and arriving at 03:00 the same day, both Paris time, and confirm
      it is refused, with the reason

> **What does this buy?** A ticket gives each end of a journey in the local time of its place. The
> traveller copies both in as printed, and sees how long the journey really takes.

> **Is travel needed between every two stretches?** No. Travel appears on the calendar only once a
> traveller adds it as a firm item (ADR-0010, a trip's calendar is pencilled in).

### PLN-F5 — The calendar shows firm items apart from the pencilled stretches, in the order they happen

The calendar shows each firm item on the day of its local date, so that it stands out from the
stretches around it. Travel that runs overnight shows on every day it covers. The firm items of
each day are listed in the order they happen, whatever time zone each is in. ^pln-f5

- **Verification:** on the trip of `PLN-F1`, with the flight of `PLN-F4`,
    - confirm the flight shows on 5 June, apart from the pencilled stretches of France and New York
    - add a hotel check-in between 14:00 and 16:00 on 5 June, New York time, and a coffee at 08:00
      on 5 June, Paris time, and confirm 5 June lists coffee, flight, check-in
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
change the next time they open the trip with a connection. ^pln-f6

- **Verification:** with two travellers on the same trip, each on their own device,
    - have the first pencil in a stretch, and confirm the second sees it on opening the trip
    - have the first move a firm item to another day, and confirm the second sees it on the new day
    - have the second change a flight's time, and confirm the first sees the new time

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

- **Verification:** on the trip that `PLN-F8`'s verification sets up, with a page Transport at the
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

- **Verification:** on a trip with Santiago pencilled in, and a page titled Santiago,
    - link the stretch to the page, and confirm following the link opens it
    - link a booked tour to the page Eating in Santiago, and confirm following the link opens it
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

- **Verification:** on the trip that `PLN-F8`'s verification sets up, with "Try the empanadas in
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
that went to the graveyard with it, under its old parent. It returns to the top of the trip when its
old parent is in the graveyard too. Nothing deletes a page from the graveyard. ^pln-f13

- **Verification:** on the trip that `PLN-F8`'s verification sets up, with Santiago deleted,
    - as a traveller who is not an admin, and who could see Santiago, confirm the graveyard lists
      Santiago, with one page beneath it, and confirm opening it is refused
    - as a traveller who could not see Santiago, confirm the graveyard does not list it
    - as an admin, open Santiago and Eating in Santiago, and confirm each reads as it was written
    - restore Santiago, and confirm it returns under Chile with Eating in Santiago beneath it, and
      that links to it open it again
    - delete Santiago, then Chile, restore Santiago, and confirm it returns at the top of the trip

> **What does this buy?** A branch of research deleted by mistake, such as a country's, is not
> lost. Restoring it is left to an admin, because who may read each page is set page by page.

> **Is the graveyard on a phone with no connection?** No. The phone's copy of a trip holds only the
> pages in the tree, so the graveyard never makes it larger. With no connection, a link to a page in
> the graveyard shows only that its page is not on the phone.

---

## Non-functional requirements

The planner makes no promise of its own about how well it does what it does. Reading a trip on a
phone with no connection is promised for the web app, the system travellers use on a computer or a
phone (ADR-0004, a trip is read-only offline).

---

## Non-requirements

| Identifier | The planner does not | Because |
|---|---|---|
| **PLN-NR1** | Warn of a gap between stretches, an overlap, or two stretches in a row with no travel between them | A rough plan has loose ends on purpose (ADR-0010, a trip's calendar is pencilled in) |
| **PLN-NR2** | Accept a change to a trip from a device with no connection | A trip changes only while the traveller is online (ADR-0004, a trip is read-only offline) |
| **PLN-NR3** | Track what a trip costs, or what a traveller spends | Travellers chose not to track spending in Itinero |
| **PLN-NR4** | Hold a page that belongs to more than one trip, or to none | Pages shared between trips, such as a country's, are future work |
| **PLN-NR5** | Find the time zone of a place by itself | Finding a place's time zone is future work (`SHR:TRIP-TIME-NR1`) |
| **PLN-NR6** | Hold facts about a country, such as its entry rules or emergency numbers | A country is a name on a stretch, for now (ADR-0010, a trip's calendar is pencilled in) |

^pln-nr

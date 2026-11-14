# The permissions component

What the component `access/permissions` promises to the components that use it, and through them
to travellers. The permissions component holds the access each traveller has been given to a trip,
and works out from it what each traveller may see and change: each page, the calendar, and each
booking. It also decides whether to allow each request a traveller makes. The component registry,
`components.md`, gives it the prefix `ACC:PERMISSIONS`.

Three roles appear below. A caller is a component that uses the permissions component, such as the
component that holds the copy of each trip online. The traveller and the admin are the roles
`requirements/README.md` defines.

The access system's requirements, in `requirements/access/access.md`, set what is promised to
travellers. In short:

- **A level** of access is edit, view or none. Edit access includes view access.
- **Access to the trip** is view or edit, and passes to every page, from the top of the trip down
  (ADR-0012, access to a page passes down to the pages beneath it).
- **An exception** gives a traveller another level for one page and every page beneath it, until
  another exception further down.
- **The calendar** has a level of its own for each traveller, which is none until an admin grants
  it (ADR-0013, a trip's bookings have a page of their own, and its calendar is seen only by the
  travellers an admin chooses).
- **A booking** names the travellers it is for.

A grant is one change an admin makes to a traveller's access, such as setting an exception.

---

## Functional requirements

### ACC:PERMISSIONS-F1 — A traveller's level for a page comes from their access to the trip and the exceptions above it

The permissions component gives each traveller's level for any page of a trip, in the tree or in its
graveyard. The level is that of the nearest exception on the page or above it, or the traveller's
access to the trip where there is none. A page beneath a page whose level for the traveller is none
has level none too, whatever exception it carries. An admin's level for every page is
edit. ^acc-permissions-f1

- **Verification:** on a trip with the pages Chile, Santiago under Chile, and Eating in Santiago
  under Santiago, and a traveller with view access to the trip,
    - confirm the traveller's level for all three pages is view
    - give the traveller edit access to Santiago, and confirm their levels read view, edit, edit
    - give them no access to Chile, and confirm all three read none
    - confirm an admin's level for every page is edit

> **What does this buy?** Access passes down the tree, so an admin sets it once for a branch
> (`ACC-F4`, `ACC-F7`).

> **Why does a page beneath a hidden page stay hidden, whatever its exception?** A moved page keeps
> its exceptions. A page with view access moved under a hidden page must not show beneath it, so
> that a traveller who may see a page may always see every page above it (ADR-0012).

### ACC:PERMISSIONS-F2 — A grant beneath a page hidden from the traveller is refused, naming the page

The permissions component applies each grant an admin makes: a traveller's access to the trip, an
exception for a page, the removal of an exception, and a traveller's level for the calendar. It
refuses an exception that would give a traveller view or edit access to a page beneath a page whose
level for them is none, and names the page above. It refuses to set a traveller's access to the
trip to none. ^acc-permissions-f2

- **Verification:** on the trip that `ACC:PERMISSIONS-F1`'s verification sets up,
    - give the traveller no access to Santiago, then view access to Eating in Santiago, and confirm
      the second is refused, naming Santiago
    - remove the exception on Santiago, and confirm the traveller's level for all three pages is
      view again
    - set the traveller's access to the trip to none, and confirm it is refused, with the reason

> **What does this buy?** An admin cannot give a traveller a page that would arrive without the
> pages above it (`ACC-F7`).

> **How is a traveller taken off a trip?** By removing them from it, not by setting their access
> to none (`ACC:PERMISSIONS-F6`).

### ACC:PERMISSIONS-F3 — The calendar's level is none until an admin grants it, and a booking's follows the travellers it names

The permissions component gives each traveller's level for the trip's calendar, which is none until
a grant sets view or edit. It gives each traveller's level for a booking: their access to the trip
where the booking names them, and none where it does not. An admin's level for the calendar and for
every booking is edit. ^acc-permissions-f3

- **Verification:** on a trip with a traveller who has edit access to the trip, and a booking
  naming them,
    - confirm the traveller's level for the calendar is none, and for the booking is edit
    - grant them view access to the calendar, and confirm it reads view
    - confirm a second traveller, whom the booking does not name, has level none for it
    - confirm an admin has edit for the calendar and the booking

> **What does this buy?** A traveller has their bookings without the plan (`ACC-F5`, `ACC-F6`).

### ACC:PERMISSIONS-F4 — Each request is allowed or refused, with the reason

Given a traveller, whether they are an admin, and a request, the permissions component allows the
request or refuses it, saying why. A request reads or changes a page, the calendar, a booking or the
trip's grants. It also reads or restores a page in the graveyard. ^acc-permissions-f4

- **Verification:** on the trip that `ACC:PERMISSIONS-F1`'s verification sets up,
    - ask to read Santiago as the traveller, and confirm it is allowed
    - ask to rename Santiago, and confirm it is refused, because the traveller may only view it
    - ask to move a page the traveller may edit under a page they may only view, and confirm it is
      refused, with the reason
    - ask to restore a page in the graveyard, and to make a grant, and confirm each is refused,
      because only an admin may
    - make each request as an admin, and confirm each is allowed

> **What does this buy?** One component decides every request, so a phone that asks for something
> its traveller may not have is refused like any other (`ACC-NFR1`).

> **Who makes the request reach the permissions component?** The caller, before it does anything a
> request asks. The permissions component enforces nothing alone (`ACC:PERMISSIONS-NR1`).

### ACC:PERMISSIONS-F5 — The permissions component gives what a traveller may see, and what their phone may hold

For a traveller, the permissions component gives the pages of the tree they may see, the pages of
the graveyard they may see listed, and the bookings they may see. It also gives the copy their
phone may hold for reading with no connection: those pages of the tree, those bookings, and the
calendar only where their level for it is view or edit. ^acc-permissions-f5

- **Verification:** on the trip that `ACC:PERMISSIONS-F1`'s verification sets up, with the
  traveller given no access to Santiago, and Santiago then deleted,
    - confirm the pages given are Chile only, and the graveyard given holds no page
    - delete Chile, and confirm the graveyard given holds Chile
    - confirm the phone's copy holds no calendar, then grant the traveller view access to the
      calendar, and confirm it does

> **What does this buy?** Each traveller, and each phone, holds what the traveller may see and
> nothing more (`ACC-F8`, `ACC-F10`, `ACC-F12`).

> **What decides whether a traveller sees a page in the graveyard?** Their level for the page
> where it stood. A deleted page keeps its parent, so the level is the one they had at the delete,
> unless an admin has changed their access since.

### ACC:PERMISSIONS-F6 — A traveller added to or removed from a trip gains or loses every grant at once

The permissions component adds a traveller to a trip with the access to the trip and to the
calendar they were invited with. It removes a traveller from a trip with every grant they hold,
after which their level for everything is none. ^acc-permissions-f6

- **Verification:** on a trip,
    - add a traveller with edit access to the trip and view access to the calendar, and confirm
      both levels read back
    - set an exception for them, remove them, and confirm their level for every page, the calendar
      and every booking is none
    - add the same traveller a second time, and confirm it is refused, with the reason

> **What does this buy?** A traveller removed from a trip keeps nothing of it (`ACC-F11`).

### ACC:PERMISSIONS-F7 — The permissions component counts the travellers a move would let see a page

Given a page and a place it would move to, the permissions component gives the number of travellers
who would be able to see the page there, and cannot see it now. ^acc-permissions-f7

- **Verification:** on a trip with a page Surprise that an exception hides from three travellers,
  and a page Chile those three may see,
    - count the move of Surprise under Chile, and confirm it gives 3
    - count the move of Chile to the top of the trip, and confirm it gives 0

> **What does this buy?** The traveller moving a page is told who else would see it, before the
> move is made (`ACC-F9`).

### ACC:PERMISSIONS-F8 — A trip's grants are written as text, read back unchanged, and changed the same way everywhere

The permissions component writes a trip's grants as text, and reads that text back as the same
grants. It refuses text that is not grants it wrote, and says why. Two copies of a trip's grants
that apply the same grants in the same order hold the same grants. A grant it refuses leaves the
grants as they were. ^acc-permissions-f8

- **Verification:**
    - write the grants of the trip of `ACC:PERMISSIONS-F1` as text, read them back, and confirm
      they are equal
    - apply the same ten grants, in the same order, to two copies, and confirm the copies are equal
    - apply a grant naming a traveller not on the trip, and confirm it is refused, with the reason,
      and the grants are unchanged

> **What does this buy?** The grants are stored with the trip held online, and every check of a
> request reads the same grants.

---

## Non-functional requirements

### ACC:PERMISSIONS-NFR1 — The permissions component works without a connection, and the same on every device

Everything the permissions component promises works on a device with no connection, and gives the
same results on every device. ^acc-permissions-nfr1

- **Verification:**
    - on a phone with no connection, confirm `ACC:PERMISSIONS-F1` and `ACC:PERMISSIONS-F5` still
      hold
    - run the same checks on a server and in a browser, and confirm the results are the same

> **What does this buy?** The phone shows a traveller what they may change, from the same rules the
> trip held online enforces.

---

## Non-requirements

| Identifier | The permissions component does not | Because |
|---|---|---|
| **ACC:PERMISSIONS-NR1** | Stop a request by itself | The caller asks it before carrying out a request. `planner/trip-host` does so |
| **ACC:PERMISSIONS-NR2** | Know who is on a trip, or who is an admin | `access/membership` does. The caller passes it on |
| **ACC:PERMISSIONS-NR3** | Know who is making a request | `access/accounts` signs each traveller in. The caller passes the traveller on |
| **ACC:PERMISSIONS-NR4** | Store a trip's grants | `planner/trip-host` stores them with the trip |
| **ACC:PERMISSIONS-NR5** | Set access to one stretch or one firm item of the calendar | The calendar is granted whole (`ACC-NR5`) |

^acc-permissions-nr

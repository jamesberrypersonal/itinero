# The access system

What the access system promises to travellers. The access system holds each traveller's account,
the invitations that bring travellers onto a trip, and who may see and change each page of a trip.
The component registry, `components.md`, gives it the prefix `ACC`.

Two roles appear below, the traveller and the admin, which `requirements/README.md` defines. A
trip, its calendar and its pages are the planner's, the system that holds each trip:

- **A trip's calendar** holds the stretches a traveller pencils in, each a place and rough dates,
  and the firm items fixed to a date, such as a booked tour.
- **A trip's pages** hold the research travellers write by hand. They form a tree, in which each
  page sits under one other page, its parent, or at the top of the trip.
- **The graveyard** holds the pages travellers have deleted, until an admin restores them.
- **A trip's bookings**, such as a booked flight or tour, have a page of their own, apart from the
  calendar. Each booking names the travellers it is for (ADR-0013, a trip's bookings have a page of
  their own, and its calendar is seen only by the travellers an admin chooses).

Access to a page is one of three levels: edit access, view access, or none. A traveller with edit
access to a page may also see it. Access passes down the tree, from the trip as its root (ADR-0012,
access to a page passes down to the pages beneath it). A trip's calendar has an access of its own,
of the same three levels, apart from its pages.

---

## Functional requirements

### ACC-F1 — A traveller signs in with a Google account

A traveller signs in to Itinero with a Google account, and has an Itinero account from their first
sign-in. Itinero holds no password for any traveller. A traveller signed in on a device stays signed
in there until they sign out. ^acc-f1

- **Verification:** on a running system,
    - sign in with a Google account for the first time, and confirm an account is created and signed
      in
    - sign out, sign in with the same Google account, and confirm it is the same account, with the
      same trips
    - close and reopen the app, and confirm the traveller is still signed in

> **What does this buy?** A traveller joins with an account they already have, and has no new
> password to remember or to lose.

> **Can a traveller sign in with no connection?** No. A traveller already signed in on a phone
> reads their trips with no connection, as the phone last held them (ADR-0004, a trip is read-only
> offline).

### ACC-F2 — The traveller who creates a trip is always its admin

A traveller who creates a trip is its admin from then on. Nothing removes their admin role, and
nothing removes them from the trip. An admin may make any other traveller on the trip an admin. An
admin has edit access to every page of the trip. Every traveller on a trip sees who else is on it,
and which of them are admins. ^acc-f2

- **Verification:** on a running system,
    - create a trip, and confirm its creator is its admin
    - as the creator, make a second traveller an admin, and confirm the second can edit every page
    - as the second admin, try to remove the creator, and to take away their admin role, and confirm
      each is refused, with the reason
    - as a traveller who is not an admin, confirm they see every traveller on the trip, with the two
      admins marked

> **What does this buy?** Every trip always has someone who may manage it, whoever else joins or
> leaves.

> **Can an admin be made an ordinary traveller again?** No (`ACC-NR3`).

### ACC-F3 — An admin invites a traveller by email address, with view or edit access to the trip

An admin invites a traveller to a trip by their email address, and chooses whether the traveller
will have view or edit access to the trip. Only an account with that email address can accept the
invitation. An invitation not accepted within 14 days expires, and an admin can withdraw one before
it is accepted. A traveller sees nothing of a trip until they accept. ^acc-f3

- **Verification:** on a running system, with an admin on a trip,
    - invite an address with view access, sign in with an account holding that address, accept, and
      confirm the trip opens with view access
    - invite a second address, sign in with an account holding a different one, and confirm the
      invitation cannot be accepted, with the reason
    - invite a third address, withdraw the invitation, and confirm it cannot be accepted
    - confirm an invitation not accepted after 14 days can no longer be accepted

> **What does this buy?** An admin brings in exactly the people they mean to. An invitation
> forwarded to someone else lets nobody in.

> **What if a traveller's Google account uses an address that is not a Gmail one?** It matches all
> the same. An admin invites a traveller at the address of their Google account, whatever it is.

### ACC-F4 — A traveller's access to the trip passes to every page

A traveller's access to a trip passes to every page at the top of the trip, and from each page to
every page beneath it, including pages added later. A new page starts with its parent's access for
each traveller, or the trip's for a page at the top. ^acc-f4

- **Verification:** on a trip with the pages Chile, Santiago under Chile, and Eating in Santiago
  under Santiago, and a traveller with view access to the trip,
    - confirm the traveller sees all three pages, and cannot change any of them
    - add a page under Santiago, and confirm the traveller sees it
    - give a second traveller edit access to the trip, and confirm they can change every page

> **What does this buy?** A long trip holds hundreds of pages, and an admin sets each traveller's
> access once, not page by page.

> **Does access to the trip give access to its calendar?** No. An admin grants the calendar
> separately (`ACC-F5`).

### ACC-F5 — A traveller sees a trip's calendar only once an admin grants it

A traveller has no access to a trip's calendar until an admin grants it. An admin grants a traveller
view or edit access to the calendar, when inviting them or at any time after, and can take it away
again. A traveller with no access to the calendar sees none of its stretches or firm items. A
traveller with view access sees the calendar, and cannot change it. ^acc-f5

- **Verification:** on a trip with a stretch for Santiago, and a traveller who has accepted an
  invitation with edit access to the trip and nothing said of the calendar,
    - confirm the traveller sees no stretch and no firm item of the trip
    - grant the traveller view access to the calendar, confirm they see the Santiago stretch, and
      confirm a change to it is refused
    - grant them edit access, and confirm they can move the stretch
    - take the access away, and confirm the calendar is hidden from them again
    - invite a second traveller with view access to the calendar, accept, and confirm they see the
      stretch at once

> **What does this buy?** The calendar holds where the travellers will be, and when. An admin
> decides who sees that, apart from who reads the research.

> **Can part of the calendar be hidden from a traveller?** No. The calendar is granted whole
> (`ACC-NR5`).

> **Does a traveller with no access to the calendar see their bookings?** Yes. Bookings are apart
> from the calendar (`ACC-F6`).

### ACC-F6 — A traveller sees only the bookings that name them

A traveller sees a booking only if it names them, or they are an admin, whatever their access to the
calendar. A traveller who sees the calendar sees on it only the bookings they may see. A traveller
named by a booking can change it if they have edit access to the trip. ^acc-f6

- **Verification:** on a trip with three travellers, and a booked flight naming the first two,
    - as the first traveller, with no access to the calendar, confirm the bookings page lists the
      flight
    - as the third traveller, confirm neither the bookings page nor the calendar shows it
    - as an admin, confirm the bookings page lists it
    - as the third traveller, ask for the flight by its identifier, and confirm it is refused

> **What does this buy?** Each traveller has what they booked, without seeing every other booking,
> which would show the trip's route.

### ACC-F7 — An admin changes a traveller's access for a branch of pages

An admin gives a traveller other access to a page than the page above it gives, such as view in
place of edit, none in place of view, or edit in place of view. The change covers the page and every
page beneath it, until another change further down. A traveller who may see a page may always see
every page above it. An admin who tries to give a traveller access beneath a page that traveller
may not see is refused, and told which page above is hidden from them. ^acc-f7

- **Verification:** on the trip that `ACC-F4`'s verification sets up,
    - give the traveller no access to Santiago, and confirm they no longer see Santiago or Eating in
      Santiago, but still see Chile
    - give them view access to Eating in Santiago, and confirm it is refused, naming Santiago
    - give them view access to Santiago again and edit access to Eating in Santiago, and confirm
      they can change Eating in Santiago only

> **What does this buy?** An admin keeps part of the research to some travellers, such as plans
> for a surprise, without setting every page by hand.

> **Why may a traveller always see the pages above a page they see?** So that every page a
> traveller sees has its place in their tree, and nothing hints at a page hidden from them
> (ADR-0012).

### ACC-F8 — A traveller sees nothing of a page they may not see

A traveller with no access to a page never sees its title or its text, and never finds it by
search. A link to it, from another page or from the calendar, shows only that its page is not
available to them. A traveller who may see a page but not edit it cannot change it. ^acc-f8

- **Verification:** on the trip that `ACC-F7`'s verification sets up, with the traveller given no
  access to Santiago, and Chile's text linking to Santiago,
    - confirm Chile's link shows that its page is not available, without Santiago's title
    - search for "Santiago", and confirm no page is listed but those the traveller may see
    - give the traveller view access to Santiago, try to change it, and confirm it is refused

> **What does this buy?** A traveller can trust that a page kept from someone shows them nothing
> of it, not even its name.

### ACC-F9 — A move that lets more travellers see a page asks first

When a traveller moves a page to a place where more travellers may see it, the planner says how
many more will see it, and asks the traveller to confirm. The moved page then takes its access from
its new place, keeping each change an admin made to it or beneath it. A move that lets no more
travellers see a page asks nothing. ^acc-f9

- **Verification:** on a trip with a page Surprise seen by the admin alone, and a page Chile seen by
  three travellers,
    - move Surprise under Chile, and confirm the planner says three more travellers will see it, and
      asks first
    - decline, and confirm Surprise has not moved
    - move a page seen by all three under Chile, and confirm nothing is asked

> **What does this buy?** Access follows the tree, so a move can share a page by accident. The
> traveller moving it is told before it happens.

### ACC-F10 — A traveller sees in the graveyard only the deleted pages they could see, and only an admin opens one

Each traveller sees, in a trip's graveyard, only the deleted pages they could see when each was
deleted. Only an admin opens a page in the graveyard to read it, or restores it. ^acc-f10

- **Verification:** on the trip that `ACC-F7`'s verification sets up, with the traveller given no
  access to Santiago, and Santiago then deleted,
    - as the traveller, confirm the graveyard does not list Santiago
    - delete Chile, and confirm the graveyard lists Chile for the traveller, and refuses to open it
    - as an admin, open and restore Chile, and confirm each is accepted

> **What does this buy?** Deleting a page never shows it to someone who could not see it before. A
> branch deleted by mistake is still recovered by an admin.

### ACC-F11 — An admin removes a traveller, who then loses the trip on every device

An admin removes any traveller from a trip, other than its creator. The traveller removed can no
longer open the trip. Each phone that holds a copy of the trip for them deletes it the next time it
connects. ^acc-f11

- **Verification:** on a running system, with a traveller on a trip, signed in on a phone,
    - with the phone offline, remove the traveller, and confirm they can no longer open the trip on
      a computer
    - connect the phone, and confirm the trip is no longer on it
    - try to remove the creator, and confirm it is refused, with the reason

> **What does this buy?** An admin takes back a trip from someone who should no longer have it,
> such as a companion who dropped out.

> **Can a phone with no connection still show the trip?** Yes, until it next connects. A phone
> with no connection cannot be told (ADR-0004, a trip is read-only offline).

### ACC-F12 — A change in access reaches each phone the next time it connects

A phone holds only the pages and bookings its traveller may see, and the calendar only if they may
see it, as of the last time it connected. When an admin changes a traveller's access, each of that
traveller's phones drops what they may no longer see, and gains what they may now see, the next time
it connects. ^acc-f12

- **Verification:** on the trip that `ACC-F4`'s verification sets up, with the traveller signed in
  on a phone,
    - with the phone offline, give the traveller no access to Santiago
    - connect the phone, then take it offline, and confirm neither Santiago nor Eating in Santiago
      is on it
    - give the traveller view access to Santiago again, connect the phone, take it offline, and
      confirm both are on it

> **What does this buy?** The copy of a trip on a phone keeps to the same access as the trip
> itself. Taking a page from a traveller takes it from their phone too.

### ACC-F13 — A traveller chooses the name other travellers see them by

A traveller signing in to Itinero for the first time, such as to accept an invitation, chooses the
name every other traveller on their trips sees them by. The name starts as the one on their Google
account, and they may keep it or change it. A traveller changes their name at any time after. ^acc-f13

- **Verification:** on a running system, with an admin who invites a traveller whose Google account
  is named Sam Taylor,
    - as the traveller, open the invitation, sign in for the first time, and confirm Itinero asks for
      a name, starting as Sam Taylor
    - change it to Sam, accept, and confirm the admin sees the new member as Sam
    - as the traveller, change the name to Sam T, and confirm the admin sees Sam T
    - sign out and in again, and confirm Itinero asks for no name, and the name is still Sam T

> **What does this buy?** Travellers on a trip know each other by the names they use, and an
> invitation's new member is recognised at once, not by an email address.

> **Does a traveller's name show on every trip?** Yes. A traveller has one name, which every trip
> they are on shows.

---

## Non-functional requirements

### ACC-NFR1 — No traveller obtains a trip, a page, a booking or a calendar they may not see, whatever their device sends

A traveller never obtains a trip they are not on, or a page, a booking or a calendar they may not
see, and never changes one they may not edit, whatever their device asks for. ^acc-nfr1

- **Verification:** on a running system, with a device altered to send any request,
    - ask for a page the traveller may not see, by its identifier, and confirm it is refused
    - ask for a trip the traveller is not on, and confirm it is refused
    - ask for the calendar of a trip whose calendar the traveller may not see, and confirm it is
      refused
    - send a change to a page the traveller may only view, and confirm it is refused, and the page
      unchanged

> **What does this buy?** Access means nothing if a traveller can get round it by changing the app
> on their own phone.

---

## Non-requirements

| Identifier | The access system does not | Because |
|---|---|---|
| **ACC-NR1** | Let a traveller sign in with a password, or with any account but a Google one | Travellers sign in with an account they already have. Apple's sign-in costs $99 a year (ADR-0015, Itinero's online side runs on Cloudflare's free plan) |
| **ACC-NR2** | Let a traveller leave a trip by themselves | Only an admin removes a traveller, for now |
| **ACC-NR3** | Make an admin an ordinary traveller again | Admins are kept as they are made, for now |
| **ACC-NR4** | Hand a trip's creator's role to another traveller, or delete a trip | A trip outlives no decision yet on who may end it. Both are future work |
| **ACC-NR5** | Set access to the calendar's stretches and firm items one by one | An admin grants the calendar whole, as one view or edit access for each traveller |
| **ACC-NR6** | Invite a traveller by a shared link | A forwarded link would let in someone the admin never chose |
| **ACC-NR7** | Delete a traveller's account | Deleting an account, and what it holds of theirs, is future work |

^acc-nr

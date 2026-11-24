# ADR-0024 — A traveller's checklists are their own, and start from templates kept outside any trip

- **Status:** Accepted
- **Date:** 2026-11-23
- **Scope:** planner, access

## Problem

Many travellers keep the same checklist for every trip, such as checking that their passport is
valid and making copies of their documents before leaving. In Itinero they write it out again for
each new trip.

A page of a trip can hold a checklist today, written in Markdown, the plain-text format the pages
use. Two things stop a page from serving here:

- **Every page belongs to one trip** (ADR-0011, a trip's pages form a tree, with links between any
  two). Nothing outlives a trip for the next trip's checklist to start from.
- **A page's text is the same for every traveller who may see it.** A tick in a checklist on a page
  is therefore ticked for all of them. A checklist such as "my passport is valid" is about one
  traveller, and each traveller has to tick it for themselves.

## Decision

A checklist is a thing of its own in the planner, apart from the pages. It holds a title, and a
list of items in an order its traveller gives, each ticked or not. It is held by its own component,
`planner/checklists`, and the web app shows it in a section of its own, apart from the pages.

**A traveller keeps templates of their own.** A template is a checklist that belongs to the
traveller's account and to no trip. Each traveller's templates form a library that only they see
and change. A template holds a checklist and nothing else.

**A checklist on a trip belongs to one traveller.** A traveller adds checklists to a trip, each
empty or copied from one of their templates. Only that traveller sees the checklist, changes its
items, or ticks them. No other traveller on the trip sees it, and that includes the trip's admins.

**A copy stands alone.** Copying a template into a trip makes a checklist with the template's title
and items, with no item ticked. Changing the checklist never changes the template, and changing the
template never changes a checklist already started from it. A traveller can also save a checklist
of a trip as a new template.

**A tick needs a connection**, like every other change to a trip (ADR-0004, a trip is read-only
offline). A phone with no connection shows each checklist as it was last ticked.

**Each traveller's library is kept in the online side's D1 database**, Cloudflare's SQL database,
where the accounts are kept, with one row for each template. A component of its own,
`planner/library`, holds it. A traveller's phone keeps a copy of their library, which it reads with
no connection, as it reads a trip.

**A traveller arranges their checklists by hand.** The checklists on one trip, and the templates of
one library, are each in an order their traveller gives. A new one goes at the end.

**A delete is for good.** A traveller deleting a checklist or a template is asked first, and once
they confirm, it is gone. Nothing like the graveyard of a trip's pages keeps it.

**A traveller who leaves a trip keeps their checklists on it.** No one sees them while the
traveller is off the trip. A traveller who rejoins finds them as they left them.

## Consequences

- An admin may see and change everything else of a trip, but not a checklist. The access system,
  which decides who may see each part of a trip, holds no grant for a checklist. Whatever gives a
  traveller their trip gives them their own checklists, and no one else's.
- A traveller's library of templates is held apart from every trip, since the copy of each trip
  held online, in `planner/trip-host`, holds only that trip. `planner/library` holds it.
  `spec/planner/library.md` gives how.
- The trip host keeps each trip's checklists with the trip, and gives each traveller only their
  own. It keeps a removed traveller's checklists, which nobody is given until the traveller rejoins.
- A checklist deleted by mistake cannot be restored. It was one traveller's alone, so no one else
  loses work by it.
- A list the travellers share, such as what the group packs, still goes on a page, in Markdown,
  where every traveller who may see the page sees the same ticks.
- `planner/checklists` holds checklists and templates, their items and ticks, and the copy between
  them. `spec/planner/checklists.md` gives how.

## Alternatives considered

- **A template as a page that belongs to no trip.** Who may see a page passes down the trip's tree
  of pages from the trip itself (ADR-0012, access to a page passes down to the pages beneath it). A
  page with no trip would need rules of access of its own, and its ticks would still be shared.
- **Starting a page from a page of an earlier trip.** Nothing new would be stored. A traveller
  would lose their list with the earlier trip, and the ticks would still be shared.
- **A checklist naming the travellers it is for, as a booking does.** Each traveller named would
  tick their own copy of the same items. The admins would see every traveller's ticks, and a
  traveller could not keep a list of their own.
- **Items shared by the trip, with each traveller's ticks private.** Any traveller could change the
  items of a list another traveller relies on.
- **A checklist that follows its template.** A change to a template would rewrite the checklists of
  trips already under way, and could remove an item a traveller had ticked.
- **A Durable Object for each traveller's library**, Cloudflare's object with storage of its own,
  shaped like the trip host. It would tell each of a traveller's devices of a change at once, but
  it adds a second kind of object to run and test, for a library that changes rarely.
- **Deleting a traveller's checklists when they leave a trip.** A traveller removed by mistake
  would lose them for good.
- **Keeping deleted checklists for restoring, as the trip's graveyard keeps pages.** A checklist is
  small and one traveller's own, and a confirm before the delete is enough.
- **Listing checklists oldest first, or by title.** Oldest first leaves a traveller no way to put
  the list they need now at the top. Sorting by title gives a different order for each language,
  unless every device sorts the same way.
- **Ticking with no connection.** It is what a traveller packing at an airport wants. A trip that
  changes on a phone with no connection needs the phone to keep its changes and send them later,
  which no part of a trip does yet (ADR-0004).

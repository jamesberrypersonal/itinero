# ADR-0012 — Access to a page passes down to the pages beneath it

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** access, planner/pages

## Problem

The planner, the system that holds each trip, gives every trip pages where travellers write up
their research, such as notes on where to eat in Santiago. The pages form a tree: each page sits
under at most one other page, its parent, or at the top of the trip (ADR-0011, a trip's pages form
a tree, with links between any two). A country's page can hold a page for each city, and each city's
page its own notes.

The access system, the system that handles accounts and invitations, decides who may see and change
each page. A trip's admin is a traveller who may manage the trip: the traveller who created it, and
anyone another admin makes one. An admin sets each traveller's access page by page, as view access
or edit access. Nothing said whether access to a page reaches the pages beneath it. A long trip
holds hundreds of pages, and an admin who had to set each one for each traveller would stop setting
them.

## Decision

Access to a page passes down the tree, and an admin can change it for a branch beneath.

**Access is one of three levels.** For each page, a traveller has edit access, view access, or
none. A traveller with edit access may also see the page. An admin has edit access to every page.

**The trip is the root.** When an admin invites a traveller, they give the traveller view or edit
access to the trip. That access passes to every page at the top of the trip, and from each page to
every page beneath it, including pages added later.

**An exception changes access for a branch.** An admin can give a traveller other access to a page
than the page above it gives, such as view in place of edit, none in place of view, or edit in
place of view. The exception covers that page and every page beneath it, until another exception
further down.

**A traveller who may see a page may see every page above it.** An admin who gives a traveller
access to a page beneath a page that traveller may not see is refused. The access system says which
page above it is hidden from them.

**A new page takes its parent's access.** Each traveller's access to a new page is their access
to its parent, or to the trip for a page at the top. The pages created for a trip's countries
start the same way, as pages at the top.

**A moved page takes its new place's access.** A moved page, with the pages beneath it, takes each
traveller's access from its new parent. Any exception set on the page or beneath it moves with it.
Before a move that lets a traveller see a page they could not see, the planner says how many
travellers will see it, and asks the traveller moving it to confirm.

## Consequences

- A traveller's pages always arrive as whole branches, from the top of the trip down. No page
  reaches a traveller without its parent, so `planner/pages` needs no rule for a page whose parent
  is hidden. `spec/planner/pages.md` gives the pages a phone keeps on that basis.
- A link to a page a traveller may not see shows only that the page is not available to them. It
  never shows the page's title.
- The graveyard, where deleted pages wait for an admin to restore them, lists for each traveller
  only the deleted pages they could see. Their access is the one they had at the delete.
- An admin cannot hide one page while showing the pages beneath it. An admin who wants that moves
  the pages beneath it elsewhere first.
- A move can widen who sees a page, such as a private page moved under a country's page every
  traveller sees. The confirmation is the guard. A move that narrows who sees a page asks nothing.
- The access system's requirements promise the three levels, the trip's access as the root, the
  exceptions, and the refusal. How the access system stores them is its specification's to give.

## Alternatives considered

- **Access passes down, with no exceptions.** To hide one branch, an admin would have to move it out
  of every branch the traveller may see, rearranging research that belongs to every traveller.
- **No access passes down, and every page is set alone.** Every new page would need its access set
  for every traveller, and a long trip holds hundreds of pages.
- **A new page seen only by its creator and the admins.** Research would stay hidden from the other
  travellers until an admin shared each page.
- **View and edit access set apart, each passing down on its own.** Edit access to a page a traveller
  cannot see gives them nothing they can use.
- **A page seen under a parent shown as a placeholder.** The placeholder tells the traveller that a
  page is hidden from them, and where.

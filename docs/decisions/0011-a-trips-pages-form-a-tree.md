# ADR-0011 — A trip's pages form a tree, with links between any two

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** planner, access

## Problem

The planner, the system that holds each trip, gives every trip pages where travellers write up
their research by hand, such as notes on where to eat in Santiago. Most of the planning for a trip
is this research, and a trip across several countries gathers a lot of it. Nothing said how a
trip's pages are arranged: whether a page can hold other pages, such as a country's page holding a
page for each city, or how one page refers to another.

Travellers organise research in different ways. One groups it by country, then by city. Another
keeps a page per topic, such as food or transport, and links each to the places it mentions. An
arrangement the planner imposes suits one of them and gets in the way of the other.

## Decision

A trip's pages form a tree, and any page can also link to any other.

**The tree.** Each page sits under at most one other page, its parent, or at the top of the trip.
A trip holds any number of pages, nested to any depth, such as Chile, then Santiago, then Eating in
Santiago. A traveller moves a page, with every page under it, to any other parent or to the top. A
page cannot be moved under itself or under a page beneath it. The pages under one parent keep the
order the traveller gives them.

**Links.** A page's text can link to any other page of the trip, in any branch of the tree, as many
times as the traveller likes. A link names the page it points to, not its title or its place in the
tree, so it survives the page being renamed or moved. A link to a page that has been deleted stays
in the text. It shows that its page is in the trip's graveyard, which the paragraph on deleting
describes.

**Deleting.** Deleting a page moves it, with every page beneath it, to the trip's graveyard. Before
deleting, the planner asks the traveller to confirm, saying how many pages beneath it will go with
it. The access system, the system that handles accounts and invitations, sets which pages each
traveller may see, page by page. Each traveller sees the graveyard as a list of the titles of the
deleted pages they could see before the delete. Only a trip's admin, a traveller who may manage the
trip, can read a page in the graveyard, or restore it with the pages beneath it. A restored page
returns under its old parent, or to the top of the trip when its old parent is in the graveyard too.
Nothing deletes a page from the graveyard. The copy of a trip each phone keeps for reading with no
connection holds no page in the graveyard.

**Content.** A page holds a title and text written in Markdown, the plain-text format for headings,
lists, tables, checklists and links that Obsidian and GitHub use. The planner imposes no structure
on the text.

**Pages for countries.** A traveller creating a trip can choose the countries it will visit. The
planner creates a page at the top of the trip for each, titled with the country's name. Each is an
ordinary page from then on, renamed, moved or deleted like any other.

**Links from the calendar.** A trip's calendar holds stretches and firm items. A stretch is a
place and the dates a traveller expects to be there, pencilled in. A firm item is something fixed
to a date, such as a booked tour. A stretch or a firm item can link to one page of the trip, such as
Santiago's stretch linking to the Santiago page.

## Consequences

- `planner/pages`, the component that holds a trip's pages, holds the tree, the links, and the text.
  Its specification gives how a link names its page.
- `planner/itinerary`, the component that holds a trip's calendar, gives each stretch and each firm
  item a link to at most one page. `spec/planner/itinerary.md` changes to hold that link.
- The planner promises the tree, the links and the pages for countries in its own requirements.
- Whether access to a page passes to the pages beneath it is a real question, because a tree
  exists. It is not decided until TODO-3 is done.
- A traveller who arranges research by topic alone puts every page at the top of the trip, and uses
  links. The tree costs them nothing.
- Pages hold no images or attached files. Adding them later enlarges the copy each phone keeps for
  reading with no connection (ADR-0004, a trip is read-only offline), and needs storage designed
  for them.
- One confirmed delete moves a whole branch, such as a country's research, to the graveyard. A
  traveller who wants to keep part of it in the tree moves that part elsewhere first. A delete made
  by mistake is undone by an admin restoring the branch.
- Every link to a page in the graveyard, from another page or from the calendar, shows that its
  page is in the graveyard. On a phone with no connection, such a link shows only that its page is
  not on the phone.
- The graveyard only grows. The pages in it are held online, so they never enlarge the copy each
  phone keeps.
- The access system promises that only an admin reads or restores a page in the graveyard. It also
  promises that each traveller's list of the graveyard holds only the deleted pages they could see.

## Alternatives considered

- **Links alone, with every page side by side.** Nothing groups the pages of one country, so a long
  trip's pages become one long list.
- **A tree alone, with no links between branches.** A page about transport across a trip could not
  point to each city it mentions.
- **Deleting a page, and moving the pages under it up to its parent.** The pages under a page
  usually belong with it, such as a city's notes under the city, and moving them up would scatter
  them through the tree. The confirmation guards against a mistaken delete instead.
- **Deleting a page for good, at once.** A delete made by mistake, such as a country's research
  deleted in place of a city's, could not be undone. The graveyard keeps it, at no cost to the copy
  on each phone.
- **Letting every traveller read and restore the pages in the graveyard.** A traveller who may not
  see a page in the tree could read it once it was deleted. Who may read a page is decided page by
  page, and only an admin manages the whole trip.
- **A page for each country created when its first stretch is pencilled in.** Pages would appear
  while the traveller is only trying out a route, and a traveller choosing countries at the start
  already knows where the trip goes.

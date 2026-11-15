# ADR-0021 — A deleted page is restored only to its old place

- **Status:** Accepted
- **Date:** 2026-11-15
- **Scope:** planner

## Problem

The planner, the system that holds each trip, keeps a trip's pages of research in a tree. Each page
sits under one other page, its parent, or at the top of the trip. Deleting a page moves it, with
every page beneath it, to the trip's graveyard, where an admin, a traveller who may manage the trip,
can restore it.

Who may see a page follows the tree. A traveller's access to a page passes down to every page
beneath it, and an admin can hide a page, with its whole branch, from a traveller (ADR-0012, access
to a page passes down to the pages beneath it). A page beneath a hidden page has no setting of its
own. It is hidden only because the page above it is.

A deleted page restored while its parent is in the graveyard has no old place to return to. The
only place left for it is the top of the trip. There, each traveller would see it as they see the
trip as a whole. A page from a hidden branch, such as plans for a surprise, would then be shown to
the travellers it was hidden from, and nothing would tell the admin.

## Decision

A deleted page is restored only to its old place, under its old parent.

**The graveyard lists only the highest deleted page of each branch.** A page deleted with the page
above it is not listed. It belongs to the listed page, and returns with it. A page deleted earlier
than a page above it is not listed either, while the page above it is in the graveyard.

**A page whose parent is in the graveyard cannot be restored.** The planner refuses, and names the
listed page above it to restore first. Restoring that page lists, in its turn, each page beneath it
that was deleted earlier. Each of those then restores to its old place.

**A restore never changes where a page sits.** A restored page has the parent it had when it was
deleted, and its old position among the pages under that parent. Each traveller's access to it is
therefore what the tree gives it there.

> [!NOTE]
> **History.** ADR-0011 (a trip's pages form a tree, with links between any two) returned a
> restored page to the top of the trip when its old parent was in the graveyard too. This record
> replaces that one rule. Everything else ADR-0011 decided stands, so ADR-0011 stays Accepted.

## Consequences

- Restoring a page never shows it to a traveller who could not see it in its old place.
- An admin who wants one page of a deleted branch restores the branch from its highest deleted
  page, then deletes again what they do not want. That takes more steps than restoring the one page.
- `planner/pages`, the component that holds a trip's pages, lists in the graveyard only the pages
  whose parent is in the tree, and refuses to restore any other. `spec/planner/pages.md` holds the
  listing and the refusal.
- A restore needs no warning about who will see the page, unlike a move, which asks first when it
  lets more travellers see a page.

## Alternatives considered

- **Returning the page to the top of the trip, after asking the admin.** The admin would be told how
  many more travellers would see the page. The page would still leave its branch, and an admin who
  agreed in haste would show it.
- **Returning the page to the top of the trip, hidden from each traveller who could not see it.**
  The restore would have to write a setting of who may see the page, which an admin would later
  find and not recognise.
- **Restoring the pages above it at the same time.** One restore would bring back pages the admin
  did not ask for.

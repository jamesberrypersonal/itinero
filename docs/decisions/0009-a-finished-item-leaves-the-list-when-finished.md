# ADR-0009 — A finished item leaves the live list in the commit that finishes it

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** workspace

## Problem

`docs/TODO.md`, the live work list, holds the work still owed and the questions waiting on a
decision. Each roadmap orders one system's work into milestones, and a milestone can name an item of
the live list as one of its steps, as `Do TODO-NN`. `documentation-system.md`, the rules every
document keeps, said two things about when such an item leaves the list.

One rule said that finished work leaves the list for `CHANGELOG.md` in the commit that finishes it,
so that no commit shows the work done and its item still open. Two other sentences said that a
milestone's items are removed from the list in one batch, once the milestone is complete.

An item that is a milestone's step is usually finished before its milestone is complete. The
question of whether a trip's pages form a tree, for example, can be decided long before the pages
are written. Under the first rule, its item leaves the list at once. Under the second, it stays
open until every other step of its milestone is done, while a decision record already settles it.

## Decision

Every item leaves the live list for `CHANGELOG.md` in the commit that finishes it, whether or not a
milestone names it as a step.

When a milestone names the item as a step, the same commit moves the step from the roadmap's
pending half to the milestone's entry in its completed half. The completed entry says what is now
present, as every completed entry does.

## Consequences

- `documentation-system.md` loses both sentences about removing a milestone's items in one batch.
- The live list never shows a finished item as open, so a reader of the list sees only work still
  owed.
- The roadmap's two halves show a milestone in progress as part done and part owed, which they
  already allow.
- A reader who wants to know which items a milestone did reads the changelog, or the milestone's
  completed entry, rather than the list.
- doc-check, the checker that holds the vault to the rules, checks neither rule, so it does not
  change.

## Alternatives considered

- **Keeping a milestone's items on the list until the milestone is complete.** The list would show
  decided questions as open, sometimes for a whole milestone.
- **Marking a finished item as done in place, then removing it with its milestone.** The list
  would hold two kinds of item, and every reader would have to tell them apart.

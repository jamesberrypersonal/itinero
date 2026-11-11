# ADR-0002 — Requirement claims, one-line code spans, no raw HTML and the live list's labels are checked

- **Status:** Accepted
- **Date:** 2026-11-10
- **Scope:** workspace

## Problem

`documentation-system.md` holds the rules every document in the `docs/` vault keeps. Its table of
mechanical checks lists the rules the documentation checker, `shared/doc-check`, enforces. Four
gaps in it surfaced while the checker's requirements and specification were written.

- **Requirement claims were deferred to a migration that does not exist.** A requirement is
  claimed when a specification's claim table, its section headed Requirements this satisfies,
  cites it. The rules said the checker would not report an unclaimed requirement until every
  component's documentation had moved into the vault from package folders. That deferral was
  carried over from another workspace. This workspace has no documentation or code outside the
  vault, so nothing is migrating, and the deferral only hid unclaimed requirements.
- **A code span wrapped across two lines was misread silently.** The checker reads each document
  line by line (ADR-0001, the checker reads each document line by line). A span that continues
  onto the next line is a form it does not read. Both renderers accept the form, so nothing told
  the author.
- **Raw HTML rendered differently in the two renderers.** GitHub drops any tag it does not allow,
  and shows the rest of the page. Obsidian renders the tag. A placeholder written in angle
  brackets, outside a code span, opened an unknown element in the checker's own specification, and
  everything after it disappeared in Obsidian while GitHub showed nothing wrong.
- **The live work list's labels had no fixed form.** `TODO.md` is the live work list. Each item
  states a problem, a reason, a proposal and the releases it moves, and the list names its next
  free item number. The rules gave the markup of the item's tag and date lines, but not of these
  five labels, so the checker could not confirm them.

## Decision

`documentation-system.md` is amended in four ways.

1. The checker reports every functional and non-functional requirement that no specification's
   claim table cites (`SHR:DOC-CHECK-F13`). The deferral is removed.
2. A code span opens and closes on one line. This becomes a Markdown rule, and the checker reports
   a span left open at the end of its line (`SHR:DOC-CHECK-F15`).
3. No document holds an HTML tag or comment outside code. This becomes a Markdown rule, and the
   checker reports each one (`SHR:DOC-CHECK-F16`).
4. An item's four parts open with `*Problem:*`, `*Reason:*`, `*Proposal:*` and `*Releases:*`.
   The list names its next free number on a `*Next free:*` line. These follow the form of the
   `*Tags:*` line the rules already gave.

The first three join the table of mechanical checks as rows of their own. The fourth extends the
existing row on the live list's shape.

## Consequences

- No document is written under an earlier form. Every document in the vault keeps the new rules on
  the day they land, so none moves and the checker accepts no second form.
- A requirement is reported from the day it is written until a specification claims it. A new
  component's requirements therefore land with its specification, or fail the check until it
  lands.
- An author who hard-wraps prose breaks each line before or after a code span, never inside one.
- A placeholder in angle brackets, and a note to other authors in an HTML comment, are both
  reported. The placeholder goes in a code span. The note goes in the document, where readers see
  it, or in the pull request.
- `spec/shared/doc-check.md` gains the rules `claims`, `code-spans` and `raw-html`, and reads the
  live list with these labels.

## Alternatives considered

- **Keep the claim check deferred.** The deferral exists for a workspace that is moving
  documentation into its vault, and this one is not.
- **Leave wrapped code spans unreported.** The fault would stay silent, and text inside the broken
  span would be checked as prose.
- **Allow the HTML both renderers share.** Which tags each renderer allows changes with its
  releases, and no document in the vault needs HTML.

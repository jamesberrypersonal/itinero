# ADR-0001 — The documentation checker reads each document line by line

- **Status:** Accepted
- **Date:** 2026-11-10
- **Scope:** shared/doc-check

## Problem

The documentation checker, `shared/doc-check`, holds every Markdown document in the `docs/` vault
to the rules of the documentation system. To do that it has to find each document's headings,
links, tables, callouts, fenced code blocks and requirement identifiers. Markdown has no single
grammar that every renderer agrees on. The vault is read in two renderers, Obsidian and GitHub, and
each accepts forms the other reads differently.

The checker must also build from a fresh checkout with only the Rust toolchain the repository pins,
using the Rust standard library and no third-party package (`SHR:DOC-CHECK-NFR5`). A complete
Markdown parser is therefore not available to it as a dependency.

## Decision

The checker reads each document one line at a time, and recognises a small set of line forms. A
line is a heading, a table row, a callout opening, a fence, a block ID, or ordinary text. Within a
line, it finds code spans, links, bold text and identifiers by scanning for their delimiters. The
only state it carries from one line to the next is whether it is inside a fenced code block, and
which paragraph or table the line belongs to.

The forms the checker reads are part of the documentation system's rules. A document written in
any other form is at fault, even where both renderers accept it. The author rewrites the document
into a form the checker reads, and the checker is not extended to read the other form
(`SHR:DOC-CHECK-NR8`, the checker does not read every Markdown form both renderers accept).

## Consequences

- The checker stays small enough to be read in one sitting, and every rule can be traced to the
  lines it reads.
- Some Markdown that both renderers accept is not a form the checker reads, so a document using it
  is at fault. A code span wrapped across two lines is the known case. Every code span is
  therefore kept to one line, and a hard-wrapped paragraph breaks its line before or after a span,
  never inside one. The checker reports a span left open at the end of its line
  (`SHR:DOC-CHECK-F15`), so the fault is never silent.
- Authors carry the cost of these forms, and the checker does not. An author who wraps prose has
  to watch where each line breaks.
- Constructs that span lines are limited to the few the checker tracks: fenced code blocks,
  paragraphs and tables. Any rule that needs another one, such as a list nested inside a callout,
  needs a new decision record first.
- Reading a vault of 1,000 documents is one pass over each file. This keeps the checker inside its
  time bound of two seconds without caching or threads (`SHR:DOC-CHECK-NFR1`).

## Alternatives considered

- **A full CommonMark parser written for the checker.** Its size would dwarf every rule it serves,
  and it would still disagree with Obsidian wherever Obsidian departs from CommonMark.
- **A Markdown parser from a third-party package.** The checker must build with the Rust standard
  library alone (`SHR:DOC-CHECK-NFR5`).

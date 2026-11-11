# ADR-0006 — New documents start from skeletons that a second program writes

- **Status:** Accepted
- **Date:** 2026-11-11
- **Scope:** shared/doc-check, shared/doc-scaffold

## Problem

An author starting a component wrote its requirements and its specification from blank files.
They also added rows by hand to the component registry, the live work list's Tags table, and the
index of every folder the documents sat in. Starting a system, a decision record or a guide took
the same kind of handwork. The documentation checker, doc-check, reported each row forgotten,
one run at a time, but it could not add the row. doc-check promises never to change a file
(`SHR:DOC-CHECK-NFR3`), so that a pre-commit hook and continuous integration can run it without
risk to the work being committed.

## Decision

A second program, doc-scaffold, writes the skeletons. It is a component of its own,
`shared/doc-scaffold`, with its own requirements and specification. It starts four kinds of thing:
a component, a system, a decision record and a guide. For each, it writes the new documents and
every row that names the new thing, then leaves the content to the author, marking each part to
write with "To be written".

doc-scaffold is built as doc-check is. It is a Rust package at `tools/doc-scaffold`, using the
Rust standard library and no third-party package. Authors run it through just, with
`just new-component`, `just new-system`, `just new-decision` and `just new-guide`.

doc-check gains a library beside its binary, holding one function that runs every rule over a
repository and returns the findings. doc-scaffold's tests call it after every command, so the
tests fail if doc-scaffold writes anything doc-check would report.

## Consequences

- doc-check stays read-only. Checking and writing are separate programs, and neither takes an
  option that turns it into the other.
- Each skeleton follows `documentation-system.md`. A change to a rule there that alters what a new
  document must hold also changes doc-scaffold, in the same pull request.
- `spec/shared/doc-check.md` describes the library, and the one package that depends on it.
- `spec/shared/doc-scaffold.md` describes the commands, the skeletons and where each row goes.
- A skeleton passes doc-check while still holding its placeholders, so the checker cannot report
  one that was never filled in. The author and the reviewer search for "To be written" instead.

## Alternatives considered

- **A writing mode in doc-check, such as `doc-check --fix`.** doc-check's promise never to change a
  file is what lets a hook run it safely, and one option would end that promise.
- **A shell script in the `justfile`.** Inserting a row in the right place of a Markdown table is
  fiddly in shell, and the script could not be tested against doc-check the way a Rust package can.
- **Templates for the author to copy by hand.** A template gives the shape of a document, but the
  author would still add every registry and index row, which is where the findings came from.

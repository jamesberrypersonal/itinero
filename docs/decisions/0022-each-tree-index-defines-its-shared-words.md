# ADR-0022 — Each tree's index defines the words its documents share

- **Status:** Accepted
- **Date:** 2026-11-15
- **Scope:** workspace

## Problem

`style.md`, the rules for how each document in the `docs/` vault is written, lets a document assume
only its own tree's `README.md`. A tree is one of the vault's top folders, such as `requirements/` or
`spec/`, and its `README.md` is the tree's index. Anything else a document relies on, it declares at
its top, or teaches itself.

Many documents rely on the same few words. A specification of the online side, the part of Itinero
that runs on Cloudflare's servers, names a Worker, a Durable Object, D1 and Wrangler. A requirement
names a stretch, a firm item, a grant and a graveyard, and cites other requirements by identifiers
such as `ACC-F2`. No index defines these words, and each document cannot teach them all again.
Read as a newcomer would, with only its tree's index beside it, almost every document of the
planner, access, bookings and web systems leaves some of them undefined.

`documentation-system.md`, the rules for where each document lives and what shape it takes, says
what each tree's index holds. None of those lists has a place for words.

## Decision

The indexes of `requirements/`, `spec/` and `roadmap/` each hold a section headed **Words**. It is
a table of each word that more than one document of the tree uses without defining, and what it
means.

**A word earns a row when two documents of the tree use it.** A word only one document uses is
defined in that document. A word the Lexicon of `style.md` settles, such as component and package,
is used as the Lexicon says, and is defined in a tree's Words only where its documents need the
meaning, not the rule.

**Each tree's Words stand alone.** A specification assumes the specifications' index, not the
requirements', so a word both trees use is defined in both.

**A document may use a word of its tree's Words without defining it.** The final pass of `style.md`
reads each document with its tree's index beside it, Words included.

## Consequences

- `documentation-system.md` adds the Words section to what the indexes of `requirements/`, `spec/`
  and `roadmap/` hold.
- Each of the three indexes gains its table. An author who adds a word more than one document uses
  adds its row, in the same commit.
- A newcomer reads one table per tree once, and each document stays short.
- Two tables can drift apart where the same word is defined in both. The definitions are kept the
  same by whoever changes either.
- `shared/doc-check`, the documentation checker, does not check the section. Nothing a checker can
  see tells a word that needs defining from one that does not.

## Alternatives considered

- **Defining each word in every document that uses it.** Every specification of the online side
  would repeat the same five definitions.
- **One list of words for the whole vault.** A document may assume only its own tree's index, so a
  list elsewhere would need an `**Assumes**` line in nearly every document.
- **A word list in the Lexicon of `style.md`.** The Lexicon settles which word to write. It does not
  say what the project's things are.

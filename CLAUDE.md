# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is here

Itinero is a trip planner: build itineraries day by day, organise bookings, keep every detail in
one place. The repository is documentation-first. The product itself is not built yet, and the only
code is `tools/doc-check`, the checker that holds the documentation to its rules, and
`tools/doc-scaffold`, which starts new documents as skeletons that pass it.

- `docs/` is the documentation, read both as an Obsidian vault and rendered on GitHub.
- `tools/doc-check/` and `tools/doc-scaffold/` are Rust packages, run through `just`.
- `tools/hooks/pre-commit` is an optional hook that runs the checker before each commit.

## Commands

All commands run from any directory in the repository, because `just` runs recipes from the
repository root.

```
just check-docs                 # check every document in docs/ (exit 0 clean, 1 findings, 2 could not run)
just test-docs                  # the whole test suites of doc-check and doc-scaffold
just install-hook               # install the pre-commit hook
just new-component <system> <slug> <PREFIX> "<description>"   # start a component's documents and rows
just new-docs <system> <slug>                                 # start the missing documents of a registered component
just new-system <slug> <PREFIX> "<description>" "<keeper>"     # register a system and start its roadmap
just new-decision "<title>" <scope>... [--slug <slug>]        # start the next decision record
just new-guide <group> <slug> "<title>" "<description>"       # start a guide
```

Narrower test and development commands:

```
cargo test -p doc-check --lib                      # unit tests, including the rule-coverage test
cargo test -p doc-check --lib <name>               # one unit test, by name or part of one
cargo test -p doc-check --test rules               # every rule case under tools/doc-check/tests/rules/
cargo test -p doc-check --test behaviour <name>    # one behaviour test
cargo test --release -p doc-check -- --ignored     # the 1,000-document speed test (NFR1)
cargo test -p doc-scaffold                         # doc-scaffold's tests, which run doc-check on its output
cargo clippy -p doc-check -p doc-scaffold --all-targets   # lints; keep at zero warnings
cargo run -p doc-check -- --root tools/doc-check/tests/rules/links/breaks   # run against one case
```

The toolchain is pinned to Rust 1.94.1 in `rust-toolchain.toml`.

## The documentation system

Read `docs/documentation-system.md` and `docs/style.md` before writing or changing any document.
They are the rules, and doc-check enforces the structural ones. `docs/guides/documenting-a-component.md`
walks through adding a component's documents in order.

How the vault is arranged:

- **Folders by question.** `requirements/` says what something promises, never how. `spec/` says how
  it is built, in eight fixed, numbered sections. `decisions/` holds the decision records. `guides/`
  holds step-by-step runbooks.
- **Folders follow systems.** `requirements/` and `spec/` hold one folder per system, plus `shared/`
  and `concerns/`. Documents sit at their component's address, such as
  `requirements/shared/doc-check.md`.
- **The registry comes first.** `docs/components.md` declares every system, component and concern,
  and its requirement prefix, before any document names it. The `just new-*` recipes add the rows
  for a new component or system, and every index row, and mark what is left with "To be written".
- **The live work list.** `docs/TODO.md` holds the work still owed.

Rules that are easy to break, and that doc-check reports:

- **Links.** Use standard relative links only. Never use wikilinks or absolute paths. The only
  fragment a link may carry is a block ID, as in `doc-check.md#^shr-doc-check-f1`, never a heading
  anchor.
- **Code spans** never wrap across two lines.
- **No raw HTML.** That includes comments. A placeholder such as `<path>` must sit in a code span,
  or Obsidian swallows the rest of the page.
- **Fenced code blocks are the only exemption** from every check. An example identifier, citation or
  link that doesn't exist must go in a fence. A fence indented more than three spaces is not read as
  a fence, which is why the guides make their steps headings rather than long numbered lists.
- **Every requirement** has:
  - a heading holding its identifier and a title
  - a body ending in ` ^<id in lower case, colon as hyphen>`
  - a `- **Verification:**` list
  - a `> **What does this buy?**` block
- **Non-requirements tables** are followed, after one blank line, by `^<prefix>-nr`.
- **Claims.** Every requirement must be claimed in some specification's section 7 claim table.
- **Indexes.** Every new document gets a row in its folder's `README.md`, in the same commit. A new
  folder's `README.md` is linked from the one above it, up to `docs/README.md`.
- **The registry and the live list agree.** Every registered address needs a row in the Tags table
  of `docs/TODO.md`.
- **Nothing links to `docs/TODO.md`**, apart from `documentation-system.md` and `CHANGELOG.md`.
  Elsewhere, an item is cited only as a condition, in the form "until TODO-N is done".
- **Section citations** resolve against the nearest document named before them on the line, and
  otherwise against the document they sit in.

Rules about process, which doc-check cannot see:

- **Decision records** are append-only once accepted. A changed decision is a new record that
  supersedes the old one. A record's Status and Scope lines change in the record and in both views of
  `docs/decisions/README.md`.
- **Changing a rule** in `docs/documentation-system.md` takes a decision record scoped `workspace`.
  It lands in the same pull request as the matching change to doc-check.
- **Guide output is real.** Expected output in a guide is captured from a real run, never written
  from memory.
- **The final pass.** Before committing a document, run the final pass at the end of `docs/style.md`.

## doc-check's architecture

`docs/spec/shared/doc-check.md` specifies it, and code comments cite its sections. A run goes:

1. **`vault.rs`** walks `docs/` in byte order. It skips `graveyard/` and `.obsidian/` directories and
   `*-draft.md` files. Each condition in spec §4.6 stops the run with exit status 2.
2. **`markdown.rs`** reads each document line by line, as ADR-0001 records. Each line is classified,
   and each heading, cell or text line is scanned for code spans, links, identifiers and citations.
   The only state carried across lines is the open fence and the paragraph or table a line is in.
3. **`tables.rs`** reads the three tables every rule shares: the registry, the decision records, and
   the live list.
4. **`rules/`** runs the rules, then sorts and de-duplicates the findings. `rules/mod.rs` holds
   `RULES`: one entry for each row of the table of mechanical checks in `documentation-system.md`,
   with the heading of that document each finding cites.
5. **`main.rs`** prints the findings, writes the optional `--summary` file for the CI job summary,
   and sets the exit status. `lib.rs` exposes the run as `doc_check::check`, which only
   doc-scaffold's tests use.

Constraints to keep:

- **No dependencies.** doc-check uses the Rust standard library only (NFR5).
- **Read-only.** It never writes inside the repository (NFR3).
- **Deterministic.** Its output must not depend on the order the file system lists files, so the
  code uses ordered collections and sorts everything.
- **Fix the document, not the parser.** When doc-check misreads Markdown both renderers accept, the
  document is at fault and gets rewritten. The parser is not extended (ADR-0001).

Adding or changing a rule takes all of these together:

- a workspace decision record
- the row in the table of mechanical checks in `documentation-system.md`
- the subsection in spec §4.3
- the entry in `RULES`
- a `breaks/` and a `keeps/` case under `tools/doc-check/tests/rules/<rule>/`. Each case is a minimal
  repository root with a `docs/` vault. A `breaks/` case holds an `expected.txt` with the exact
  findings, all of its own rule.

The coverage test fails for any rule missing either case. The `case-collisions` breaking case needs a
case-sensitive file system, so it is skipped on macOS and runs in CI, on Linux.

## doc-scaffold

`docs/spec/shared/doc-scaffold.md` specifies it, and ADR-0006 records why it is a separate program.
It reads the registry and the index tables, refuses before writing anything, and edits existing
files only by inserting lines. The one exception: `just new-docs` links a registered component's
slug in the registry to the specification it has just written. Its tests in
`tools/doc-scaffold/tests/scaffold.rs` run each command on a copy of the real vault and require
doc-check's findings to be unchanged afterwards. A change to what a new document must hold, in
`documentation-system.md`, changes doc-scaffold's skeletons in `src/commands.rs` in the same pull
request.

## Continuous integration

`.github/workflows/check-docs.yml` runs on every push and pull request. It runs `just test-docs`,
then `just check-docs --summary "$GITHUB_STEP_SUMMARY"`. A pull request with findings fails its
check.

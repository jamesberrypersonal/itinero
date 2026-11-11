# The documentation checker

**Assumes** [doc-check.md](../../requirements/shared/doc-check.md) — what the checker promises.

## 1. Purpose

doc-check is the program that holds every document in the `docs/` vault to the documentation system.
It reads the whole vault on every run, and prints one finding for each place a document breaks a
rule. Each finding says where the problem is, which rule it breaks, and what would pass. Authors run it before committing, and continuous integration runs it on every pull request.

## 2. Scope

doc-check covers the rules in the table of mechanical checks in `documentation-system.md`. It
reads every markdown file under `docs/`, and the vault's directory structure. It never writes to
the vault.

Three things act on it:

- an author, through `just check-docs`, from any directory in the repository
- the continuous integration workflow, on every push and pull request
- a pre-commit hook, which a guide says how to install

Deliberately absent:

- the rules of `style.md`, Mermaid validation, and the other rules its requirements' non-requirements list
- any way to silence a finding other than a fenced code block
- any change to a document. doc-check reports, and the author fixes

## 3. Interface

### 3.1 User interface

doc-check is a command-line program, written in Rust and run through just (ADR-0003, the
documentation checker is built in Rust and run through just). An author runs it from any directory
in the repository:

```
just check-docs [--summary <file>]
```

just runs every recipe in the directory that holds the `justfile`, which is the repository root.
The recipe builds doc-check in release mode, if needed, and runs it there, so `--root` keeps its
default. The working directory matters only when the built program is run directly, as a test
does.

| Option | Effect |
|---|---|
| `--root <dir>` | The repository root. The vault is `<dir>/docs`. Defaults to the working directory. Findings print paths relative to this directory |
| `--summary <file>` | Also append the run's summary, in Markdown, to `<file>`, creating it if it does not exist (§4.5) |

No other option exists. Neither option can remove a finding: `--root` chooses which repository is
checked, and `--summary` adds a second copy of the output.

| Exit status | Means |
|---|---|
| 0 | Clean. Every document was checked, and none breaks a rule |
| 1 | Findings. Every document was checked, and at least one breaks a rule |
| 2 | Could not run. doc-check stopped before checking every document (§4.6) |

Findings go to standard output, one per line, in the form §4.4 gives. The last line on standard
output states the outcome. A could-not-run message goes to standard error.

### 3.2 Application interface

None. doc-check has no network or service interface. Callers reach it through its command (§3.1).

### 3.3 Programming interface

None. The package `tools/doc-check` builds a binary only, and no other package depends on it.

### 3.4 Systems this drives

doc-check drives three systems outside itself.

- **The file system.** doc-check lists directories and reads files under the vault, and writes only
  the summary file it is given. It follows no symbolic link out of the vault. A symbolic link inside
  the vault is read as the file it points to, if that file is inside the vault, and is otherwise a
  could-not-run condition (§4.6).
- **just**, a command runner. A `justfile` at the repository root defines named recipes, and
  `just <recipe> <arguments>` runs one. The `check-docs` recipe runs
  `cargo run --release --quiet --package doc-check -- <arguments>`.
- **GitHub Actions**, the continuous integration platform. A workflow is a file under
  `.github/workflows/` that lists jobs and their steps. A job summary is Markdown that a step appends to the file named by the environment variable `GITHUB_STEP_SUMMARY`. GitHub shows the summary on the pull request's run. A step that exits non-zero fails its job. A failed job fails the pull request's check.

The workflow `.github/workflows/check-docs.yml` runs on every push and every pull request. It
installs just and the pinned Rust toolchain. It runs the test suite (§4.7) with `just test-docs`,
so no rule lands without its cases, and then runs:

```
just check-docs --summary "$GITHUB_STEP_SUMMARY"
```

doc-check never reads `GITHUB_STEP_SUMMARY` itself. The workflow passes the path, so a run behaves the same everywhere (`SHR:DOC-CHECK-NFR2`).

## 4. Behaviour

### 4.1 A run, end to end

*Invoked from:* `just check-docs`, run by an author, a pre-commit hook or the workflow (§3.4).
Nothing runs it automatically on save.

1. doc-check parses its options. An unknown option or a missing value is a could-not-run condition.
2. It confirms that `<root>/docs` is a directory, and that `<root>/docs/components.md` can be read.
3. It walks the vault (§4.2) and reads every file it keeps, as UTF-8.
4. It reads each document into lines, and each line into the parts §4.2 names.
5. It reads the registry, the decision index and the live work list into tables (§4.3).
6. It runs every rule over the vault (§4.3), and collects the findings.
7. It sorts the findings (§4.4), prints them, and prints the outcome line.
8. With `--summary`, it appends the summary to the file (§4.5).
9. It exits with the status for its outcome (§3.1).

A could-not-run condition at any step stops the run there. doc-check prints no partial findings.

### 4.2 Reading the vault

The walk starts at `<root>/docs`, and visits each directory's entries in byte order of their names.

- **Skipped by path.** A directory named `graveyard`, at any depth, is skipped with everything
  below it. A directory named `.obsidian` holds Obsidian's local state, and is skipped too. A file
  whose name ends in `-draft.md` is skipped.
- **Kept.** Every other file ending in `.md` is a document. Every other entry is kept as a name only,
  so links to images and to directories resolve, and so letter-case collisions are seen.

doc-check reads a document one line at a time (ADR-0001, the checker reads each document line by line). Each line is classified, in this order:

| Line | Recognised by |
|---|---|
| Fence | Up to three spaces, then three or more backticks or tildes. A fence opens a fenced code block, and the block closes at the next fence of the same character that is at least as long |
| Inside a fence | Any line between a fence and its close. Such a line is never read further, and never produces a finding (`SHR:DOC-CHECK-F14`) |
| Heading | One to six `#` characters, then a space. Its level is the number of `#` characters |
| Table row | A line that starts with a pipe, `\|`. A row of only pipes, hyphens, colons and spaces is the separator row |
| Callout | A blockquote line of the form `> [!TYPE]`, with optional text after it |
| Block ID line | A line holding only `^` and an ID of lower-case letters, digits and hyphens |
| Blank | A line holding only whitespace |
| Text | Every other line, including list items and blockquote lines |

A paragraph is a run of consecutive text lines. A table is a run of consecutive table rows. A
paragraph's block ID is a ` ^id` at the end of its last line. A table's block ID is a block ID line
after it, with one blank line between them. On GitHub, a line directly after a table is read as
another row of it.

Within a heading, table cell or text line, doc-check finds these parts:

- **Code spans.** A run of backticks opens a span, which closes at the next run of the same length on the same line. An unmatched run is reported by the rule `code-spans` (§4.3.22), and is otherwise read as literal text. A span never continues onto the next line, because a code span that does is a fault in the document (ADR-0001, the checker reads each
  document line by line).
- **Links.** `[text](target)` and `![alt](target)`, outside code spans. The target runs to the
  first `)` that is not inside angle brackets.
- **Wikilinks.** `[[` outside code spans opens one, and it closes at `]]`.
- **Bold text.** Text between a pair of `**` on the same line, outside code spans.
- **Requirement identifiers.** A system or concern prefix of two to four capital letters, then
  optionally a colon and a component name of three to twelve capitals, digits and hyphens, then a hyphen, a kind (`F`, `NFR` or `NR`) and a number. The kind and number are the last hyphen-joined part, so in `SHR:DOC-CHECK-F1` the component name is `DOC-CHECK`. An identifier has no letter,
  digit, colon or hyphen directly before it, so `PREFIX-F1` is not one. An identifier is found in
  prose and in code spans, but not inside a link target.
- **Unprefixed identifiers.** A kind and a number standing alone, such as a bare F7, with no
  hyphen, letter or digit directly before it.
- **Decision citations.** `ADR-` and four digits, in prose or in code spans.
- **Item citations.** `TODO-` and one or more digits, in prose or in code spans.
- **Raw HTML.** Outside code spans, a `<` followed by a tag name of letters, digits and hyphens,
  optionally after a `/`, and then a space, a `/` or a `>`. A `<!` also opens raw HTML, which covers
  comments. An autolink, such as `<https://example.com>`, is not raw HTML.
- **Section citations.** `§` followed by a number, optionally followed by further dot-joined
  numbers.
- **Document mentions.** A code span holding a path that ends in `.md`, read as a path from the
  vault root.

A document's numbered sections are its headings of level two or below, whose text opens with a
number, optionally followed by further dot-joined numbers, and then a full stop or a space.
`## 4. Behaviour` numbers section 4, and `### 3.2 Application interface` numbers section 3.2.

### 4.3 The rules

Each rule has a name, which every finding prints. There is one rule for each row of the table of
mechanical checks in `documentation-system.md`. The last three rows, `claims`, `code-spans` and
`raw-html`, joined the table with ADR-0002 (the checker confirms requirement claims, one-line code
spans and the absence of raw HTML). Each rule names the heading of `documentation-system.md` that states it.

| Rule | Checks | Stated under |
|---|---|---|
| `links` | Relative links resolve, with no wikilinks, absolute paths, or fragments other than a block ID the target defines | Markdown rules |
| `block-ids` | Each requirement and each non-requirements table carries its block ID | Identifiers |
| `callouts` | Only the five shared callout types appear | Markdown rules |
| `case-collisions` | No two names in one directory differ only in letter case | What is checked mechanically |
| `filenames` | Markdown filenames are lower-case words joined by hyphens | Filenames |
| `indexes` | Each document, and each directory index, is linked from the index that lists it | The layout |
| `registry` | Addresses and prefixes are unique, and each component's system and prefix are well formed | The component registry |
| `concern-sections` | Every component specification has each registered concern's subsection | Cross-cutting concerns |
| `addresses` | Requirements documents and tree folders sit at registered addresses | Systems and components |
| `identifiers` | Each cited requirement identifier is defined, in the document owning its prefix | Identifiers |
| `verification` | Each functional and non-functional requirement has a verification clause | The shape of a requirement |
| `unprefixed` | No unprefixed identifier in a heading, code span, bold text or parentheses | Identifiers |
| `adr-citations` | Each decision citation names a record on disk | Citations |
| `adr-scopes` | Each record's scope names registered addresses, or `workspace` | The shape of a record |
| `decision-index` | Both views of the decision index match the records on disk | The index |
| `back-citations` | Each specification an accepted record names in its Consequences cites it back | The shape of a record |
| `sections` | Each section citation resolves to a section its document numbers | Citations |
| `live-list-citations` | Only the permitted documents link to the live list, and others cite items only as conditions | The live work list and the changelog |
| `live-list-shape` | The live list keeps its shape | The live work list and the changelog |
| `tags` | The live list's Tags table and the registry agree | The live work list and the changelog |
| `claims` | Every requirement is claimed by some specification | Requirements this satisfies |
| `code-spans` | Every code span closes on the line it opens on | Markdown rules |
| `raw-html` | No HTML tag or comment appears outside code | Markdown rules |

Three tables are read once and shared by the rules.

- **The registry**, from `components.md`. It is read from four tables, found by their level-two
  headings: Systems, Components, Booking kinds and Cross-cutting concerns. A cell's slug is the link text, if the cell holds a link, and otherwise the cell's text. Each row of Booking kinds is
  a component of the system `bookings`, whose slug is the part of its prefix after the colon, in
  lower case. The registry yields every address, and maps every prefix to the document that owns it:
    - a system's prefix to `requirements/<system>/<system>.md`
    - a component's to `requirements/<system>/<component>.md`
    - a shared component's to `requirements/shared/<component>.md`
    - a concern's to `requirements/concerns/<concern>.md`
- **The decision records**, from every file in `decisions/` named with four digits, a hyphen and a
  slug. Each record yields its number, its title from its level-one heading after `ADR-NNNN — `,
  and its Status and Scope lines.
- **The live list**, from `TODO.md`, if it exists, together with every item identifier that
  `CHANGELOG.md` mentions. A vault with no `TODO.md` has no live list. The rules about the list's
  own shape and its Tags table then have nothing to check.

#### 4.3.1 links

For every link and image outside a code span:

- A wikilink is reported. The passing form is a standard link to the same document, by relative
  path.
- A target with a scheme, such as `https:` or `mailto:`, is not checked (`SHR:DOC-CHECK-NR11`).
- A target that starts with `/` is reported as absolute. Where the path names a file in the vault,
  the passing form is the relative path from the document to that file.
- A relative target is percent-decoded, resolved against the document's directory, and reported if no kept file or directory is there.
- A fragment other than `#^id` is reported as a heading anchor.
- A `#^id` fragment is reported unless the target is a document that defines the block ID `id`.

#### 4.3.2 block-ids

A requirement is a heading of level three, in a document under `requirements/`, whose text opens with a requirement identifier of kind `F` or `NFR`, then ` — `. Its block ID is the identifier in
lower case, with the colon written as a hyphen.

- A requirement whose first paragraph after the heading does not end with ` ^<block ID>` is
  reported. The passing form is that ending.
- A non-requirements table is a table whose first body row's first cell holds a bold identifier of
  kind `NR`. A non-requirements table with no block ID line of `^<prefix>-nr` is reported. Here,
  `<prefix>` is the document's prefix in lower case, with its colon written as a hyphen. The passing
form is that line after the table, with one blank line between them.

#### 4.3.3 callouts

A callout whose type is not `NOTE`, `TIP`, `IMPORTANT`, `WARNING` or `CAUTION` is reported. Case
is ignored when the type is compared, so `[!note]` passes.

#### 4.3.4 case-collisions

Two kept names in one directory that are equal once both are lowered are reported, once for each name, at line 1. This applies to files and to directories.

#### 4.3.5 filenames

A document whose name is not `README.md`, `TODO.md` or `CHANGELOG.md` is reported, at line 1,
unless its name before `.md` is one or more runs of lower-case letters and digits joined by single
hyphens. The passing form lowers the name, and replaces each run of spaces and underscores with a hyphen.

#### 4.3.6 indexes

- A document below the vault root is reported, at line 1, when no link in its directory's
  `README.md` resolves to it. This does not apply to a directory's `README.md`, or to a decision
  record in `decisions/`.
- A directory's `README.md` below the vault root is reported, at line 1, when no link in its
  parent directory's `README.md` resolves to it or to its directory.
- A document whose directory has no `README.md` is reported. So is a `README.md` whose parent directory has none. The finding names the missing index.

#### 4.3.7 registry

Each of these is reported at its row in `components.md`:

- a missing table of the four, reported at line 1
- a system slug used twice, or a component slug used twice within one system
- a prefix used twice, across all four tables
- a system named `shared` or `concerns`
- a system or concern prefix that is not two to four capital letters
- a component whose system is neither a registered system nor `shared`
- a component prefix that is not its system's prefix, or `SHR` for a shared component, followed by a colon and three to twelve capitals, digits and hyphens

#### 4.3.8 concern-sections

A component specification is a document at `spec/<system>/<component>.md` or
`spec/shared/<component>.md` whose address is registered. For every registered concern, every component specification that does not number the section the concern names is reported, at line 1.
A concern's own specification, at `spec/concerns/<concern>.md`, is held to the same rule.

#### 4.3.9 addresses

- A directory directly inside `requirements/` or `spec/` is reported, at the first document inside
  it, unless it is a registered system, `shared` or `concerns`.
- A directory any deeper inside `requirements/` is reported in the same way.
- A document in `requirements/` other than a `README.md` is reported, at line 1, unless its address is registered. A system's own document is `requirements/<system>/<system>.md`.

#### 4.3.10 identifiers

Every requirement identifier found in a document is resolved through the registry's map of prefixes.

- An identifier whose prefix is not registered is reported.
- An identifier whose owning document does not exist is reported.
- An identifier its owning document does not define is reported. A document defines an identifier of kind `F` or `NFR` by a requirement heading (§4.3.2), and one of kind `NR` by a bold first cell of its non-requirements table.

#### 4.3.11 verification

A requirement (§4.3.2) with no line opening `- **Verification:**` before the next heading is
reported, at its heading.

#### 4.3.12 unprefixed

An unprefixed identifier is reported when it appears in a heading, in a code span, inside bold
text, or between parentheses on one line. Where the document owns a prefix, the passing form is the identifier with that prefix.

#### 4.3.13 adr-citations

A decision citation is reported unless a record of that number exists in `decisions/`.

#### 4.3.14 adr-scopes

Each record's Scope line is split at commas. Each entry is reported, at the Scope line, unless it
is `workspace` or a registered address. A record with no Scope line is reported at line 1.

#### 4.3.15 decision-index

`decisions/README.md` holds two views. The ledger is the table whose header is
`| ADR | Title | Scope | Status |`. The views by subject are level-three headings, each naming an address or `workspace`, and each followed by a table whose header is `| ADR | Title | Status |`. Each row's first cell links to a record.

- A record that the ledger does not list is reported, at the record's line 1.
- A ledger row whose link resolves to no record is reported, at the row.
- A row whose number, title, scope or status differs from its record is reported, at the row. The
  number is compared with both the record's filename and its heading.
- A record missing from the view of an address its scope names is reported, at the record's line 1.
- A record listed under an address its scope does not name is reported, at the row.
- A status of `Superseded by` naming a record that does not exist is reported, at the Status line.

#### 4.3.16 back-citations

For each record whose status is `Accepted`, every specification named in its `## Consequences`
section is collected. A specification is named by a link to it, or by a document mention, under
`spec/`. Each one that neither links to the record nor holds its decision citation is reported, at
the line in the record that names it.

#### 4.3.17 sections

A section citation's document is found in this order:

1. the nearest document named before it on the same line, by a link or a document mention
2. failing that, the last document named earlier in the same paragraph or table
3. failing both, the document the citation sits in

In a table row, the search stays inside the citation's cell, and step 2 does not apply. A citation
is reported when its document numbers no sections, or does not number the cited one.

#### 4.3.18 live-list-citations

- A link that resolves to `TODO.md` is reported, unless it is in `documentation-system.md` or
  `CHANGELOG.md`.
- An item citation is reported unless it is part of a condition: `until`, one or more item
  citations joined by `and`, then `is done` or `are done`. A roadmap under `roadmap/` may also
  cite an item as `Do` followed by the item citation. This does not apply in `TODO.md`,
  `CHANGELOG.md` or `documentation-system.md`.
- An item in a condition or a `Do` step is reported unless the live list holds it or the changelog
  mentions it.

#### 4.3.19 live-list-shape

Every level-three heading in `TODO.md` is an item.

- An item whose heading is not `### TODO-<number> — <title>` is reported.
- An item with no `*Tags:*` line is reported.
- A tag that is not the first cell of a row in the table under the `## Tags` heading is reported.
- An item that has no paragraph opening with each of `*Problem:*`, `*Reason:*`, `*Proposal:*` and `*Releases:*` is reported, once for each missing part.
- A missing `*Next free:*` line is reported. So is one whose item number is at or below any item number in `TODO.md` or `CHANGELOG.md`.

#### 4.3.20 tags

With a live list, a registered address with no row in its Tags table is reported, at the table's
heading. So is a tag in the table that holds a slash and is not a registered address, at its row.

#### 4.3.21 claims

A claim table is the table in a specification's section numbered 7, headed
`## 7. Requirements this satisfies`. A requirement is claimed when the first cell of some claim table's row holds its identifier, as text or as link text. Every requirement (§4.3.2) not claimed by any specification under `spec/` is reported, at its heading. Deprecated requirements are included. Non-requirements are not.

#### 4.3.22 code-spans

A run of backticks outside a fence that has no run of the same length after it on the same line is
reported, at that line. The passing form keeps the span on one line, or writes a literal backtick
inside a span opened by a longer run.

#### 4.3.23 raw-html

Every raw HTML part (§4.2) is reported, at its line. The passing form puts it in a code span, or
writes its `<` as `&lt;`.

### 4.4 Findings

A finding is one line:

```
<path>:<line>: <rule>: <what was found>. <what would pass>. (documentation-system.md, "<heading>")
```

- `<path>` is the document's path from the repository root, with `/` as the separator, on every
  platform.
- `<what was found>` quotes the text that breaks the rule, such as the link target or the
  identifier.
- `<what would pass>` is present only where a rule above gives a passing form.
- `<heading>` is the rule's heading from the table in §4.3.

Findings are sorted by path, in byte order, then by line, then by rule name, then by text. Two
identical findings are printed once. The outcome line is `doc-check: clean`, or
`doc-check: <n> findings in <m> files`, with the singular for one.
A finding's passing form opens with a capital letter, since it follows a full stop.

### 4.5 The summary

With `--summary <file>`, doc-check appends one Markdown section to the file:

```markdown
## Documentation check

<outcome sentence>

| Where | Rule | Finding |
|---|---|---|
| `docs/requirements/shared/doc-check.md:12` | block-ids | ... |
```

The outcome sentence is `The vault is clean.`, `<n> findings in <m> files.`, or
`The vault could not be checked: <reason>.` The table is present only when there are findings. It holds every
finding, in the order of §4.4. A pipe in a finding is written as `\|`.

### 4.6 Could not run

Each of these stops the run with exit status 2 and a one-line reason on standard error:

- an unknown option, or an option missing its value
- a root with no `docs/` directory
- a `components.md` that is missing or cannot be read
- a document that cannot be read, or is not valid UTF-8
- a symbolic link inside the vault that points outside it
- a summary file that cannot be written

With `--summary`, doc-check still tries to append the could-not-run summary. If that append fails too, only standard error carries the reason.

### 4.7 The test suite

The suite runs with `cargo test --package doc-check`.

- **Rule cases.** Each rule of §4.3 has a directory `tools/doc-check/tests/rules/<rule>/`, holding
  `breaks/` and `keeps/`. Each is a minimal repository root, with a `docs/` vault inside it. Beside
  the vault, `breaks/` holds `expected.txt`: the exact findings the run must print. The rule must
  appear in every one of those findings. `keeps/` must run clean. A rule may hold more cases, as
  further directories whose names begin with `breaks-` or `keeps-`.
- **Created files.** A case may also hold `create.txt`, listing files the test creates in a copy of
  the case before running it. Two names that differ only in letter case are the exemplar: git and a
  case-insensitive file system cannot hold both. Where the file system cannot create them, the case
  is skipped with a note, and a test of the rule over a vault built in memory still runs.
- **Coverage.** One test reads doc-check's own list of rules, and fails for any rule that lacks
  either directory. It also fails for any rule directory whose rule is not in the list. A new rule
  cannot pass the suite without both cases (`SHR:DOC-CHECK-NFR6`).
- **Behaviour.** Further tests hold each requirement's verification: the exit statuses, the
  determinism runs, and the hash comparison showing nothing is written.
- **Speed.** A test marked ignored generates a vault of 1,000 conforming documents, and times five runs. It runs with `cargo test --release --package doc-check -- --ignored`, on the reference laptop (`SHR:DOC-CHECK-NFR1`).

The cases live outside `docs/`, so the vault's own run never reads them.

## 5. Resources

doc-check creates nothing in the repository. A run writes only the summary file it is given.

| Resource | Path | Owned by |
|---|---|---|
| The package | `tools/doc-check/` | The rules keeper |
| The Cargo workspace | `Cargo.toml` and `Cargo.lock` at the repository root, listing `tools/doc-check` as a member | The rules keeper |
| The toolchain pin | `rust-toolchain.toml` at the repository root, pinning Rust 1.94.1 | The rules keeper |
| The recipes | `check-docs` and `test-docs`, in the `justfile` at the repository root | The rules keeper |
| The workflow | `.github/workflows/check-docs.yml` | The rules keeper |
| Build output | `target/` at the repository root, which `.gitignore` must exclude | Nobody: it is rebuilt at will |

The package's manifest declares no dependencies, so its lockfile names only the package itself
(`SHR:DOC-CHECK-NFR5`). A change to any rule is a change to the package. It lands with the change to `documentation-system.md` that the rules keeper makes through a decision record scoped `workspace`.

## 6. Quality attributes

- **Speed** (`SHR:DOC-CHECK-NFR1`). A run reads each file once, and keeps every document's lines in memory. Each rule is one pass over the parsed vault, or a lookup in the shared tables. One thousand documents average far less than a megabyte of text. A single thread, with no cache, stays inside two seconds.
- **Determinism** (`SHR:DOC-CHECK-NFR2`). The walk visits entries in byte order. Every table is an ordered map. The findings are sorted before printing. No finding includes a time, an absolute path, or anything from the environment.
- **Read-only** (`SHR:DOC-CHECK-NFR3`). doc-check opens vault files for reading only. Its one write is the append to the summary file, which the workflow places outside the repository.
- **Offline** (`SHR:DOC-CHECK-NFR4`). doc-check opens no socket, and never follows a link with a scheme.
- **Robustness** (`SHR:DOC-CHECK-F2`). Every condition that would leave a document unchecked stops the run with exit status 2, rather than producing a shorter list of findings.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [SHR:DOC-CHECK-F1](../../requirements/shared/doc-check.md#^shr-doc-check-f1) | The walk of §4.2: every document under `docs/`, skipping drafts and every `graveyard` directory with everything below it. |
| [SHR:DOC-CHECK-F2](../../requirements/shared/doc-check.md#^shr-doc-check-f2) | The three exit statuses of §3.1, and the conditions of §4.6. |
| [SHR:DOC-CHECK-F3](../../requirements/shared/doc-check.md#^shr-doc-check-f3) | The finding form of §4.4, and the passing forms each rule of §4.3 gives. |
| [SHR:DOC-CHECK-F4](../../requirements/shared/doc-check.md#^shr-doc-check-f4) | The rules `links`, `identifiers`, `adr-citations` and `sections`. |
| [SHR:DOC-CHECK-F5](../../requirements/shared/doc-check.md#^shr-doc-check-f5) | The rules `links` and `callouts`. |
| [SHR:DOC-CHECK-F6](../../requirements/shared/doc-check.md#^shr-doc-check-f6) | The rules `filenames` and `case-collisions`. |
| [SHR:DOC-CHECK-F7](../../requirements/shared/doc-check.md#^shr-doc-check-f7) | The rule `indexes`. |
| [SHR:DOC-CHECK-F8](../../requirements/shared/doc-check.md#^shr-doc-check-f8) | The rules `registry`, `addresses`, `concern-sections`, `adr-scopes` and `tags`. |
| [SHR:DOC-CHECK-F9](../../requirements/shared/doc-check.md#^shr-doc-check-f9) | The rules `block-ids`, `verification` and `unprefixed`. |
| [SHR:DOC-CHECK-F10](../../requirements/shared/doc-check.md#^shr-doc-check-f10) | The rules `decision-index` and `back-citations`. |
| [SHR:DOC-CHECK-F11](../../requirements/shared/doc-check.md#^shr-doc-check-f11) | The rules `live-list-shape` and `live-list-citations`. |
| [SHR:DOC-CHECK-F12](../../requirements/shared/doc-check.md#^shr-doc-check-f12) | The exit status and the summary of §4.5. The workflow of §3.4 fails the pull request's check and shows the summary on it. |
| [SHR:DOC-CHECK-F13](../../requirements/shared/doc-check.md#^shr-doc-check-f13) | The rule `claims`. |
| [SHR:DOC-CHECK-F14](../../requirements/shared/doc-check.md#^shr-doc-check-f14) | The fence tracking of §4.2, and an option set of §3.1 in which nothing removes a finding. |
| [SHR:DOC-CHECK-F15](../../requirements/shared/doc-check.md#^shr-doc-check-f15) | The rule `code-spans`, and the code-span reading of §4.2. |
| [SHR:DOC-CHECK-F16](../../requirements/shared/doc-check.md#^shr-doc-check-f16) | The rule `raw-html`, and the raw-HTML reading of §4.2. |
| [SHR:DOC-CHECK-NFR1](../../requirements/shared/doc-check.md#^shr-doc-check-nfr1) | The single pass of §6, and the speed test of §4.7. |
| [SHR:DOC-CHECK-NFR2](../../requirements/shared/doc-check.md#^shr-doc-check-nfr2) | The ordered walk, the ordered tables and the sorted findings of §6. |
| [SHR:DOC-CHECK-NFR3](../../requirements/shared/doc-check.md#^shr-doc-check-nfr3) | Opening the vault for reading only, as §6 states. |
| [SHR:DOC-CHECK-NFR4](../../requirements/shared/doc-check.md#^shr-doc-check-nfr4) | No socket, and no link with a scheme followed, as §6 states. |
| [SHR:DOC-CHECK-NFR5](../../requirements/shared/doc-check.md#^shr-doc-check-nfr5) | A manifest with no dependencies, the toolchain pin and the recipe of §5. |
| [SHR:DOC-CHECK-NFR6](../../requirements/shared/doc-check.md#^shr-doc-check-nfr6) | The rule cases and the coverage test of §4.7. |

## 8. Open

None. Nothing in this specification is undecided.

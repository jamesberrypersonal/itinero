# The document scaffolder

**Assumes** [doc-scaffold.md](../../requirements/shared/doc-scaffold.md) — what the scaffolder promises.

## 1. Purpose

doc-scaffold is the program that starts a new component, system, decision record or guide in the
`docs/` vault, and the missing documents of a component that is already registered. It writes each new document's skeleton, and adds every row that names the new
thing to the registry, the indexes and the live work list. An author then fills in each part the
skeleton marks, and runs the checker, doc-check.

## 2. Scope

doc-scaffold covers five commands: `component`, `docs`, `system`, `decision` and `guide`. It reads
and writes files under `docs/` alone.

One thing acts on it: an author, through one of five just recipes, from any directory in the
repository.

Deliberately absent:

- what a document says. The skeleton marks each part the author writes
- concerns, booking kinds, whitepapers, overview paths, and a system's own requirements and
  specification. The non-requirements in its requirements document give the reasons
- renaming, moving or deleting anything
- running doc-check, and committing

doc-scaffold and doc-check are separate programs, because doc-check never changes a file
(ADR-0006, new documents start from skeletons that a second program writes).

## 3. Interface

### 3.1 User interface

doc-scaffold is a command-line program, written in Rust and run through just, as doc-check is. An
author runs one of these, from any directory in the repository:

```
just new-component <system> <slug> <prefix> <description>
just new-docs <system> <slug>
just new-system <slug> <prefix> <description> <keeper>
just new-decision <title> <scope>... [--slug <slug>] [--date <YYYY-MM-DD>]
just new-guide <group> <slug> <title> <description>
```

Each recipe runs `doc-scaffold <command>` with the arguments it is given, where the command is
`component`, `docs`, `system`, `decision` or `guide`.

| Argument | Holds |
|---|---|
| `<system>` | A registered system, or `shared` |
| `<slug>` | The new thing's slug, or for `docs` the registered component's: lower-case letters and digits, in runs joined by single hyphens |
| `<prefix>` | For a component, its system's prefix, or `SHR`, then a colon and three to twelve capitals, digits and hyphens. For a system, two to four capital letters |
| `<description>` | One line saying what it is, for the registry's Is column and each index row |
| `<keeper>` | Who keeps the new system's roadmap, for its Kept by line |
| `<title>` | The decision record's title, which says what was decided |
| `<scope>` | `workspace`, or one or more registered addresses |
| `<group>` | `workspace`, or the registered system the guide belongs to |

| Option | Effect |
|---|---|
| `--root <dir>` | The repository root. The vault is `<dir>/docs`. Defaults to the working directory |
| `--slug <slug>` | `decision` only. The record's filename slug, in place of the one made from its title |
| `--date <YYYY-MM-DD>` | `decision` only. The record's Date line, in place of today's date in UTC |

| Exit status | Means |
|---|---|
| 0 | Written. Every file was written |
| 1 | Refused. Nothing was written, and standard error says why |
| 2 | Failed. A file could not be written partway through. The files listed before the failure were written |

A written run prints one line for each file to standard output, as
`doc-scaffold: created docs/<path>` or `doc-scaffold: changed docs/<path>`. Created files come
first, then changed files, each in byte order of their paths. The last line tells the author to
replace each "To be written" and then run `just check-docs`.

### 3.2 Application interface

None. doc-scaffold has no network or service interface. Callers reach it through its commands (§3.1).

### 3.3 Programming interface

None. The package `tools/doc-scaffold` builds a binary only, and no other package depends on it.

### 3.4 Systems this drives

doc-scaffold drives three systems outside itself.

- **The file system.** doc-scaffold reads the vault's `components.md`, its `TODO.md` and each index
  it edits. It lists the vault's `decisions/` folder to find the next record number. It creates the new documents,
  with any folders they need, and writes the indexes it changed.
- **just**, the command runner doc-check also uses. Each of the five recipes runs
  `cargo run --release --quiet --package doc-scaffold -- <command> <arguments>`.
- **doc-check**, through its library, in doc-scaffold's tests only. The package `tools/doc-check`
  builds a library holding one function, `check`, which runs every rule over a repository root and
  returns the findings. doc-scaffold names it as a development dependency, so the tests can hold
  what doc-scaffold writes to every rule. The binary doc-scaffold builds does not use it.

## 4. Behaviour

### 4.1 A run, end to end

*Invoked from:* one of the five recipes of §3.1, run by an author. Nothing runs doc-scaffold
automatically.

1. doc-scaffold parses its options and its command's arguments. An unknown command or option, a
   missing value, the wrong number of arguments, or `--slug` or `--date` given to a command other
   than `decision` is refused.
2. It confirms that the vault holds the component registry, and reads it (§4.2).
3. It runs its command (§4.3 to §4.7). The command first checks everything it refuses, and then
   plans each change in memory: a new file's text, or an existing file's lines with rows inserted.
4. It writes every planned file whose text differs from what is on disk, creating folders as
   needed, and prints a line for each (§3.1).

Any refusal stops the run before step 4, so a refused run writes nothing (`SHR:DOC-SCAFFOLD-F3`).
A file that already exists is never planned as a new one, so nothing is overwritten. The one
existing line a command changes is a registry row, when §4.7 links a slug to its new specification
(`SHR:DOC-SCAFFOLD-F4`).

Every part of a skeleton the author still has to write opens with the marker "To be written"
(`SHR:DOC-SCAFFOLD-F5`). That includes an index's Verified or Runs cell, and a roadmap's
milestone title.

### 4.2 Reading the vault

doc-scaffold reads only headings and the tables under them, and skips every fenced code block, as
doc-check does.

- **A heading** is one to six `#` characters, then a space.
- **A table under a heading** is the first run of lines starting with a pipe, `|`, between the
  heading and the next heading of its level or above. Its first line is the header row and its
  second the separator. A cell is split at each pipe, except one inside a code span or written as
  `\|`. A cell's value is its link text if it holds a link, and otherwise its text, without
  backticks.
- **The registry** is read from the four tables under the level-two headings of `components.md`:
  Systems, Components, Booking kinds and Cross-cutting concerns. Columns are found by their header
  text. A booking kind is a component of the system `bookings`, as doc-check reads it. A missing
  table is a refusal.
- **The registry's order** is every system in the order of its table, then every component and
  booking kind, then every concern. Rows of the Components table are grouped by system, in the
  order of the Systems table with `shared` last, and in alphabetical order of slug within a system.

Every command applies two checks to its arguments:

- **A slug** is one or more runs of lower-case letters and digits, joined by single hyphens.
- **A line of text**, such as a description, a title or a keeper, is not empty and holds no line
  break, no pipe, no `<`, and no unpaired backtick. Each of those would break a table, open raw
  HTML or leave a code span unclosed, and the checker would report the result
  (`SHR:DOC-SCAFFOLD-F2`).

A row is added to a table by inserting one line. Where §4.3 to §4.7 give an order, the row goes
before the first row it sorts before, and otherwise after the last row. A new section is inserted
with one blank line between it and any text on either side.

### 4.3 component

*Invoked from:* `just new-component <system> <slug> <prefix> <description>`.

It refuses a `<system>` of `concerns`, a system that is neither registered nor `shared`, an address
already registered, a prefix that does not open with the system's prefix and a colon, a name after
the colon that is not three to twelve capitals, digits and hyphens, and a prefix already in use. It
writes the address `<system>/<slug>`:

| File | Change |
|---|---|
| `requirements/<system>/<slug>.md` | Created: one functional requirement and one non-requirement, each a placeholder, with their block IDs |
| `spec/<system>/<slug>.md` | Created: the eight numbered sections, a claim table claiming the placeholder requirement, each registered concern's subsection, and a placeholder citing each record that names it |
| `components.md` | A row in Components, with the slug linked to the specification, in the registry's order |
| `TODO.md` | A row in the Tags table, if the vault has a live list (§4.4) |
| `requirements/<system>/README.md` and `spec/<system>/README.md` | A row for the document, in alphabetical order. Where the folder is new, the index is created holding the row |
| `requirements/README.md` and `spec/README.md` | Only where the folder is new: a row for it in the table whose header opens with Folder, in the order of the Systems table, before `shared/` and `concerns/` |

A concern registered as covered at a section such as `§5.1` gets a heading of level two plus the
number of dots, such as `### 5.1 Personal data`. The heading is placed at the end of the numbered
section it belongs to, and concerns are ordered by section number, so `§5.2` comes before
`§5.10`.

An accepted decision record must be cited back by each specification its Consequences name. A
record names a specification when its Consequences section holds the specification's path, such as
`spec/shared/trip-time.md`, in a link or a code span. Where accepted records name a new
specification, its section 2 holds a placeholder that cites each of them, so the skeleton adds no
finding (`SHR:DOC-SCAFFOLD-F2`).

### 4.4 system

*Invoked from:* `just new-system <slug> <prefix> <description> <keeper>`.

It refuses a slug of `shared` or `concerns`, a system already registered, a prefix that is not two
to four capital letters, and a prefix already in use or equal to `SHR`. It writes:

| File | Change |
|---|---|
| `roadmap/<slug>.md` | Created: the Kept by line, the description, and a completed and a pending Phase 0, each holding `Milestone <Slug>-0.1` |
| `components.md` | A row at the end of Systems, with the slug unlinked, since the system has no document yet |
| `roadmap/README.md` | A row at the end of its table |
| `TODO.md` | A row in the Tags table, if the vault has a live list |

Every command that registers an address adds its Tags row before the first row whose tag is a
registered address sorting after the new one in alphabetical order. Failing that, the row goes
after the last row holding a registered address. A tag that is not an address, such as `docs`,
keeps its place below the addresses.

### 4.5 decision

*Invoked from:* `just new-decision <title> <scope>... [--slug <slug>] [--date <YYYY-MM-DD>]`.

It refuses a scope that is neither `workspace` nor a registered address, a scope named twice,
`workspace` beside any other scope, and a system named beside one of its own components, since a
record binding a system binds it as a whole. It refuses a date that is not a real date written
`YYYY-MM-DD`.

- **The number** is one past the highest number among the files in `decisions/` named with four
  digits and a hyphen, zero-padded to four digits.
- **The slug** is `--slug`, or else the title in lower case, with every run of characters other than
  letters and digits replaced by one hyphen.
- **The date** is `--date`, or else today's date in UTC, from the system clock. An author in a time
  zone behind UTC can find the next day's date there in the evening, and passes `--date`.

| File | Change |
|---|---|
| `decisions/<number>-<slug>.md` | Created: the heading `ADR-<number> — <title>`, a Status of Proposed, the Date and Scope lines, and the four sections, each a placeholder |
| `decisions/README.md` | A row at the end of the ledger, the table whose header is `\| ADR \| Title \| Scope \| Status \|`. For each scope, a row at the end of its level-three section under By subject. A missing section is created, in the order `workspace` first, then the registry's order |

### 4.6 guide

*Invoked from:* `just new-guide <group> <slug> <title> <description>`.

It refuses a group that is neither `workspace` nor a registered system. It writes:

| File | Change |
|---|---|
| `guides/<slug>.md` | Created: the title, an opening paragraph, one numbered step under The steps, and Confirming the work, each a placeholder |
| `guides/README.md` | A row at the end of the table under the level-two heading naming the group with its first letter capitalised, such as Workspace. A missing section is added at the end of the file |

### 4.7 docs

*Invoked from:* `just new-docs <system> <slug>`.

It starts whichever of its two documents a registered component lacks. The prefix and the
description come from the component's row in the registry, so the author types neither again.

It refuses a `<system>` of `concerns`, an address the registry does not hold, and a component that
has both its documents already. Where one document exists, the new one is tied to it through the
component's first requirement, F1. It therefore refuses an existing requirements document that does
not define F1, and an existing specification whose claim table does not claim it.

| File | Change |
|---|---|
| `requirements/<system>/<slug>.md` | Created, where it is missing, as §4.3 writes it |
| `spec/<system>/<slug>.md` | Created, where it is missing, as §4.3 writes it, citing the records that name it |
| `requirements/<system>/README.md` and `spec/<system>/README.md` | A row for each document created, as §4.3 adds it, unless the index lists the document already |
| `requirements/README.md` and `spec/README.md` | Only where a folder is new, as §4.3 |
| `components.md` | Where the specification is created and the slug is not linked: the slug linked to it, the one cell of an existing line doc-scaffold changes |
| `TODO.md` | A row in the Tags table, only where the address has none |

### 4.8 The test suite

The suite runs with `cargo test --package doc-scaffold`, and `just test-docs` runs it with
doc-check's.

- **Unit tests** cover reading headings and cells, the checks of §4.2, the record slug, and the
  date.
- **Behaviour tests** run the built program against a copy of this repository's vault, and against
  a small vault that registers a concern at `§5.1`. Each run of a command is followed by doc-check's
  `check` (§3.4), which must return the same findings as before the run. Every line of every file
  that existed before must still be there, in order.
- **Refusals** run each refused case of §4.3 to §4.7, and confirm the exit status, the reason, and
  that every file is unchanged.

## 5. Resources

doc-scaffold creates only the files §4.3 to §4.7 list, under `docs/`.

| Resource | Path | Owned by |
|---|---|---|
| The package | `tools/doc-scaffold/` | The rules keeper |
| The recipes | `new-component`, `new-docs`, `new-system`, `new-decision` and `new-guide`, in the `justfile` at the repository root | The rules keeper |
| The Cargo workspace membership | `tools/doc-scaffold` in the members of `Cargo.toml` at the repository root | The rules keeper |

The package's manifest declares no dependencies. Its one development dependency is doc-check, by
its path in this repository, so its lockfile names no package from outside the repository
(`SHR:DOC-SCAFFOLD-NFR3`). A change to a skeleton lands with the change to
`documentation-system.md` or `style.md` that made it necessary.

## 6. Quality attributes

- **Writes inside the vault alone** (`SHR:DOC-SCAFFOLD-NFR1`). Every path doc-scaffold writes is
  joined to `<root>/docs`.
- **Offline** (`SHR:DOC-SCAFFOLD-NFR2`). doc-scaffold opens no socket.
- **All or nothing, until writing starts** (`SHR:DOC-SCAFFOLD-F3`). Every refusal happens before the
  first write. A write that fails partway, such as on a full disk, stops the run with exit status 2,
  and the files listed before it were written.
- **Deterministic.** The same arguments over the same files, on the same date, write the same
  bytes. Rows are placed by the orders of §4.2 to §4.7, and never by the order the file system
  lists files.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [SHR:DOC-SCAFFOLD-F1](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-f1) | The five commands of §4.3 to §4.7, each writing every row its new thing needs. |
| [SHR:DOC-SCAFFOLD-F2](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-f2) | The skeletons and the row placement of §4.3 to §4.7, the text checks of §4.2, the records a new specification cites (§4.3), and the behaviour tests of §4.8 that run doc-check after every command. |
| [SHR:DOC-SCAFFOLD-F3](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-f3) | The refusals of §4.1 to §4.7, all made before anything is written, and exit status 1. |
| [SHR:DOC-SCAFFOLD-F4](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-f4) | Rows added by inserting lines (§4.2), a new file refused where one exists (§4.1), and the one registry link of §4.7. |
| [SHR:DOC-SCAFFOLD-F5](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-f5) | The "To be written" marker of §4.1, and the list of files of §3.1. |
| [SHR:DOC-SCAFFOLD-NFR1](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-nfr1) | Every path joined to the vault, as §6 states. |
| [SHR:DOC-SCAFFOLD-NFR2](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-nfr2) | No socket, as §6 states. |
| [SHR:DOC-SCAFFOLD-NFR3](../../requirements/shared/doc-scaffold.md#^shr-doc-scaffold-nfr3) | A manifest with no dependencies, and the recipes of §5. |

## 8. Open

None. Nothing in this specification is undecided.

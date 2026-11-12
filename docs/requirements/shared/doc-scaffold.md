# The document scaffolder

**Assumes** [documentation-system.md](../../documentation-system.md) — the rules every document it writes keeps.

What the shared component `shared/doc-scaffold` promises to the people who write the vault.
doc-scaffold starts a new component, system, decision record or guide, and the missing documents of
a component that is already registered. It writes each new document's skeleton, and adds every
registry, index and live-list row that names the new thing.
The component registry, `components.md`, gives it the prefix `SHR:DOC-SCAFFOLD`.

One role appears below, as `requirements/README.md` defines it. The author adds a document or
changes one.

---

## Functional requirements

### SHR:DOC-SCAFFOLD-F1 — One command starts each kind of thing an author adds

One command starts a component, a system, a decision record or a guide. Another starts the
requirements or the specification that a registered component lacks, or both. Each command writes
the new documents and every row the documentation system requires before the new thing can be
named. ^shr-doc-scaffold-f1

- **Verification:** on a copy of the vault, run each command, then confirm that
    - a new component of a registered system has its row in the registry and in the live list's
      Tags table, a requirements document and a specification at its address, and a row in each
      folder's index
    - a component of a system with no folder yet also gets each folder, its index, and a row for
      the folder in the index above it
    - a new system has its row in the registry and in the live list's Tags table, and a roadmap
      with a row in the roadmaps' index
    - a new decision record takes the next free number, and has a row in both views of the
      decision index
    - a new guide has a row in the guides' index, under its system or under the workspace
    - a registered component with neither document gets both, with a row in each folder's index,
      and its slug in the registry linked to its specification
    - a registered component with one document gets the other, and the one it had is unchanged

> **What does this buy?** Without it, an author starting a component writes two documents from
> blank files, and adds up to six rows by hand, each in a different file. Each row forgotten is a
> finding to fix, one run of the checker at a time. The command does the mechanical part, and the author starts on the part
> that needs thought.

> **Why start the documents of a registered component?** A component can be registered before
> anyone writes about it, as the planner's itinerary was. The command for a new component refuses
> an address that is already registered, so such a component needs a command of its own.

> **Why components, systems, decision records and guides, and not concerns or booking kinds?** They
> are what authors add most often. Registering a concern obliges every component specification to
> add a subsection, which is written by hand in each one (`SHR:DOC-SCAFFOLD-NR2`).

### SHR:DOC-SCAFFOLD-F2 — What a command writes passes the checker

On a vault that the checker, `shared/doc-check`, passes, every command leaves a vault that it
still passes. On a vault with findings, a command adds none. ^shr-doc-scaffold-f2

- **Verification:** on a copy of this repository's vault, and on a small vault that registers a
  concern,
    - run each command, and confirm the checker's findings are the same before and after
    - start a component in a vault that registers a concern, and confirm its specification has the
      concern's subsection

> **What does this buy?** An author can commit the skeletons as soon as they are written, or open a
> draft pull request, and the check passes. Any finding that appears afterwards comes from what the
> author wrote, so the author knows where to look.

### SHR:DOC-SCAFFOLD-F3 — A refused command writes nothing, and says why

A command whose arguments the vault cannot take writes no file, and prints the reason it refused. ^shr-doc-scaffold-f3

- **Verification:** on a copy of the vault, confirm that each of these is refused, with its
  reason, and that every file is unchanged afterwards
    - a component of a system that is not registered
    - a new component or system whose address, or prefix, is already registered
    - a slug or prefix that is not in the form the registry requires
    - a description holding a pipe, a line break, an angle bracket or an unclosed code span
    - a new document where one already exists

    - a decision record scoped to an address that is not registered, or to `workspace` and an
      address together
    - the documents of a component that is not registered, or that has both its documents already
    - one document of a registered component, beside an existing document that does not define or
      claim the requirement the new skeleton ties to, its first, such as `SHR:DOC-CHECK-F1` for
      doc-check
    - an unknown command, or a command given the wrong number of arguments

> **What does this buy?** A command that wrote half its files and then stopped would leave the
> author to find and undo the half. A refusal changes nothing, so the author fixes the arguments
> and runs the command again.

### SHR:DOC-SCAFFOLD-F4 — doc-scaffold never removes what an author wrote, and changes one registry link at most

A command never overwrites a file. In a file that exists, it only adds lines, with one exception:
it links a registered component's slug in the registry to the specification it has just written.
Every other line that was there before stays, unchanged and in the same order. ^shr-doc-scaffold-f4

- **Verification:** on a copy of the vault, run each command, then confirm that
    - every line of every file that existed before is still in it, in the same order, apart from
      a registry row whose slug is now linked to its new specification
    - a command naming a document that exists is refused

> **What does this buy?** An author can run a command in a working copy holding unfinished work,
> and lose none of it. A change the command made shows in the diff as added lines, and at most one
> changed registry row, so a reviewer reads it at a glance.

> **Why may a registry row change?** A component registered before its documents existed has an
> unlinked slug. Linking it to the new specification keeps every registry row alike, and the change
> is to one cell, which a reviewer sees in the diff.

### SHR:DOC-SCAFFOLD-F5 — Every part left to the author is marked, and the run lists every file it wrote

Every part of a skeleton that the author still has to write opens with the words "To be written".
A run lists each file it created and each file it changed. ^shr-doc-scaffold-f5

- **Verification:** run each command on a copy of the vault, then confirm that
    - the run lists every file that differs from before, and no other file
    - every placeholder in the new documents and rows opens with "To be written"
    - a file the command only read, such as the registry when a decision record is written, is not
      listed

> **What does this buy?** One search finds everything still to write, in every file the command
> touched. The checker cannot see a placeholder, because it reads as an ordinary sentence. The
> author and the reviewer search for the marker instead.

---

## Non-functional requirements

### SHR:DOC-SCAFFOLD-NFR1 — doc-scaffold writes nothing outside the vault

A run changes no file outside `docs/`. ^shr-doc-scaffold-nfr1

- **Verification:** on a copy of the repository,
    - run each command, and confirm that no file outside `docs/` differs from before

> **What does this buy?** The commands start documents, and nothing else. Code, settings and the
> workflow change only when an author changes them.

### SHR:DOC-SCAFFOLD-NFR2 — doc-scaffold runs without network access

A run needs no network access, and connects to no host. ^shr-doc-scaffold-nfr2

- **Verification:** on a copy of the vault,
    - run each command with the network disabled, and confirm it writes the same files as with
      the network enabled

> **What does this buy?** An author can start a document anywhere, the same as the checker lets
> them check one (`SHR:DOC-CHECK-NFR4`).

### SHR:DOC-SCAFFOLD-NFR3 — doc-scaffold builds with only the Rust toolchain, and runs with just added

On a machine holding nothing but the Rust toolchain the repository pins, a fresh checkout builds
doc-scaffold, using only the Rust standard library and fetching nothing. The commands an author
runs need only that toolchain and the just command runner. ^shr-doc-scaffold-nfr3

- **Verification:** in a clean container holding only the pinned Rust toolchain,
    - clone the repository, build doc-scaffold with cargo, and confirm the build succeeds
    - confirm doc-scaffold's manifest and the repository's lockfile name no package from outside
      the repository
    - install just, run `just new-guide`, and confirm it writes a guide

> **What does this buy?** Anyone who can build the checker can build the scaffolder, because the
> two need the same things (`SHR:DOC-CHECK-NFR5`).

---

## Non-requirements

| Identifier | doc-scaffold does not | Because |
|---|---|---|
| **SHR:DOC-SCAFFOLD-NR1** | Write what a document says | The author knows what the component promises, and how it is built. The skeleton marks each part for them (`SHR:DOC-SCAFFOLD-F5`) |
| **SHR:DOC-SCAFFOLD-NR2** | Start a concern, a booking kind, a whitepaper, an overview path, or a system's own requirements or specification | Each is rare, and each takes more judgement than a skeleton saves. A concern adds a subsection to every component specification, and those subsections are written by hand |
| **SHR:DOC-SCAFFOLD-NR3** | Rename, move or delete anything | The checker reports every link and row a move leaves behind, and each is a mechanical fix the author makes |
| **SHR:DOC-SCAFFOLD-NR4** | Run the checker, or commit | The author runs `just check-docs` when the skeletons are filled in, and commits when it passes |
| **SHR:DOC-SCAFFOLD-NR5** | Take an option that writes despite a refusal | A forced write could break the registry or overwrite an author's work (`SHR:DOC-SCAFFOLD-F3`, `SHR:DOC-SCAFFOLD-F4`) |

^shr-doc-scaffold-nr

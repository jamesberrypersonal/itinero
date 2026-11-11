# The documentation checker

**Assumes** [documentation-system.md](../../documentation-system.md) — the rules this checker holds every document to.

What the shared component `shared/doc-check` promises to the people who write the vault. doc-check
reads every document in the vault and reports each place where a document breaks a rule. The rules
it checks are those in the table of mechanical checks in `documentation-system.md`, and one more:
every requirement is claimed by some specification. These requirements name each rule they cover,
and leave its full statement to that document. The
component registry, `components.md`, gives doc-check the prefix `SHR:DOC-CHECK`.

Two roles appear below, as `requirements/README.md` defines them. The author adds a document or
changes one. The rules keeper changes `documentation-system.md`, and doc-check with it.

---

## Functional requirements

### SHR:DOC-CHECK-F1 — doc-check checks every document in the vault, and nothing outside it

One run of doc-check checks every markdown file in the vault, `docs/`, and no other file in the
repository. It skips every file whose name ends in `-draft.md`, and every directory named
`graveyard` with everything below it. ^shr-doc-check-f1

- **Verification:** on a copy of the vault, run `just check-docs` from the repository root,
  then
    - break one rule in a document at the vault root, and confirm it is reported
    - break the same rule in a document three directories below the root, and in a directory
      index, and confirm each is reported
    - break the same rule in a markdown file outside `docs/`, such as a package's own
      documentation or the repository's front page, and confirm nothing is reported
    - break the same rule in a file whose name ends in `-draft.md`, and confirm nothing is reported
    - break the same rule in a file directly inside a directory named `graveyard`, and in a file
      two directories below one, and confirm neither is reported
    - break a link by renaming the document it targets, and confirm the finding is reported in the
      document holding the link, which the rename never touched

> **What does this buy?** A document can break a rule without being edited. Moving a component's
> documents breaks every link to them, in files the move never opened. Only a run over the whole
> vault finds those findings, so no run checks part of it (`SHR:DOC-CHECK-NR9`).

> **Why are drafts and graveyards skipped by name?** A draft defines the identifiers that the
> document it replaces already owns, so checking both would report every identifier twice. A
> graveyard holds documents an author has set aside during a rewrite. Each exemption is visible in
> the file's path, and it ends when the file is renamed or moved. Inside a document that is
> checked, nothing can keep a finding from being reported (`SHR:DOC-CHECK-F14`).

### SHR:DOC-CHECK-F2 — A run says whether the vault is clean, has findings, or could not be checked

A run ends in one of three outcomes, and its exit status tells them apart: clean, findings, or
could not run. A run that could not check every document never ends as clean. ^shr-doc-check-f2

- **Verification:** run doc-check against
    - a vault that breaks no rule, and confirm the exit status is zero and no finding is printed
    - a vault that breaks one rule, and confirm the exit status is non-zero and the finding is
      printed
    - a vault whose `components.md` cannot be read, and confirm the exit status is non-zero,
      differs from the findings status, and is printed with what stopped the run
    - a directory that holds no vault, and confirm the could-not-run status

> **What does this buy?** Whatever calls doc-check must fail when doc-check cannot run, never
> pass. A pre-commit hook or a continuous integration step that treats a crash as clean is a check
> that has quietly stopped running. A distinct status also lets the caller tell the author which
> of the two happened.

> **Why is an unreadable registry a reason to stop, rather than a finding?** Every address and
> prefix check depends on the registry. Without it, a list of findings would be silently
> incomplete. A registry that can be read but breaks a rule is reported as findings, like any
> other document.

### SHR:DOC-CHECK-F3 — Each finding says where, which rule, what was found, and what would pass

Each finding names the file and line it concerns, the rule the document breaks, and the text that
breaks it. Where the passing form follows mechanically from what was found, the finding also states
that form. ^shr-doc-check-f3

- **Verification:** break each rule doc-check checks once, then confirm that each
  finding
    - opens with the file's path from the repository root and the line number, as `file:line`
    - names the rule broken, and the heading of `documentation-system.md` under which the rule is
      stated
    - quotes the text that breaks the rule, such as the target of a link that does not resolve
    - states the passing form where one follows mechanically, such as the block ID a requirement's
      body paragraph should end with

> **What does this buy?** An author can fix a finding without first reading the rules. The rule's
> name and heading let them read why the rule exists when they want to.

> **Why is the passing form stated only sometimes?** Some findings have more than one fix. A link
> to a missing document might need a new target, or the document might need to be restored. A
> guess printed as the fix would be followed as one. The finding then says what was found, and the
> author chooses (`SHR:DOC-CHECK-NR7`).

> **Why a path from the repository root?** The command runs from the repository root, so editors
> and terminals open the path as printed.

### SHR:DOC-CHECK-F4 — Every citation in the vault resolves

Every link, requirement identifier, decision record identifier and section citation in the vault
names something that exists. doc-check reports each one that does not. ^shr-doc-check-f4

- **Verification:** on a copy of the vault, confirm that each of these is reported
    - a relative link whose target file does not exist
    - a link fragment naming a block ID that its target does not define
    - a requirement identifier that the document owning its prefix does not define
    - a decision record identifier, written in prose, that names no record on disk
    - a section citation naming a section that its document does not number
    - a section citation against a document that numbers no sections, such as a decision record
    - a section citation after a link on the same line, naming a section the linked document lacks,
      even where the document it sits in has that section

> **What does this buy?** A reader arrives at a document by random access, and trusts a citation
> only if it lands. A renumbered section, a moved document or a deleted requirement breaks
> citations silently, and nothing else in a review looks for them.

> **Which document does a section citation refer to?** `documentation-system.md` gives the order:
> the nearest document named on the same line, then the last one named earlier in the same block,
> then the document the citation sits in. In a table, the search stays inside the citation's cell.

### SHR:DOC-CHECK-F5 — Every document reads the same in Obsidian and on GitHub

Every document uses only the Markdown that both renderers read the same way. doc-check reports each
wikilink, absolute link, link fragment other than a block ID, and callout of a type the two
renderers do not share. ^shr-doc-check-f5

- **Verification:** on a copy of the vault, confirm that
    - a wikilink is reported
    - a link whose path is absolute, from either the vault root or the repository root, is reported
    - a link carrying a heading anchor is reported
    - a callout of any type other than `NOTE`, `TIP`, `IMPORTANT`, `WARNING` and `CAUTION` is
      reported
    - a callout of each of those five types passes

> **What does this buy?** Half the vault's readers use Obsidian and half use GitHub. A form only
> one renderer understands shows the other half literal markup, or a link that goes nowhere.

### SHR:DOC-CHECK-F6 — Every filename can be predicted, and survives a case-insensitive file system

Every markdown file is named in lower-case words joined by hyphens, apart from `README.md`,
`TODO.md` and `CHANGELOG.md`. No two files in one directory have names that differ only in letter
case. ^shr-doc-check-f6

- **Verification:** on a copy of the vault, checked out on a case-sensitive file system,
    - name a markdown file with a capital letter, with an underscore, and with a space, and confirm
      each is reported
    - confirm the three exempt names pass in any directory
    - confirm a decision record named by its four-digit number and slug passes
    - place two files whose names differ only in letter case in one directory, and confirm they are
      reported
    - place the same two files in different directories, and confirm they pass

> **What does this buy?** An address is also a filename, so an author never has to guess a
> spelling. A case-insensitive file system, the default on macOS, holds only one of two names that
> differ in case. Git holds both, so a checkout on such a machine silently loses one.

### SHR:DOC-CHECK-F7 — Every document is listed in its directory's index

Every document below the vault root, other than a decision record, is linked from the `README.md`
in its own directory. A directory's own `README.md` is linked instead from the `README.md` of the
directory above it. ^shr-doc-check-f7

- **Verification:** on a copy of the vault,
    - add a document that its directory's index does not link, and confirm it is reported
    - link it from that index, and confirm it passes
    - add a directory whose `README.md` the index of the directory above does not link, and
      confirm it is reported
    - link it from that index, and confirm it passes
    - confirm the vault root's own `README.md` needs no link from above, since nothing above it is
      in the vault
    - add a decision record that the decisions index does not list, and confirm this check does
      not report it

> **What does this buy?** A reader browsing the vault finds a document through its directory's
> index. A document the index omits can be found only by search, so the index gains it in the
> commit that creates it. Linking each directory's index from the one above means every document
> can be reached by browsing down from the vault root.

> **Why are decision records exempt?** The decisions index lists records in two views of its own,
> and `SHR:DOC-CHECK-F10` holds both to the records on disk.

### SHR:DOC-CHECK-F8 — The vault agrees with the component registry

Every system, component and concern is declared once, in `components.md`, and every document that
names one agrees with that declaration. doc-check reports each disagreement. ^shr-doc-check-f8

- **Verification:** on a copy of the vault whose registry declares at least one system, one
  component and one concern, confirm that each of these is reported
    - a registry row whose address or prefix another row already uses
    - a component whose system is neither a registered system nor `shared`
    - a component whose prefix does not open with its system's prefix, or with `SHR` for a shared
      component
    - a requirements document at an address the registry does not declare
    - a folder in `requirements/` or `spec/` that is not a registered system, `shared` or `concerns`
    - a component specification missing the subsection that a registered concern names
    - a decision record whose scope names an address the registry does not declare, other than
      `workspace`
    - a registered address with no row in the Tags table of `TODO.md`
    - a tag in that table that holds a slash and is not a registered address

> **What does this buy?** The registry is the one place a system, component or concern is
> declared, so renaming or splitting one is a mechanical change. doc-check reports every document
> the change leaves behind, and the author fixes each one.

> **Why does a concern's subsection belong here?** Registering a concern, such as telemetry,
> obliges every component specification to cover it at the place the registry names. A concern
> covered by some specifications and not others is not covered.

> **Why the live list's Tags table?** The table is the only place the list's tags are read from. A
> component renamed in the registry and not in the table leaves its old address behind as a tag.

### SHR:DOC-CHECK-F9 — Every requirement can be landed on, cited and proved

Every functional and non-functional requirement carries its block ID and a verification clause, and
every non-requirements table carries its document's block ID. No document writes a requirement
identifier without its prefix in a heading, a code span, bold text or
parentheses. ^shr-doc-check-f9

- **Verification:** on a copy of the vault, confirm that
    - a requirement whose body paragraph lacks its block ID, or ends with another one, is reported
    - a requirement whose prefix holds a colon passes only when its block ID writes that colon as a
      hyphen
    - a non-requirements table not followed by its document's block ID line is reported
    - a functional or non-functional requirement with no `**Verification:**` clause is reported
    - an identifier without its prefix is reported in each of the four positions
    - the same unprefixed identifier in plain prose is not reported

> **What does this buy?** A link lands on a requirement only if the block ID is there. A promise
> with no stated way to prove it is a wish. An unprefixed identifier resolves only inside its own
> document, and it spreads once one document starts numbering on its own.

### SHR:DOC-CHECK-F10 — The decision index matches the records, and accepted records are cited back

Both views of the decision index list exactly the records on disk, and every filename, title,
status, scope and supersession target agrees with them. Every specification that an accepted
record names in its Consequences cites that record back. ^shr-doc-check-f10

- **Verification:** on a copy of the vault, confirm that
    - a record on disk missing from either view is reported, and so is a row naming no record
    - a row whose title, status or scope differs from what its record states is reported
    - a record filed under an address its scope does not name, or missing under one it does, is
      reported
    - a status of superseded naming a record that does not exist is reported
    - a record renumbered in its filename, and not in its index rows, is reported
    - an accepted record that names a specification in its Consequences is reported, where the
      specification neither links the record nor names its identifier
    - a specification named only under a record's Alternatives considered is not reported
    - a specification named by a record that is proposed, superseded or rescinded is not reported

> **What does this buy?** The index is the permanent entry point to the records, and a reader
> arrives at it cold. It is held to the files on disk, rather than trusted. An accepted record can
> say a specification must change, and have nothing happen. The back-citation shows that the
> specification has taken the decision in.

### SHR:DOC-CHECK-F11 — The live work list keeps its shape, and is cited only as a condition

`TODO.md` keeps the shape that `documentation-system.md` gives it. Only `documentation-system.md`
and `CHANGELOG.md` link to the list, and any other document cites an item only as a condition that
holds until the item is done. ^shr-doc-check-f11

- **Verification:** on a copy of the vault holding a live list and a changelog, confirm that
    - an item whose heading lacks its identifier is reported
    - an item missing its Tags line, or carrying a tag absent from the list's Tags table, is
      reported
    - an item missing any of its Problem, Reason, Proposal and Releases parts is reported
    - a next free number at or below a number used by any item, on the list or in the changelog, is
      reported
    - a link to the list from any document other than `documentation-system.md` and `CHANGELOG.md`
      is reported
    - an item cited in any form other than a condition that holds until it is done is reported
    - a condition naming an item that neither the list nor the changelog holds is reported
    - a condition naming an item the changelog records passes

> **What does this buy?** The list is live, and an item leaves it as soon as it is done. A citation
> of an item stops being true then, unless it is a condition. A condition stays true once its item
> is done, because the item is then recorded in the changelog. A list edited in a hurry drifts back
> into prose, and the shape check catches the drift.

### SHR:DOC-CHECK-F12 — A pull request whose vault has findings fails its check, and lists them all

When doc-check runs for a pull request, the pull request's check fails unless the run ends clean.
The run writes one summary of every finding for the pull request to show. The summary also says
when the run could not check the vault. ^shr-doc-check-f12

- **Verification:** on a pull request,
    - with no findings, confirm the check passes and the summary says the vault is clean
    - with one finding, confirm the check fails
    - with a vault whose `components.md` cannot be read, confirm the check fails
    - with thirty findings across several files, confirm the summary lists all thirty, each with
      everything `SHR:DOC-CHECK-F3` requires
    - with a vault whose `components.md` cannot be read, confirm the summary says the run could not
      check the vault
- **Applies to:** runs in continuous integration for a pull request

> **What does this buy?** A finding that does not block the merge gets merged, and the vault
> drifts one pull request at a time. A failed check stops the merge until the author fixes the
> document. The author reads the findings where the change is reviewed, without opening the run's
> log.

> **Who puts the summary on the pull request?** The continuous integration step does. doc-check
> writes the summary where that step reads it, so doc-check itself stays offline
> (`SHR:DOC-CHECK-NFR4`).

> **Why does a run that could not check the vault fail too?** A check that passes when it could
> not run has quietly stopped being a check (`SHR:DOC-CHECK-F2`).

> **Why one summary, rather than a note on each line?** The platform shows only a limited number
> of line annotations, about ten per step. Annotations would show some findings and hide the rest,
> and the hidden ones would look like none (`SHR:DOC-CHECK-NR10`).

### SHR:DOC-CHECK-F13 — Every requirement is claimed by at least one specification

Every functional and non-functional requirement in the vault is cited by at least one row of some
specification's claim table, in its section headed Requirements this satisfies. doc-check reports
each requirement that no claim table cites. ^shr-doc-check-f13

- **Verification:** on a copy of the vault, confirm that
    - a requirement that no claim table cites is reported
    - the same requirement passes once one row of one specification's claim table cites it
    - a requirement cited by a specification only outside its claim table is reported
    - a system requirement claimed only by a component's specification passes
    - a deprecated requirement that no claim table cites is reported
    - a non-requirement that no claim table cites is not reported

> **What does this buy?** A requirement that nothing claims is a promise nothing implements. This
> check is the cheapest way to find one, and it finds it the day the requirement is written.

> **Why only "at least one claim", and not "the claims add up to the whole"?** A requirement is met
> when the contributions across every claim table add up to all of it. Whether they do is a
> judgement about what each row says, and a reviewer makes it. doc-check holds the part a program
> can see: that the requirement has been taken up at all.

> **Why a deprecated requirement too?** A deprecated promise still holds, and is verified like any
> other, until the last thing relying on it is deleted.

### SHR:DOC-CHECK-F14 — Nothing but a fenced code block keeps a finding from being reported

Inside a checked document, text in a fenced code block never produces a finding. Nothing else can
stop a finding from being reported: no comment, frontmatter, setting, option or environment
variable. ^shr-doc-check-f14

- **Verification:** on a copy of the vault,
    - break a rule inside a fenced code block, and confirm nothing is reported
    - break the same rule on the line after the closing fence, and confirm it is reported
    - break the same rule inside a fence of four backticks that holds a fence of three, and confirm
      nothing is reported before the outer fence closes
    - break a rule beside an HTML comment, a frontmatter key and a sentence each asking for it to be
      ignored, and confirm it is reported every time
    - run doc-check with each option and environment variable it reads, and confirm none removes a
      finding

> **What does this buy?** A template has to show a rule being broken without breaking it, and the
> templates in `documentation-system.md` are fenced for that reason. Any other way to silence a
> finding would be used, and a checker that can be told to ignore things accumulates things to
> ignore. A rule that needs an exception is narrowed instead.

> **Are drafts and graveyards not a way to silence findings?** They decide which files are
> checked, and `SHR:DOC-CHECK-F1` states both. Neither works inside a checked document, and
> neither hides anything a reader of the path cannot see.

---

## Non-functional requirements

### SHR:DOC-CHECK-NFR1 — A whole-vault run is fast enough to run before every commit

A run over a vault of 1,000 documents finishes within two seconds on the reference laptop, an Apple
M4 Pro with 24 GB of memory. ^shr-doc-check-nfr1

- **Verification:** on the reference laptop, with a generated vault of 1,000 documents spread across
  every tree, each with its index, and linked to one another,
    - confirm a run over the vault ends clean, so the timing covers a full check
    - run doc-check five times, and confirm every run finishes within two seconds of wall-clock time

> **What does this buy?** A check that slows every commit gets switched off, and a check that is
> switched off is not a check. Two seconds is short enough that a pre-commit hook goes unnoticed.

> **Why 1,000 documents?** It is well beyond the size of this vault for the foreseeable future, so
> the bound holds as the vault grows.

> **Why a named laptop?** A bound needs a machine anyone can reproduce it on. The bound is set for
> the pre-commit hook, which runs on an author's laptop. A continuous integration runner may be
> slower, and is not held to it.

### SHR:DOC-CHECK-NFR2 — The same vault always gives the same findings, in the same order

Two runs over the same files report the same findings, in the same order and with the same text.
This holds whatever the machine, the time of the run, or the order the file system lists
files in. ^shr-doc-check-nfr2

- **Verification:** on a copy of the vault holding findings in several files,
    - run doc-check twice, and confirm the two outputs are byte for byte identical
    - copy the vault file by file in reverse order, run doc-check on the copy, and confirm the same
      output
    - run doc-check on a checkout on Linux and on one on macOS, and confirm the same output

> **What does this buy?** An author can compare the output before and after a fix, and see only
> what the fix changed. A run in continuous integration and a run on a laptop agree, so neither
> raises a finding the other cannot reproduce.

### SHR:DOC-CHECK-NFR3 — doc-check never changes a file

A run leaves every file in the repository exactly as it found it, and creates no file in the
vault. ^shr-doc-check-nfr3

- **Verification:** on a copy of the vault breaking every rule doc-check checks,
    - record a hash of every file in the repository, run doc-check, and confirm every hash is
      unchanged
    - confirm that no file has been added to the vault

> **What does this buy?** A pre-commit hook and a continuous integration step can run doc-check
> without risk to the work being committed. Fixing a finding is the author's act
> (`SHR:DOC-CHECK-NR7`).

### SHR:DOC-CHECK-NFR4 — doc-check runs without network access

A run needs no network access, and connects to no host. ^shr-doc-check-nfr4

- **Verification:** on a copy of the vault holding findings,
    - run doc-check with the network disabled, and confirm the same outcome and the same findings as
      with the network enabled
    - run doc-check with the network enabled, and confirm that it opens no network connection

> **What does this buy?** An author can check the vault on a train, and continuous integration does
> not fail when an outside host is down. A link to a web address is never followed
> (`SHR:DOC-CHECK-NR11`).

### SHR:DOC-CHECK-NFR5 — doc-check builds with only the Rust toolchain, and runs with just added

On a machine holding nothing but the Rust toolchain the repository pins, a fresh checkout builds
doc-check, using only the Rust standard library and fetching nothing. The command an author runs,
`just check-docs`, needs only that toolchain and the just command runner. ^shr-doc-check-nfr5

- **Verification:** in a clean container holding only the pinned Rust toolchain,
    - clone the repository, build doc-check with cargo, and confirm the build succeeds
    - repeat the build with the network disabled after the clone, and confirm it succeeds
    - confirm doc-check's manifest and the repository's lockfile name no package from outside the
      repository
    - install just, run `just check-docs`, and confirm it checks the vault

> **What does this buy?** Anyone with the toolchain can build the checker, and so can a minimal
> continuous integration image. A checker that cannot be built has quietly stopped running. With
> no third-party package, no outside release can break the build or change what it does.

> **Why is just allowed, when the build allows nothing beyond the toolchain?** The build is what
> continuous integration and every new machine must be able to do from nothing. just is one small
> program that gives every command in the repository the same short form. Each author installs it
> once, and so does the continuous integration image.

### SHR:DOC-CHECK-NFR6 — Every rule has a test that breaks it and a test that keeps it

For every row of the table of mechanical checks, and for the claim check `SHR:DOC-CHECK-F13`
makes, doc-check's test suite holds a case that breaks the rule and a case that keeps it. The suite
fails while any of them lacks either case. ^shr-doc-check-nfr6

- **Verification:** run doc-check's test suite, then
    - confirm it passes, with at least one breaking case and one keeping case for every row and for
      the claim check
    - confirm every breaking case is reported under its own rule, and every keeping case produces no
      finding
    - delete one rule's breaking case, and confirm the suite fails, naming the rule
    - delete one rule's keeping case, and confirm the suite fails, naming the rule
    - add a row to the table with no cases, and confirm the suite fails, naming the row

> **What does this buy?** A rule tested only against broken documents can still report correct
> ones, and a checker that reports correct documents gets switched off. A rule tested only against
> correct documents may never fire. The suite enforces both cases, so no rule lands without them.

> **Why one pair per row, when a row can hold several conditions?** The table is the list the
> documentation system keeps, so the suite's obligation maps one to one onto it. A row holding
> several conditions, such as the row on links, may have more cases than the pair, and the suite
> is free to hold them.

---

## Non-requirements

| Identifier | doc-check does not | Because |
|---|---|---|
| **SHR:DOC-CHECK-NR1** | Check a rule of `documentation-system.md` outside its table of mechanical checks, other than the claim check `SHR:DOC-CHECK-F13` makes, such as a document's opening title, or a specification's eight numbered sections | The table is the list of rules the documentation system says are checked. A rule joins it through a decision record scoped `workspace`, which the rules keeper lands with the change to the table and to doc-check |
| **SHR:DOC-CHECK-NR2** | Check any rule of `style.md` | The style rules are applied by the author and the reviewer, and most need judgement a checker cannot make |
| **SHR:DOC-CHECK-NR3** | Validate a Mermaid diagram | Validating a diagram needs mermaid-cli, so the author validates each diagram before committing it |
| **SHR:DOC-CHECK-NR4** | Check documentation outside the vault | A package folder named in the registry's Outside the vault column stays authoritative for its component, under its own rules |
| **SHR:DOC-CHECK-NR5** | Install or run a pre-commit hook | A guide says how to install one. The hook relies on `SHR:DOC-CHECK-F2` to fail when doc-check cannot run |
| **SHR:DOC-CHECK-NR6** | Accept the earlier form of a changed rule beside its current form | No rule has changed yet. The first decision record that leaves documents in an earlier form adds the requirement, with the date the earlier form ends |
| **SHR:DOC-CHECK-NR7** | Rewrite a document to fix a finding | The author chooses the fix. `SHR:DOC-CHECK-F3` says what would pass, where one form would |
| **SHR:DOC-CHECK-NR8** | Read every Markdown form both renderers accept, such as a code span wrapped across two lines | A document doc-check misreads is rewritten into the form it reads. That rewrite is mechanical, and it keeps doc-check small |
| **SHR:DOC-CHECK-NR9** | Check only some of the vault's files | Rules across documents, such as a link broken by a move elsewhere, need every file |
| **SHR:DOC-CHECK-NR10** | Attach a finding to its line on a pull request | The platform shows a limited number of line annotations, so some findings would be hidden. `SHR:DOC-CHECK-F12` lists every finding in one summary instead |
| **SHR:DOC-CHECK-NR11** | Check that a link to a web address resolves | Only relative links are among the documentation system's checks, and `SHR:DOC-CHECK-NFR4` keeps every run offline |

^shr-doc-check-nr

# The documentation system

How documents in this workspace are stored, arranged and checked. Every document is read two
ways: in an Obsidian vault rooted at `docs/`, and rendered on GitHub. This document says where each
kind of document lives, what shape it takes on disk, and which of those rules a checker enforces.
How the sentences inside a document are written is [style.md](style.md).

Every document serves two readers: a person getting up to speed, and a model reconstructing project
context in a fresh session. Both arrive cold, and both read by random access. The layout exists so
that either can find the one document that answers a question, and trust what it says.

**The layout is built for a large workspace.** It can hold dozens of packages, several
services and many command-line scripts, and the unit a reader wants documented is rarely the
unit the package manager builds. The documentation is therefore organised around systems and their
components, which the section on systems and components defines, and never around packages.

---

## The vault

**`docs/` is an Obsidian vault.** Opening that folder as a vault is the whole setup. Obsidian's own
state lives in `docs/.obsidian/`, which is gitignored: it holds one machine's workspace, and nothing
a reader needs.

Three Obsidian settings matter, and each person sets them in their own copy.

| Setting | Value | Because |
|---|---|---|
| `Use [[Wikilinks]]`, under Files and links | Off | A link Obsidian inserts is then a standard link, which GitHub renders. A wikilink is literal text on GitHub |
| New link format, under Files and links | Path from current file | A link Obsidian inserts then names the path from the document, which GitHub resolves. A bare filename is ambiguous once two trees hold documents of the same name |
| Strict line breaks, under Editor | On | Prose is hard-wrapped at about a hundred columns. With this on, a single newline is a space in both renderers rather than a line break in one |

**The same files render on GitHub**, which is where anyone without Obsidian reads them and where
changes are reviewed. Nothing may depend on a feature only one renderer has.

### Markdown rules

These are not preferences. A document that breaks one renders wrongly for half its readers.

- **Standard links only: `[text](relative/path.md)`. Never `[[wikilinks]]`.** Obsidian handles
  standard links fine; GitHub renders wikilinks as literal text.
- **Links are relative paths, never absolute.** A path from the repository root works on GitHub
  and fails in Obsidian, which resolves from the vault root.
- **A document mentioned in a code span is written as its path from the vault root**, such as
  `spec/planner/itinerary.md`. Filenames repeat across trees by design, so a bare `itinerary.md`
  names no document in particular.
- **Callouts: only `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]`.** That
  is the intersection of the two renderers. Obsidian supports more; do not use them.
- **No `#tags`.** GitHub reads a leading `#` as a heading. YAML frontmatter is harmless in both,
  and unused.
- **No heading anchors in links.** GitHub links to a slugified heading and Obsidian to the heading
  text, so an anchor that works in one silently fails in the other. A heading anchor also carries
  the heading's title, and breaks when the title is reworded.
- **A link reaches a requirement through its block ID, and that is the only fragment a link may
  carry.** A block ID is Obsidian's name for one paragraph or table, written `^id` at its end. A
  link to `requirements/shared/doc-check.md#^shr-doc-check-f1` lands on the requirement in
  Obsidian. GitHub does not know the fragment, so the same link opens the right document at its
  top. The ID is made from the identifier, which never changes, so rewording a title breaks
  nothing. The price is the ID's text, which GitHub shows at the end of the paragraph.
- **Mermaid renders natively in both**, so a ```` ```mermaid ```` fence is safe. Validate every
  diagram with mermaid-cli before committing, never by eye. Sequence diagrams reject parentheses
  and `+` in participant aliases, and treat `;` as a statement separator that silently splits a
  message label.
- **No raw HTML, comments included.** GitHub drops any tag it does not allow and shows the page
  around it as normal. Obsidian renders the tag, and an unknown tag left open swallows the rest of
  the document. A placeholder such as `<reason>` goes in a code span.
- **A code span opens and closes on one line.** The checker reads a document line by line, so a
  span wrapped across two lines is a fault in the document, even though both renderers accept it.
  A hard-wrapped paragraph breaks its line before or after a span, never inside one.
- **Prefer tables to prose.** Use a diagram only where it earns its space.
- **Fenced code blocks are exempt from every check.** That is how a template can show a rule
  being broken without breaking it.

### Filenames

| Kind | Name | Example |
|---|---|---|
| Any document | Lower-case words joined by hyphens | `restoring-from-backup.md` |
| A system's document | The system's slug, in the system's folder | `requirements/planner/planner.md` |
| A component's document | The component's slug, in its system's folder or in `shared/` | `requirements/planner/api.md`, `spec/shared/doc-check.md` |
| A concern's document | The concern's slug, in `concerns/` | `requirements/concerns/telemetry.md` |
| An artefact's or format's specification | The artefact's name, in the folder of the system that writes it, or `shared/` | `spec/shared/trip-export.md` |
| Directory index | `README.md` | One in every directory |
| Decision record | `NNNN-short-slug.md`, four digits, zero-padded, allocated in order | `0007-times-are-stored-in-local-time.md` |
| Draft | `<name>-draft.md`, beside the document it will replace | `itinerary-draft.md` |

**A draft is excluded from every check by its filename**, because it defines the identifiers the
document it replaces already owns, and would fail the identifier checks in both files at once. The
exemption is visible in the name, covers the whole file, and ends the moment the draft is renamed
to the document it replaces. It is not an annotation a document can carry.

### The first lines of a document

Every document opens with a level-one heading that stands alone as its title. A document that
depends on another declares it in one line directly below:

```markdown
# The itinerary model

**Assumes** [itinerary.md](../../requirements/planner/itinerary.md) — the promises every itinerary keeps.
```

A document may assume its own tree's `README.md` without saying so. Anything more is declared.
The declaration is a budget, not a substitute for teaching.

---

## Systems and components

**A component is the unit that is documented.** It is the smallest thing that makes promises of
its own to someone outside it: a caller, an operator, or another component. The time library
`trip-time`, the planner's itinerary model and the email parser are each one component. The test
for a new candidate is whether a reader could use it, or depend on it, without reading about
anything else. If they could, it is a component. If it only makes sense as part of something
larger, it belongs to that larger thing.

**A component is named for what it does, never for the package that holds it today.** Designs
last longer than implementations. A component often starts inside a larger package and moves into
a package of its own when that pays: the planner's itinerary model and its calendar export both
began inside the API's package. A component named for its package would be renamed at every such
split, and every link to it would move.

**A package is the unit the package manager builds, and the two need not line up.** Packages are
drawn for implementation, components for the reader, and the component registry records how they
map:

| Shape | Exemplar |
|---|---|
| One package, one component | `@itinero/trip-time` |
| One package, several components | `@itinero/planner` holds the planner's API, its itinerary model, its share links and its calendar export; `@itinero/scripts` builds `seed-db`, `import-mailbox` and three other programs |
| Several packages, one component | a schema and the client generated from it, such as `@itinero/api-schema` and `@itinero/api-client` |
| A package no component claims | a deprecated package, listed in `deprecated.md` until it is deleted |

**A system is a set of components that together make promises to someone outside all of them.**
The planner, the bookings system and the web app are three of them. A system has its own
requirements, because some promises belong to no single component: "a booking forwarded by email
appears on the right day of its trip, or is reported as unmatched, within a stated time" is kept
by the whole bookings system.

**A component belongs to one system, or to `shared`.** A component that several systems use, or
that no system owns, is shared: `trip-time` serves the planner, the bookings system and the web
app, and `doc-check` serves the vault itself. Systems and components are named in separate
namespaces, so the web system and its `web` component share a name without colliding.

**Every system, component and concern has an address**, and the address is how every other
document names it:

| Kind | Address | Exemplar |
|---|---|---|
| A system | Its slug | `planner` |
| A component of a system | The system's slug, a slash, the component's slug | `planner/api` |
| A shared component | `shared/`, then the component's slug | `shared/doc-check` |
| A cross-cutting concern | `concerns/`, then the concern's slug | `concerns/telemetry` |

The address is also where the documents live: `requirements/planner/api.md` and
`spec/planner/api.md` are the planner API's. A system's own documents sit inside its folder,
named by its slug, as `requirements/planner/planner.md` does. `shared` and `concerns` are therefore
never the slug of a system.

### Cross-cutting concerns

**A cross-cutting concern is a subject every component must address the same way.** Telemetry is
the first: an operator reading traces and metrics from the planner and from the email parser needs the
same attribute names, the same units and the same rules for what is recorded, or the signals
cannot be compared. A concern is not a component, because nothing is built for it alone. It is a
contract every component that touches the subject keeps.

**A concern has a requirements document and a specification, like a component.** Its requirements
say what every component promises about the subject: "every span an operator can see names the
trip it concerns" is a telemetry requirement. Its specification is the shared contract, such
as the naming rules, and the names still waiting for the conventions registry. Neither document
describes any one component.

**Each component's specification covers every concern in a fixed place**, so a reader finds a
component's telemetry where they find every other component's. The concern's own specification
names that place, and the section list under Specifications gives it a number. A component that
has nothing to say about a concern says so there, and routes the reader.

### The component registry

**`docs/components.md` is the component registry, and it is the one place a system, component or
concern is declared.** Every other document names one by its address, and the checker resolves each
address against the component registry. The component registry holds four tables.

```markdown
## Systems

| System | Prefix | Telemetry namespace | Outside the vault | Is |
|---|---|---|---|---|
| [planner](requirements/planner/planner.md) | PLN | | | The trip planner: it holds each trip, its days, and what happens on each one |
| [bookings](requirements/bookings/bookings.md) | BKG | `itinero.booking` | | The booking model, the importers that read bookings in, and how each booking is matched to a trip |
| mobile | MOB | | `apps/mobile/docs/` | The mobile app, which shows a trip offline while travelling |

## Components

| Component | System | Prefix | Packages | Outside the vault | Is |
|---|---|---|---|---|---|
| [api](spec/planner/api.md) | planner | PLN:API | `@itinero/planner` | | The planner's HTTP API, and how it starts, runs and stops |
| [itinerary](spec/planner/itinerary.md) | planner | PLN:ITINERARY | `@itinero/planner` | | How trips, their days and their items are stored and changed |
| email-parser | bookings | BKG:PARSER | `@itinero/email-parser` | `packages/email-parser/docs/` | Reads a confirmation email and extracts the booking it confirms |
| [doc-check](spec/shared/doc-check.md) | shared | SHR:DOC-CHECK | `doc-check` | | The checker that holds every document in this vault to the documentation system |

## Booking kinds

| Kind | Prefix | Imported | Manual | In `@itinero/bookings` | Is |
|---|---|---|---|---|---|
| flight | BKG:FLIGHT | yes | yes | `FlightBooking` | A flight, with its departure and arrival in each airport's local time |
| stay | BKG:STAY | planned | yes | `StayBooking` | One or more nights' stay, from check-in to check-out |

## Cross-cutting concerns

| Concern | Prefix | Covered in each specification at | Is |
|---|---|---|---|
| [telemetry](requirements/concerns/telemetry.md) | OTEL | `§3.5` | The traces, metrics and logs every component emits, and the names they use |
```

| Column | Holds |
|---|---|
| Slug | The name in lower-case words joined by hyphens. A system's slug is unique among systems, and a component's among the components of its system |
| System | The system a component belongs to, or `shared` |
| Prefix | The requirement identifier prefix it owns. A system's or a concern's is two to four capital letters, unique among them. A component's is its system's prefix, or `SHR` for a shared component, then a colon and a name: three to twelve capitals, digits and hyphens, unique within its system, such as `PLN:SHARING` for `planner/share-links` |
| Telemetry namespace | For a system, the namespace of its own telemetry where it is not `itinero.` and the system's slug: `itinero.` and one name of lower-case letters, digits and underscores, unique among systems. Empty otherwise |
| Packages | Every package whose code implements it today |
| Imported, Manual | For a kind of booking, whether it can be imported from a confirmation email, and whether a traveller can enter it by hand: `yes` where it can, `planned` where it is to, and `no` where that is not planned yet. At least one of the two is not `no` |
| In `@itinero/bookings` | For a kind of booking, the kind as the code names it, and anything that keeps it from being used |
| Outside the vault | The package folder that still holds its documentation, until it moves into the vault. Empty once it has |
| Is | One line saying what it is, in the reader's words |

**Every kind of booking is a component of the system `bookings`**, at `bookings/<kind>`, so its
table needs no System column. A kind's slug is the name after its prefix's colon, in lower case.

**A slug links only once its document exists.** A slug that is not yet a link names something
documented only outside the vault, which makes the component registry the progress report for moving
documentation in.

**A system, component or concern is added to the component registry before any document names it.**
A renamed or split component is an edit to the component registry, a move of its documents to their
new address, an edit to the `Scope` lines of the decision records that name it, and an edit to its
row in the live list's Tags table and to the items carrying it. The checker reports every link the
move breaks and every address the Tags table and the component registry disagree on, so the move is
mechanical. The records themselves never move.

### What will never move in

**`docs/deprecated.md` lists the packages whose documentation will never move into the vault**,
with what replaces each one, or why nothing does. The vault documents the workspace as it is going
to be, not everything it has been. A package on the list is on its way out: its documentation stays
in its own folder until the package is deleted, and its row is deleted with it. The file itself is
deleted once it is empty. Anyone who disagrees with a row challenges it in a pull request.

**`docs/shared-package-changes.md` lists every change a replacement system makes, or plans, in a
package it shares with the system it replaces**, with what the retiring system sees of it and what
goes once the retiring system is deleted. The changes are additions only, and a harmless difference
is recorded rather than hidden. Each change is decided where its specification or decision record
says, and listed here as well. The file exists only while one system is replacing another, and is
deleted with the cleanup that follows the retiring system's deletion.

---

## The layout

```
README.md                    the repository's front door: what this is, and a table into docs/
docs/
  components.md              the component registry: each system, component and concern and its prefix
  deprecated.md              the packages that will never move in, until they are deleted
  shared-package-changes.md  every change a replacement system makes in a package it shares with the system it replaces
  TODO.md                    the live work list — what needs active work, and what waits on a decision
  CHANGELOG.md               what has been done, newest first
  overview/                  where a reader starts: the front door, and one reading path per use case
  requirements/              what each system and component promises — numbered, testable, never naming mechanism
    planner/                 one folder per system, holding the system's document and its components'
    shared/                  components several systems use, or none owns
    concerns/                what every component promises about one subject
  spec/                      what each thing we build does — the same folders as requirements/
  decisions/                 decision records — what we chose and why; append-only once accepted
  whitepapers/               how one mechanism works end to end; defines nothing
  guides/                    runbooks — how to do one task
  roadmap/                   one roadmap per system: its history, then its pending work
  style.md                   how documents are written
  documentation-system.md    this document
```

**Six trees, strictly separated.** Each answers one kind of question, and mixing them is what makes
documentation drift: a requirement that names a mechanism has to change when the mechanism does,
and a specification that argues for its design has to change when the argument does.

| Tree | Answers | Names mechanism? | Volatility | Form |
|---|---|---|---|---|
| `requirements/` | What a system, component or concern promises | **Never** | Low — a change is an event | Numbered, testable, tabular |
| `spec/` | What each thing we build does | **Yes — that is its job** | Medium — sits near the code | Per component |
| `decisions/` | What we chose, and why | Where relevant | **Append-only once accepted** | Short records, dated, with a status and a scope |
| `whitepapers/` | How a mechanism actually works, end to end | Yes — that is the point | **Highest** — mechanism moves | Read straight through, dated |
| `guides/` | How a person does one task | Yes | High — tracks code | Task-oriented runbooks |
| `overview/` | Where a reader starts, and what to read for a use case | By citation only | High — it tracks every other tree | A short system design; one reading path per use case |

**Requirements and specifications are divided into one folder per system.** The
workspace can hold a dozen systems and far more components, and one flat folder of them would be
a list nobody browses. A reader working on the planner opens `requirements/planner/` and finds
everything the planner promises. Folders follow systems and components, never packages, so a
package split moves nothing.

**The folders can change because the checker makes moving a document safe.** A component moved
to another system, or into `shared/`, moves its documents, and every link to them breaks. The
checker reports each broken link, and each one is a mechanical fix. The trees that hold what does
not move stay flat: decision records are append-only and are filed by their `Scope` lines, and
whitepapers, guides and the overview each cross systems by nature. Roadmaps are flat too, one file
per system, because a system has only one.

**Every directory has a `README.md`, and it is that directory's index.** GitHub renders it on the
directory page, and it is the document every other document in the directory may assume. Each
tree's top index has a fixed table, described under that tree below, and each system's folder
lists its documents. A new document is added to its index in the same commit that creates it.

**Documents outside the trees define nothing; all of them cite.** The roadmaps and their completed
milestones are the one kind of document rewritten freely rather than superseded, because
they track reality rather than record it. The component registry, the deprecation list, the style
guide and this document are the rules the rest follow.

---

## Requirements

**Requirements come at two levels, a system's and a component's, and a concern's cut across both.**
Each system, component and concern has at most one requirements document, at its address.
All of them state what is promised, never how it is built. Mechanism belongs in a specification; the
reasoning behind a choice belongs in a decision record.

| Level | Promises | Names a component? | Verified |
|---|---|---|---|
| System | What the whole system does for someone outside it | **Never** — the decomposition is mechanism at this level | End to end, against the running system |
| Component | What one component does for its callers, at its own interface | Only itself | Against the component alone |
| Concern | What every component promises about one subject, such as telemetry | **Never** — it binds them all alike | Against each component in turn |

**A system requirement never names a component**, because which components keep a system's
promise is a design choice that can change without the promise changing. **A component
requirement is written against the component's own interface**: "an item's start time is shown in
the local time of the place it happens," not "the API converts from UTC using the zone stored on
the item." A component requirement that exists to serve a system requirement says so in its
commentary, and cites it.

Written for a **technically capable release manager**, not an implementor. State **observable
behaviour, never mechanism**: "the service remains reachable when one node is powered off," not
"the load balancer maintains a virtual address by leader election." Concise but unambiguous; terse
to the point of vagueness is worse than a sentence too long.

### Identifiers

**Every requirement carries an identifier prefixed by its document**, so a citation resolves
anywhere in the workspace and can be found by search. Each requirements document owns the prefix the
component registry gives its system, component or concern. A bare "F7" is never written: the checker
rejects an unprefixed identifier in heading, backtick, bold or parenthesis position.

**A prefix says where its requirement belongs, so a reader who has never seen it can guess.** A
system's or a concern's prefix stands alone. A component's names its system first, then a colon,
then the component:

```
PLN-F3           the planner's third functional requirement
OTEL-F2          the telemetry concern's second
BKG:PARSER-F3    the third of the bookings system's email parser
```

The colon is the looser joint and the hyphen before the kind the tighter, which is why the two
differ. The name after the colon is a word or two from the component's own
name, shortened only as far as it stays guessable, as `BKG:PARSER` is for the email parser, with a
number on the end for a later version of the same thing. A shared component's prefix opens with
`SHR`, since `shared` is a folder and not a system. The checker holds the shape; a reviewer holds
the guess. The template below uses `APP`, a system that does not exist. The examples in prose use
the documentation checker's own prefix, `SHR:DOC-CHECK`.

| Kind | Form | Means |
|---|---|---|
| Functional | `PREFIX-F1` | What the system or component does |
| Non-functional | `PREFIX-NFR1` | How well it does it: performance, security, reliability, maintainability |
| Non-requirement | `PREFIX-NR1` | Explicitly out of scope, **with an identifier** so it can be cited |

Functional and non-functional requirements are defined by a heading. Non-requirements are defined
by a table whose first column is the identifier in bold.

**Every requirement carries a block ID, so a link can land on it.** A functional or non-functional
requirement's body paragraph ends with its identifier in lower case, with the colon written as a
hyphen because Obsidian allows nothing else in a block ID: `SHR:DOC-CHECK-F3` ends with
` ^shr-doc-check-f3`. Obsidian can give a table only one block ID, so a document's non-requirements
table is followed by a line holding `^shr-doc-check-nr`, and a link to any non-requirement lands on
the table. A non-requirement has an identifier because a requirement can otherwise depend on
something that is secretly a non-goal, and the identifier is what makes that visible.

**There are no "goals."** They drift into duplicates of the requirements, and removing them later
is a large commit.

### One promise, not one test

**A requirement is one coherent promise.** A single requirement may need several tests to prove,
and that is normal. Write the concept the reader has to hold, then list the checks that establish
it.

**The splitting heuristic, stated carefully.** Split when the verification is long because it
proves *unrelated* things: that is a compound requirement, and a compound requirement can be half
satisfied and still called met. Do **not** split merely because a concept takes three tests to
establish: a document of one-test requirements is a test plan wearing a specification's clothes,
and the reader can no longer see what was promised. Ask "is this one promise?", never "is this one
assertion?"

### The shape of a requirement

Each requirement is a short section in three parts, in this order, marked typographically with no
subheadings: the body, the verification, and a blockquote of question-labelled commentary.

```markdown
### APP:SERVICE-F3 — The service survives loss of one node

Description of what must be true, in one or two sentences, in observable terms. ^app-service-f3

- **Verification:** on a running system,
    - power off one node and confirm the service endpoint still answers
    - confirm new work can still be scheduled
    - restore the node and confirm it rejoins
- **Applies to:** the configurations it applies to        (omit when it applies to all)
- **Deprecated:** what still relies on it                  (omit unless it is deprecated)

> **What does this buy?** The requirement's justification, answered as a question a real reader
> would ask. Further question-labelled blocks follow as needed; none at all is also fine.
```

**Every functional and non-functional requirement has a `**Verification:**` clause**, and
the checker refuses one without. A promise with no stated way to prove it is a wish. The
verification is a bulleted list of short checks, one confirmation per item, and a single check is
still a list. Setup shared by every check sits on the label line.

**A requirement that only a retiring system relies on is marked deprecated**, with a
`**Deprecated:**` line naming what still relies on it. A carried-over component often keeps
promises that only the system it came from uses, such as a response field that only the app being replaced
reads. A deprecated promise still holds, and is verified like any other, for as long as it
stands. Nothing new may depend on it. It is deleted with the last thing relying on it, and its
identifier is never reused.

**The first question is always "what does this buy?"** If it has no answer, the requirement is
misstated or should not exist. Requirements are read by random access, so each one is
self-contained and deliberate redundancy between them is correct. The body stays generic and
citation-light; the commentary may name concrete cases and carries the cross-references. The full
rules for the register are in [style.md](style.md).

### The tree's index

The requirements `README.md` holds two things. Prefixes are not among them, because the component
registry owns them.

| Section | Holds |
|---|---|
| Folders | One row per system folder, then `shared/` and `concerns/`: what the folder's documents promise about |
| People | Every role the documents refer to, so a requirement names a role rather than saying "operator" |

Each folder's own `README.md` lists its documents: what each makes promises about, and how those
promises are verified.

**Every document in the tree owns a prefix.** A checklist written for an outside reader, which
restates obligations the numbered documents place on them, is a guide, and lives in `guides/`.

---

## Specifications

**A requirements document says what must be true and how to check it. A specification says how it
is built.** It is the design of one thing, written so that someone who has not read the code could
implement it. That is the test: if a capable reader could not build the thing from the document,
it is not a specification yet.

**A specification names mechanism freely. That is its purpose.** It describes behaviour,
interfaces and formats. What it does not do: argue for its design, which is a decision record;
say how a person uses it, which is a guide; or say when it gets built, which is a roadmap.

**A thing we build need not be a program.** A specification describes one component, one artefact
written by one program and consumed by others, or one format read by many documents. Organising an
artefact by the programs that touch it would give it several owners and therefore none, so it gets a
document of its own, named for the artefact rather than any component, in the folder of the system
that writes it or in `shared/`: the trip export file is the exemplar. Specifications are
organised by component, never by build order, so they do not churn when the plan changes.

**A system may have a specification too**, in its folder and named by its slug, when how its
components fit together is itself a design someone could implement from. Its interface is what the
outside world sees of the system. Its behaviour is which component does what, and what crosses
between them.

### The eight sections

**Every specification has the same eight sections, in this order, numbered in their headings.** A
reader who knows the shape knows where to look before opening the file.

| | Section | Holds |
|---|---|---|
| 1 | Purpose | What this is for |
| 2 | Scope | What it covers, what acts on it, and what is deliberately absent |
| 3 | Interface | The surface, in five parts: user, application and programming interfaces, the systems this drives, then its telemetry |
| 4 | Behaviour | What it does — the section a reader implements from |
| 5 | Resources | What it creates or stores, how that is named, who owns it, what protects it |
| 6 | Quality attributes | Performance, security, availability, robustness |
| 7 | Requirements this satisfies | The claim table |
| 8 | Open | What is undecided |

Headings carry their numbers (`## 4. Behaviour`, `### 3.2 Application interface`) because a
section number is a stable address: another document cites `§4` or `§3.2` and the checker
resolves it. A part with nothing in it routes rather than disappearing: "None. A developer reaches
this through the command-line tool" tells a reader where to go, where an absent heading leaves them
wondering whether the question was ever put. What each section contains, and how it is written, is
in [style.md](style.md).

**Section 3.5 is where a component covers telemetry**, the first cross-cutting concern. It lists
the signals the component emits by their registered names, citing the telemetry specification for
what each name means, and never redefines one. A concern's own specification is the exception: it
defines the contract, so its section 3.5 routes to its own section 4. A new concern is given a
subsection of its own when it is registered.

**An open question that belongs to one specification lives in its Open section**, not in the live
work list.

### Requirements this satisfies

**Every specification satisfies requirements only in part.** A requirement is met when the claims
across all specifications add up to the whole of it, never because one document claims it. A
component's specification claims its own component's requirements first. It also claims any
system requirement it contributes to, and that is how a system requirement is traced to the
components that keep it. Each specification carries a claim table that says what it contributes
and names who covers the rest:

```markdown
## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [BKG:PARSER-F2](../../requirements/bookings/email-parser.md#^bkg-parser-f2) | Extracts a flight's times and airports from its confirmation email. Placing the flight on its trip is [matcher](matcher.md). |
| [BKG-F1](../../requirements/bookings/bookings.md#^bkg-f1) | The booking details the system reports. Matching the booking to its trip is [matcher](matcher.md). |
```

Naming who covers the rest is the important half. It is what turns a partial claim into a
traceable one, and what makes a missing contribution visible.

> [!IMPORTANT]
> **A specification never restates a requirement.** It cites the identifier and describes what it
> does about it. If a specification finds itself asserting a promise no requirement makes, that is
> a gap in the requirements: fix it there, then cite it here.

### The tree's index

The specification `README.md` holds one table with a row per folder. Each folder's own
`README.md` holds one row per document: what the thing **is**, and where it **runs** or is applied.
Below its table, a short paragraph says which documents are programs, which are artefacts, and
which are anything else, so a reader can see the folder's shape at once.

---

## Decision records

**What we chose, and why.** Each record states a problem, the decision taken, what follows from
it, and the alternatives that were rejected. They are written for a technically capable release
manager who needs to understand what was decided without being familiar with the code.

**The records are one sequence in one folder, and each names its scope.** A decision often cuts
across components: how a booking's times are stored binds `bookings/email-parser`,
`planner/itinerary` and `shared/trip-time` at once, across three folders. A folder per system would force such a record into one of
them, and would put a record that must never change at a path that does. The number therefore only
identifies a record, and the `Scope` line is what files it.

### Append-only, once accepted

**A changed decision is a new record that supersedes an old one, never an edit to the old one.**
Superseded records stay exactly as written, with their status updated to point forward. This is
the single rule that prevents drift, where a large share of commits would otherwise exist only to
reconcile documents with each other or with the code.

**Append-only governs the reasoning, not the status or scope lines.** Changing either is an
ordinary edit. A status changes because a record has to be able to reach its end state. A scope
changes because the component registry does: when a component is split or renamed, the records that
name it are re-scoped, and their text stays exactly as written. A **Proposed** record is not yet
subject to append-only and may be edited freely until it is accepted; that is what proposing is for.
The index is updated in the same commit as either line.

**An accepted record still takes small corrections until something acts on it.** The rule exists
so that nobody acts on a decision, building or specifying something from it, and then finds the
decision altered underneath them. Until then, a correction such as a consequence the review turns
up does no such harm. The boundary is whichever comes first: work that implements the record, such
as a later gate's specification built on it, or the close of the pull request that accepted it.
After that, any change is a new record. A correction is small. A changed decision is a new record
at any time.

| Status | Means |
|---|---|
| **Proposed** | Open. Editable, and settles nothing. Exists to make a question visible and hold its constraints while they are fresh |
| **Proposed until TODO-NN is done** | Open, and held until that work is done: `Proposed until TODO-52 is done`, or `Proposed until TODO-44 and TODO-54 are done` for several. Each item is cited as the vault cites any item, so the checker checks it |
| **Accepted** | In force. The reasoning becomes append-only once something acts on it, or its pull request closes |
| **Rejected** | Considered and not adopted. Kept, because "we thought about this and said no" is worth as much as a yes |
| **Superseded by ADR-NNNN** | Was in force; another record now governs. The target must exist, and the checker checks it |
| **Rescinded** | Withdrawn with nothing replacing it. The situation that forced the decision is gone, so there is nothing to supersede it with |

### The shape of a record

Write the **problem and the solution both at a level a release manager can follow.**
Implementation detail is fine where the thing being decided *is* an implementation detail, but
never assume the reader knows the code. **The title has to stand alone**: it is a permanent index
entry that someone will read cold in a year, so it says what was decided, not what was rejected.
Avoid tool names the reader may not know, and prefer plain words over the project's vocabulary.

**Every record reads cold.** A reader reaches a record by a link, from an index, a specification
or a search, having read no other record, so no record leans on its neighbours. It states in its
own words everything it relies on:

- each term of the project's vocabulary is defined where the record first uses it, or replaced by
  plain words
- each system, component and package is named, never "the old one", "the new model" or "the app
  this replaces"
- each record or requirement cited comes with what it says, such as "ADR-NNNN (a trip's dates are
  those of its first and last items)". A citation is where to read the reasoning, never the only
  place a fact the record needs is stated
- words that assume the reader knows what came before, such as "now", "still", "no longer" and "as
  before", are replaced by what is true

**A record describes the system as decided.** It says what is, for a reader who wants to understand
the current system, not how it came to be. What an older system did, and what was planned before,
goes in one short `> [!NOTE]` callout headed **History**, and nowhere else in the record. A record
that describes the old system and the new one side by side reads as two specifications intermingled,
and a reader has to untangle which one is in force.

```markdown
# ADR-0007 — Times are stored in local time

- **Status:** Accepted            (Proposed | Proposed until TODO-NN is done | Accepted | Rejected | Superseded by ADR-NNNN | Rescinded)
- **Date:** 2026-08-05
- **Scope:** bookings/email-parser, planner/itinerary     (addresses, or workspace)

## Problem
What situation forced a decision, and why the status quo did not work.

## Decision
What we chose, stated plainly.

## Consequences
What this makes easier, what it makes harder, and what it commits us to.
Name the consequence that will be discovered the hard way if it isn't written down.

## Alternatives considered
Each option, and the one reason it lost. Not a balanced essay — a balanced
alternatives section is where documents go to get long.
```

**The scope names every system, component and concern the decision binds**, by its address. A
decision binding a system binds it as a whole, and does not also list its components. `workspace` is
the scope of a decision that binds everything, such as a dependency pinned for every package or this
documentation system. A scope names what the decision constrains, not what it mentions: a record
that rejects an alternative built on `trip-time` does not bind `trip-time`.

Numbered `NNNN-short-slug.md`, zero-padded to four digits, allocated in order. The record is added
to the tree's index in the same commit.

**A specification an accepted record names in its Consequences must cite the record back.** A
record can say a document "must move with this record", reach Accepted, and have that sentence be
the only thing that ever happens. Only Consequences carries the obligation: a mention under
Alternatives considered carries none, and a proposed, superseded or rescinded record has stopped
asking. The back-citation is a link to the record or its `ADR-NNNN` identifier in prose.

### Two people minting records at once

**Concurrent records are ordinary, and the merge has a discipline**, because two records can
conflict in what they decide while no line of text does. Numbers merged to `main` first are final;
the other side may already have accepted theirs and built on them. The merging party renumbers
their own records, and the checker verifies the rename across filename, index row and every
citation. They then compare the *decisions* across both sets of new records, not just the text. A
discovered conflict is the merging party's to reconcile: amend their own record to conform to what
stands, or supersede the standing record explicitly, with reasons. Two accepted records that
disagree are never left standing.

### The index

**The decisions `README.md` holds the rules above, the status table, and the index in two views.**
The first is the ledger: one row per record, in order, with its scope and status. The second files
the same records by subject: one section per address, in the component registry's order, each
listing the records whose scope names it. A record scoped to a system is listed under the system
alone. A record scoped `workspace` is listed in a section of its own, first.

```markdown
| ADR | Title | Scope | Status |
|---|---|---|---|
| [0007](0007-times-are-stored-in-local-time.md) | Times are stored in local time | bookings/email-parser, planner/itinerary | Accepted |
```

```markdown
### bookings/email-parser

| ADR | Title | Status |
|---|---|---|
| [0007](0007-times-are-stored-in-local-time.md) | Times are stored in local time | Accepted |
```

The checker holds both views to the files on disk: the set, the filenames, the titles, the
statuses, the scopes, and every supersession target must agree. The index is the permanent entry
point someone reads cold, so it is checked rather than trusted.

**To catch up on one component rather than read cold**: read its section of the index, then the
records it lists in order, then the records of every system the component belongs to. Later
records build on earlier ones, though each still reads on its own. Where a record and any summary of it disagree, the record is right.

---

## Whitepapers

**How a mechanism actually works, end to end, at a depth that convinces.** A whitepaper follows
one mechanism across every component it touches, names the data crossing each boundary, and says
plainly what the design does **not** protect against. They exist because some mechanisms are
correct for reasons invisible from any single specification, and reading five documents in
sequence does not produce the understanding.

> [!IMPORTANT]
> **A whitepaper defines nothing, and is never authority.** It cites requirements, specifications
> and decisions; it never introduces a promise, an identifier or a mechanism of its own. If a
> whitepaper finds itself asserting something no other document says, that is a gap somewhere
> else: fix it there, then cite it here. Where a whitepaper and a specification disagree, the
> specification is right.

This is the tree most likely to go stale, because it describes mechanism in depth and mechanism
moves. Each document opens with the date it was written and what it depends on, so a reader can
judge whether to trust it:

```markdown
# How a forwarded booking reaches its trip, end to end

- **Written:** 2026-08-06
- **Depends on:** [ADR-0012](../decisions/0012-bookings-are-matched-to-trips-by-date.md),
  [email-parser.md](../spec/bookings/email-parser.md), [bookings.md](../requirements/bookings/bookings.md)

> [!IMPORTANT]
> **This document defines nothing.** Everything it asserts is either cited to the specification
> or decision that owns it, or is an observed fact. Where it and a specification disagree, the
> specification is right.
```

Whitepapers are the only tree written to be **read straight through**. Requirements are looked
up, specifications are consulted, guides are followed; a whitepaper is read once, by someone who
needs to hold the whole mechanism in their head.

The tree's `README.md` holds one table with a row per document: the question it answers, the
systems and components it crosses, and the date it was written.

---

## Guides

**Runbooks: how a person actually does one task.** Task-oriented, and expected to change as the
code changes. If a guide no longer matches reality, fix it or mark it stale; never leave it
silently wrong.

**A guide is numbered acts; a specification is standing truths.** Each step names the exact file
by repository-relative path or the exact command, and says what successful output looks like. The
list ends with how to verify the change took effect. **Expected output is captured from a real run,
never invented**: a runbook for a command that does not run yet is not written yet. Where a
specification finds itself saying "then run…", that sentence belongs in a guide.

A guide that builds on another declares it with an **Assumes** line, and covers only what differs.

The tree's `README.md` holds one table with a row per guide and what it covers, grouped by system.
The first row is the one a new reader starts with, and says so.

---

## Overview

**The front door.** The overview `README.md` says what the workspace is in a paragraph, how the
documentation is arranged in a paragraph, and then who reads it: one section per role, each with a
table of that role's use cases and what the path for each one walks. A use case shared by two
roles has one path.

**One path document per use case.** A path is a reading order, not a retelling: it takes the
reader through its use case's requirements, decisions and specifications in the order that
teaches, then hands them into the trees. It defines nothing and cites everything. A path opens by
answering "am I in the right place?" with bullets a reader triages in seconds: the concrete tasks
this path serves, then one short list per near-miss destination.

> [!NOTE]
> A use-case name in the front door becomes a link as its path document is written. A name that
> is not yet a link is a path that does not yet exist, and a sparse path is a visible register of
> documentation debt. No name links before its target does.

The tree may also hold a short **FAQ**: the problems anyone in this domain meets, the solution
chosen for each and what it buys, in the order they are met. It is the story before the paths.

---

## Roadmaps

**A roadmap is the order work happens in, and the record of what was present at each step.** Its
work is divided into phases, and each phase into milestones: stable release points, reached in
order. Its top half is a history, every completed milestone newest first, saying what was present
at it, so a reader from outside can follow how the system grew. Its bottom half is the work still
owed, each item marked with the milestone it is for. Sequencing is a list, not a document tree. The
pending half changes whenever reality does; a completed milestone's entry changes only to correct
it.

**`roadmap/` holds one roadmap per system, and no other roadmaps.** Several people work on this
workspace at once, each on different systems, and one list ordering all of their work would be
edited by everyone and kept by no one. The web app's milestones are not the bookings system's,
and neither waits on the other. Each roadmap is named by its system's slug, as `roadmap/planner.md`
is.

**A system's roadmap holds its components' plans as well as its own.** Its milestones prove the
system's requirements and its components' alike, and a milestone that belongs to one component
names it. Keeping one roadmap per system means a reader planning the system sees all of its work
in one place.

**Each roadmap names who keeps it**, in a `**Kept by:**` line below its title. The keeper is the
person who reorders it. Anyone may propose a change to it in a pull request.

**Phases and milestones have permanent names.** A phase is a stage of a system's work with one
aim, numbered from 0; a system that moved its documentation into the vault counts the move as Phase
0, and its gates as that phase's milestones. A milestone is a stable release point within a phase,
numbered from 1 in order. Its name is `Milestone <System>-<Phase>.<Milestone>`, such as
`Milestone Planner-0.1`, and the word Milestone is written every time it is named, in the roadmap and
in every document that cites it.

**Work has four levels: system, phase, milestone and work-list item.** A system's roadmap
divides its work into phases, and each phase into milestones. A piece of work is written directly
into a milestone, as one of its pending items, or, where it is a logical whole worth tracking on
its own, is split off into an item of the live work list, which the milestone names as a step and
whose *Releases* line names the milestone.

**Milestones are linear.** Work for a milestone never happens after the next one has started. To
start the next milestone before a milestone's work is finished, the unfinished work moves to the
next milestone, or a later one, and the roadmap says so.

**A roadmap has two halves, laid out the same way in every roadmap:**

- **Completed:** a section for each phase, newest first, and in it a subsection for each milestone
  with work done, newest first, headed with its name and a short title. It reads as the system's
  changelog, so it is kept short enough to skim:
    - each milestone holds a list of bullets, even when there is only one
    - each bullet says what is present: what was written or built, or a decision that shaped it,
      citing its record
    - nothing says why a thing was done, or defends it; the records hold the reasons
    - nothing points at what remains; the pending half shows it
- **Pending:** a section for each phase, in order, and in it a subsection for each milestone, in
  order, headed with its name and a short title, holding a list. Each item is one piece of work: its
  first sentence summarises the work, and what follows is short. An item that does a work-list item
  says so, as `Do TODO-NN`; once its milestone is complete, the work-list items it did are removed
  from the list in one batch, and recorded in the changelog.

**A milestone in progress can appear in both halves.** What it has finished is listed under its
heading in the completed half, and what remains stays listed under its heading in the pending half.
Once nothing remains, it leaves the pending half.

**A milestone is complete when every item marked for it is done**, and the requirements it names
are verified by the verification clauses those requirements carry, not when the code looks
finished. A roadmap defines nothing: it cites the requirements, specifications and records that
do.

The tree's `README.md` holds one table with a row per roadmap: what it plans, and who keeps it.

---

## The live work list and the changelog

Two documents in `docs/` hold what is owed and what is done, so they are read in the vault like
everything else. Neither defines anything; the requirements, the specifications and the decision
records do.

**`TODO.md` is where the work stands**: the things that need active work, and the questions waiting
on a decision. An item is the fourth level of a roadmap's work, below a milestone, when a milestone
names it as a step. Every item is a `### TODO-NN — title` heading carrying a stable identifier,
allocated in order and never reused, and the list names the next free number in a `*Next free:*`
line. Every item carries a
`*Tags:*` line drawn from a Tags table the list defines, so "the list for one area" is a filter
rather than a second document. Every registered address is a tag, such as `planner` or
`planner/api`, and has a row in the table, added in the commit that registers it: the document
checker reads tags from the table alone, and reports any
tag the table lacks. Any other tag is added to the table before it is used, and a tag holding a
slash is always a registered address. Every item carries a `*Written:*` date line directly after its
tags, and an item that work has begun on carries a `*Started:*` line directly after that, so the two
dates read in the order they happened. An item that cannot be worked yet carries a `*Blocked:*` line
for each thing it waits on, after its dates: another item's identifier alone, or a few words naming
what is outside the list. An item's age is the first thing wanted when it is picked up again: its
Reason can be overtaken by work finished after it was written, and without a date neither a reader
nor a session can tell which changelog entries and which commits arrived afterwards. The identifier
says the order items were written in but not when, and an item can sit through a release while the
code moves under it. Every item states four things, each opening a paragraph with its label: the
`*Problem:*` in one sentence, the `*Reason:*` it is that way, the `*Proposal:*` in one or two
sentences, and the `*Releases:*` it is projected to move.

**Two people allocating items at once renumber on merge.** Several people work in this
workspace, and each may add items on their own branch. Numbers merged to `main` first are final.
The merging party renumbers their own new items past the highest number on `main`, and moves the
list's next free number with them. A renumbering touches no other document, except a condition
citing a renumbered item. The merging party searches for each old identifier and moves those
conditions with it. The checker cannot find them, because the old number now names someone else's
item.

**Finished work leaves the list for `CHANGELOG.md` in the commit that finishes it**, never struck
through or marked done in place, so no commit shows the work done and its item still open. A
changelog entry is a date, who did it, and a few sentences of what was done, newest first, naming
the item's identifier so the number's fate is findable. An entry may also carry a `*Commits:*`
line directly after the attribution, listing the short hashes of the commits the work landed in,
newest first, where the commit the entry ships in cannot name itself. Pull requests here land as
one squashed commit, so the line names the pull request as well. The line is optional and an entry
without one is complete. If part of an item stays live, keep that part and delete the rest.

**Nothing links to the live list except the file that defines its rules and the changelog, and
nothing else cites an item except to say what waits on it.** The list is live, and an item leaves
it as soon as it is done. A document that needs to say work is owed says so itself. The one
exception is a statement that holds only until an item is done, such as a promise today's code
keeps only once a defect is fixed. It cites the item in the form `until TODO-NN is done`. A
roadmap also names, as a step of a milestone, each item the milestone does, such as `Do TODO-61`,
and removes the items in a batch once the milestone is complete.
Identifiers are never reused, so the citation can never come to name another item. An identifier
the list no longer holds names an item that is done. The condition it states is then met, and the
changelog says when.

---

## Moving a component into the vault

**Until every component has moved in, documentation lives in two places, and the component registry
says which holds each component's.** A component whose `Outside the vault` column names a folder is
documented in that package folder, as the workspace has done until now. That folder stays
authoritative for it, and nothing in this document binds it. A component whose column is empty is
documented in the vault alone.

**Components move one at a time, each in a pull request of its own.** The pull request writes the
component's requirements, specification and index rows, and whatever decision records are still in
force. It empties the component's `Outside the vault` column. Half a component in each place would
leave a reader unable to tell which document is right.

**The vault replaces the package folder's documentation, and is never a layer on top of it.** The
pull request carries every decision and every fact the folder holds into the vault, then deletes the
folder's documents. A reader must never need an old document to understand a vault one, because
the old one will not be there. The pull request proves nothing was left behind with a working
checklist, such as a ledger mapping every section of every source document to where it went, and
deletes the checklist with the folder. Git history keeps the old documents, but nothing in the vault
depends on them.

**A vault document never refers to documentation a migration will delete.** It states what it
relies on in its own words: a fact, a reason, or the history of a decision. A path, a section
number, a checklist's labels or a pinned commit would each leave the reader holding a reference to
something that is gone. Documentation outside the vault that stays, such as a deprecated package's
own `README.md`, is cited by repository-relative path in backticks, never by link, because a link to
it resolves on GitHub and fails in Obsidian.

**A decision recorded outside the vault is carried over while it is in force.** It becomes a new
record, dated the day it is written. Its Problem states the situation that forced the decision, and
its history where that explains it, without naming the document it came from. A decision that has
since been overturned is not recorded again. The record of the decision now in force says what it
replaced, where that matters.

**A component that does not exist yet starts in the vault.** Nothing new is written into a package's
`docs/` folder for a component whose documentation has moved in.

**Nothing on the deprecation list moves in.** Its documentation stays in its package until the package
is deleted, and then goes with it.

---

## Citations

A citation names a stable address, and the checker resolves it.

| Cite | As | Resolves against |
|---|---|---|
| A requirement | `SHR:DOC-CHECK-F3`, in backticks, prefixed; or a link carrying its block ID, `[SHR:DOC-CHECK-F3](../requirements/shared/doc-check.md#^shr-doc-check-f3)` | The heading or table row that defines it, in the document that owns the prefix |
| A decision | `ADR-0001`, or a link to its file | The record on disk and the index |
| A section of a specification | `§4`, `§3.2`, after naming the document | The numbered headings the cited document defines |
| A system, component or concern | Its address, such as `planner/api`, or a link to its specification | The component registry |
| Documentation outside the vault that stays | Its repository-relative path, in backticks. Documentation a migration will delete is never cited | Nothing: it is outside the vault |
| A document | A relative link | The file on disk |

**A section citation takes the nearest document named before it.** First the nearest document named
on the same line, by link or by a path in a code span; failing that, the last document named earlier
in the same block, which is how a bulleted walk through one specification names it once and then
cites section after section; failing both, the document it sits in. On a table row the search stays
inside the cell holding the citation, and skips the rows above. That is how a claim table cites the
specification around it, although each row's first cell links a requirement. A `§` against a
document that numbers no sections is a finding, not a pass: a decision record has no `§4` to mean.

**Cite by prefixed identifier or not at all.** In prose, a citation adds a source and never carries
the claim; the sentence must survive the link's removal. In code, a cited requirement carries its
meaning: `SHR:DOC-CHECK-F3 (each finding says where, which rule, what was found, and what would pass)`,
not `SHR:DOC-CHECK-F3` alone.
The identifier makes it greppable; the gloss makes it readable.

---

## What is checked mechanically

**The checker is `doc-check`, a Rust package in this workspace at `tools/doc-check`.** An author
runs it with `just check-docs`, from any directory in the repository. Continuous integration runs
it on every push and every pull request, and a pull request with findings fails its check. What it promises is
[requirements/shared/doc-check.md](requirements/shared/doc-check.md), and how it reads a document
is [spec/shared/doc-check.md](spec/shared/doc-check.md).

Most of the rules above are checkable, so they are checked rather than remembered. The checker
runs over every markdown file in the vault, and over nothing outside it: documentation in package
folders is never checked. It prints findings as `file:line`, and exits non-zero on any. Its exit
status also tells a run with findings apart from one that could not run. A person may
also run it from a pre-commit hook, which the guides say how to install. The hook fails hard when
the checker cannot run rather than skipping: a check that quietly stops running is not a check.

| It confirms | Because |
|---|---|
| Relative links resolve; no wikilinks, no absolute paths, and no fragment but a block ID the target defines | The rules under the vault |
| Every requirement carries the block ID its identifier gives it, and every non-requirements table carries its document's | A link to a requirement lands on it only if the ID is there |
| Only the five shared callout types appear | The intersection of the two renderers |
| No two files in one directory differ only in letter case | A case-insensitive file system, the default on macOS, holds only one of them |
| Every markdown file is named in lower-case words joined by hyphens, other than `README.md`, `TODO.md` and `CHANGELOG.md` | A slug is a filename, and an author should never guess a spelling |
| Every document below the vault root is linked from its directory's `README.md`, decision records aside | A new document joins its index in the commit that creates it, and a reader browsing the vault finds it there |
| Every address and prefix is unique, every component's system is a registered system or `shared`, and every component's prefix opens with its system's | The component registry is the one place a system, component or concern is declared |
| Every component specification has the subsection each registered concern names | A concern is covered uniformly, or it is not covered |
| Every requirements document sits at a registered address, and every folder in `requirements/` and `spec/` is a registered system, `shared` or `concerns` | A document for an unregistered component has no prefix and no place in the indexes |
| Every cited identifier is defined, in the document whose prefix it carries | A citation must resolve anywhere |
| Every functional and non-functional requirement has a **Verification:** clause | A promise with no stated way to prove it is a wish |
| No unprefixed identifiers, in heading, backtick, bold or parenthesis position | Per-document numbering, caught before it spreads |
| Every `ADR-NNNN` in prose names a record on disk | A citation must resolve anywhere, as a requirement identifier's must |
| Every decision record's scope names registered addresses, or `workspace` | A scope that names nothing registered files the record nowhere |
| Both views of the decision index match the files on disk: set, filenames, titles, statuses, scopes, supersession targets | The index is the permanent entry point someone reads cold |
| Every specification an accepted record names in its Consequences cites that record back | A record can name a document that must move and have nothing happen |
| Every `§4` resolves to a section the cited document defines | A section citation is prose, so nothing else checks it; renumbering breaks citations silently |
| Only the rules file and the changelog link to the live list, and any other document cites an item only as `until TODO-NN is done`, naming an item the list holds or the changelog records | The list is live, and an item leaves it as soon as it is done. Only a condition stays true once it has |
| The live list has the shape above: identifiers, tags from the table, four parts, a next number past every one ever used | A list edited in a hurry drifts back into prose |
| The live list's Tags table has a row for every registered address, and every tag in it holding a slash is one | The document checker reads tags from the table alone, and a renamed component leaves its old address behind |
| Every functional and non-functional requirement is cited by some specification's claim table | A requirement nothing claims is a promise nothing implements |
| Every code span closes on the line it opens on | The checker reads line by line, so a wrapped span is misread silently |
| No HTML tag or comment appears outside code | Obsidian renders an unknown tag, and one left open swallows the rest of the page, while GitHub shows nothing wrong |

**Fenced code blocks are skipped for every check, and there is no suppression syntax.** That is
what lets the templates in this document show a rule without breaking it, and it is deliberate: a
checker that can be told to ignore things accumulates things to ignore. If a rule needs an
exception, narrow the rule. Drafts are excluded by their `-draft` suffix. Any directory named
`graveyard` is excluded by name: it is where an author sets documents aside while replacing
them, and `.gitignore` keeps it off every other machine.

**A document the checker misreads is repaired, not the checker.** The checker reads a document
line by line rather than parsing it (ADR-0001 records why). The forms it reads are part of these
rules, so a document in any other form is at fault, even where both renderers accept it. A code
span wrapped across two lines is the known case. The document is rewritten into the form the
checker reads, which is a mechanical edit, and the checker stays small.

**One thing it does not do.** Mermaid needs mermaid-cli, so diagrams are validated by hand before
committing.

---

## Changing this system

**This system will change, and each change costs more than the last.** A workspace's
documentation is reorganised as the needs behind it change, and pretending those needs will stop
changing would not be honest. A change is weighed against what it moves, not refused because
something must move.

**A change to this document is a decision record scoped `workspace`, from the day this document
reaches `main`.** Until then it is still being founded, and is revised directly. After that, the
record says what changed, why the rule it replaces stopped serving, and what moves. It lands in the
same pull request as the change to this document and the change to `doc-check` that enforces it.

**Every change says what happens to documents written under the old rule.** Either they all move
in the same pull request, or they are left as they are and the checker accepts both forms until
they move. A rule the checker enforces on new documents alone is a rule with two forms, and the
record says when the second form ends.

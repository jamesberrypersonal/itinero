# House style

How documents in this repository are written. Every document serves two readers: a person
getting up to speed, and a model reconstructing project context in a fresh session. Where each
kind of document lives, and what shape it takes on disk, is
[documentation-system.md](documentation-system.md).

Rules are sorted by what they apply to, and each rule belongs to exactly one part.

| Part | Applies to | Branches on document kind? |
|---|---|---|
| **Voice** | Every sentence and block, in every document | Never |
| **Lexicon** | Every word choice | Never |
| **Shape** | What parts a document has, and in what order | Yes — the only part that branches |
| **Rationale** | Nothing, while writing. Read it when a rule is challenged | — |

**Voice is capped at twelve rules.** It holds eleven today. Once it holds twelve, another rule is
admitted only by showing that one of the twelve is subsumed, dead, or wrong. The cap is what forces
consolidation. Without it the list only grows, and each rule dilutes the others.

**A rule is admitted only on two conditions.** A document in this repository has violated it,
and it is not derivable from a rule already present. Observations from a review are raw
material. They accumulate in a companion file, `style-observations.md`, beside this one. The
companion is a table of date, document and what went wrong, with nothing edited on the way in.
Observations enter this file only at a distillation pass, which may delete observations and
standing rules alike. Distil when a document is rewritten into the shape this file sets, or when
the list reaches a dozen entries. A distillation reads the whole list at once and asks what rules
it implies. Several observations often collapse into one rule, or show that a standing rule is
mis-stated.

The Shape part is settled for requirements, specifications, guides and orientation documents.
Orientation documents are the ones in `overview/`, which route a reader to what they need. Two
kinds of document have no part of their own under Shape yet: decision records, and whitepapers,
which explain one mechanism end to end. The rules Shape sets for every document, and all of Voice
and Lexicon, still bind them.

---

## Voice

### STY-V1 — A sentence carries one claim

- **Test:** count the sentence's joints — its semicolons, colons, em-dash breaks, and
  conjunctions joining two independent clauses. More than one joint is a second claim, and a
  second claim is a second sentence. Two constructions are not joints:
    - a parallel enumeration in which no item is a clause of its own, wherever in the sentence
      it sits — the commands to start a service are `init`, `fetch`, then `up`
    - a parenthetical carrying no joint of its own, in brackets or between matched em-dashes

A nested claim costs the reader what a joint costs. Keep a parenthetical simple, and let
`STY-V11` take an enumeration whose items have outgrown the sentence.

```
Before:  The writer always holds the whole system; the reader never does — and a document
         written from that vantage uses concepts no reading order has supplied.

After:   The writer always holds the whole system. The reader never does. A document written
         from that vantage uses concepts no reading order has supplied.
```

### STY-V2 — A paragraph opens with its takeaway

- **Test:** read the first sentence alone. If it does not state the paragraph's point, the
  paragraph is ordered wrong.

### STY-V3 — Everything else in the paragraph serves that takeaway

- **Test:** take each clause in turn and remove it. If nothing is lost, it stays removed. If
  something is lost but it does not serve this paragraph's takeaway, it moves to the section it
  does serve. An aside, a digression, or a closing aphorism fails one test or the other.

```
Delete:  a record is a promise, and a promise is a kind of record
Delete:  there is more to say about this, and it is said elsewhere
```

### STY-V4 — Every normative sentence names its actor

- **Test:** ask who does this. If the answer is not in the sentence, name it. A restriction
  names who cannot, and a section with two actors divides where the actor changes.

Actor and audience can differ. Where they do, the text says who it is written for.

### STY-V5 — An implied subject is named earlier in the same paragraph

- **Test:** for every pronoun, and every subject or object left out, find where it was last
  named outright. It must be in the same paragraph, or in the sentence introducing the list or
  table that follows, with no other candidate standing between. A heading is read cold and out
  of order, so it names its own subject and object.

### STY-V6 — A citation adds a source, never a claim

- **Test:** delete the citation and any identifier gloss. If the sentence stops making its
  point, the citation was carrying the claim. State the claim in full, cite trailing with a
  short gloss, and give an identifier's meaning inline at its first use in the document.

```
Before:  > Per ADR-0005. Independent settings multiply into combinations nobody tests.

After:   > **Why a single axis rather than independent settings?** Independent settings
         > multiply into combinations nobody tests. An untested combination is not a supported
         > one (ADR-0005 records the choice).

Before:  SEC-F3 governs issuance.
After:   SEC-F3 (a credential is issued to a person exactly once) governs issuance.
```

### STY-V7 — An abstraction is accompanied by an exemplar

- **Test:** name the concrete thing the reader will meet — the MAC address behind "hardware
  address", the vendor's product behind "the platform", the operating-system image behind
  "an update". The exemplar is a noun phrase in the sentence, never a worked example. Without
  one, an abstraction reads as vagueness; with one it reads as scope.

### STY-V8 — A specialist term is replaced by the action or thing it names

- **Test:** substitute what the term stands for. If the replacement is still vague, the
  substitution has not been done. A term that is ordinary in one tree may be unreadable in
  another.

```
Wrote:     proven by a walk
Repaired:  proven by hand                            — still vague; the repair failed
Correct:   proven by following the installation guide
```

### STY-V9 — Bold marks structure, never emphasis

- **Test:** bold marks table row-heads, and the question label that opens a rationale block
  (`STY-S3`). Nothing else is bold.

### STY-V10 — A worked example is included only where the text cannot state its own boundary

- **Test:** try to state the boundary in one sentence. If it states cleanly, keep the sentence
  and add no example. If it does not, the reader is being asked to recognise a quality rather
  than check a property, and one example shows what the sentence could not. A worked example
  goes in a `[!TIP]` callout, a blockquote that Obsidian and GitHub both draw as a boxed tip. A
  reader can then take or skip the example whole.

This bounds worked examples alone. The inline exemplar `STY-V7` requires is not one, and is
never dropped under this rule.

### STY-V11 — An enumeration whose items need more than a clause becomes a list

- **Test:** write the enumeration as one sentence. If an item needs a parenthetical, a citation,
  or a clause of its own to be understood, the enumeration is a list instead. Items that are not
  clauses of their own stay in the sentence.

---

## Lexicon

**Mint no term where an ordinary phrase serves.** Every new term costs the reader, and the cost
is paid on every later reading.

The table grows as terms are settled. A row is added when a review finds two words for one
thing, or one word for two things, and records which to write.

| Write | Never write | Because |
|---|---|---|
| a person's role by name | operator, in a sentence about who may do what | "operator" conflates roles with different access |
| operator, for any human | — | "without operator intervention" is correct |
| `docs/spec/planner/api.md`, `packages/planner/` | a bare filename | a path relative to nowhere makes the reader guess |
| porcelain, plumbing | surface, internals | the two words label a specification's section 4 subsections, as Shape describes |
| item, for one entry of `TODO.md` | task, card, ticket, issue | the documentation system's word; a ticket lives in another tracker |
| component, for the unit documented | module, subsystem, node, part | a component is what makes promises of its own, and `docs/components.md` registers each one |
| package, for the unit the package manager builds | crate, module, library | a package and a component need not line up, so the two words are never swapped |
| system, for a set of components with promises of their own | platform, suite, product | the planner, the bookings system and the web app are systems |
| address, for the name a document uses for a system, component or concern | path, key | `planner/api` is an address, and it is also where the documents live. A concern is a subject every component handles the same way, such as personal data |
| outside the vault, for documentation in a package's own folder | legacy | the vault describes where documentation is, not how old it is |

**A word is defined by what is done at its level**, not by its position in a taxonomy. A package
is what the package manager builds. A component is what makes promises of its own. A built
artefact, such as an app's installer, is what a hash attests. A category has nothing done to it,
so naming one defines nothing.

Where a set of terms names the kinds of one thing, show the kinds side by side. Put the single
case beside the case that groups several, such as a component beside the system that groups
components. Then give the test a reader applies to decide which kind the next new thing is.

**A comparison teaches a new concept, or it is deleted.** Having defined something, a comparison
to what the reader already knows will settle it. A template and the documents made from it, for
instance, are a class and its instances. Everywhere else the plain word serves. A section title
names its keyword plainly, with no comparison attached. The test is to delete the comparison. Keep
it if the definition it follows becomes harder to grasp, and drop it if only the prose reads
flatter.

---

## Shape

### Every document

**STY-S1 — A document assumes at most its own tree's README.** Anything more is declared in one
line at the top: `**Assumes** [document](path.md)`. The declaration limits what the document may
take as read. It does not excuse the document from teaching anything else it needs.

**STY-S2 — Concepts are introduced before first use**, in dependency order, at one altitude. A
short overview beats definitions scattered through the sections that need them. A process the
document depends on is established as a subject in its own sentences before anything refers to
it in passing.

**STY-S3 — Normative text above, rationale below.** Rationale goes in question-labelled
blockquote blocks: a bold question label, one question per block, narrative prose. A consequence
someone learned by being caught out, such as a command that deletes data without asking, goes in a
`[!WARNING]` callout instead. A question label would soften it.

**STY-S4 — A citation names a stable address.** A document, a numbered section (`§4`) and an
identifier (`SHR:DOC-CHECK-F3`, `ADR-0001`) are stable addresses. A paragraph, a sentence and a point
partway through a section are not. Cite the smallest stable address that contains what you mean,
and reiterate in place whatever the current section needs. The checker resolves every `§4`
against the sections its target defines.

**STY-S5 — No document cites the live work list, except to say what waits on an item.** The list is
live, and an item cited from elsewhere leaves it as soon as it is done. A document that needs to say
work is owed says so itself. A statement that holds only until an item is done cites it as
`until TODO-NN is done`. That stays true once the item leaves the list, because an identifier the
list no longer holds names an item that is done. `documentation-system.md`, which defines the list's
rules, and the changelog cite it freely, because one defines its terms and the other receives its
finished items. The checker enforces this.

### Requirements

Each requirement is three parts below its heading, in this order. Typography tells the parts
apart, with no subheadings: a plain paragraph, a bulleted list, then quoted blocks.

| Part | What it is | Written for |
|---|---|---|
| Body | The promise, in observable behaviour, never mechanism | The release manager deciding what was contracted |
| Verification | The proof | Whoever builds the test or check that proves it |
| Blockquote | Disambiguation: corner cases, boundaries, see-also | The reader who arrived confused or curious |

**The body stays abstract, and the disambiguation may name concrete cases.** A concrete case in
the body narrows the promise. The body also may not absorb mechanism. Where a body cannot be
both generic and plain, the missing piece is usually a name.

**Cross-references live in the disambiguation.** The body stays citation-light.

**The verification is a bulleted list of short checks.** Each item is one short description of
how to establish that the requirement is met. A single check is still a list. Setup shared by
every check sits on the line that carries the `**Verification:**` label.

**The first question in the blockquote is always "what does this buy?"** If it has no answer, the
requirement is misstated or should not exist.

Every question after the first is optional and never filler. A requirement with no other question
is the shape working, not a gap.

### Specifications

**A requirements document says what must be true and how to check it. A specification says how it
is built.** It is the design of one component, written so that someone who has not read the code
could implement it. That is the test: if a capable reader could not build the thing from the
document, it is not a specification yet.

**Every specification has the same eight sections, in this order.** A reader who knows the shape
knows where to look before opening the file, which is the whole point of fixing it.

| | Section | Holds |
|---|---|---|
| 1 | Purpose | What this is for |
| 2 | Scope | What it covers, what acts on it, and what is deliberately absent |
| 3 | Interface | The surface, in the four parts below |
| 4 | Behaviour | What it does — the section a reader implements from |
| 5 | Resources | What it creates or stores, how that is named, who owns it, what protects it |
| 6 | Quality attributes | Performance, security, availability, robustness |
| 7 | Requirements this satisfies | The claim table |
| 8 | Open | What is undecided |

**A part with nothing in it routes rather than disappearing.** "None. A developer reaches this
through the command-line tool" tells a reader where to go; an absent heading leaves them
wondering whether the question was ever put. An empty section is a question nobody asked, not a
question with no answer.

**Section 3 has four parts. The fourth is the outbound half.**

| | Part | Answers |
|---|---|---|
| 3.1 | User interface | Who calls this, and what a person uses to do it, such as commands or screens |
| 3.2 | Application interface | Who calls this over a network or a service boundary |
| 3.3 | Programming interface | Who calls this from code, through functions in the same program |
| 3.4 | Systems this drives | What this calls, and what it creates there |

**Where 3.4 names a borrowed system, it teaches that system's vocabulary first.** `STY-S2` binds a
borrowed vocabulary exactly as it binds the project's own, and a reader who has never written
against the thing being driven is the ordinary case rather than the exception. Depth belongs to
that system's own documentation, named rather than linked.

**Section 4's granularity is set by section 3.**

| Where the surface is | Section 4 is one subsection per |
|---|---|
| 3.1 | Command or use case |
| 3.2, 3.3 | Operation: inputs, effect, output, what it refuses, what a second call does |
| 3.4 | Operation it performs on the system it drives, and how it is carried out here |

**Section 4 states only what this component adds.** A component can implement an interface that
another document specifies, such as a storage adapter that implements a shared storage interface.
Where that document is the whole story, the operations go in a table and nothing more is said.
Section 4 then never restates the document the component implements. Behaviour crossing every
operation, such as a guard, is stated once at the top rather than in each.

**Section 4 is verified against the source, never inferred from the interface.** Behaviour read
off a method signature is a guess, and a guess reads exactly like a fact. The claim most worth
checking is that an operation has nothing of its own to add: a first draft that made it for six
operations was wrong about four, one of them a capability the component did not implement at all.

**Section 6 cites requirements; it never declares them.** Requirements, at system and component
level, live in their own tree. Section 6 says what this component's security or availability
properties are, naming the promise each one serves. The claim table in section 7 stays the
complete record, and section 6 is its reader-facing view.

**`Porcelain:` and `Plumbing:` mark section 4's subsections, where a specification has both.**
Porcelain is the surface consumers use. Plumbing is the machinery beneath it, for those who change
it. Porcelain never depends on plumbing having been read.

**Where section 4 is organised by use case, each opens with `Invoked from:`**, naming the literal
commands or triggers and saying what is automatic. What follows the label is a complete sentence
that stands without it.

**A specification never argues against the alternative.** State what is, and cite the record that
chose it.

**A specification's porcelain is complete when writing the guide from it is mechanical.** A guide
is the step-by-step runbook for one task. A section that leaves one of its guide's questions
unanswered is missing semantics.

**A format read by many documents gets its own specification**, rather than a section inside the
specification of whichever program writes it.

Mechanisms belong at class level: sequence diagrams, named services, the shape of an exchange.
Code-level detail does not.

### Guides

**A guide is numbered acts; a specification is standing truths.** A specification sentence stays
true while nobody acts. A guide line is an act.

Each step names the exact file by repository-relative path or the exact command, and says what
successful output looks like. The list ends with how to verify the change took effect.

**Expected output is captured from a real run, never invented.** A guide for commands that do not
run yet is not written yet.

Where a specification finds itself saying "then run…", that sentence belongs in a guide.

### Orientation documents

`overview/` holds two kinds of orientation document. The system design is its `README.md`, the
front door a new reader starts from. A path document is a reading order for one use case, such as
adding a booking kind. A role is a kind of reader, such as someone who writes the planner's code.

**The system design decomposes by role, then use case.** Each use case has its own path document,
and roles are how a reader finds theirs. The design routes rather than teaches, with one line per
use case saying what its path covers. A sparse path is a visible register of documentation debt.

**A path is a reading order, not a retelling.** It takes the reader through its use case's
requirements, decisions and specifications in the order that teaches, and then into the trees. It
defines nothing and cites everything.

**A path opens by answering "am I in the right place?"** The answer is bullets a reader triages
in seconds: the concrete tasks this path serves, then one short list per near-miss destination.
The system the use case belongs to follows, in one paragraph of simple promises with no mechanism
names.

**A path's bullet carries three things.** They are the claim, the scenario that makes it real, and
what the reader does differently because of it.

**A path names no single role as its audience.** It is written for every role routed to it.
Material for one role sits in an aside that names that role, as `STY-V4` asks.

---

## Final pass

Run these against the document before committing.

1. Delete every link. Does every sentence still make its point? (`STY-V6`)
2. Count the joints in each sentence. (`STY-V1`)
3. Read the first sentence of every paragraph, in order. Do they carry the argument? (`STY-V2`)
4. Read as someone who has read only the declared prerequisites. Can every sentence be parsed?
   (`STY-S1`, `STY-S2`)
5. Validate every Mermaid diagram with mermaid-cli, never by eye.
6. Run the documentation checker, `just check-docs`.

In Claude Code, the project skill `/final-pass` runs this pass over the documents a branch
changes. A fresh subagent does step 4, because the author has seen the work and cannot read it as
a newcomer.

---

## Rationale

Read when a rule is challenged. Nothing here is normative.

**STY-V1 — why the test counts joints when the rule is about claims.** The two arrive
together. Claims are joined artificially, and the joining is what overloads the reader.
Counting joints therefore counts claims. The Voice rules were settled by marking up existing
documents sentence by sentence. That markup never found a sentence carrying many claims across few
joints, so the rule needs no second test for it. A count is also the only form the rule survives
in. Asked instead whether a sentence is too dense, a writer defends each aside on its own, one at a
time, and none is ever removed.

**STY-V3 — where the rule came from.** The two deleted examples are the two ways an aside fails.
The first decorated a point two plain sentences had already made; the second said nothing at
all.

**STY-V6 — what a carried citation costs.** A bare "Per ADR-0001." forces the reader to click
out of confusion rather than curiosity, and hides how many claims the sentence makes. A human
cannot resolve an identifier from memory, and cannot see from a reference that its target was
superseded.

**STY-V8 — why the first repair failed.** "Proven by hand" traded one vagueness for another.
The plain phrase is usually the more precise one, and where it is not, the sentence was hiding
a claim it should state.

**Requirements — why questions in a blockquote.** Requirements are read by random access, so each
one is self-contained. Deliberate redundancy is correct there. When requirements were first
rewritten into this shape,
two requirements carried commentary that answered only a peripheral question while the
requirement's purpose was written nowhere. The mandatory first question is what made the hole
visible.

**Requirements — why the body stays generic.** One requirement names the MAC address only in its
disambiguation. Another once carried a whole second program's shape in its body as if it were the
promise. Two more circumlocuted until the two kinds of change they described were named.

**STY-V11 — where the rule came from, and what it measures.** The failure is losing the opening of
the sentence before reaching the next item. A list of items survives a sentence; a list of phrases
does not. One requirement's "two things" was two items in prose, the first running three lines
through a parenthetical and a citation, so the count was lost before the second arrived and the
sentence had to open with "And" to reconnect them. Another's "two other promises" is the same
construction with short items, and reads correctly. The rule's test draws the line between the two,
because only the first has items that are clauses of their own. The rule is also why a verification
bullet is one confirmation per item.

**Requirements — why a single check is still a list.** The verification is read by whoever builds
the test or check that proves the requirement, one check at a time, and a list is what makes each of
them separately actionable. Holding the form constant means a requirement that grows a second check
does not change shape, and a reader never has to notice which form they are looking at.

**STY-S4 — why stability rather than wholeness.** The rule began as a specifications rule,
where the section is the addressable unit and a reference partway through one rots. Generalised
to every document it forbade citing a requirement, which is the unit requirements are read and
cited by. Identifiers exist so that a citation resolves anywhere, and a rule banning their use
defeats them.

**Voice — why twelve.** An earlier style guide grew from under a thousand words to nearly four
thousand in twenty-seven commits, and not one commit reduced it. Every observation was appended;
none was ever absorbed. A cap is the only mechanism that makes a distillation pass do work.

**Lexicon — why it may grow freely.** A table is read by random access, so an extra row costs
nothing to the rows around it. Only Voice is read in bulk and applied per sentence.

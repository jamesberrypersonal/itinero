# Changelog

What has been done, newest first. The live work list, `TODO.md`, numbers each piece of work still
owed, such as TODO-9. An entry that finishes one of those items names it, so a reader can find what
became of its number. `documentation-system.md` sets the rules.

## 2026-11-14 — TODO-12, Itinero's online side runs on Cloudflare

*By:* James Berry, with Claude

Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone
(ADR-0015, Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google
alone). Requests are served by a Cloudflare Worker. Each trip is held in a Durable Object of its
own, which applies its changes one at a time. Accounts and membership are held in a D1 database,
and invitations are sent through Resend. Apple's sign-in was dropped, because offering it on a
website costs $99 a year. Itinero's only running cost is its domain name.

## 2026-11-14 — TODO-10, a trip opens on a home page for each traveller

*By:* James Berry, with Claude

A trip opens on a home page for each traveller (ADR-0014, a trip opens on a home page for each
traveller). A trip has its own first and last dates, and each traveller sets their own within them.
Before their dates, the home page counts the days left. During them, it says which day of their
trip it is. It lists the traveller's bookings for today and the next ones, and links to the page
for the country the phone is in. The phone works out its country itself, and its location never
leaves it. A trip's bookings have a page of their own, and its calendar is seen only by the
travellers an admin chooses (ADR-0013, which supersedes ADR-0010).

## 2026-11-14 — TODO-3, access to a page passes down the tree

*By:* James Berry, with Claude

Access to a page passes down to the pages beneath it (ADR-0012, access to a page passes down to the
pages beneath it). An admin gives each traveller view or edit access to the trip, and it passes to
every page, including pages added later. An admin can change a traveller's access for a branch. A
traveller who may see a page may see every page above it. A new page takes its parent's access,
and a moved page takes its new place's, once the traveller moving it confirms any move that lets
more travellers see it.

## 2026-11-14 — TODO-9, the style guide's final pass from a Claude skill

*By:* James Berry, with Claude

The project skill `final-pass`, in `.claude/skills/final-pass/SKILL.md`, runs the final pass over
the documents a branch changes. The final pass is the list of checks at the end of `style.md` that
every document gets before it is committed. An author starts the skill by typing `/final-pass` in
Claude Code. The skill runs the first three checks itself. It gives the fourth, reading each
document as a newcomer would, to a fresh subagent. That subagent reads only the document and the
documents it declares it assumes. Whoever wrote the documents has seen the work, and cannot read
them as a newcomer. The skill then applies its fixes, and rewraps at 100 columns only the paragraphs
it changed. Last, it runs the documentation checker, `just check-docs`, and the test suites,
`just test-docs`. It asks before it edits a decision record that has been accepted, because an
accepted record is never changed.

## 2026-11-14 — TODO-2, a trip's pages form a tree

*By:* James Berry, with Claude

A trip's pages form a tree, nested to any depth, and any page can link to any other, across
branches (ADR-0011, a trip's pages form a tree, with links between any two). A page holds Markdown
text, with no structure imposed. A traveller creating a trip chooses its countries, and each gets a
page. A stretch or a firm item on the trip's calendar can link to a page. Deleting a page moves it,
with the pages under it, to the trip's graveyard, once the traveller confirms. Each traveller sees
the graveyard as a list of the deleted pages they could see, and only an admin reads or restores a
page in it.

## 2026-11-12 — TODO-8, the documents of a registered component from one command

*By:* James Berry, with Claude

doc-scaffold, the program that starts new documents as skeletons, has a new command,
`just new-docs <system> <slug>`. It starts the documents of a component that was registered in
`components.md` before anyone wrote them. `planner/itinerary` is one, with the system `planner` and
the slug `itinerary`. The command writes whichever of the requirements and the specification is
missing, with their index rows, and takes the prefix and description from the registry. Where it
writes the specification, it also links the component's slug in the registry to it. That is the one
existing line doc-scaffold changes. Every other edit it makes only adds lines.

A new specification from either `just new-docs` or `just new-component` now cites each accepted
decision record whose Consequences section names that specification. The checker requires that
citation, so a new specification adds nothing to the checker's report.

## 2026-11-11 — TODO-1, a new component's documents from one command

*By:* James Berry, with Claude

The scaffolder doc-scaffold starts a new component with `just new-component`. It writes the
component's requirements and specification as skeletons. It also adds the component's rows to the
registry, to the tags of the live work list and to every index. It starts a system with
`just new-system`, a decision record with `just new-decision`, and a guide with `just new-guide`.
What it writes passes the checker, and it marks each part the author still writes with "To be
written". It is a component of its own, `shared/doc-scaffold`. It is built as the checker doc-check
is, in Rust with no third-party packages, and run through `just`. Decision record ADR-0006 records
why the skeletons come from a program of their own, rather than from the checker.

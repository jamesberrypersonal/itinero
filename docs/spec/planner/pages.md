# The pages component

**Assumes** [pages.md](../../requirements/planner/pages.md) — what the pages component promises, and the tree, the graveyard and the links it holds.

## 1. Purpose

The pages component is the component, built as one package, that holds a trip's pages: the tree
they form, the title and text of each, the links between them, and the trip's graveyard. Other
components, such as the web app, use it to start a trip's pages, apply each change to them, resolve
a link, search them, and write each page as text. It works the same in a browser with no connection
as on a server.

## 2. Scope

The pages component covers a trip's pages, the changes that edit them, the graveyard, links to a
page, search, and the text form each page is stored and sent in.

Two things act on it:

- **A caller**, such as the web app, builds changes, applies them, resolves links and searches
  (§3.3).
- **The component holding the copy of each trip online** applies every change a traveller makes,
  stores each page it changes, and sends the changed pages back. That component is not yet
  registered (§8).

Deliberately absent:

- storing a page, or sending a page or a change between devices
- deciding who may see or change a page, or read or restore a page in the graveyard, which is the
  access system's
- showing Markdown as formatted text, which is the web app's
- reading or checking the Markdown of a page's text. The text is kept exactly as written
- images and attached files (ADR-0011, a trip's pages form a tree, with links between any two)
- deleting a page from the graveyard
- listing the pages that link to a page
- merging changes made on two devices while apart (ADR-0004, a trip is read-only offline)

A trip's pages form a tree, and any page can link to any other (ADR-0011). Each page is held as a
record of its own, so that the access system can give each traveller only the pages they may see.
Every change writes exactly one record, even a move or a delete of a page with many pages beneath
it.

The pages component is written in TypeScript, like `planner/itinerary`, the component that holds a
trip's calendar. It is one package that runs unchanged in the browser and on Node.js, the
JavaScript runtime servers use.

## 3. Interface

### 3.1 User interface

None. The pages component has no user interface. The web app shows what its functions return.

### 3.2 Application interface

None. The pages component has no network or service interface. A change reaches the copy of a trip
held online through the component that holds it (§8).

### 3.3 Programming interface

The package `@itinero/pages` exports the types and functions below. Every object a function returns
is frozen. No function changes its arguments. Every function gives a result that depends only on its
arguments.

```ts
import type { Refusal, Result } from "@itinero/trip-time";

type Id = string;            // 1 to 64 of A–Z, a–z, 0–9, "-" and "_", unique within a trip

type Page = { format: 1; id: Id; trip: Id; revision: number;
              parent?: Id;   // absent: at the top of the trip
              order: string; // its place among the pages under its parent (§4.3)
              title: string; text: string;
              buried?: number };   // present: deleted. Higher: deleted later (§4.4)

type Pages = { trip: Id; pages: readonly Page[] };      // every page, ordered by id

type Where = { parent?: Id; after?: Id };   // after absent: first under the parent

type Change =
  | { op: "add";     id: Id; title: string; text?: string; at: Where }
  | { op: "rename";  id: Id; title: string }
  | { op: "write";   id: Id; text: string }
  | { op: "move";    id: Id; to: Where }
  | { op: "bury";    id: Id }
  | { op: "restore"; id: Id };

type Applied = { pages: Pages; written: readonly Page[] };   // written: the records changed

type Branch = { page: Page; under: readonly Branch[] };
type State = "tree" | "graveyard" | "absent";
type Buried = { page: Page; went: number };                  // went: pages that went with it
type Hit = { page: Page; around: readonly { before: string; match: string; after: string }[] };

function newPages(trip: Id, countries: readonly { id: Id; title: string }[]): Result<Pages>;
function apply(pages: Pages, change: Change): Result<Applied>;

function tree(pages: Pages): readonly Branch[];
function state(pages: Pages, id: Id): State;
function page(pages: Pages, id: Id): Page | undefined;
function beneath(pages: Pages, id: Id): number;
function graveyard(pages: Pages): readonly Buried[];
function forPhone(pages: Pages): Pages;

function pageLink(id: Id, words: string): string;
function linkTarget(href: string): Id | undefined;

function search(pages: Pages, words: string): Result<readonly Hit[]>;

function pageToText(page: Page): string;
function pageFromText(text: string): Result<Page>;
function changeToText(change: Change): string;
function changeFromText(text: string): Result<Change>;
```

`Refusal` and `Result` are those of `shared/trip-time`, the component that holds a trip's dates and
times, so a caller handles a refusal from any planner package the same way. A `Result` is
`{ ok: true, value }` on success, and `{ ok: false, refusal }` otherwise. A `Refusal` holds a
`code`, from the table below, and a `message`. A refusal's `message`
is one English sentence saying what was refused and why. A caller may show it to the traveller.

| Refusal code | Returned by | When |
|---|---|---|
| `malformed` | every function returning a `Result` | The fields or the text are not in the form §3.3 or §5.1 gives |
| `bad-id` | `newPages`, `apply` | An identifier outside the form of `Id` |
| `bad-title` | `newPages`, `apply` | A title that is empty once trimmed, or longer than 200 characters |
| `text-length` | `apply` | Text longer than 100,000 characters |
| `duplicate-id` | `newPages`, `apply` | An added page whose identifier the trip already holds, in the tree or the graveyard |
| `unknown-id` | `apply` | A change naming a page the trip does not hold |
| `not-in-tree` | `apply` | A parent or an `after` that is not in the tree |
| `not-a-sibling` | `apply` | An `after` that is not under the parent given |
| `cycle` | `apply` | A move under the page itself, or under a page beneath it |
| `in-graveyard` | `apply` | A `rename`, `write`, `move` or `bury` of a page in the graveyard |
| `not-in-graveyard` | `apply` | A `restore` of a page in the tree |
| `no-words` | `search` | Words that are empty once trimmed |
| `unknown-format` | `pageFromText` | A page whose `format` is not 1 |

A character, wherever a length is counted, is one Unicode code point, so a letter with an accent
written as one code point counts once.

### 3.4 Systems this drives

None. The pages component imports only the types `Refusal` and `Result` from `@itinero/trip-time`,
which `spec/shared/trip-time.md` specifies.

## 4. Behaviour

Behaviour crossing every operation:

- **The tree is worked out, never stored.** A page records only its parent and its order. The pages
  under a parent, and whether a page is in the tree, are worked out from every page's record.
- **A page is in the graveyard** when it, or any page above it, has `buried`. It is in the tree
  otherwise.
- **Nothing reads the device.** No function reads the clock, the time zone or the language the
  device is set to (`PLN:PAGES-NFR1`).

### 4.1 newPages

*Porcelain:* `newPages(trip, countries)` gives a trip's pages, with one page at the top for each
country given, in the order given, each with no text (`PLN:PAGES-F6`). With no countries, it gives
no pages. The caller makes each identifier, as `crypto.randomUUID()` does, and takes each title from
the itinerary's `countries()`, which `spec/planner/itinerary.md` §5.2 gives.

### 4.2 apply

*Porcelain:* `apply(pages, change)` checks the change against the pages, and gives the pages with
the change made. It also gives the records it wrote, each with its `revision` one higher, so that
the copy held online stores only those (`PLN:PAGES-F9`). A change it refuses gives the refusal, and
the pages given are unchanged. Every check is made before anything is changed.

| Change | Effect | Records written | Refused when |
|---|---|---|---|
| `add` | Adds a page at the place `at` gives, with the title and text given, or no text | The new page | `bad-id`, `duplicate-id`, `bad-title`, `text-length`, and any refusal of §4.3 |
| `rename` | Sets the page's title | The page | `unknown-id`, `in-graveyard`, `bad-title` |
| `write` | Sets the page's text | The page | `unknown-id`, `in-graveyard`, `text-length` |
| `move` | Puts the page at the place `to` gives. Every page beneath it moves with it, unwritten | The page | `unknown-id`, `in-graveyard`, `cycle`, and any refusal of §4.3 |
| `bury` | Deletes the page, with every page beneath it (§4.4) | The page | `unknown-id`, `in-graveyard` |
| `restore` | Returns the page to the tree (§4.5) | The page | `unknown-id`, `not-in-graveyard` |

A new page's `revision` is 1. Apart from raising `revision`, a change sets whole fields, and never
adds to or subtracts from them.
Two changes to the same field of one page therefore leave the later one standing.

A title is trimmed of spaces at both ends before it is checked and kept. Text is kept exactly as
given, with nothing trimmed (`PLN:PAGES-F2`).

### 4.3 The order of pages under a parent

*Plumbing:* the pages under one parent are ordered by `order`, comparing code unit by code unit,
then by `id` (`PLN:PAGES-F1`). An `order` is one or more of the 62 characters 0–9, A–Z and a–z,
taken in that order, and never ends in 0. Between any two such strings there is always another, so
a page is placed anywhere without writing the pages around it.

A `Where` is checked as follows:

- its `parent`, where present, is in the tree, or the change is refused with `not-in-tree`
- its `after`, where present, is in the tree, or it is refused with `not-in-tree`
- its `after`, where present, has the parent given, or it is refused with `not-a-sibling`
- for a `move`, its `parent` is not the page itself, nor a page beneath it, or it is refused with
  `cycle`

A page placed at a `Where` takes the shortest `order` that sorts between two neighbours, among the
pages in the tree under that parent:

- the page before it is the page `after` names, or none when `Where` has no `after`
- the page after it is the page that follows its `after` there, or the first page there when
  `Where` has no `after`, or none when no page follows

Where two candidates are equally short, it takes the lower. A page moved after itself keeps its
place, and its record is still written.

### 4.4 Deleting, and the graveyard

*Porcelain:* `beneath(pages, id)` gives the number of pages in the tree beneath a page in the tree,
for the caller to show before it deletes the page (`PLN:PAGES-F3`). It gives 0 for a page not in the
tree.

A `bury` sets the page's `buried` to one more than the highest `buried` any page of the trip holds,
or 1 for the trip's first delete. Nothing else is written. Every page beneath it is then in the
graveyard because a page above it has `buried`, so a branch of any size is deleted by writing one
record.

`graveyard(pages)` lists every page with `buried`, highest `buried` first, so the most recent
delete comes first (`PLN:PAGES-F4`). `went` counts the pages beneath it, stopping at any page that
has `buried` of its own, because that page was deleted before and is listed for itself.

`page(pages, id)` gives any page the trip holds, in the tree or in the graveyard. The caller gives a
page in the graveyard only to an admin. It shows each traveller only the pages of `graveyard` that
the traveller could see before the delete (`PLN:PAGES-NR2`).

### 4.5 Restoring

*Porcelain:* a `restore` returns the page to the tree, with every page beneath it that has no
`buried` of its own (`PLN:PAGES-F4`). It removes the page's `buried`, if it has one. Then:

- where its parent is in the tree, or it has none, its `parent` and `order` are kept, so it returns
  to its old place
- where its parent is in the graveyard, its `parent` is removed, and it takes an `order` after every
  page at the top of the trip

A page in the graveyard only because a page above it was deleted can be restored on its own. Its
parent is then in the graveyard, so it returns to the top of the trip.

### 4.6 Links

*Porcelain:* a link to a page is a Markdown link whose destination is `page:` followed by the page's
identifier (`PLN:PAGES-F5`). A link to the page `a17f`, showing the words "the city", is written:

```markdown
[the city](page:a17f)
```

Every Markdown reader shows it as a link, because the form is a standard inline link. Nothing in the
link holds the page's title or place, so a rename, a move, a delete or a restore leaves it naming
its page.

- `pageLink(id, words)` writes the link, putting a backslash before each `\`, `[` and `]` in the
  words.
- `linkTarget(href)` gives the identifier in a link's destination where it is `page:` followed by an
  identifier, and `undefined` otherwise. The web app calls it for each link it shows.
- `state(pages, id)` says whether the page named is in the tree, in the graveyard, or not held.

The trip's calendar, which `planner/itinerary` holds, names a page by the same identifier, from a
stretch or a firm item (`PLN:ITINERARY-F9`). A stretch is a place and the dates a traveller expects
to be there, and a firm item is something fixed to a date. The caller resolves the page each names
with `state` in the same way. On a phone with no
connection, the pages of `forPhone` hold no graveyard, so a page in the graveyard is `absent`
there. The web app shows it as not on the phone.

### 4.7 Search

*Porcelain:* `search(pages, words)` lists every page in the tree whose title or text holds the
words, in the order of the tree: each page, then the pages under it, in their order
(`PLN:PAGES-F7`). It refuses, with `no-words`, words that are empty once trimmed.

The words and each page's title and text are folded before they are compared:

1. every run of spaces, tabs and line ends becomes one space, and the words are trimmed
2. each character is decomposed, as Unicode normalisation form NFD does, and every combining mark
   is dropped, so that "í" matches "i"
3. each character is changed to its lower case by the Unicode default case mapping, which depends
   on no language, so that "İ" and "I" each become "i" on every device (`PLN:PAGES-NFR1`)

Folding keeps, for each folded character, its position in the original text, so that the words
around a match are given as written. A page matches where its folded title or folded text holds the
folded words. For each page, `around` gives up to three matches, earliest first, the title before
the text. Each gives the match as written, and up to 40 characters on either side of it, cut back to
the nearest space.

### 4.8 The text form

*Porcelain:* `pageToText` and `changeToText` write a page and a change as the JSON of §5.1.
`pageFromText` and `changeFromText` read them back (`PLN:PAGES-F8`). Reading checks the form, and
does not apply the checks of §4.2 again, so a page stored once can always be read back.
`pageFromText(pageToText(p))` gives a page equal to `p`, and the same page always gives the same
text.

`forPhone(pages)` gives the same trip's pages with every page in the graveyard left out. The caller
keeps on the phone the pages `forPhone` gives, less any page the traveller may not see (ADR-0004).

### 4.9 The test suite

The suite runs with `npm test` in `packages/pages/`, using Node's built-in test runner. The recipe
`just test-pages`, of just, the command runner the repository uses, runs it from anywhere in the
repository.

- **Unit tests** cover each refusal of §3.3, each row of the table of §4.2, and every check in the
  verification of each requirement the pages component claims.
- **Order tests** apply the same changes to two copies of a trip's pages, and confirm the two are
  equal (`PLN:PAGES-F9`). They also place a thousand pages, each before the last placed, and
  confirm every `order` stays in the form of §4.3.
- **Round-trip tests** confirm that a page with every field, and text holding every kind of
  character, reads back equal to itself (`PLN:PAGES-F8`).
- **Device independence tests** run the search tests with the `LANG` environment variable set to
  `en_GB.UTF-8` and to `tr_TR.UTF-8`, and the `TZ` variable set to `Europe/London` and to
  `Asia/Tokyo`, and confirm every result is the same (`PLN:PAGES-NFR1`).

## 5. Resources

### 5.1 The text form of a page

A page is one JSON object, and a trip's pages are stored as one such object for each page. Keys are
written in sorted order. A page in the tree and a page in the graveyard read:

```json
{ "format": 1, "id": "a17f", "order": "V", "parent": "c3e2", "revision": 4,
  "text": "Try the empanadas in Valparaíso. See [transport](page:d81b).",
  "title": "Eating in Santiago", "trip": "6f1e" }
```

```json
{ "buried": 3, "format": 1, "id": "c3e2", "order": "a", "revision": 7,
  "text": "", "title": "Santiago", "trip": "6f1e" }
```

A change is written the same way, as an object holding its `op` and its fields.

| Resource | Path | Owned by |
|---|---|---|
| The package | `packages/pages/` | Whoever keeps the planner's roadmap |
| The npm workspace membership | `packages/pages` in the workspaces of `package.json` at the repository root | Whoever keeps the planner's roadmap |
| The recipe | `test-pages`, in the `justfile` at the repository root | Whoever keeps the planner's roadmap |

The package imports only types from `@itinero/trip-time`, so it has no runtime dependency. Its
development dependencies are `@itinero/trip-time`, TypeScript and Node's type definitions.

## 6. Quality attributes

- **Offline** (`PLN:PAGES-NFR1`). The pages component holds no network code. Every function works
  from its arguments alone.
- **The same on every device** (`PLN:PAGES-NFR1`). Nothing reads the device's clock, time zone or
  language, and search folds text with mappings that depend on no language (§4.7). The tests of
  §4.9 run under two languages and two time zones.
- **Deterministic** (`PLN:PAGES-F9`). The same changes, applied in the same order, give equal pages.
  The same page always gives the same text.
- **One record per change.** Every change writes exactly one record, however large the branch it
  moves, deletes or restores (§4.2).
- **Bounded.** A page's text holds at most 100,000 characters, so a search reads at most that much
  of each page (`PLN:PAGES-F2`).
- **Nothing is lost by a delete** (`PLN:PAGES-F4`). A page in the graveyard keeps its title, its
  text and its parent, and no change removes a page from the trip.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [PLN:PAGES-F1](../../requirements/planner/pages.md#^pln-pages-f1) | The `add`, `rename` and `move` changes of §4.2, the `cycle` refusal, and the order of §4.3. |
| [PLN:PAGES-F2](../../requirements/planner/pages.md#^pln-pages-f2) | The `bad-title` and `text-length` refusals of §3.3, and text kept exactly as given, in §4.2. |
| [PLN:PAGES-F3](../../requirements/planner/pages.md#^pln-pages-f3) | `beneath` and the `bury` change, in §4.4, and the `in-graveyard` refusal. |
| [PLN:PAGES-F4](../../requirements/planner/pages.md#^pln-pages-f4) | `graveyard` and `page`, in §4.4, and the `restore` change of §4.5. |
| [PLN:PAGES-F5](../../requirements/planner/pages.md#^pln-pages-f5) | The link form, `pageLink`, `linkTarget` and `state`, in §4.6. |
| [PLN:PAGES-F6](../../requirements/planner/pages.md#^pln-pages-f6) | `newPages`, in §4.1. |
| [PLN:PAGES-F7](../../requirements/planner/pages.md#^pln-pages-f7) | `search` and its folding, in §4.7. |
| [PLN:PAGES-F8](../../requirements/planner/pages.md#^pln-pages-f8) | The text form of §4.8 and §5.1, and `forPhone`. |
| [PLN:PAGES-F9](../../requirements/planner/pages.md#^pln-pages-f9) | `apply`, with every check made before anything is changed, in §4.2. Applying each change to the copy held online is the component that holds it, which is not yet registered. |
| [PLN:PAGES-NFR1](../../requirements/planner/pages.md#^pln-pages-nfr1) | No network code, and never reading the device (§4, §6). Keeping a copy on the phone is the web app, whose specification is not yet written. |
| [PLN-F7](../../requirements/planner/planner.md#^pln-f7) | Pages with a title and Markdown text, kept as written (§4.2). Showing the text formatted is the web app. |
| [PLN-F8](../../requirements/planner/planner.md#^pln-f8) | The tree, moves and deletes (§4.2 to §4.4). Asking the traveller to confirm a delete is the web app. |
| [PLN-F9](../../requirements/planner/planner.md#^pln-f9) | Links that name their page, resolved with `state` (§4.6). Opening a page from a link is the web app. |
| [PLN-F10](../../requirements/planner/planner.md#^pln-f10) | A page for each country given to `newPages` (§4.1). Choosing the countries is the web app. |
| [PLN-F11](../../requirements/planner/planner.md#^pln-f11) | `state`, for the page a stretch or a firm item names (§4.6). Naming the page is `planner/itinerary`. |
| [PLN-F12](../../requirements/planner/planner.md#^pln-f12) | `search`, over the pages of `forPhone` with no connection (§4.7, §4.8). Showing the results is the web app. |
| [PLN-F13](../../requirements/planner/planner.md#^pln-f13) | `graveyard`, `page` and `restore` (§4.4, §4.5). Refusing a traveller who is not an admin is the access system, whose requirements are not yet written. |

## 8. Open

- **Where the copy of a trip's pages held online lives.** No component holds it yet. That
  component applies every change with `apply`, stores the records each change writes, and sends
  each changed page to every traveller who may see it. It is the same component that holds the
  itinerary's copy online, and is to be registered in Milestone Planner-0.3.
- **Two travellers writing one page at once.** A `write` sets the whole text. Of two travellers
  editing the same page at the same time, the later write stands, and the other's work is lost.
  One remedy is for a `write` to name the `revision` it was made against, and be refused where the
  page has changed since. It is not decided.
- **A page whose parent a traveller may not see.** The access system gives each traveller only the
  pages they may see, so a page can arrive without its parent. Whether access to a page passes to
  the pages beneath it, and so where such a page sits, is not decided until TODO-3 is done.

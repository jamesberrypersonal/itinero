// @itinero/pages: a trip's pages, the tree they form, their links, the graveyard, and search.
// docs/spec/planner/pages.md specifies it, and its section numbers are cited throughout.

export type { Applied, Around, Branch, Buried, Change, Hit, Id, Page, Pages, Refusal, Result, State, Where } from "./types.ts";

export { newPages, apply } from "./apply.ts";
export { startingText } from "./starting.ts";
export { tree, state, page, beneath, graveyard, forPhone, countryPage } from "./tree.ts";
export { pageLink, linkTarget } from "./links.ts";
export { search } from "./search.ts";
export { pageToText, pageFromText, changeToText, changeFromText } from "./text.ts";

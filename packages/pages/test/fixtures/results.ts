// Prints, as JSON, what a set of searches finds. independence.test.ts runs it under two languages
// and two time zones.

import { search } from "../../src/index.ts";
import { applyAll, chile, ok } from "../helpers.ts";

const pages = applyAll(
  chile("Try the empanadas in Valparaíso. İstanbul next, then ISTANBUL again, and ıstanbul."),
  { op: "add", id: "turkey", title: "İstanbul", text: "Istanbul, Kadıköy, KADIKÖY", at: {} },
);
const results = ["İstanbul", "istanbul", "ISTANBUL", "kadikoy", "VALPARAISO", "santiago"].map((words) =>
  ok(search(pages, words)).map((hit) => [hit.page.id, hit.around]),
);
console.log(JSON.stringify(results));

// The text a new page starts with (spec §4.1).

/** The headings every new page starts with, each with its level. */
const PAGE: readonly (readonly [number, string])[] = [
  [2, "General Info"],
  [2, "Getting Around"],
  [2, "Things to Do"],
  [2, "Places to See"],
  [2, "Food to Eat"],
  [3, "Dishes to Try"],
  [3, "Where to Eat"],
  [2, "Nightlife"],
];

/** A country's page holds one more, last. */
const COUNTRY: readonly (readonly [number, string])[] = [...PAGE, [2, "Emergency Info"]];

function write(headings: readonly (readonly [number, string])[]): string {
  return headings.map(([level, title]) => `${"#".repeat(level)} ${title}\n`).join("\n");
}

const TEXT = { page: write(PAGE), country: write(COUNTRY) } as const;

export function startingText(kind: "page" | "country"): string {
  return TEXT[kind];
}

// Which countries a device needs the towns of (docs/spec/web/places.md §4.1). Kept apart from the
// browser's APIs, so that Node's test runner tests it.

/** What the places component reads of a trip's copy, as web/trip-store gives it. */
export type CopyCountries = {
  pages: { pages: readonly { country?: string }[] };
  /** Absent where the traveller is not granted the calendar. */
  calendar?: { stretches: readonly { place: { country: string } }[] };
};

/**
 * The countries a device's trips visit: the country of every page made for one, and of every
 * stretch, in each copy that holds the calendar, with those a traveller chose, in byte order.
 */
export function countriesOf(copies: Iterable<CopyCountries>, chosen: Iterable<string> = []): string[] {
  const countries = new Set<string>(chosen);
  for (const copy of copies) {
    for (const page of copy.pages.pages) if (page.country) countries.add(page.country);
    for (const stretch of copy.calendar?.stretches ?? []) countries.add(stretch.place.country);
  }
  return [...countries].filter((country) => /^[A-Z]{2}$/.test(country)).sort();
}

// Finding a place in the files the places component holds (docs/spec/web/places.md §4.2, §4.3, §5.1).
// Kept apart from the browser's APIs, so that Node's test runner tests it.

export type Place = {
  kind: "airport" | "town";
  /** Such as "Puerto Natales", or "Arturo Merino Benítez International Airport". */
  name: string;
  /** An airport's three-letter code, such as "SCL". */
  code?: string;
  /** An airport's town, such as "Santiago". */
  town?: string;
  /** A town's region, such as "Magallanes". */
  region?: string;
  /** An ISO 3166-1 alpha-2 code, such as "CL". */
  country: string;
  /** A time zone, such as "America/Punta_Arenas". */
  zone: string;
};

/** A country's towns: its name, its region's name, its zone's place in `zones`, and its population. */
export type TownsFile = {
  country: string;
  towns: readonly (readonly [string, string, number, number])[];
  version: string;
  zones: readonly string[];
};

/** Every airport: its code, name, town, country, and its zone's place in `zones`, ordered by code. */
export type AirportsFile = {
  airports: readonly (readonly [string, string, string, string, number])[];
  version: string;
  zones: readonly string[];
};

/** The list's version, and the size of each country's file. */
export type IndexFile = { countries: Readonly<Record<string, number>>; version: string };

/**
 * Folds a text for matching: decomposed into Unicode's NFD form, every combining mark dropped, and
 * made lower case, so `Valparaíso` folds to `valparaiso`.
 */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The words of a folded text: its runs of letters and digits. */
function wordsOf(folded: string): string[] {
  return folded.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "");
}

/** A country's towns, with every name folded once, when the country is read (§4.3, WEB:PLACES-NFR1). */
export class TownIndex {
  readonly country: string;
  readonly version: string;
  private readonly file: TownsFile;
  private readonly folded: string[];
  private readonly words: string[][];

  constructor(file: TownsFile) {
    this.country = file.country;
    this.version = file.version;
    this.file = file;
    this.folded = file.towns.map(([name]) => fold(name));
    this.words = this.folded.map(wordsOf);
  }

  get size(): number {
    return this.file.towns.length;
  }

  /** Every town matching the folded words, as matches to be ordered. */
  collect(query: readonly string[], into: Match[]): void {
    const first = query[0]!;
    for (let i = 0; i < this.folded.length; i++) {
      const name = this.folded[i]!;
      if (!name.includes(first)) continue;
      const words = this.words[i]!;
      if (!query.every((word) => words.some((own) => own.startsWith(word)))) continue;
      const [, , , population] = this.file.towns[i]!;
      into.push({ index: this, at: i, begins: name.startsWith(first), population, name: this.file.towns[i]![0] });
    }
  }

  place(at: number): Place {
    const [name, region, zone] = this.file.towns[at]!;
    return { kind: "town", name, region, country: this.country, zone: this.file.zones[zone]! };
  }
}

type Match = { index: TownIndex; at: number; begins: boolean; population: number; name: string };

/**
 * The towns matching `words`, at most `limit`: every word must begin some word of the town's name,
 * in any order. Towns whose name begins with the first word come first, then the larger, then by
 * name (§4.3).
 */
export function searchTowns(indexes: Iterable<TownIndex>, words: string, limit = 10): Place[] {
  const query = wordsOf(fold(words));
  if (query.length === 0 || limit <= 0) return [];
  const matches: Match[] = [];
  for (const index of indexes) index.collect(query, matches);
  matches.sort(
    (a, b) =>
      Number(b.begins) - Number(a.begins) ||
      b.population - a.population ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.index.country < b.index.country ? -1 : a.index.country > b.index.country ? 1 : 0),
  );
  return matches.slice(0, limit).map((match) => match.index.place(match.at));
}

/** The airport whose code is `code`, in capitals, or undefined (§4.2). */
export function findAirport(file: AirportsFile, code: string): Place | undefined {
  const wanted = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(wanted)) return undefined;
  // The airports are ordered by code, so a binary search finds one.
  let low = 0;
  let high = file.airports.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const row = file.airports[mid]!;
    if (row[0] === wanted) {
      const [code, name, town, country, zone] = row;
      return { kind: "airport", name, code, town, country, zone: file.zones[zone]! };
    }
    if (row[0] < wanted) low = mid + 1;
    else high = mid - 1;
  }
  return undefined;
}

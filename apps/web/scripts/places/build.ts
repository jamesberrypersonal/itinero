// The build of the places' files (docs/spec/web/places.md §4.5): every country's towns from
// GeoNames, and every airport from OurAirports, each given the time zone of the nearest town in its
// country. The same downloaded files always give the same bytes.

/** The files the build writes, by name, such as "CL.json", in byte order of their names. */
export type Built = Map<string, string>;

export type Sources = {
  /** GeoNames' cities1000.txt: every town of 1,000 people or more, tab-separated. */
  cities: string;
  /** GeoNames' admin1CodesASCII.txt: the name of each country's regions, tab-separated. */
  regions: string;
  /** OurAirports' airports.csv. */
  airports: string;
  /** The date the GeoNames files were downloaded, such as "2026-11-14", the list's version. */
  version: string;
};

type Town = {
  id: number;
  name: string;
  region: string;
  country: string;
  zone: string;
  population: number;
  lat: number;
  lon: number;
};

type Airport = { code: string; name: string; town: string; country: string; zone: string };

/** OurAirports' types, best first, for choosing between two airports given one code. */
const TYPE_RANK: Record<string, number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
  seaplane_base: 3,
  heliport: 4,
  balloonport: 5,
};

export function buildPlaces(sources: Sources): Built {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sources.version)) throw new Error(`The version ${sources.version} is not a date`);
  const regions = readRegions(sources.regions);
  const towns = readTowns(sources.cities, regions);
  const byCountry = new Map<string, Town[]>();
  for (const town of towns) {
    const list = byCountry.get(town.country) ?? [];
    list.push(town);
    byCountry.set(town.country, list);
  }

  const files: [string, string][] = [];
  const sizes: [string, number][] = [];
  for (const country of [...byCountry.keys()].sort()) {
    const list = byCountry.get(country)!.sort(byPopulation);
    const zones = zoneList(list.map((town) => town.zone));
    const text = json({
      country,
      towns: list.map((town) => [town.name, town.region, zones.index.get(town.zone)!, town.population]),
      version: sources.version,
      zones: zones.list,
    });
    files.push([`${country}.json`, text]);
    sizes.push([country, Buffer.byteLength(text)]);
  }

  const airports = readAirports(sources.airports, byCountry);
  const airportZones = zoneList(airports.map((airport) => airport.zone));
  files.push([
    "airports.json",
    json({
      airports: airports.map((a) => [a.code, a.name, a.town, a.country, airportZones.index.get(a.zone)!]),
      version: sources.version,
      zones: airportZones.list,
    }),
  ]);
  files.push(["index.json", json({ countries: Object.fromEntries(sizes), version: sources.version })]);

  return new Map(files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** JSON with no white space, keys in the order given, which the callers give sorted. */
function json(value: unknown): string {
  return JSON.stringify(value);
}

function zoneList(zones: string[]): { list: string[]; index: Map<string, number> } {
  const index = new Map<string, number>();
  for (const zone of zones) if (!index.has(zone)) index.set(zone, index.size);
  return { list: [...index.keys()], index };
}

function byPopulation(a: Town, b: Town): number {
  return b.population - a.population || compareText(a.name, b.name) || a.id - b.id;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function readRegions(text: string): Map<string, string> {
  const regions = new Map<string, string>();
  for (const line of text.split("\n")) {
    const fields = line.split("\t");
    if (fields.length >= 2 && fields[0]) regions.set(fields[0], fields[1]!.trim());
  }
  return regions;
}

function readTowns(text: string, regions: Map<string, string>): Town[] {
  const towns: Town[] = [];
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const f = line.split("\t");
    const country = f[8] ?? "";
    const zone = f[17] ?? "";
    if (!/^[A-Z]{2}$/.test(country) || zone === "") continue;
    towns.push({
      id: Number(f[0]),
      name: f[1]!.trim(),
      region: regions.get(`${country}.${f[10]}`) ?? "",
      country,
      zone,
      population: Number(f[14]) || 0,
      lat: Number(f[4]),
      lon: Number(f[5]),
    });
  }
  return towns;
}

function readAirports(text: string, towns: Map<string, Town[]>): Airport[] {
  const rows = readCsv(text);
  const header = rows.shift() ?? [];
  const at = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`airports.csv has no column ${name}`);
    return index;
  };
  const col = {
    id: at("id"),
    type: at("type"),
    name: at("name"),
    lat: at("latitude_deg"),
    lon: at("longitude_deg"),
    country: at("iso_country"),
    town: at("municipality"),
    scheduled: at("scheduled_service"),
    iata: at("iata_code"),
  };

  type Candidate = Airport & { rank: number; scheduled: boolean; id: number };
  const best = new Map<string, Candidate>();
  for (const row of rows) {
    const code = (row[col.iata] ?? "").trim();
    const type = row[col.type] ?? "";
    const country = row[col.country] ?? "";
    if (!/^[A-Z]{3}$/.test(code) || type === "closed") continue;
    const inCountry = towns.get(country);
    if (!inCountry) continue;
    const nearest = nearestTown(inCountry, Number(row[col.lat]), Number(row[col.lon]));
    const candidate: Candidate = {
      code,
      name: (row[col.name] ?? "").trim(),
      town: (row[col.town] ?? "").trim(),
      country,
      zone: nearest.zone,
      rank: TYPE_RANK[type] ?? 9,
      scheduled: row[col.scheduled] === "yes",
      id: Number(row[col.id]),
    };
    const held = best.get(code);
    if (!held || better(candidate, held)) best.set(code, candidate);
  }
  return [...best.values()]
    .sort((a, b) => compareText(a.code, b.code))
    .map(({ code, name, town, country, zone }) => ({ code, name, town, country, zone }));
}

/** Of two airports given one code, the one scheduled flights use, then the larger, then the first listed. */
function better(a: { rank: number; scheduled: boolean; id: number }, b: { rank: number; scheduled: boolean; id: number }): boolean {
  if (a.scheduled !== b.scheduled) return a.scheduled;
  if (a.rank !== b.rank) return a.rank < b.rank;
  return a.id < b.id;
}

/** The town nearest a point, measured along the earth's surface. */
function nearestTown(towns: Town[], lat: number, lon: number): Town {
  let nearest = towns[0]!;
  let least = Infinity;
  for (const town of towns) {
    const d = haversine(lat, lon, town.lat, town.lon);
    if (d < least || (d === least && town.id < nearest.id)) {
      least = d;
      nearest = town;
    }
  }
  return nearest;
}

/** The central angle between two points, which orders distances along the earth's surface. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Reads CSV as RFC 4180 writes it: fields in double quotes may hold commas, newlines and doubled quotes. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

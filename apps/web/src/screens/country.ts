// Finding the country a position is in, on the phone, from the map of country borders
// (docs/spec/web/screens.md §4.3, §5.1). Kept apart from the browser's APIs, so that Node's test
// runner tests it. Neither the position nor the country found leaves the phone (WEB-F6).

export type Borders = Record<string, { box: readonly [number, number, number, number]; rings: readonly (readonly number[])[] }>;

/**
 * Whether a point is inside a ring, a flat list of longitude, latitude pairs: a ray cast east
 * from the point crosses the ring an odd number of times.
 */
function inside(ring: readonly number[], lon: number, lat: number): boolean {
  let crossings = 0;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2]!;
    const yi = ring[i * 2 + 1]!;
    const xj = ring[j * 2]!;
    const yj = ring[j * 2 + 1]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) crossings++;
  }
  return crossings % 2 === 1;
}

/** How near a coast or border a position at sea still counts as in the country, in degrees: about 10 kilometres. */
const NEAR = 0.09;

/** The distance in degrees, with longitude scaled to its latitude, from a point to a ring's nearest edge. */
function distanceTo(ring: readonly number[], lon: number, lat: number, scale: number): number {
  let least = Infinity;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const ax = ring[j * 2]! * scale;
    const ay = ring[j * 2 + 1]!;
    const bx = ring[i * 2]! * scale;
    const by = ring[i * 2 + 1]!;
    const px = lon * scale;
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy)));
    least = Math.min(least, Math.hypot(px - (ax + t * dx), lat - (ay + t * dy)));
  }
  return least;
}

const area = ([west, south, east, north]: readonly [number, number, number, number]) => (east - west) * (north - south);

/**
 * The ISO 3166-1 alpha-2 code of the country holding a position, or undefined, such as at sea.
 * Where two countries hold it, as Italy and Vatican City do, the smaller is the one: an enclave is
 * drawn inside the country around it. The map draws each coast coarsely, so a position at sea within
 * about 10 kilometres of a country counts as in the nearest one.
 */
export function countryAt(borders: Borders, lon: number, lat: number): string | undefined {
  let found: { code: string; area: number } | undefined;
  for (const [code, country] of Object.entries(borders)) {
    const [west, south, east, north] = country.box;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    // Inside an odd number of the country's rings: inside an outline, and not in a hole.
    let count = 0;
    for (const ring of country.rings) if (inside(ring, lon, lat)) count++;
    if (count % 2 === 1 && (!found || area(country.box) < found.area)) found = { code, area: area(country.box) };
  }
  if (found) return found.code;

  const scale = Math.cos((lat * Math.PI) / 180);
  let nearest: { code: string; distance: number } | undefined;
  for (const [code, country] of Object.entries(borders)) {
    const [west, south, east, north] = country.box;
    if (lon < west - NEAR / scale || lon > east + NEAR / scale || lat < south - NEAR || lat > north + NEAR) continue;
    for (const ring of country.rings) {
      const distance = distanceTo(ring, lon, lat, scale);
      if (distance <= NEAR && (!nearest || distance < nearest.distance)) nearest = { code, distance };
    }
  }
  return nearest?.code;
}

let loaded: Promise<Borders> | undefined;

/** The map, read into memory only once the traveller first asks for their country (§5.1). */
export function loadBorders(): Promise<Borders> {
  loaded ??= import("./borders.json").then((module) => module.default as unknown as Borders);
  return loaded;
}

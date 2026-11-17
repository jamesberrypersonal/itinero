// The build of the map of country borders (docs/spec/web/screens.md §5.1): Natural Earth's
// countries at 1:50 million, read from its shapefile and its attribute table, written as each
// country's rings with coordinates rounded to two decimal places, and its bounding box.

/** One country: its bounding box, west, south, east and north, and its rings, each a flat list of longitude, latitude pairs. */
export type Country = { box: [number, number, number, number]; rings: number[][] };
export type Borders = Record<string, Country>;

type Polygon = { rings: [number, number][][] };

/** Reads the polygons of an ESRI shapefile, in the order of its records. Any other shape is read as none. */
export function readShapes(shp: Uint8Array): (Polygon | undefined)[] {
  const view = new DataView(shp.buffer, shp.byteOffset, shp.byteLength);
  const shapes: (Polygon | undefined)[] = [];
  let at = 100; // past the file header
  while (at + 8 <= shp.byteLength) {
    const length = view.getInt32(at + 4, false) * 2; // in 16-bit words, big-endian
    const content = at + 8;
    const type = view.getInt32(content, true);
    if (type === 5 || type === 15 || type === 25) {
      const parts = view.getInt32(content + 36, true);
      const points = view.getInt32(content + 40, true);
      const starts: number[] = [];
      for (let i = 0; i < parts; i++) starts.push(view.getInt32(content + 44 + i * 4, true));
      const xy = content + 44 + parts * 4;
      const rings: [number, number][][] = [];
      for (let p = 0; p < parts; p++) {
        const end = p + 1 < parts ? starts[p + 1]! : points;
        const ring: [number, number][] = [];
        for (let i = starts[p]!; i < end; i++) ring.push([view.getFloat64(xy + i * 16, true), view.getFloat64(xy + i * 16 + 8, true)]);
        rings.push(ring);
      }
      shapes.push({ rings });
    } else {
      shapes.push(undefined);
    }
    at = content + length;
  }
  return shapes;
}

/** Reads one field of every record of a dBASE table, as text. */
export function readField(dbf: Uint8Array, field: string): string[] {
  const view = new DataView(dbf.buffer, dbf.byteOffset, dbf.byteLength);
  const records = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const decoder = new TextDecoder("utf-8");
  let offset = 1; // past each record's deletion flag
  let found: { offset: number; length: number } | undefined;
  for (let at = 32; dbf[at] !== 0x0d && at < headerLength; at += 32) {
    const name = decoder.decode(dbf.subarray(at, at + 11)).replace(/\0.*$/s, "");
    const length = dbf[at + 16]!;
    if (name === field) found = { offset, length };
    offset += length;
  }
  if (!found) throw new Error(`The table has no field ${field}`);
  const values: string[] = [];
  for (let r = 0; r < records; r++) {
    const start = headerLength + r * recordLength + found.offset;
    values.push(decoder.decode(dbf.subarray(start, start + found.length)).replace(/\0/g, "").trim());
  }
  return values;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The map: each country by its ISO 3166-1 alpha-2 code, in byte order of the codes. */
export function buildBorders(shp: Uint8Array, dbf: Uint8Array): Borders {
  const shapes = readShapes(shp);
  const codes = readField(dbf, "ISO_A2_EH");
  const byCode = new Map<string, number[][]>();
  shapes.forEach((shape, i) => {
    const code = codes[i] ?? "";
    if (!shape || !/^[A-Z]{2}$/.test(code)) return;
    const rings = byCode.get(code) ?? [];
    for (const ring of shape.rings) {
      const flat: number[] = [];
      for (const [x, y] of ring) {
        const lon = round(x);
        const lat = round(y);
        // A point that rounds onto the one before adds nothing.
        if (flat.length >= 2 && flat[flat.length - 2] === lon && flat[flat.length - 1] === lat) continue;
        flat.push(lon, lat);
      }
      if (flat.length >= 6) rings.push(flat);
    }
    byCode.set(code, rings);
  });
  const borders: Borders = {};
  for (const code of [...byCode.keys()].sort()) {
    const rings = byCode.get(code)!;
    let west = 180;
    let south = 90;
    let east = -180;
    let north = -90;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        west = Math.min(west, ring[i]!);
        east = Math.max(east, ring[i]!);
        south = Math.min(south, ring[i + 1]!);
        north = Math.max(north, ring[i + 1]!);
      }
    }
    borders[code] = { box: [west, south, east, north], rings };
  }
  return borders;
}

// Draws Itinero's icons into public/icons/ (docs/spec/web/shell.md §4.3): a white map pin on a teal
// field, at the sizes a phone's home screen and the web app manifest ask for. It uses no library:
// each pixel is sampled 16 times against the pin's shape, and written as a PNG with node:zlib.
//
//     node scripts/icons.ts
//
// The icons are committed, so this runs only when the design changes.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const TOP = [20, 128, 120] as const; // the field's colour at the top, a light teal
const BOTTOM = [12, 86, 92] as const; // and at the bottom, a deep one

/** Whether a point, in a square of side 1, lies on a pin of the given height, centred in the square. */
function onPin(x: number, y: number, height: number): boolean {
  const r = height * 0.36; // the head's radius
  const cx = 0.5;
  const cy = 0.5 - height / 2 + r; // the head's centre
  const tipY = 0.5 + height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const fromCentre = Math.hypot(dx, dy);
  if (fromCentre <= r * 0.42) return false; // the hole in the head
  if (fromCentre <= r) return true;
  // The tail: the region between the tangents from the tip to the head, below the head's centre.
  if (y < cy || y > tipY) return false;
  const d = tipY - cy;
  const half = Math.asin(r / d); // the half-angle at the tip
  const angle = Math.atan2(Math.abs(dx), tipY - y);
  return angle <= half && Math.hypot(dx, tipY - y) <= Math.sqrt(d * d - r * r);
}

function draw(size: number, pinHeight: number): Buffer {
  const rows: Buffer[] = [];
  const samples = 4;
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte 0, then RGB
    const t = py / (size - 1);
    const field = TOP.map((top, i) => top + (BOTTOM[i]! - top) * t);
    for (let px = 0; px < size; px++) {
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (onPin((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size, pinHeight)) covered++;
        }
      }
      const a = covered / (samples * samples);
      for (let i = 0; i < 3; i++) row[1 + px * 3 + i] = Math.round(field[i]! * (1 - a) + 255 * a);
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

function png(size: number, raw: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A maskable icon may be cut to a circle of 80% of its side, so its pin is smaller.
const icons: [string, number, number][] = [
  ["icon-192.png", 192, 0.56],
  ["icon-512.png", 512, 0.56],
  ["maskable-512.png", 512, 0.46],
  ["apple-touch-icon.png", 180, 0.56],
  ["favicon-32.png", 32, 0.7],
];
for (const [name, size, height] of icons) writeFileSync(join(out, name), draw(size, height));
console.log(`Wrote ${icons.length} icons to ${out}`);

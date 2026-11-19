// Makes a trip of 500 pages and 300 bookings on a running online side, for the timing checks made
// by hand on a phone (WEB-NFR1, WEB:SHELL-NFR1, WEB:STORE-NFR1, WEB:SCREENS-NFR1, BKG-NFR1). The
// trip is the one the browser tests time: two country pages and 498 more, 48 at the top and the rest
// beneath them, and 300 bookings of the four kinds, each naming the traveller signed in.
//
//     ITINERO_SESSION=<value> npm run fill-trip -- https://useitinero.ca
//
// The session is the value of the `itinero_session` cookie of a browser signed in to that site,
// copied from the browser's developer tools. It is read from the environment, so that it stays out
// of the shell's history when set with a leading space or read from a file. The script prints the
// trip's address. Delete the trip when the checks are done, since nothing else uses it.

import { changeToText as bookingChange } from "@itinero/bookings";
import { changeToText as pageChange } from "@itinero/pages";

const site = process.argv[2]?.replace(/\/+$/, "");
const session = process.env["ITINERO_SESSION"];
if (!site || !/^https?:\/\//.test(site) || !session) {
  console.error("fill-trip: give the site's address, and set ITINERO_SESSION, as this script's opening comment says.");
  process.exit(2);
}

const headers = { "Itinero-Api": "1", "Content-Type": "application/json", Cookie: `itinero_session=${session}` };

async function call(path: string, body: unknown): Promise<unknown> {
  const answer = await fetch(`${site}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await answer.text();
  if (!answer.ok) throw new Error(`${path} answered ${answer.status}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}

const SANTIAGO = "America/Santiago";
const PUNTA_ARENAS = "America/Punta_Arenas";
const exact = (zone: string, date: string, time: string) => ({ kind: "exact" as const, zone, date, at: { time } });
const december = (day: number) => `2026-12-${String(day).padStart(2, "0")}`;

const { trip } = (await call("/api/trips", { name: "Timing trip, 500 pages", first: "2026-12-01", last: "2026-12-20", countries: ["CL", "AR"] })) as { trip: string };
const copy = (await call(`/api/trips/${trip}/sync`, { holdsCalendar: false })) as { you: { grant: { traveller: string } } };
const account = copy.you.grant.traveller;

const changes: { target: string; change: string }[] = [];
for (let i = 0; i < 498; i++) {
  changes.push({
    target: "pages",
    change: pageChange({ op: "add", id: `p-${i}`, title: `Page ${i}`, text: "Torres del Paine, the W trek. ".repeat(40), at: i < 48 ? {} : { parent: `p-${i % 48}` } }),
  });
}
const kinds = [
  (i: number) => ({ kind: "activity", sort: "tour", title: `Tour ${i}`, starts: exact(SANTIAGO, december(1 + (i % 20)), "09:00") }),
  (i: number) => ({ kind: "stay", name: `Stay ${i}`, checkIn: { kind: "date", zone: SANTIAGO, date: december(1 + (i % 19)) }, checkOut: { kind: "date", zone: SANTIAGO, date: december(2 + (i % 19)) } }),
  (i: number) => ({ kind: "journey", by: "bus", from: "Santiago", to: "Valparaíso", leaves: exact(SANTIAGO, december(1 + (i % 20)), "08:00") }),
  (i: number) => ({
    kind: "flight",
    seats: [],
    legs: [{ flight: `LA ${100 + i}`, from: { code: "SCL" }, to: { code: "PUQ" }, leaves: exact(SANTIAGO, december(1 + (i % 20)), "07:05"), arrives: exact(PUNTA_ARENAS, december(1 + (i % 20)), "10:30") }],
  }),
];
for (let i = 0; i < 300; i++) {
  const booking = { id: `b-${i}`, revision: 0, travellers: [account], details: {}, ...kinds[i % 4]!(i) };
  changes.push({ target: "bookings", change: bookingChange({ op: "add", booking: booking as never }) });
}

// Eight at a time, as the browser tests send them.
for (let at = 0; at < changes.length; at += 8) {
  await Promise.all(changes.slice(at, at + 8).map((c) => call(`/api/trips/${trip}/changes`, c)));
  process.stdout.write(`\rfill-trip: ${Math.min(at + 8, changes.length)} of ${changes.length} changes sent`);
}
console.log(`\nfill-trip: made ${site}/trips/${trip}`);

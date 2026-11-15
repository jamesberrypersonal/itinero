// Prints, as JSON, the text, the order and the durations trip-time gives for a fixed set of values.
// independence.test.ts runs it under two device time zones, and compares what it prints.

import { duration, format, formatDuration, relativeTo, sort, span, toText, create, type TripTime } from "../../src/index.ts";
import { loadNewestRules } from "../helpers.ts";

loadNewestRules();
const zones = ["Europe/London", "Asia/Tokyo", "Europe/Paris", "America/New_York", "Australia/Sydney", "Pacific/Kiritimati"];
const values: TripTime[] = [];
for (const zone of zones) {
  for (const date of ["2026-01-15", "2026-03-29", "2026-06-03", "2026-10-25", "2026-11-01"]) {
    const fields: TripTime[] = [
      { kind: "exact", zone, date, at: { time: "01:30" } },
      { kind: "exact", zone, date, at: { time: "12:00" } },
      { kind: "date", zone, date },
      { kind: "tbd", zone, date },
      { kind: "part", zone, date, part: "night" },
      { kind: "approx", zone, date, at: { time: "18:15" } },
      { kind: "window", zone, date, from: { time: "09:00" }, endDate: date, to: { time: "17:30" } },
    ];
    for (const f of fields) {
      const made = create(f);
      if (made.ok) values.push(made.value);
    }
  }
}
const styles = [
  { clock: "24h", dateOrder: "day-first" },
  { clock: "12h", dateOrder: "month-first" },
] as const;
const now = Date.UTC(2026, 5, 3, 9, 30);
const spans = values.slice(0, -1).map((start, i) => {
  const made = span(start, values[i + 1]!);
  return made.ok ? formatDuration(duration(made.value)) : made.refusal.code;
});
console.log(
  JSON.stringify({
    text: values.map((v) => [toText(v), ...styles.map((s) => format(v, s)), relativeTo(v, now)]),
    order: sort(values).map(toText),
    spans,
  }),
);

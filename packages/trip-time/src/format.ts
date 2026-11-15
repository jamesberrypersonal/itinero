// format and formatDuration (spec §4.8), and relativeTo (§4.9).

import { civilFromDays, splitDays, weekday } from "./calendar.ts";
import { momentOf } from "./local.ts";
import { offsetAt, zoneOrUtc } from "./rules.ts";
import type { ClockTime, Duration, TextStyle, TripTime } from "./types.ts";
import { localCount, readDate } from "./value.ts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The zones whose last part is not a place, and how each is named. */
const ZONE_NAMES: Record<string, string> = {
  UTC: "UTC",
  "Etc/UTC": "UTC",
  "Etc/UCT": "UTC",
  "Etc/Universal": "UTC",
  "Etc/Zulu": "UTC",
  UCT: "UTC",
  Universal: "UTC",
  Zulu: "UTC",
  GMT: "GMT",
  "Etc/GMT": "GMT",
  "Etc/GMT0": "GMT",
  "Etc/GMT+0": "GMT",
  "Etc/GMT-0": "GMT",
  "Etc/Greenwich": "GMT",
  GMT0: "GMT",
  "GMT+0": "GMT",
  "GMT-0": "GMT",
  Greenwich: "GMT",
  CET: "Central European time",
  EET: "Eastern European time",
  MET: "Middle European time",
  WET: "Western European time",
  EST: "UTC-5",
  MST: "UTC-7",
  HST: "UTC-10",
  EST5EDT: "US Eastern time",
  CST6CDT: "US Central time",
  MST7MDT: "US Mountain time",
  PST8PDT: "US Pacific time",
};

/** The name a zone is written with: "America/New_York" reads "New York time". */
export function zoneName(zone: string): string {
  const named = ZONE_NAMES[zone];
  if (named) return named;
  // The IANA database writes the sign of an Etc/GMT zone backwards: Etc/GMT-2 is two hours ahead of UTC.
  const etc = /^Etc\/GMT([+-])(\d{1,2})$/.exec(zone);
  if (etc) return `UTC${etc[1] === "-" ? "+" : "-"}${Number(etc[2])}`;
  const last = zone.slice(zone.lastIndexOf("/") + 1);
  return `${last.replaceAll("_", " ")} time`;
}

function days(date: string): number {
  const read = readDate(date);
  return read.code === "ok" ? read.days : 0;
}

/** "Wed 3 June 2026", or without its year, "Thu 4 June". */
function dateWords(date: string, style: TextStyle, withYear: boolean): string {
  const count = days(date);
  const { year, month, day } = civilFromDays(count);
  const name = WEEKDAYS[weekday(count)]!;
  const monthName = MONTHS[month - 1]!;
  if (style.dateOrder === "month-first") return `${name} ${monthName} ${day}${withYear ? `, ${year}` : ""}`;
  return `${name} ${day} ${monthName}${withYear ? ` ${year}` : ""}`;
}

function clockWords(at: ClockTime, style: TextStyle): string {
  const [hours, minutes] = at.time.split(":").map(Number) as [number, number];
  const mm = String(minutes).padStart(2, "0");
  const text =
    style.clock === "24h" ? at.time : `${hours % 12 === 0 ? 12 : hours % 12}:${mm} ${hours < 12 ? "am" : "pm"}`;
  return at.second ? `${text} (second time)` : text;
}

export function format(value: TripTime, style: TextStyle): string {
  const date = dateWords(value.date, style, true);
  const zone = zoneName(value.zone);
  switch (value.kind) {
    case "exact":
      return `${date}, ${clockWords(value.at, style)}, ${zone}`;
    case "date":
      return `${date}, ${zone}`;
    case "tbd":
      return `${date}, time to be decided, ${zone}`;
    case "part":
      return `${date}, ${value.part}, ${zone}`;
    case "approx":
      return `${date}, around ${clockWords(value.at, style)}, ${zone}`;
    case "window": {
      const from = clockWords(value.from, style);
      const to = clockWords(value.to, style);
      if (value.endDate === value.date) return `${date}, ${from}–${to}, ${zone}`;
      const sameYear = value.endDate.slice(0, 4) === value.date.slice(0, 4);
      return `${date}, ${from} – ${dateWords(value.endDate, style, !sameYear)}, ${to}, ${zone}`;
    }
  }
}

/** One length, in days, hours and minutes, leaving out any part that is zero. */
function length(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(d === 1 ? "1 day" : `${d} days`);
  if (h > 0) parts.push(`${h} h`);
  if (m > 0 || parts.length === 0) parts.push(`${m} min`);
  return parts.join(" ");
}

export function formatDuration(duration: Duration): string {
  const { shortest, longest } = duration;
  if (shortest === longest) return length(shortest);
  if (shortest % 60 === 0 && longest % 60 === 0 && longest < 1440) return `${shortest / 60}–${longest / 60} h`;
  return `${length(shortest)} – ${length(longest)}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function relativeTo(value: TripTime, now: number): string {
  const nowSeconds = Math.floor(now / 1000);
  const zone = zoneOrUtc(value.zone);

  if (value.kind === "exact" || value.kind === "approx" || value.kind === "window") {
    const at = value.kind === "window" ? value.from : value.at;
    const moment = momentOf(zone, localCount(value.date, at.time), at.second === true);
    const seconds = moment - nowSeconds;
    const minutes = Math.sign(seconds) * Math.round(Math.abs(seconds) / 60);
    const size = Math.abs(minutes);
    if (size < 720) {
      if (size < 1) return "now";
      const about = value.kind === "approx" ? "about " : "";
      const hours = Math.floor(size / 60);
      const rest = size % 60;
      const words =
        hours === 0
          ? plural(rest, "minute")
          : rest === 0
            ? plural(hours, "hour")
            : `${plural(hours, "hour")} ${plural(rest, "minute")}`;
      return minutes > 0 ? `in ${about}${words}` : `${about}${words} ago`;
    }
  }

  const today = splitDays(nowSeconds + offsetAt(zone, nowSeconds)).days;
  const apart = days(value.date) - today;
  if (apart === 0) return "today";
  if (apart === 1) return "tomorrow";
  if (apart === -1) return "yesterday";
  return apart > 0 ? `in ${apart} days` : `${-apart} days ago`;
}

// The types of the programming interface (spec §3.3).

/** A time zone's IANA name, such as "Europe/Paris". */
export type Zone = string;

/** A local date, as "YYYY-MM-DD". */
export type LocalDate = string;

/** A local clock time, "HH:MM" from 00:00 to 23:59, perhaps marked as the second occurrence of a repeated time. */
export type ClockTime = { time: string; second?: true };

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

export type TripTime =
  | { kind: "exact"; zone: Zone; date: LocalDate; at: ClockTime }
  | { kind: "date"; zone: Zone; date: LocalDate }
  | { kind: "tbd"; zone: Zone; date: LocalDate }
  | { kind: "part"; zone: Zone; date: LocalDate; part: PartOfDay }
  | { kind: "approx"; zone: Zone; date: LocalDate; at: ClockTime }
  | { kind: "window"; zone: Zone; date: LocalDate; from: ClockTime; endDate: LocalDate; to: ClockTime };

export type Span = { start: TripTime; end: TripTime };

/** The shortest and the longest time a span can take, in whole minutes. */
export type Duration = { shortest: number; longest: number };

export type RefusalCode =
  | "malformed"
  | "out-of-range"
  | "invalid-date"
  | "invalid-time"
  | "unknown-zone"
  | "no-rules"
  | "skipped-time"
  | "not-repeated"
  | "window-order"
  | "span-order"
  | "bad-rules";

export type Refusal = { code: RefusalCode; message: string; details?: Record<string, string> };

export type Result<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

export type TextStyle = { clock: "24h" | "12h"; dateOrder: "day-first" | "month-first" };

export function refuse<T>(code: RefusalCode, message: string, details?: Record<string, string>): Result<T> {
  const refusal: Refusal = details ? { code, message, details: Object.freeze({ ...details }) } : { code, message };
  return Object.freeze({ ok: false as const, refusal: Object.freeze(refusal) });
}

export function accept<T>(value: T): Result<T> {
  return Object.freeze({ ok: true as const, value });
}

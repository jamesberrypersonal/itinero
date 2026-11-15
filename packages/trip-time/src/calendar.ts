// Gregorian calendar arithmetic, counted in days and seconds since 1970-01-01 (spec §4).
// Nothing here reads the device's clock or time zone.

export const SECONDS_PER_DAY = 86400;

export type Civil = { year: number; month: number; day: number };

/** The days from 1970-01-01 to a Gregorian date. */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The Gregorian date a count of days from 1970-01-01 falls on. */
export function civilFromDays(days: number): Civil {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The weekday of a count of days from 1970-01-01, a Thursday: 0 is Sunday. */
export function weekday(days: number): number {
  return (((days + 4) % 7) + 7) % 7;
}

/** Writes a count of days from 1970-01-01 as `YYYY-MM-DD`. */
export function dateText(days: number): string {
  const { year, month, day } = civilFromDays(days);
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Writes a count of seconds within a day, rounded down to the minute, as `HH:MM`. */
export function clockText(secondsOfDay: number): string {
  const minutes = Math.floor(secondsOfDay / 60);
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Splits a count of seconds into whole days and the seconds left over, which are never negative. */
export function splitDays(seconds: number): { days: number; secondsOfDay: number } {
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  return { days, secondsOfDay: seconds - days * SECONDS_PER_DAY };
}

// Calendar dates, counted in days from 1970-01-01 in the Gregorian calendar (spec/bookings/list.md
// §4). A date belongs to no time zone, and nothing here reads the device's clock or time zone.

const LAST_DAY = daysFromCivil(9999, 12, 31);

export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * ((month + 9) % 12) + 2) / 5) + day - 1;
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
}

/** The days from 1970-01-01 to a "YYYY-MM-DD" date, or undefined for a date that does not exist or is out of range. */
export function daysOf(date: string): number | undefined {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!found) return undefined;
  const [year, month, day] = [Number(found[1]), Number(found[2]), Number(found[3])];
  if (month < 1 || month > 12 || day < 1) return undefined;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const length = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (day > length) return undefined;
  const days = daysFromCivil(year, month, day);
  return days < 0 || days > LAST_DAY ? undefined : days;
}

const MELBOURNE_TIME_ZONE = "Australia/Melbourne";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatMelbourneDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MELBOURNE_TIME_ZONE,
  });
}

/** Melbourne calendar date only, e.g. "24 July 2026". */
export function formatMelbourneDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-AU", {
    dateStyle: "medium",
    timeZone: MELBOURNE_TIME_ZONE,
  });
}

/** Melbourne clock time only, e.g. "2:05 pm". */
export function formatMelbourneTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString("en-AU", {
    timeStyle: "short",
    timeZone: MELBOURNE_TIME_ZONE,
  });
}

/** Melbourne civil date as YYYY-MM-DD (for date inputs / filters). */
export function melbourneDateYmd(date: Date = new Date()): string {
  const { year, month, day } = melbourneYmd(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** YYMM prefix for shared permit numbers (Melbourne calendar), e.g. "2608". */
export function melbournePermitYearMonth(date: Date = new Date()): string {
  const ymd = melbourneDateYmd(date);
  return `${ymd.slice(2, 4)}${ymd.slice(5, 7)}`;
}

/** Display label for a YYYY-MM-DD Melbourne civil date, e.g. "30 July 2026". */
export function formatMelbourneYmd(ymd: string): string | null {
  const bounds = melbourneDayBounds(ymd);
  if (!bounds) {
    return null;
  }
  // Midday Melbourne avoids edge cases around midnight DST transitions.
  const midday = new Date(bounds.start.getTime() + 12 * 60 * 60 * 1000);
  return formatMelbourneDate(midday);
}

/** Parse YYYY-MM-DD; returns null if invalid. */
export function parseYmd(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = YMD_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  // Reject impossible dates (e.g. 2026-02-31) via round-trip in UTC.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Inclusive Melbourne civil-day bounds as UTC instants:
 * [start, end) where end is the next Melbourne midnight.
 */
export function melbourneDayBounds(ymd: string): { start: Date; end: Date } | null {
  const parsed = parseYmd(ymd);
  if (!parsed) {
    return null;
  }
  const [, yearStr, monthStr, dayStr] = YMD_RE.exec(parsed)!;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const start = melbourneLocalToUtc(year, month, day, 0, 0, 0);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = melbourneLocalToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0,
  );
  return { start, end };
}

function melbourneYmd(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

/** Melbourne weekday: 0 = Sunday … 6 = Saturday (same as Date#getUTCDay). */
function melbourneWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TIME_ZONE,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * Instant for a Melbourne local civil time (no DST ambiguity handling beyond
 * the engine's usual behaviour for that wall time).
 */
function melbourneLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  // Iterate from a UTC guess until Melbourne wall-clock matches.
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: MELBOURNE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(utc);
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour") === 24 ? 0 : read("hour"),
      read("minute"),
      read("second"),
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = target - asUtc;
    if (delta === 0) {
      break;
    }
    utc = new Date(utc.getTime() + delta);
  }
  return utc;
}

/**
 * Monday 00:00:00 in Australia/Melbourne for the week containing `date`.
 * Weeks start the day after Sunday (Monday–Sunday).
 */
export function startOfMelbourneWeek(date: Date = new Date()): Date {
  const { year, month, day } = melbourneYmd(date);
  const weekday = melbourneWeekday(date);
  // Days since Monday: Sun→6, Mon→0, … Sat→5
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(Date.UTC(year, month - 1, day));
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return melbourneLocalToUtc(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    0,
    0,
  );
}

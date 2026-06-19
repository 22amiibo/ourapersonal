// All "today / this week" logic is computed in the user's timezone, not the
// server's, so the 7-day window and weekly rollup line up with their day.

export function localDateStr(tz: string, d: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function daysAgoStr(tz: string, days: number): string {
  return localDateStr(tz, new Date(Date.now() - days * 86400000));
}

export function daysAheadStr(tz: string, days: number): string {
  return localDateStr(tz, new Date(Date.now() + days * 86400000));
}

// Monday of the current local week, as YYYY-MM-DD.
export function weekOfStr(tz: string, d: Date = new Date()): string {
  const [y, m, day] = localDateStr(tz, d).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day, 12));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  dt.setUTCDate(dt.getUTCDate() - ((dow + 6) % 7)); // back up to Monday
  return localDateStr("UTC", dt);
}

export function isMonday(tz: string, d: Date = new Date()): boolean {
  const [y, m, day] = localDateStr(tz, d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).getUTCDay() === 1;
}

// Smart notification timing. The daily cron fires at a fixed UTC hour, but a
// push should never land in the middle of the user's night. These helpers gate
// delivery to the user's local waking window (timezone-aware), so an alert that
// would otherwise buzz at 3am is held back instead.

const QUIET_START = 22; // 22:00 local — wind-down begins
const QUIET_END = 7; //    07:00 local — day begins

// Current hour (0–23) in an IANA timezone.
export function localHour(tz: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const h = parseInt(raw, 10);
  return h === 24 ? 0 : h;
}

// True when local time is inside the quiet window (wraps midnight).
export function inQuietHours(tz: string, now: Date = new Date()): boolean {
  const h = localHour(tz, now);
  return h >= QUIET_START || h < QUIET_END;
}

/**
 * Slots are stored as 30-minute "buckets" (minutes since epoch / 30). A booking reserves every bucket it
 * covers. A unique index on (artisan, bucket) lets MongoDB itself reject double bookings, no transactions needed.
 */
export const BUCKET_MINUTES = 30;
const BUCKET_MS = BUCKET_MINUTES * 60_000;

export function bucketsFor(start: Date, durationMinutes: number): number[] {
  if (!(durationMinutes > 0)) throw new RangeError("Duration must be positive.");
  const first = Math.floor(start.getTime() / BUCKET_MS);
  const count = Math.ceil(durationMinutes / BUCKET_MINUTES);
  return Array.from({ length: count }, (_, i) => first + i);
}

/** Working hours in local Nigerian wall time (WAT, UTC+1, no daylight saving). */
export interface WorkingWindow { dayOfWeek: number; startMinute: number; endMinute: number }
const LAGOS_OFFSET_MIN = 60;

export function localParts(d: Date) {
  const l = new Date(d.getTime() + LAGOS_OFFSET_MIN * 60_000);
  return { dayOfWeek: l.getUTCDay(), minuteOfDay: l.getUTCHours() * 60 + l.getUTCMinutes(), ymd: l.toISOString().slice(0, 10) };
}

export function fitsWorkingHours(start: Date, durationMinutes: number, windows: WorkingWindow[], blackoutDates: string[] = []): boolean {
  const p = localParts(start);
  if (blackoutDates.includes(p.ymd)) return false;
  const end = p.minuteOfDay + durationMinutes;
  return windows.some((w) => w.dayOfWeek === p.dayOfWeek && p.minuteOfDay >= w.startMinute && end <= w.endMinute);
}

/** Candidate start times for a day, minus anything already reserved. */
export function openSlots(opts: {
  ymd: string; durationMinutes: number; windows: WorkingWindow[]; blackoutDates?: string[];
  takenBuckets: Set<number>; now?: Date; leadTimeMinutes?: number; stepMinutes?: number;
}): Date[] {
  const { ymd, durationMinutes, windows, takenBuckets } = opts;
  const step = opts.stepMinutes ?? 60;
  const earliest = (opts.now ?? new Date()).getTime() + (opts.leadTimeMinutes ?? 120) * 60_000;
  const dayStartUtc = Date.parse(`${ymd}T00:00:00Z`) - LAGOS_OFFSET_MIN * 60_000;
  const out: Date[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    const start = new Date(dayStartUtc + m * 60_000);
    if (start.getTime() < earliest) continue;
    if (!fitsWorkingHours(start, durationMinutes, windows, opts.blackoutDates)) continue;
    if (bucketsFor(start, durationMinutes).some((b) => takenBuckets.has(b))) continue;
    out.push(start);
  }
  return out;
}

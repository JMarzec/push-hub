/**
 * Streak rules (gap tolerance)
 * ---------------------------------------------------------------
 * - A day is a "hit" when total reps >= that day's target.
 * - A single missed day is forgiven as a rest day: it keeps the streak alive
 *   but adds nothing to its length.
 * - At most one rest day may be used per rolling 7-day window.
 * - Two missed days in a row always end the streak.
 * - Today never breaks the streak: an unfinished today is simply not counted.
 */

export const MAX_REST_DAYS_PER_WINDOW = 1;
export const REST_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export type DayStatus = "hit" | "rest" | "break" | "pending" | "none" | "recovery";

/** Day-of-week helper: 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function isRecoveryDate(date: string, restDayOfWeek: number | null | undefined): boolean {
  if (restDayOfWeek === null || restDayOfWeek === undefined) return false;
  return new Date(`${date}T00:00:00Z`).getUTCDay() === restDayOfWeek;
}

export type StreakDay = {
  date: string;
  status: DayStatus;
  /** True when this day belongs to the currently running streak. */
  inCurrentStreak: boolean;
};

export type StreakResult = {
  current: number;
  longest: number;
  /** Rest days consumed inside the active streak's trailing 7-day window. */
  restDaysUsed: number;
  /** Rest days still available today before the streak breaks. */
  restDaysLeft: number;
  /** True when the streak is only alive because a rest day was forgiven. */
  onGrace: boolean;
  /** Per-day statuses, oldest first, covering the requested timeline window. */
  timeline: StreakDay[];
};

const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Walks day-by-day backwards from `today`, applying the gap tolerance rules.
 */
export function computeStreaks(
  hitDates: Iterable<string>,
  today: string,
  options: {
    maxLookbackDays?: number;
    timelineDays?: number;
    /** 0 = Sunday … 6 = Saturday. That weekday never counts as a miss. */
    restDayOfWeek?: number | null;
  } = {},
): StreakResult {
  const { maxLookbackDays = 730, timelineDays = 30, restDayOfWeek = null } = options;
  const isRecovery = (ms: number) =>
    restDayOfWeek !== null && new Date(ms).getUTCDay() === restDayOfWeek;
  const hits = new Set(hitDates);
  const todayMs = toMs(today);

  const emptyTimeline = (): StreakDay[] =>
    Array.from({ length: timelineDays }, (_, i) => {
      const ms = todayMs - (timelineDays - 1 - i) * DAY_MS;
      return {
        date: toKey(ms),
        status: (ms === todayMs ? "pending" : "none") as DayStatus,
        inCurrentStreak: false,
      };
    });

  if (hits.size === 0) {
    return {
      current: 0,
      longest: 0,
      restDaysUsed: 0,
      restDaysLeft: MAX_REST_DAYS_PER_WINDOW,
      onGrace: false,
      timeline: emptyTimeline(),
    };
  }

  const sorted = [...hits].sort();
  const firstMs = toMs(sorted[0]!);

  let current = 0;
  let restDaysUsed = 0;
  let onGrace = false;
  let currentDone = false;

  let longest = 0;
  let run = 0;
  const restWindow: number[] = []; // ms of forgiven days inside the walk
  const statuses = new Map<number, DayStatus>();
  const inCurrent = new Set<number>();

  const startMs = Math.max(firstMs, todayMs - maxLookbackDays * DAY_MS);

  for (let ms = todayMs; ms >= startMs; ms -= DAY_MS) {
    const hit = hits.has(toKey(ms));

    if (hit) {
      run += 1;
      longest = Math.max(longest, run);
      statuses.set(ms, "hit");
      if (!currentDone) {
        current = run;
        inCurrent.add(ms);
      }
      continue;
    }

    // Today that isn't done yet is neutral.
    if (ms === todayMs) {
      statuses.set(ms, "pending");
      continue;
    }

    const previousMissedMs = restWindow[restWindow.length - 1];
    const consecutiveMiss = previousMissedMs === ms + DAY_MS;
    while (restWindow.length > 0 && restWindow[0]! - ms >= REST_WINDOW_DAYS * DAY_MS) {
      restWindow.shift();
    }
    const canForgive = !consecutiveMiss && restWindow.length < MAX_REST_DAYS_PER_WINDOW;

    if (canForgive) {
      restWindow.push(ms);
      statuses.set(ms, "rest");
      if (!currentDone) {
        restDaysUsed += 1;
        inCurrent.add(ms);
        if (current > 0 && ms === todayMs - DAY_MS) onGrace = true;
      }
      continue;
    }

    // Streak broken here.
    statuses.set(ms, "break");
    if (!currentDone) currentDone = true;
    run = 0;
    restWindow.length = 0;
  }

  const timeline: StreakDay[] = Array.from({ length: timelineDays }, (_, i) => {
    const ms = todayMs - (timelineDays - 1 - i) * DAY_MS;
    return {
      date: toKey(ms),
      status: statuses.get(ms) ?? (ms === todayMs ? "pending" : "none"),
      inCurrentStreak: inCurrent.has(ms),
    };
  });

  return {
    current,
    longest: Math.max(longest, current),
    restDaysUsed,
    restDaysLeft: Math.max(0, MAX_REST_DAYS_PER_WINDOW - restDaysUsed),
    onGrace,
    timeline,
  };
}

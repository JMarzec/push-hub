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

export type StreakResult = {
  current: number;
  longest: number;
  /** Rest days consumed inside the active streak's trailing 7-day window. */
  restDaysUsed: number;
  /** Rest days still available today before the streak breaks. */
  restDaysLeft: number;
  /** True when the streak is only alive because a rest day was forgiven. */
  onGrace: boolean;
};

const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Walks day-by-day backwards from `today`, applying the gap tolerance rules.
 */
export function computeStreaks(
  hitDates: Iterable<string>,
  today: string,
  maxLookbackDays = 730,
): StreakResult {
  const hits = new Set(hitDates);
  if (hits.size === 0) {
    return { current: 0, longest: 0, restDaysUsed: 0, restDaysLeft: MAX_REST_DAYS_PER_WINDOW, onGrace: false };
  }

  const sorted = [...hits].sort();
  const firstMs = toMs(sorted[0]!);
  const todayMs = toMs(today);

  let current = 0;
  let restDaysUsed = 0;
  let onGrace = false;
  let currentDone = false;

  let longest = 0;
  let run = 0;
  const restWindow: number[] = []; // ms of forgiven days inside the walk

  const startMs = Math.max(firstMs, todayMs - maxLookbackDays * DAY_MS);

  for (let ms = todayMs; ms >= startMs; ms -= DAY_MS) {
    const hit = hits.has(toKey(ms));

    if (hit) {
      run += 1;
      longest = Math.max(longest, run);
      if (!currentDone) current = run;
      continue;
    }

    // Today (or a future-less trailing day) that isn't done yet is neutral.
    if (ms === todayMs) continue;

    const previousMissedMs = restWindow[restWindow.length - 1];
    const consecutiveMiss = previousMissedMs === ms + DAY_MS;
    while (restWindow.length > 0 && restWindow[0]! - ms >= REST_WINDOW_DAYS * DAY_MS) {
      restWindow.shift();
    }
    const canForgive = !consecutiveMiss && restWindow.length < MAX_REST_DAYS_PER_WINDOW;

    if (canForgive) {
      restWindow.push(ms);
      if (!currentDone) {
        restDaysUsed += 1;
        onGrace = current > 0 && ms === todayMs - DAY_MS;
      }
      continue;
    }

    // Streak broken here.
    if (!currentDone) currentDone = true;
    run = 0;
    restWindow.length = 0;
  }

  return {
    current,
    longest: Math.max(longest, current),
    restDaysUsed,
    restDaysLeft: Math.max(0, MAX_REST_DAYS_PER_WINDOW - restDaysUsed),
    onGrace,
  };
}

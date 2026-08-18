import type { PushupSet } from "@/components/pushup/SetChips";

export const SLOT_TIMES: Record<number, string[]> = {
  1: ["08:00"],
  2: ["08:00", "18:00"],
  3: ["08:00", "13:00", "19:00"],
  4: ["08:00", "12:00", "17:00", "21:00"],
  6: ["07:00", "10:00", "13:00", "16:00", "19:00", "21:30"],
};

export function slotTimesFor(frequency: number): string[] {
  const preset = SLOT_TIMES[frequency];
  if (preset) return preset;
  // Even spread between 07:00 and 21:00 for custom frequencies.
  const start = 7 * 60;
  const end = 21 * 60;
  const step = frequency > 1 ? (end - start) / (frequency - 1) : 0;
  return Array.from({ length: frequency }, (_, i) => {
    const mins = Math.round(start + step * i);
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}`;
  });
}

/** Split a daily target across slot times, distributing the remainder to the earliest sets. */
export function buildTargets(dailyTarget: number, slotTimes: string[]): PushupSet[] {
  const frequency = Math.max(slotTimes.length, 1);
  const base = Math.floor(dailyTarget / frequency);
  let remainder = dailyTarget - base * frequency;
  return slotTimes.map((time) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { time, target: base + extra, reps: 0 };
  });
}

/**
 * Build today's sets from persisted per-slot reps, then apply the day's bank
 * movements: deposits come off the latest sets, withdrawals fill the earliest.
 */
export function composeSets(
  dailyTarget: number,
  slotTimes: string[],
  repsBySlot: Record<string, number>,
  depositedToday: number,
  withdrawnToday: number,
): PushupSet[] {
  const sets = buildTargets(dailyTarget, slotTimes).map((s) => ({
    ...s,
    reps: repsBySlot[s.time] ?? 0,
  }));

  // Reps logged against a slot that no longer exists still count: fold into the first set.
  const known = new Set(slotTimes);
  const orphaned = Object.entries(repsBySlot)
    .filter(([slot]) => !known.has(slot))
    .reduce((sum, [, reps]) => sum + reps, 0);
  if (orphaned > 0 && sets[0]) sets[0] = { ...sets[0], reps: sets[0].reps + orphaned };

  // A day's bank effect is the NET of transfers: withdrawals add reps, deposits
  // take them away. Applying them separately let a deposit "fall off" when the
  // day's logged reps were 0 (e.g. withdraw 50, bank 50, withdraw 50 again),
  // which double-counted banked reps on the ring versus the squad total.
  const netBank = withdrawnToday - depositedToday;

  let toRemove = Math.max(-netBank, 0);
  for (let i = sets.length - 1; i >= 0 && toRemove > 0; i -= 1) {
    const take = Math.min(sets[i]!.reps, toRemove);
    sets[i] = { ...sets[i]!, reps: sets[i]!.reps - take };
    toRemove -= take;
  }

  let toAdd = Math.max(netBank, 0);
  for (let i = 0; i < sets.length && toAdd > 0; i += 1) {
    const room = Math.max(sets[i]!.target - sets[i]!.reps, 0);
    const give = Math.min(room, toAdd);
    if (give > 0) sets[i] = { ...sets[i]!, reps: sets[i]!.reps + give };
    toAdd -= give;
  }
  if (toAdd > 0 && sets.length > 0) {
    const last = sets.length - 1;
    sets[last] = { ...sets[last]!, reps: sets[last]!.reps + toAdd };
  }

  // Overshooting one set counts towards the next ones, so a chip never reads 25/13.
  let spill = 0;
  for (let i = 0; i < sets.length; i += 1) {
    const total = sets[i]!.reps + spill;
    const isLast = i === sets.length - 1;
    const keep = isLast ? total : Math.min(total, sets[i]!.target);
    spill = total - keep;
    sets[i] = { ...sets[i]!, reps: keep };
  }

  return sets;

}

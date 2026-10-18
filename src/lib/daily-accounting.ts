export interface RepLog {
  reps: number;
  log_date: string;
}
export interface BankMovement {
  reps: number;
  kind: string;
  entry_date: string;
}
export interface DailyGoal {
  goal_date: string;
  daily_target: number;
  rest_day_of_week: number | null;
}

/** Clamp once, after summing the day's complete net movement. */
export function dailyReps(logs: RepLog[], bank: BankMovement[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const log of logs) totals[log.log_date] = (totals[log.log_date] ?? 0) + log.reps;
  for (const entry of bank) {
    totals[entry.entry_date] =
      (totals[entry.entry_date] ?? 0) + (entry.kind === "withdrawal" ? entry.reps : -entry.reps);
  }
  return Object.fromEntries(
    Object.entries(totals).map(([date, reps]) => [date, Math.max(0, reps)]),
  );
}

export function goalForDate(
  goals: DailyGoal[],
  date: string,
  fallback: number,
  rest: number | null,
) {
  const goal = goals.find((g) => g.goal_date === date);
  return {
    target: goal?.daily_target ?? fallback,
    restDayOfWeek: goal ? goal.rest_day_of_week : rest,
  };
}

export function hitDatesFor(
  reps: Record<string, number>,
  goals: DailyGoal[],
  target: number,
  rest: number | null,
) {
  const byDate = new Map(goals.map((g) => [g.goal_date, g]));
  return Object.keys(reps).filter((date) => {
    const goal = byDate.get(date);
    const recovery = goal ? goal.rest_day_of_week : rest;
    return (
      new Date(`${date}T00:00:00Z`).getUTCDay() !== recovery &&
      (reps[date] ?? 0) >= (goal?.daily_target ?? target)
    );
  });
}

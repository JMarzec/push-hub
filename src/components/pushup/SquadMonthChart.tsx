import type { TeamMemberStat } from "@/lib/teams.functions";

/**
 * 30-day squad overview: one sparkline row per member showing daily reps,
 * with their current streak and recovery days alongside.
 */
export function SquadMonthChart({ members }: { members: TeamMemberStat[] }) {
  const peak = Math.max(
    1,
    ...members.flatMap((m) => m.monthDays.map((d) => d.reps)),
  );
  const squadTotal = members.reduce((sum, m) => sum + m.monthTotal, 0);

  const ranked = [...members].sort((a, b) => b.monthTotal - a.monthTotal);

  return (
    <section
      aria-labelledby="month-chart-heading"
      className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="month-chart-heading" className="text-sm font-bold text-foreground">
          Last 30 days
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {squadTotal.toLocaleString()} squad reps
        </p>
      </div>

      <ul className="mt-4 space-y-4">
        {ranked.map((m) => (
          <li key={m.userId}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-bold text-foreground">{m.displayName}</p>
              <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {m.monthTotal.toLocaleString()} reps
              </p>
            </div>
            <div
              className="mt-1.5 flex h-14 items-end gap-[2px]"
              role="img"
              aria-label={`${m.displayName}: ${m.monthTotal} reps over the last 30 days, ${m.currentStreak} day streak, ${m.recoveryDaysInMonth} recovery days`}
            >
              {m.monthDays.map((d) => {
                const height = Math.max(3, Math.round((d.reps / peak) * 100));
                return (
                  <span
                    key={d.date}
                    title={`${d.date} — ${d.reps} reps${d.rest ? " (recovery day)" : ` of ${d.target}`}`}
                    className={`flex-1 rounded-t-sm ${
                      d.rest
                        ? "bg-accent"
                        : d.hit
                          ? "bg-primary"
                          : d.reps > 0
                            ? "bg-primary/40"
                            : "bg-secondary"
                    }`}
                    style={{ height: `${d.rest && d.reps === 0 ? 12 : height}%` }}
                  />
                );
              })}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {m.currentStreak}
                </span>{" "}
                day streak
              </span>
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {m.recoveryDaysInMonth}
                </span>{" "}
                recovery days
              </span>
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {m.monthDays.filter((d) => d.hit && !d.rest).length}
                </span>{" "}
                days on target
              </span>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> target met
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-primary/40" aria-hidden="true" /> partial
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-accent" aria-hidden="true" /> recovery day
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-secondary" aria-hidden="true" /> missed
        </span>
      </p>
    </section>
  );
}

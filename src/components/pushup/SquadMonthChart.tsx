import { useEffect, useRef } from "react";
import type { TeamMemberStat } from "@/lib/teams.functions";

type MonthDay = TeamMemberStat["monthDays"][number];

function compactDate(date: string) {
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${Number(day)}/${Number(month)}`;
}

function MemberTimeline({
  days,
  displayName,
  monthTotal,
  currentStreak,
  recoveryDays,
  peak,
}: {
  days: MonthDay[];
  displayName: string;
  monthTotal: number;
  currentStreak: number;
  recoveryDays: number;
  peak: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollLeft = scroller.scrollWidth;
  }, [days]);

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <p className="min-w-0 truncate text-sm font-bold text-foreground">{displayName}</p>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {monthTotal.toLocaleString()} reps
        </p>
      </div>

      <dl className="mt-2 grid gap-1 text-xs">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <dt className="text-muted-foreground">Current streak</dt>
          <dd className="font-semibold text-foreground tabular-nums">{currentStreak} days</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <dt className="text-muted-foreground">Recovery days</dt>
          <dd className="font-semibold text-foreground tabular-nums">{recoveryDays}</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <dt className="text-muted-foreground">Days on target</dt>
          <dd className="font-semibold text-foreground tabular-nums">
            {days.filter((day) => day.hit && !day.rest).length}
          </dd>
        </div>
      </dl>

      <div
        ref={scrollRef}
        className="mt-3 overflow-x-auto pb-1 [scrollbar-width:thin]"
        aria-label={`${displayName} daily activity timeline. Swipe horizontally for earlier dates.`}
      >
        <div className="grid min-w-max grid-flow-col grid-cols-none gap-1" role="img">
          {days.map((day, index) => {
            const height = Math.max(3, Math.round((day.reps / peak) * 100));
            const showDate = index === 0 || index === days.length - 1 || index % 5 === 0;
            const dateLabel = compactDate(day.date);

            return (
              <div key={day.date} className="grid w-5 grid-rows-[3.5rem_1rem] gap-1">
                <div className="flex items-end border-b border-border">
                  <span
                    title={`${day.date} — ${day.reps} reps${day.rest ? " (recovery day)" : ` of ${day.target}`}`}
                    aria-label={`${dateLabel}: ${day.reps} reps${day.rest ? ", recovery day" : day.hit ? ", target met" : day.reps > 0 ? ", partial" : ", missed"}`}
                    className={`w-full rounded-t-sm ${
                      day.rest
                        ? "bg-accent"
                        : day.hit
                          ? "bg-primary"
                          : day.reps > 0
                            ? "bg-primary/40"
                            : "bg-secondary"
                    }`}
                    style={{ height: `${day.rest && day.reps === 0 ? 12 : height}%` }}
                  />
                </div>
                <span
                  className="whitespace-nowrap text-[9px] leading-4 text-muted-foreground tabular-nums"
                  aria-hidden="true"
                >
                  {showDate ? dateLabel : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

      <ul className="mt-4 divide-y divide-border">
        {ranked.map((m) => (
          <li key={m.userId} className="py-4 first:pt-0 last:pb-0">
            <MemberTimeline
              days={m.monthDays}
              displayName={m.displayName}
              monthTotal={m.monthTotal}
              currentStreak={m.currentStreak}
              recoveryDays={m.recoveryDaysInMonth}
              peak={peak}
            />
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

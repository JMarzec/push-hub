import { useState } from "react";
import { ChevronDown, Flame } from "lucide-react";
import type { DayStatus } from "@/lib/streaks";
import type { TimelineDay } from "@/components/pushup/StreakTimeline";

type Props = {
  timeline: TimelineDay[];
  currentStreak: number;
  dailyTarget: number;
  restDaysLeft: number;
  restAllowance: number;
};

const GROUPS: { status: DayStatus; label: string; note: string; dot: string }[] = [
  {
    status: "hit",
    label: "Counted",
    note: "Target hit — added a day to your streak.",
    dot: "bg-primary",
  },
  {
    status: "recovery",
    label: "Recovery days",
    note: "Your weekly day off — streak keeps running.",
    dot: "bg-accent ring-1 ring-inset ring-primary/40",
  },
  {
    status: "rest",
    label: "Forgiven",
    note: "Missed but forgiven — streak survived, no day added.",
    dot: "bg-primary/30 ring-1 ring-inset ring-primary",
  },
  {
    status: "break",
    label: "Broke the streak",
    note: "No rest day left — the streak reset here.",
    dot: "bg-destructive",
  },
];

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export function StreakBreakdown({
  timeline,
  currentStreak,
  dailyTarget,
  restDaysLeft,
  restAllowance,
}: Props) {
  const [open, setOpen] = useState(false);
  const relevant = timeline.filter((d) => d.status !== "none" && d.status !== "pending");
  const recent = relevant.slice(-30).reverse();

  const groups = GROUPS.map((g) => ({
    ...g,
    days: recent.filter((d) => d.status === g.status),
  })).filter((g) => g.days.length > 0);

  return (
    <section className="mt-5 rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Flame className="size-4 text-primary" aria-hidden="true" />
            Streak breakdown
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
            {currentStreak}-day streak · {restDaysLeft}/{restAllowance} rest days left
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        relevant.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No logged days yet — hit today's target to start your streak.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((group) => (
              <div key={group.status}>
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${group.dot}`} aria-hidden="true" />
                  <p className="text-xs font-bold text-foreground">
                    {group.label} · {group.days.length}
                  </p>
                </div>
                <p className="mt-0.5 pl-[18px] text-[11px] text-muted-foreground">{group.note}</p>
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
                  {group.days.map((day) => (
                    <li
                      key={day.date}
                      className="flex items-center justify-between px-3 py-2 text-[11px]"
                    >
                      <span className="font-semibold text-foreground">{shortDate(day.date)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {day.reps}/{dailyTarget} reps
                        {day.inCurrentStreak ? " · in current streak" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Last 30 days. One missed day per rolling week is forgiven; a second miss resets the
              streak.
            </p>
          </div>
        )
      ) : null}
    </section>
  );
}

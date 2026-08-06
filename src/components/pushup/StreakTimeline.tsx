import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DayStatus } from "@/lib/streaks";

export type TimelineDay = {
  date: string;
  status: DayStatus;
  inCurrentStreak: boolean;
  reps: number;
};

type Props = {
  timeline: TimelineDay[];
  currentStreak: number;
  longestStreak: number;
  dailyTarget: number;
  restDaysLeft: number;
  restAllowance: number;
  restWindowDays: number;
  onGrace: boolean;
  onSelectDay?: (day: TimelineDay) => void;
};


const STATUS_META: Record<DayStatus, { label: string; dot: string; note: string }> = {
  hit: {
    label: "Counted",
    dot: "bg-primary",
    note: "Target hit — adds a day to your streak.",
  },
  rest: {
    label: "Forgiven rest",
    dot: "bg-primary/30 ring-1 ring-inset ring-primary",
    note: "Missed but forgiven — streak survives, no day added.",
  },
  break: {
    label: "Streak reset",
    dot: "bg-destructive",
    note: "No rest day left — the streak ended here.",
  },
  pending: {
    label: "Today",
    dot: "bg-secondary ring-1 ring-inset ring-muted-foreground/40",
    note: "Still open — today never breaks your streak.",
  },
  none: {
    label: "Before you started",
    dot: "bg-secondary",
    note: "Outside your logging history.",
  },
};

const shortDate = (date: string) => date.slice(5).replace("-", "/");

export function StreakTimeline({
  timeline,
  currentStreak,
  longestStreak,
  dailyTarget,
  restDaysLeft,
  restAllowance,
  restWindowDays,
  onGrace,
}: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const relevant = timeline.filter((d) => d.status !== "none");
  const counted = relevant.filter((d) => d.status === "hit");
  const forgiven = relevant.filter((d) => d.status === "rest");
  const breaks = relevant.filter((d) => d.status === "break");

  return (
    <section
      className="mt-5 rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
      aria-labelledby="streak-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="streak-heading" className="text-sm font-bold text-foreground">
            Streak timeline
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Last {timeline.length} days · current {currentStreak}d · best {longestStreak}d
          </p>
        </div>
        <Dialog>
          <DialogTrigger
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground"
            aria-label="How streaks work"
          >
            <HelpCircle className="size-3.5" aria-hidden="true" />
            Rules
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>How streaks work</DialogTitle>
              <DialogDescription>
                Gap tolerance keeps an honest streak alive without rewarding missed weeks.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-3 text-xs leading-snug text-muted-foreground">
              <li>
                <span className="font-bold text-foreground">Counted day.</span> You log at least
                your daily target ({dailyTarget} reps). Adds +1 to your current streak and can set a
                new best.
              </li>
              <li>
                <span className="font-bold text-foreground">Forgiven rest day.</span> Miss a day and
                it&apos;s forgiven — the streak keeps running but the day adds nothing. You get{" "}
                {restAllowance} rest day per rolling {restWindowDays} days.
              </li>
              <li>
                <span className="font-bold text-foreground">Breaking miss.</span> A second miss
                inside the same {restWindowDays}-day window, or two missed days back to back, resets
                the current streak to zero. Your best streak is never lowered.
              </li>
              <li>
                <span className="font-bold text-foreground">Today.</span> An unfinished today is
                neutral: it never breaks your streak. Hit the target and it counts immediately.
              </li>
            </ul>
          </DialogContent>
        </Dialog>
      </div>

      <ol className="mt-4 grid grid-cols-10 gap-1.5" aria-label="Daily streak statuses">
        {timeline.map((d) => {
          const meta = STATUS_META[d.status];
          return (
            <li key={d.date}>
              <div
                className={`h-7 rounded-md ${meta.dot} ${
                  d.inCurrentStreak ? "outline outline-2 outline-offset-1 outline-primary/50" : ""
                }`}
                title={`${d.date} · ${d.reps} reps · ${meta.label}`}
              >
                <span className="sr-only">{`${d.date}: ${d.reps} reps, ${meta.label}`}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {(["hit", "rest", "break", "pending"] as DayStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`size-2.5 rounded-sm ${STATUS_META[s].dot}`} aria-hidden="true" />
            {STATUS_META[s].label}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] font-semibold text-muted-foreground tabular-nums">
        {onGrace ? "Streak riding on a rest day · " : ""}Rest days left in this window:{" "}
        {restDaysLeft} of {restAllowance}
      </p>

      <button
        type="button"
        onClick={() => setShowBreakdown((v) => !v)}
        className="mt-3 w-full rounded-2xl bg-secondary px-4 py-2.5 text-xs font-bold text-foreground"
        aria-expanded={showBreakdown}
      >
        {showBreakdown ? "Hide streak breakdown" : "Show streak breakdown"}
      </button>

      {showBreakdown ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: "Counting", value: counted.length },
              { label: "Forgiven", value: forgiven.length },
              { label: "Resets", value: breaks.length },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-secondary px-3 py-2">
                <dd className="text-base font-bold text-foreground tabular-nums">{s.value}</dd>
                <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
          {relevant.length === 0 ? (
            <p className="rounded-2xl bg-secondary p-4 text-xs text-muted-foreground">
              No logged days in this window yet.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
              {[...relevant].reverse().map((d) => {
                const meta = STATUS_META[d.status];
                return (
                  <li key={d.date} className="flex items-start gap-3 px-3 py-2.5">
                    <span
                      className={`mt-1 size-2.5 shrink-0 rounded-sm ${meta.dot}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground tabular-nums">
                        {shortDate(d.date)} · {d.reps}/{dailyTarget} reps
                        {d.inCurrentStreak ? " · in current streak" : ""}
                      </p>
                      <p className="text-[11px] leading-snug text-muted-foreground">{meta.note}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

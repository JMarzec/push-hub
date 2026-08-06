import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Flame, Lock, Medal, PiggyBank, Trophy, Users, Zap } from "lucide-react";
import { TabBar } from "@/components/pushup/TabBar";
import { buildAchievements } from "@/lib/achievements";
import { getStats } from "@/lib/pushups.functions";

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

const statsQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["stats", date],
    queryFn: () => getStats({ data: { today: date } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/trophies")({
  head: () => ({
    meta: [
      { title: "Trophies — Push Daily achievements & streaks" },
      {
        name: "description",
        content:
          "Track your push-up streaks, all-time totals and unlocked achievements as you work through the Push Daily challenge.",
      },
      { property: "og:title", content: "Trophies — Push Daily achievements & streaks" },
      {
        property: "og:description",
        content: "Streaks, all-time totals and achievement badges for your push-up challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(statsQueryOptions(localToday()));
  },
  component: Trophies,
});

const ICONS = {
  flame: Flame,
  trophy: Trophy,
  medal: Medal,
  piggy: PiggyBank,
  users: Users,
  zap: Zap,
} as const;

function Trophies() {
  const [today] = useState(localToday);
  const { data } = useSuspenseQuery(statsQueryOptions(today));
  const achievements = buildAchievements(data);
  const unlocked = achievements.filter((a) => a.progress >= a.goal).length;

  const stats = [
    { label: "All-time reps", value: data.totalReps.toLocaleString() },
    { label: "Last 7 days", value: data.weekReps.toLocaleString() },
    { label: "Current streak", value: `${data.currentStreak}d` },
    { label: "Best streak", value: `${data.longestStreak}d` },
    { label: "Best single day", value: data.bestDay.toLocaleString() },
    { label: "Target days hit", value: data.targetDays.toLocaleString() },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-card/60">
            Your progress
          </p>
          <h1 className="mt-1 text-2xl font-bold">Trophies</h1>
          <p className="mt-0.5 text-xs text-card/60 tabular-nums">
            {unlocked} of {achievements.length} unlocked
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 px-5 pb-8">
        <section
          className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
          aria-labelledby="stats-heading"
        >
          <h2 id="stats-heading" className="text-sm font-bold text-foreground">
            Lifetime stats
          </h2>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-secondary px-3 py-3">
                <dd className="text-lg font-bold text-foreground tabular-nums">{s.value}</dd>
                <dt className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-5" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-2 text-sm font-bold text-foreground">
            Last 14 logged days
          </h2>
          {data.recentDays.length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">
              Nothing logged yet — your first set unlocks this.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.recentDays.map((d) => (
                <li
                  key={d.date}
                  className={
                    d.hit
                      ? "rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground tabular-nums"
                      : "rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground tabular-nums"
                  }
                  title={`${d.date}: ${d.reps} reps`}
                >
                  {d.date.slice(5)} · {d.reps}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5" aria-labelledby="badges-heading">
          <h2 id="badges-heading" className="mb-2 text-sm font-bold text-foreground">
            Achievements
          </h2>
          <ul className="space-y-2">
            {achievements.map((a) => {
              const done = a.progress >= a.goal;
              const Icon = done ? ICONS[a.icon] : Lock;
              const pct = Math.round((Math.min(a.progress, a.goal) / a.goal) * 100);
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-ring)]"
                >
                  <span
                    className={
                      done
                        ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                    }
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{a.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{a.description}</p>
                    {!done && (
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${a.title} progress`}
                        >
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                          {Math.min(a.progress, a.goal)}/{a.goal}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <TabBar active={2} />
    </div>
  );
}

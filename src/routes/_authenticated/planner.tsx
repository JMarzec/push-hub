import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Flame, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TabBar } from "@/components/pushup/TabBar";
import { StreakTimeline } from "@/components/pushup/StreakTimeline";
import { deletePlan, listPlans, savePlan } from "@/lib/plans.functions";
import { getStats } from "@/lib/pushups.functions";

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

const FREQUENCIES = [1, 2, 3, 4, 6];

const plansQueryOptions = (today: string) =>
  queryOptions({
    queryKey: ["plans", today],
    queryFn: () => listPlans({ data: { today } }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Goal planner — schedule push-up targets" },
      {
        name: "description",
        content:
          "Plan ahead: schedule future changes to your daily push-up count and set frequency, and track how your streak responds over time.",
      },
      { property: "og:title", content: "Goal planner — schedule push-up targets" },
      {
        property: "og:description",
        content: "Schedule upcoming target and frequency changes and keep an eye on your streak.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(plansQueryOptions(localToday()));
  },
  component: Planner,
});

function Planner() {
  const queryClient = useQueryClient();
  const [today] = useState(localToday);
  const { data } = useSuspenseQuery(plansQueryOptions(today));

  const statsQuery = useQuery({
    queryKey: ["stats", today],
    queryFn: () => getStats({ data: { today } }),
    staleTime: 30_000,
  });
  const stats = statsQuery.data;

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [date, setDate] = useState(tomorrow);
  const [target, setTarget] = useState(data.current.dailyTarget);
  const [frequency, setFrequency] = useState(data.current.frequency);
  const [note, setNote] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["plans"] });
    void queryClient.invalidateQueries({ queryKey: ["today"] });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
    void queryClient.invalidateQueries({ queryKey: ["team"] });
  };

  const saveMutation = useMutation({
    mutationFn: useServerFn(savePlan),
    onSuccess: (result: { id: string; appliedNow: boolean }) => {
      invalidate();
      toast.success(
        result.appliedNow
          ? "Change applied — your target is updated now."
          : `Scheduled for ${date}.`,
      );
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: useServerFn(deletePlan),
    onSuccess: () => {
      invalidate();
      toast.success("Scheduled change removed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upcoming = data.plans.filter((p) => !p.appliedAt);
  const history = data.plans.filter((p) => p.appliedAt).reverse();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-card/60">
            Goal planner
          </p>
          <h1 className="mt-1 text-2xl font-bold">Plan your progression</h1>
          <p className="mt-1 text-sm text-card/70">
            Now: {data.current.dailyTarget} a day across {data.current.frequency}{" "}
            {data.current.frequency === 1 ? "set" : "sets"}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8">
        <section
          className="-mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm"
          aria-labelledby="new-plan-heading"
        >
          <h2 id="new-plan-heading" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Schedule a change
          </h2>

          <div className="mt-3">
            <Label htmlFor="plan-date" className="text-xs text-muted-foreground">
              Takes effect on
            </Label>
            <Input
              id="plan-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {target} push-ups a day
            </p>
            <Slider
              className="mt-2"
              min={10}
              max={500}
              step={5}
              value={[target]}
              onValueChange={([v]) => setTarget(v ?? target)}
              aria-label="Daily push-up target"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Sets per day</p>
            <div className="mt-2 flex gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={f === frequency}
                  onClick={() => setFrequency(f)}
                  className={
                    f === frequency
                      ? "h-10 flex-1 rounded-full bg-primary text-sm font-bold text-primary-foreground"
                      : "h-10 flex-1 rounded-full bg-secondary text-sm font-semibold text-muted-foreground"
                  }
                >
                  {f}×
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {Math.ceil(target / frequency)} per set
            </p>
          </div>

          <div className="mt-4">
            <Label htmlFor="plan-note" className="text-xs text-muted-foreground">
              Note (optional)
            </Label>
            <Input
              id="plan-note"
              maxLength={120}
              placeholder="e.g. step up after holiday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button
            className="mt-4 h-11 w-full rounded-full font-bold"
            disabled={saveMutation.isPending || !date}
            onClick={() =>
              saveMutation.mutate({
                data: {
                  effectiveDate: date,
                  dailyTarget: target,
                  frequency,
                  note: note.trim() || undefined,
                  today,
                },
              })
            }
          >
            <Plus className="size-5" aria-hidden="true" />
            Save scheduled change
          </Button>
        </section>

        <section className="mt-5" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="mb-2 text-sm font-bold text-foreground">
            Upcoming changes
          </h2>
          {upcoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nothing scheduled yet. Plan a step up so your target grows without you thinking
              about it.
            </p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {plan.dailyTarget} a day · {plan.frequency}× sets
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From {plan.effectiveDate}
                      {plan.note ? ` · ${plan.note}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove scheduled change for ${plan.effectiveDate}`}
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ data: { id: plan.id } })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6" aria-labelledby="streak-heading">
          <h2 id="streak-heading" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Flame className="size-4 text-primary" aria-hidden="true" />
            Streak tracking
          </h2>
          {stats ? (
            <StreakTimeline
              timeline={stats.streakTimeline}
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              dailyTarget={stats.dailyTarget}
              restDaysLeft={stats.restDaysLeft}
              restAllowance={stats.restAllowance}
              restWindowDays={stats.restWindowDays}
              onGrace={stats.onGrace}
            />
          ) : (
            <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
          )}
        </section>

        {history.length > 0 ? (
          <section className="mt-6" aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <Target className="size-4 text-primary" aria-hidden="true" />
              Applied changes
            </h2>
            <ul className="space-y-2">
              {history.map((plan) => (
                <li key={plan.id} className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {plan.dailyTarget} a day · {plan.frequency}× sets
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Applied {plan.effectiveDate}
                    {plan.note ? ` · ${plan.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Button asChild variant="ghost" className="mt-6 h-11 w-full rounded-full font-bold">
          <Link to="/me">Back to profile</Link>
        </Button>
      </main>

      <TabBar active={4} />
    </div>
  );
}

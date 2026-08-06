import { Suspense, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { HeartPulse, Info, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TabBar } from "@/components/pushup/TabBar";
import { getToday } from "@/lib/pushups.functions";
import {
  buildFactHistory,
  formatFactDate,
  WELLBEING_CATEGORIES,
  type WellbeingCategory,
  type WellbeingEntry,
} from "@/lib/wellbeing";
import { cn } from "@/lib/utils";

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const wellbeingQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["today", date],
    queryFn: () => getToday({ data: { today: date, timezone: localTimezone() } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/wellbeing")({
  head: () => ({
    meta: [
      { title: "Wellbeing — daily push-up facts & habits" },
      {
        name: "description",
        content:
          "A fresh wellbeing fact for every day of your push-up challenge, plus a dated history so you can revisit anything you missed.",
      },
      { property: "og:title", content: "Wellbeing — daily push-up facts & habits" },
      {
        property: "og:description",
        content:
          "Sleep, mood, strength and recovery insights paired with your daily push-up targets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(wellbeingQueryOptions(localToday()));
  },
  errorComponent: ({ error }) => (
    <Shell>
      <div role="alert" className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">We couldn't load your wellbeing feed</p>
        <p className="mt-1">{error.message}</p>
      </div>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
        Nothing here yet — start your challenge to unlock daily facts.
      </p>
    </Shell>
  ),
  pendingComponent: () => (
    <Shell>
      <FeedSkeleton />
    </Shell>
  ),
  component: WellbeingPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="bg-gradient-to-b from-primary to-primary/85 px-5 pb-8 pt-6 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-card/15">
            <HeartPulse className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">Wellbeing</h1>
            <p className="text-sm opacity-90">One idea a day to make the reps stick</p>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 px-5 pb-8">{children}</main>

      <TabBar active={3} />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-44 animate-pulse rounded-3xl bg-card" />
      <div className="h-9 animate-pulse rounded-full bg-secondary" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}

function WellbeingPage() {
  return (
    <Shell>
      <Suspense fallback={<FeedSkeleton />}>
        <WellbeingFeed />
      </Suspense>
    </Shell>
  );
}

function WellbeingFeed() {
  const today = localToday();
  const { data } = useSuspenseQuery(wellbeingQueryOptions(today));
  const [filter, setFilter] = useState<WellbeingCategory | "All">("All");
  const [selected, setSelected] = useState<WellbeingEntry | null>(null);

  const entries = useMemo(
    () => buildFactHistory(data.settings.startDate, today),
    [data.settings.startDate, today],
  );

  const todayEntry = entries[0];
  const past = entries.slice(1);
  const visible = past.filter((e) => filter === "All" || e.fact.category === filter);

  return (
    <>
      {todayEntry ? (
        <section
          className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
          aria-labelledby="today-fact-heading"
        >
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Today · Day {todayEntry.dayNumber} · {todayEntry.fact.category}
          </p>
          <h2 id="today-fact-heading" className="mt-2 text-lg font-extrabold text-foreground">
            {todayEntry.fact.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {todayEntry.fact.body}
          </p>
          <Button asChild className="mt-4 h-12 w-full rounded-full text-base font-bold">
            <Link to="/today">
              <Plus className="size-5" aria-hidden="true" />
              Put it into practice — log a set
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-2 text-sm font-bold text-foreground">
          Fact history
        </h2>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {(["All", ...WELLBEING_CATEGORIES] as const).map((cat) => {
            const isActive = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(cat)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {past.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <HeartPulse className="mx-auto size-6 text-primary" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-foreground">
              Your history starts tomorrow
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Today is day one of your challenge. Every day you keep going adds a new fact here.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm font-semibold text-foreground">No {filter} facts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep going — categories rotate as your challenge continues.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 font-semibold text-primary"
              onClick={() => setFilter("All")}
            >
              Show all facts
            </Button>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {visible.map((entry) => (
              <li key={entry.date}>
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="w-full rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary"
                >
                  <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {formatFactDate(entry.date)} · Day {entry.dayNumber} · {entry.fact.category}
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">{entry.fact.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {entry.fact.body}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        General wellbeing information, not medical advice. Consult your GP or physiotherapist before
        increasing exercise intensity.
      </p>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {selected ? (
            <>
              <SheetHeader className="text-left">
                <p className="text-xs font-semibold text-primary tabular-nums">
                  {formatFactDate(selected.date)} · Day {selected.dayNumber} ·{" "}
                  {selected.fact.category}
                </p>
                <SheetTitle className="text-lg font-extrabold">{selected.fact.title}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {selected.fact.body}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">Source: {selected.fact.source}</p>
                <Button asChild className="mt-5 h-12 w-full rounded-full text-base font-bold">
                  <Link to="/today">
                    <Plus className="size-5" aria-hidden="true" />
                    Log a set now
                  </Link>
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

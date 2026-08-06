import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Info, PiggyBank, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DayStrip } from "@/components/pushup/DayStrip";
import { LogSheet } from "@/components/pushup/LogSheet";
import { ProgressRing } from "@/components/pushup/ProgressRing";
import { SetChips, type PushupSet } from "@/components/pushup/SetChips";
import { TabBar } from "@/components/pushup/TabBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Push Daily — Daily push-up targets with your friends" },
      {
        name: "description",
        content:
          "Set your own daily push-up amount and frequency, log reps as you go, and keep your squad moving together.",
      },
      { property: "og:title", content: "Push Daily — Daily push-up targets with your friends" },
      {
        property: "og:description",
        content:
          "Set your own daily push-up amount and frequency, log reps as you go, and keep your squad moving together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const DAILY_TARGET = 240;
const INITIAL_SETS: PushupSet[] = [
  { time: "08:00", reps: 60, target: 60 },
  { time: "12:00", reps: 60, target: 60 },
  { time: "17:00", reps: 0, target: 60 },
  { time: "21:00", reps: 0, target: 60 },
];

function Home() {
  const [sets, setSets] = useState<PushupSet[]>(INITIAL_SETS);
  const [logOpen, setLogOpen] = useState(false);

  const total = sets.reduce((sum, s) => sum + s.reps, 0);
  const nextSet = sets.find((s) => s.reps < s.target) ?? sets[sets.length - 1]!;

  function handleLog(reps: number, slot: string) {
    const previousSets = sets;
    const nextTotal = total + reps;
    setSets((current) =>
      current.map((s) => (s.time === slot ? { ...s, reps: s.reps + reps } : s)),
    );

    const justCompleted = total < DAILY_TARGET && nextTotal >= DAILY_TARGET;
    toast.success(
      justCompleted
        ? `You did it! ${nextTotal} of ${DAILY_TARGET} today.`
        : `${reps} logged. ${nextTotal} of ${DAILY_TARGET} today.`,
      {
        duration: 6000,
        action: { label: "Undo", onClick: () => setSets(previousSets) },
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-card/60">
              Push Daily
            </p>
            <h1 className="mt-1 text-2xl font-bold">Day 13</h1>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1 rounded-full bg-card/10 px-3 py-1.5 text-sm font-semibold"
              aria-label="Current streak: 11 days"
            >
              <Flame className="size-4 text-primary" aria-hidden="true" />
              <span aria-hidden="true">11</span>
            </span>
            <button
              type="button"
              aria-label="Targets and settings"
              className="flex size-11 items-center justify-center rounded-full bg-card/10"
            >
              <Settings className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 px-5 pb-8">
        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]">
          <DayStrip days={21} current={13} completed={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} />

          <div className="mt-5 flex justify-center">
            <ProgressRing value={total} target={DAILY_TARGET} />
          </div>

          <p className="mt-3 text-center text-sm text-muted-foreground">
            Next set at <span className="font-semibold text-foreground">{nextSet.time}</span> —{" "}
            {Math.max(nextSet.target - nextSet.reps, 0)} to go
          </p>

          <div className="mt-5 space-y-2">
            <Button
              className="h-13 w-full rounded-full py-4 text-base font-bold"
              onClick={() => setLogOpen(true)}
            >
              <Plus className="size-5" aria-hidden="true" />
              Log push-ups
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-full text-base font-semibold">
              <PiggyBank className="size-5" aria-hidden="true" />
              Bank ahead
            </Button>
          </div>
        </section>

        <section className="mt-5" aria-labelledby="sets-heading">
          <h2 id="sets-heading" className="mb-2 text-sm font-bold text-foreground">
            Today's sets
          </h2>
          <SetChips sets={sets} />
        </section>

        <section className="mt-5 rounded-2xl bg-accent p-4" aria-labelledby="fact-heading">
          <h2 id="fact-heading" className="text-sm font-bold text-accent-foreground">
            Today's wellbeing fact
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Regular moderate exercise is linked with better sleep quality — and better sleep is one
            of the strongest supports for day-to-day mental wellbeing.
          </p>
          <button type="button" className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Read more
          </button>
        </section>

        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Not medical advice. Consult your GP or physiotherapist before increasing exercise
          intensity.
        </p>
      </main>

      <TabBar active={0} />

      <LogSheet
        open={logOpen}
        onOpenChange={setLogOpen}
        sets={sets}
        defaultSlot={nextSet.time}
        onLog={handleLog}
      />
    </div>
  );
}

import { useState } from "react";
import { Flame, Info, LogOut, PiggyBank, Plus, Share2, Sliders } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BankSheet } from "@/components/pushup/BankSheet";
import { DayStrip } from "@/components/pushup/DayStrip";
import { InviteSheet } from "@/components/pushup/InviteSheet";
import { LogSheet } from "@/components/pushup/LogSheet";
import { ProgressRing } from "@/components/pushup/ProgressRing";
import { SetChips, type PushupSet } from "@/components/pushup/SetChips";
import { TabBar } from "@/components/pushup/TabBar";
import { TargetSheet } from "@/components/pushup/TargetSheet";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Push Daily push-up targets" },
      {
        name: "description",
        content:
          "Your daily push-up ring: log reps as you go, bank extra progress, adjust your target and frequency, and invite friends to your team.",
      },
      { property: "og:title", content: "Today — Push Daily push-up targets" },
      {
        property: "og:description",
        content:
          "Log reps, bank extra progress and keep your streak going with your push-up team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Today,
});

const SLOT_TIMES: Record<number, string[]> = {
  1: ["08:00"],
  2: ["08:00", "18:00"],
  3: ["08:00", "13:00", "19:00"],
  4: ["08:00", "12:00", "17:00", "21:00"],
  6: ["07:00", "10:00", "13:00", "16:00", "19:00", "21:30"],
};

function buildSets(dailyTarget: number, frequency: number, previous: PushupSet[]): PushupSet[] {
  const times = SLOT_TIMES[frequency] ?? SLOT_TIMES[4]!;
  const base = Math.floor(dailyTarget / frequency);
  let remainder = dailyTarget - base * frequency;
  return times.map((time, i) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      time,
      target: base + extra,
      reps: previous[i]?.reps ?? 0,
    };
  });
}

const INITIAL_TARGET = 240;
const INITIAL_FREQUENCY = 4;
const INITIAL_SETS: PushupSet[] = [
  { time: "08:00", reps: 60, target: 60 },
  { time: "12:00", reps: 60, target: 60 },
  { time: "17:00", reps: 0, target: 60 },
  { time: "21:00", reps: 0, target: 60 },
];

function Today() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dailyTarget, setDailyTarget] = useState(INITIAL_TARGET);
  const [frequency, setFrequency] = useState(INITIAL_FREQUENCY);
  const [sets, setSets] = useState<PushupSet[]>(INITIAL_SETS);
  const [bank, setBank] = useState(0);
  const [teamName, setTeamName] = useState("Morning Crew");
  const [logOpen, setLogOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const total = sets.reduce((sum, s) => sum + s.reps, 0);
  const nextSet = sets.find((s) => s.reps < s.target) ?? sets[sets.length - 1]!;
  const surplus = Math.max(total - dailyTarget, 0);
  const remainingToday = Math.max(dailyTarget - total, 0);

  const who =
    (user.user_metadata?.["display_name"] as string | undefined) ||
    (user.user_metadata?.["full_name"] as string | undefined) ||
    user.email?.split("@")[0] ||
    "you";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  function handleLog(reps: number, slot: string) {
    const previousSets = sets;
    const nextTotal = total + reps;
    setSets((current) =>
      current.map((s) => (s.time === slot ? { ...s, reps: s.reps + reps } : s)),
    );

    const justCompleted = total < dailyTarget && nextTotal >= dailyTarget;
    toast.success(
      justCompleted
        ? `You did it! ${nextTotal} of ${dailyTarget} today.`
        : `${reps} logged. ${nextTotal} of ${dailyTarget} today.`,
      {
        duration: 6000,
        action: { label: "Undo", onClick: () => setSets(previousSets) },
      },
    );
  }

  function handleSaveTarget(nextTarget: number, nextFrequency: number) {
    setDailyTarget(nextTarget);
    setFrequency(nextFrequency);
    setSets((current) => buildSets(nextTarget, nextFrequency, current));
    toast.success(
      `Target set: ${nextTarget} push-ups across ${nextFrequency} ${nextFrequency === 1 ? "set" : "sets"} a day.`,
    );
  }

  // Move surplus reps out of today's log and into the bank, newest sets first.
  function handleDeposit(reps: number) {
    setSets((current) => {
      let left = reps;
      const next = [...current];
      for (let i = next.length - 1; i >= 0 && left > 0; i -= 1) {
        const take = Math.min(next[i]!.reps, left);
        next[i] = { ...next[i]!, reps: next[i]!.reps - take };
        left -= take;
      }
      return next;
    });
    setBank((b) => b + reps);
    toast.success(`${reps} reps banked for a future day.`);
  }

  // Spend banked reps against today's unfinished sets, earliest first.
  function handleWithdraw(reps: number) {
    setSets((current) => {
      let left = reps;
      return current.map((s) => {
        if (left <= 0) return s;
        const room = Math.max(s.target - s.reps, 0);
        const give = Math.min(room, left);
        left -= give;
        return give > 0 ? { ...s, reps: s.reps + give } : s;
      });
    });
    setBank((b) => Math.max(b - reps, 0));
    toast.success(`${reps} banked reps applied to today.`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-card/60">
              {teamName}
            </p>
            <h1 className="mt-1 text-2xl font-bold">Day 13</h1>
            <p className="mt-0.5 text-xs text-card/60">Signed in as {who}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 rounded-full bg-card/10 px-3 py-1.5 text-sm font-semibold"
              aria-label="Current streak: 11 days"
            >
              <Flame className="size-4 text-primary" aria-hidden="true" />
              <span aria-hidden="true">11</span>
            </span>
            <button
              type="button"
              aria-label="Invite friends and share your challenge link"
              onClick={() => setInviteOpen(true)}
              className="flex size-11 items-center justify-center rounded-full bg-card/10"
            >
              <Share2 className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Targets and settings"
              onClick={() => setTargetOpen(true)}
              className="flex size-11 items-center justify-center rounded-full bg-card/10"
            >
              <Sliders className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Sign out"
              onClick={handleSignOut}
              className="flex size-11 items-center justify-center rounded-full bg-card/10"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 px-5 pb-8">
        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]">
          <DayStrip days={21} current={13} completed={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} />

          <div className="mt-5 flex justify-center">
            <ProgressRing value={total} target={dailyTarget} />
          </div>

          <p className="mt-3 text-center text-sm text-muted-foreground">
            Next set at <span className="font-semibold text-foreground">{nextSet.time}</span> —{" "}
            {Math.max(nextSet.target - nextSet.reps, 0)} to go
          </p>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {dailyTarget} a day · {frequency}× sets
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {Math.ceil(dailyTarget / frequency)} per set · {bank} banked
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-primary"
              onClick={() => setTargetOpen(true)}
            >
              Adjust
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            <Button
              className="h-13 w-full rounded-full py-4 text-base font-bold"
              onClick={() => setLogOpen(true)}
            >
              <Plus className="size-5" aria-hidden="true" />
              Log push-ups
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-full text-base font-semibold"
              onClick={() => setBankOpen(true)}
            >
              <PiggyBank className="size-5" aria-hidden="true" />
              Bank push-ups{bank > 0 ? ` (${bank})` : ""}
            </Button>
            <Button
              variant="ghost"
              className="h-12 w-full rounded-full text-base font-semibold"
              onClick={() => setInviteOpen(true)}
            >
              <Share2 className="size-5" aria-hidden="true" />
              Invite friends to {teamName}
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
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
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

      <BankSheet
        open={bankOpen}
        onOpenChange={setBankOpen}
        surplus={surplus}
        bank={bank}
        remainingToday={remainingToday}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
      />

      <TargetSheet
        open={targetOpen}
        onOpenChange={setTargetOpen}
        dailyTarget={dailyTarget}
        frequency={frequency}
        onSave={handleSaveTarget}
      />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        teamName={teamName}
        onTeamNameChange={setTeamName}
        inviteCode="PUSH-13X4"
      />
    </div>
  );
}

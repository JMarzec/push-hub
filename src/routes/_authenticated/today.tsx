import { useState } from "react";
import { Flame, Info, LogOut, PiggyBank, Plus, Share2, Sliders } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BankSheet } from "@/components/pushup/BankSheet";
import { DayStrip } from "@/components/pushup/DayStrip";
import { InviteSheet } from "@/components/pushup/InviteSheet";
import { LogSheet } from "@/components/pushup/LogSheet";
import { ProgressRing } from "@/components/pushup/ProgressRing";
import { SetChips } from "@/components/pushup/SetChips";
import { TabBar } from "@/components/pushup/TabBar";
import { TargetSheet } from "@/components/pushup/TargetSheet";
import { useReminders } from "@/hooks/useReminders";
import { composeSets } from "@/lib/pushup-schedule";
import { factForDate } from "@/lib/wellbeing";
import { WEEKDAY_LABELS } from "@/lib/streaks";
import { createTeam, getMyTeam, renameTeam } from "@/lib/teams.functions";
import { listConversions } from "@/lib/conversions.functions";
import type { ActivityLog } from "@/components/pushup/LogSheet";
import {
  deleteLog,
  getToday,
  logReps,
  moveBank,
  undoBankEntry,
  updateTargetSettings,

} from "@/lib/pushups.functions";

function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const todayQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["today", date],
    queryFn: () => getToday({ data: { today: date, timezone: localTimezone() } }),
    staleTime: 30_000,
  });

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
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(todayQueryOptions(localToday()));
  },
  component: Today,
});

const CHALLENGE_DAYS = 21;

function Today() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [today] = useState(localToday);

  const options = todayQueryOptions(today);
  const { data } = useSuspenseQuery(options);

  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () => getMyTeam(),
    staleTime: 15_000,
  });
  const team = teamQuery.data?.team ?? null;
  const conversionsQuery = useQuery({
    queryKey: ["conversions"],
    queryFn: () => listConversions(),
    staleTime: 60_000,
  });
  const conversions = conversionsQuery.data?.conversions ?? [];
  const teamName = team?.name ?? "Solo challenge";
  const [logOpen, setLogOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["today"] });
    void queryClient.invalidateQueries({ queryKey: ["team"] });
  };

  const logMutation = useMutation({
    mutationFn: useServerFn(logReps),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const undoMutation = useMutation({
    mutationFn: useServerFn(deleteLog),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const targetMutation = useMutation({
    mutationFn: useServerFn(updateTargetSettings),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const invalidateTeam = () => queryClient.invalidateQueries({ queryKey: ["team"] });
  const createTeamMutation = useMutation({
    mutationFn: useServerFn(createTeam),
    onSuccess: invalidateTeam,
    onError: (error: Error) => toast.error(error.message),
  });
  const renameTeamMutation = useMutation({
    mutationFn: useServerFn(renameTeam),
    onSuccess: invalidateTeam,
    onError: (error: Error) => toast.error(error.message),
  });
  const bankMutation = useMutation({
    mutationFn: useServerFn(moveBank),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const undoBankMutation = useMutation({
    mutationFn: useServerFn(undoBankEntry),
    onSuccess: () => {
      invalidate();
      toast.success("Transfer reverted.");
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const { dailyTarget, frequency, slotTimes } = data.settings;
  const followingSquadTarget = data.settings.targetSource === "squad";
  const sets = composeSets(
    dailyTarget,
    slotTimes,
    data.repsBySlot,
    data.depositedToday,
    data.withdrawnToday,
  );

  const total = sets.reduce((sum, s) => sum + s.reps, 0);

  // Keep set-time nudges firing while the Home screen is open.
  useReminders({
    enabled: data.settings.remindersEnabled,
    today,
    slotTimes: data.settings.slotTimes,
    perSet: Math.ceil(data.settings.dailyTarget / data.settings.frequency),
    remaining: Math.max(data.settings.dailyTarget - total, 0),
  });
  const todaysFact = factForDate(data.settings.startDate, today);
  const nextSet = sets.find((s) => s.reps < s.target) ?? sets[sets.length - 1]!;
  const surplus = Math.max(total - dailyTarget, 0);
  const remainingToday = Math.max(dailyTarget - total, 0);
  const bank = data.bank;

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

  async function handleLog(reps: number, slot: string) {
    const nextTotal = total + reps;
    const justCompleted = total < dailyTarget && nextTotal >= dailyTarget;
    try {
      const { id } = await logMutation.mutateAsync({ data: { reps, slot, today } });
      toast.success(
        justCompleted
          ? `You did it! ${nextTotal} of ${dailyTarget} today.`
          : `${reps} logged. ${nextTotal} of ${dailyTarget} today.`,
        {
          duration: 6000,
          action: {
            label: "Undo",
            onClick: () => {
              void undoMutation.mutateAsync({ data: { id } });
            },
          },
        },
      );
    } catch {
      // surfaced by the mutation's onError
    }
  }

  async function handleLogActivity(entry: ActivityLog) {
    const nextTotal = total + entry.reps;
    try {
      const { id } = await logMutation.mutateAsync({
        data: {
          reps: entry.reps,
          slot: entry.slot,
          today,
          activityKey: entry.activityKey,
          activityLabel: entry.activityLabel,
          activityAmount: entry.activityAmount,
          activityUnit: entry.activityUnit,
        },
      });
      toast.success(
        `${entry.activityAmount} ${entry.activityUnit} of ${entry.activityLabel} = ${entry.reps} push-ups. ${nextTotal} of ${dailyTarget} today.`,
        {
          duration: 6000,
          action: {
            label: "Undo",
            onClick: () => {
              void undoMutation.mutateAsync({ data: { id } });
            },
          },
        },
      );
    } catch {
      // surfaced by the mutation's onError
    }
  }

  async function handleSaveTarget(
    nextTarget: number,
    nextFrequency: number,
    nextRestDay: number | null,
  ) {
    await targetMutation.mutateAsync({
      data: { dailyTarget: nextTarget, frequency: nextFrequency, restDayOfWeek: nextRestDay },
    });
    toast.success(
      `Target set: ${nextTarget} push-ups across ${nextFrequency} ${nextFrequency === 1 ? "set" : "sets"} a day${
        nextRestDay === null ? "" : `, ${WEEKDAY_LABELS[nextRestDay]}s off`
      }.`,
    );
  }

  function bankUndoToast(message: string, entryId: string) {
    toast.success(message, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          void undoBankMutation.mutateAsync({ data: { entryId } });
        },
      },
    });
  }

  async function handleDeposit(reps: number) {
    const { entryId } = await bankMutation.mutateAsync({
      data: { reps, kind: "deposit", today },
    });
    bankUndoToast(`${reps} reps banked for a future day.`, entryId);
  }

  async function handleWithdraw(reps: number) {
    const { entryId } = await bankMutation.mutateAsync({
      data: { reps, kind: "withdrawal", today },
    });
    bankUndoToast(`${reps} banked reps applied to today.`, entryId);
  }


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-card/60">
              {teamName}
            </p>
            <h1 className="mt-1 text-2xl font-bold">Day {data.dayNumber}</h1>
            <p className="mt-0.5 text-xs text-card/60">Signed in as {who}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 rounded-full bg-card/10 px-3 py-1.5 text-sm font-semibold"
              aria-label={`Current streak: ${data.streak} days`}
            >
              <Flame className="size-4 text-primary" aria-hidden="true" />
              <span aria-hidden="true">{data.streak}</span>
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
          <DayStrip
            days={CHALLENGE_DAYS}
            current={Math.min(data.dayNumber, CHALLENGE_DAYS)}
            completed={data.completedDays}
          />

          {data.settings.isRecoveryDay ? (
            <p className="mt-4 rounded-2xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
              Recovery day — no target today. Your streak keeps running, and anything you log still
              counts.
            </p>
          ) : null}

          <div className="mt-5 flex justify-center">
            <ProgressRing value={total} target={dailyTarget} />
          </div>

          <p className="mt-3 text-center text-sm text-muted-foreground">
            {data.settings.isRecoveryDay ? (
              "Resting today — log only if you feel like it."
            ) : (
              <>
                Next set at <span className="font-semibold text-foreground">{nextSet.time}</span> —{" "}
                {Math.max(nextSet.target - nextSet.reps, 0)} to go
              </>
            )}
          </p>


          <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {dailyTarget} a day · {frequency}× sets
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {Math.ceil(dailyTarget / frequency)} per set · {bank} banked
              </p>
              {followingSquadTarget ? (
                <p className="mt-0.5 text-xs font-semibold text-primary">
                  Following {data.settings.squadName ?? "squad"} target
                </p>
              ) : null}
            </div>
            {followingSquadTarget ? (
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-primary"
                onClick={() => void navigate({ to: "/squad" })}
              >
                Squad
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-primary"
                onClick={() => setTargetOpen(true)}
              >
                Adjust
              </Button>
            )}
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
              {team ? `Invite friends to ${team.name}` : "Start a team & invite friends"}
            </Button>
          </div>
        </section>

        <section className="mt-5" aria-labelledby="sets-heading">
          <h2 id="sets-heading" className="mb-2 text-sm font-bold text-foreground">
            Today's sets
          </h2>
          <SetChips sets={sets} />
        </section>

        {statsQuery.data ? (
          <StreakBreakdown
            timeline={statsQuery.data.streakTimeline}
            currentStreak={statsQuery.data.currentStreak}
            dailyTarget={statsQuery.data.dailyTarget}
            restDaysLeft={statsQuery.data.restDaysLeft}
            restAllowance={statsQuery.data.restAllowance}
          />
        ) : null}



        <section className="mt-5 rounded-2xl bg-accent p-4" aria-labelledby="fact-heading">
          <h2 id="fact-heading" className="text-sm font-bold text-accent-foreground">
            Today's wellbeing fact
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {todaysFact.body}
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2 font-semibold text-primary"
          >
            <Link to="/wellbeing">See all wellbeing facts</Link>
          </Button>
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
        conversions={conversions}
        onLogActivity={handleLogActivity}
      />

      <BankSheet
        open={bankOpen}
        onOpenChange={setBankOpen}
        surplus={surplus}
        loggedToday={total}

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
        restDayOfWeek={data.settings.restDayOfWeek}
        onSave={handleSaveTarget}
      />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        team={team}
        busy={createTeamMutation.isPending || renameTeamMutation.isPending}
        onCreateTeam={async (name) => {
          await createTeamMutation.mutateAsync({ data: { name } });
          toast.success(`${name} created — share your link!`);
        }}
        onRenameTeam={async (name) => {
          if (!team) return;
          await renameTeamMutation.mutateAsync({ data: { teamId: team.id, name } });
          toast.success(`Team renamed to ${name}.`);
        }}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
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
import { Bell, CalendarClock, Flame, Info, LogOut, Sliders, Trophy, User, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabBar } from "@/components/pushup/TabBar";
import { TargetSheet } from "@/components/pushup/TargetSheet";
import { AvatarPicker } from "@/components/pushup/AvatarPicker";
import { ReminderSheet } from "@/components/pushup/ReminderSheet";
import { useReminders } from "@/hooks/useReminders";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, removeAvatar, setAvatar, updateProfile } from "@/lib/profile.functions";
import {
  getStats,
  getToday,
  updateReminderSettings,
  updateTargetSettings,
} from "@/lib/pushups.functions";
import { getMyTeam, leaveTeam } from "@/lib/teams.functions";

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

const profileQueryOptions = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Me — Push Daily profile & settings" },
      {
        name: "description",
        content:
          "Your Push Daily profile: edit your display name, set your daily push-up target and frequency, review lifetime stats and manage your squad.",
      },
      { property: "og:title", content: "Me — Push Daily profile & settings" },
      {
        property: "og:description",
        content: "Edit your name, targets and squad membership for the Push Daily challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(profileQueryOptions());
  },
  component: Me,
});

function Me() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [today] = useState(localToday);
  const [targetOpen, setTargetOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const { data: profile } = useSuspenseQuery(profileQueryOptions());

  const statsQuery = useQuery({
    queryKey: ["stats", today],
    queryFn: () => getStats({ data: { today } }),
    staleTime: 30_000,
  });
  const settingsQuery = useQuery({
    queryKey: ["today", today],
    queryFn: () => getToday({ data: { today } }),
    staleTime: 15_000,
  });
  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () => getMyTeam(),
    staleTime: 15_000,
  });

  const [name, setName] = useState(profile.displayName);
  useEffect(() => setName(profile.displayName), [profile.displayName]);

  const nameMutation = useMutation({
    mutationFn: useServerFn(updateProfile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Display name updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avatarMutation = useMutation({
    mutationFn: useServerFn(setAvatar),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Profile photo updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avatarRemoveMutation = useMutation({
    mutationFn: useServerFn(removeAvatar),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Profile photo removed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reminderMutation = useMutation({
    mutationFn: useServerFn(updateReminderSettings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success("Reminder settings saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const targetMutation = useMutation({
    mutationFn: useServerFn(updateTargetSettings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const leaveMutation = useMutation({
    mutationFn: useServerFn(leaveTeam),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("You left the squad.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settings = settingsQuery.data?.settings;
  const dailyTarget = settings?.dailyTarget ?? 50;
  const frequency = settings?.frequency ?? 4;
  const stats = statsQuery.data;
  const team = teamQuery.data?.team ?? null;
  const slotTimes = settings?.slotTimes ?? ["08:00", "12:00", "17:00", "21:00"];
  const remindersEnabled = settings?.remindersEnabled ?? false;
  const loggedToday = Object.values(
    (settingsQuery.data?.repsBySlot ?? {}) as Record<string, number>,
  ).reduce((sum, n) => sum + n, 0);

  const reminders = useReminders({
    enabled: remindersEnabled,
    today,
    slotTimes,
    perSet: Math.ceil(dailyTarget / frequency),
    remaining: Math.max(dailyTarget - loggedToday, 0),
  });

  const initials =
    (profile.displayName || user.email || "?")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const memberSince = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const dirty = name.trim().length > 0 && name.trim() !== profile.displayName;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto flex max-w-md items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Your profile photo"
                className="size-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">
              {profile.displayName || "Your profile"}
            </h1>
            <p className="truncate text-xs text-card/60">{user.email}</p>
            {memberSince ? (
              <p className="mt-0.5 text-xs text-card/60">Member since {memberSince}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8">
        <section
          className="-mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm"
          aria-label="Lifetime stats"
        >
          {[
            { label: "All-time reps", value: stats?.totalReps ?? 0, icon: Trophy },
            { label: "Current streak", value: stats?.currentStreak ?? 0, icon: Flame },
            { label: "Days logged", value: stats?.daysLogged ?? 0, icon: User },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="mx-auto size-4 text-primary" aria-hidden="true" />
              <p className="mt-1 text-xl font-extrabold tabular-nums text-foreground">
                {s.value}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4" aria-labelledby="photo-heading">
          <h2 id="photo-heading" className="text-sm font-bold text-foreground">
            Profile photo
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your squad sees this next to your name on the leaderboard.
          </p>
          <div className="mt-3">
            <AvatarPicker
              userId={user.id}
              avatarUrl={profile.avatarUrl}
              initials={initials}
              hasAvatar={Boolean(profile.avatarPath)}
              busy={avatarMutation.isPending || avatarRemoveMutation.isPending}
              onUploaded={(path) => avatarMutation.mutate({ data: { path } })}
              onRemove={() => avatarRemoveMutation.mutate({})}
            />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4" aria-labelledby="name-heading">
          <h2 id="name-heading" className="text-sm font-bold text-foreground">
            Display name
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the name your squad sees on the leaderboard.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="display-name" className="sr-only">
                Display name
              </Label>
              <Input
                id="display-name"
                value={name}
                maxLength={40}
                placeholder="e.g. Alex"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              className="h-10 rounded-full px-5 font-bold"
              disabled={!dirty || nameMutation.isPending}
              onClick={() => nameMutation.mutate({ data: { displayName: name.trim() } })}
            >
              Save
            </Button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4" aria-labelledby="target-heading">
          <h2 id="target-heading" className="text-sm font-bold text-foreground">
            Daily target
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dailyTarget} push-ups across {frequency} {frequency === 1 ? "set" : "sets"} a day ·{" "}
            {Math.ceil(dailyTarget / frequency)} per set
          </p>
          {settingsQuery.data?.settings.targetSource === "squad" ? (
            <>
              <p className="mt-1 text-sm font-semibold text-primary">
                Coming from your squad target
                {settingsQuery.data?.settings.squadName ? ` (${settingsQuery.data.settings.squadName})` : ""}.
              </p>
              <Button
                variant="outline"
                className="mt-3 h-11 w-full rounded-full font-bold"
                onClick={() => void navigate({ to: "/squad" })}
              >
                <Sliders className="size-5" aria-hidden="true" />
                Manage in squad
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="mt-3 h-11 w-full rounded-full font-bold"
              onClick={() => setTargetOpen(true)}
            >
              <Sliders className="size-5" aria-hidden="true" />
              Adjust count & frequency
            </Button>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4" aria-labelledby="reminders-heading">
          <h2 id="reminders-heading" className="text-sm font-bold text-foreground">
            Reminders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reminders.permission === "unsupported"
              ? "Your browser doesn't support notifications."
              : remindersEnabled
                ? `On · ${slotTimes.join(", ")}`
                : "Off — turn on nudges for each set time."}
          </p>
          <Button
            variant="outline"
            className="mt-3 h-11 w-full rounded-full font-bold"
            onClick={() => setRemindersOpen(true)}
          >
            <Bell className="size-5" aria-hidden="true" />
            Manage reminders
          </Button>
          <Button asChild variant="ghost" className="mt-2 h-10 w-full rounded-full font-bold">
            <Link to="/reminders">
              <Wrench className="size-4" aria-hidden="true" />
              Troubleshoot reminders
            </Link>
          </Button>

        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4" aria-labelledby="planner-heading">
          <h2 id="planner-heading" className="text-sm font-bold text-foreground">
            Goal planner
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule future target and frequency changes, and watch your streak respond.
          </p>
          <Button asChild variant="outline" className="mt-3 h-11 w-full rounded-full font-bold">
            <Link to="/planner">
              <CalendarClock className="size-5" aria-hidden="true" />
              Open planner
            </Link>
          </Button>
        </section>

        <section
          className="mt-4 rounded-2xl border border-border bg-card p-4"
          aria-labelledby="conversions-heading"
        >
          <h2 id="conversions-heading" className="text-sm font-bold text-foreground">
            Activity conversions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Count swims, runs, squats and your own activities as push-up equivalents.
          </p>
          <Button asChild variant="outline" className="mt-3 h-11 w-full rounded-full font-bold">
            <Link to="/conversions">
              <Repeat className="size-5" aria-hidden="true" />
              Set conversion rates
            </Link>
          </Button>
        </section>


        <section className="mt-4 rounded-2xl border border-border bg-card p-4" aria-labelledby="squad-heading">
          <h2 id="squad-heading" className="text-sm font-bold text-foreground">
            Squad
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {team ? team.name : "You're training solo — start a squad from the Progress tab."}
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild variant="outline" className="h-11 flex-1 rounded-full font-bold">
              <Link to="/squad">
                <Users className="size-5" aria-hidden="true" />
                {team ? "View squad" : "Explore squad"}
              </Link>
            </Button>
            {team ? (
              <Button
                variant="ghost"
                className="h-11 rounded-full font-bold text-destructive"
                disabled={leaveMutation.isPending}
                onClick={() => leaveMutation.mutate({ data: { teamId: team.id } })}
              >
                Leave
              </Button>
            ) : null}
          </div>
        </section>

        <Button
          variant="ghost"
          className="mt-5 h-11 w-full rounded-full font-bold text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="size-5" aria-hidden="true" />
          Sign out
        </Button>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Not medical advice. Consult your GP or physiotherapist before increasing exercise
          intensity.
        </p>
      </main>

      <TabBar active={4} />

      <TargetSheet
        open={targetOpen}
        onOpenChange={setTargetOpen}
        dailyTarget={dailyTarget}
        frequency={frequency}
        onSave={(nextTarget, nextFrequency) => {
          targetMutation.mutate({
            data: { dailyTarget: nextTarget, frequency: nextFrequency },
          });
          toast.success(
            `Target set: ${nextTarget} push-ups across ${nextFrequency} ${nextFrequency === 1 ? "set" : "sets"} a day.`,
          );
        }}
      />

      <ReminderSheet
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        enabled={remindersEnabled}
        slotTimes={slotTimes}
        permission={reminders.permission}
        onRequestPermission={reminders.request}
        onSendTest={reminders.sendTest}
        onSave={(enabled, nextTimes) =>
          reminderMutation.mutate({ data: { enabled, slotTimes: nextTimes } })
        }
      />
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, LogOut, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "@/components/pushup/ProgressRing";
import { TabBar } from "@/components/pushup/TabBar";
import { InviteSheet } from "@/components/pushup/InviteSheet";
import { SharedTargetCard } from "@/components/pushup/SharedTargetCard";
import {
  createTeam,
  getMyTeam,
  joinTeam,
  leaveTeam,
  renameTeam,
  setFollowSharedTarget,
  setSharedTarget,
} from "@/lib/teams.functions";
import { localToday } from "@/lib/local-date";

export const teamQueryOptions = queryOptions({
  queryKey: ["team"],
  queryFn: () => getMyTeam({ data: { today: localToday() } }),
  staleTime: 5_000,
  refetchOnMount: "always",
  refetchInterval: 30_000,
});

export const Route = createFileRoute("/_authenticated/squad")({
  head: () => ({
    meta: [
      { title: "Your squad — Push Daily" },
      {
        name: "description",
        content:
          "See your push-up squad: today's progress for every member, the team total ring, weekly and all-time leaderboards, and your invite link.",
      },
      { property: "og:title", content: "Your squad — Push Daily" },
      {
        property: "og:description",
        content: "Track your friends' daily push-up progress and climb the squad leaderboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(teamQueryOptions);
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-foreground">Couldn't load your squad</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-md px-5 py-16 text-center text-muted-foreground">
      Squad not found.
    </main>
  ),
  component: Squad,
});

type Board = "today" | "week" | "all";

function Squad() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(teamQueryOptions);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [code, setCode] = useState("");
  const [board, setBoard] = useState<Board>("today");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["team"] });
    void queryClient.invalidateQueries({ queryKey: ["today"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  const createMutation = useMutation({ mutationFn: useServerFn(createTeam), onSuccess: invalidate, onError });
  const joinMutation = useMutation({ mutationFn: useServerFn(joinTeam), onSuccess: invalidate, onError });
  const renameMutation = useMutation({ mutationFn: useServerFn(renameTeam), onSuccess: invalidate, onError });
  const leaveMutation = useMutation({ mutationFn: useServerFn(leaveTeam), onSuccess: invalidate, onError });
  const sharedMutation = useMutation({
    mutationFn: useServerFn(setSharedTarget),
    onSuccess: invalidate,
    onError,
  });
  const followMutation = useMutation({
    mutationFn: useServerFn(setFollowSharedTarget),
    onSuccess: invalidate,
    onError,
  });

  const team = data.team;
  const members = data.members;
  const teamToday = members.reduce((sum, m) => sum + m.repsToday, 0);
  const teamTarget = members.reduce((sum, m) => sum + m.dailyTarget, 0) || 1;

  const ranked = [...members].sort((a, b) =>
    board === "today"
      ? b.repsToday - a.repsToday
      : board === "week"
        ? b.repsWeek - a.repsWeek
        : b.repsTotal - a.repsTotal,
  );

  function valueFor(m: (typeof members)[number]) {
    return board === "today" ? m.repsToday : board === "week" ? m.repsWeek : m.repsTotal;
  }

  if (!team) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="bg-foreground px-5 pb-8 pt-6 text-card">
          <div className="mx-auto max-w-md">
            <h1 className="text-2xl font-bold">Your squad</h1>
            <p className="mt-1 text-sm text-card/70">
              Train with friends — you'll all see each other's daily rings.
            </p>
          </div>
        </header>
        <main className="mx-auto -mt-4 w-full max-w-md flex-1 space-y-4 px-5 pb-8">
          <section className="rounded-3xl bg-card p-5 text-center shadow-[var(--shadow-ring)]">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent">
              <Users className="size-6 text-primary" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-foreground">Start a team</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Create a private squad and share the invite link with friends.
            </p>
            <Button
              className="mt-4 h-12 w-full rounded-full text-base font-bold"
              onClick={() => setInviteOpen(true)}
            >
              <Share2 className="size-5" aria-hidden="true" />
              Create team & invite
            </Button>
          </section>

          <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]">
            <h2 className="text-sm font-bold text-foreground">Have an invite code?</h2>
            <div className="mt-3 flex gap-2">
              <Input
                aria-label="Invite code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={12}
                className="h-11 font-mono uppercase"
              />
              <Button
                variant="secondary"
                className="h-11 shrink-0"
                disabled={code.trim().length < 4 || joinMutation.isPending}
                onClick={async () => {
                  await joinMutation.mutateAsync({ data: { code: code.trim() } });
                  toast.success("You're in! Welcome to the squad.");
                  setCode("");
                }}
              >
                Join
              </Button>
            </div>
          </section>
        </main>
        <TabBar active={1} />
        <InviteSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          team={null}
          busy={createMutation.isPending}
          onCreateTeam={async (name) => {
            await createMutation.mutateAsync({ data: { name } });
            toast.success(`${name} created — share your link!`);
          }}
          onRenameTeam={async () => {}}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto flex max-w-md items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-card/60">Squad</p>
            <h1 className="mt-1 text-2xl font-bold">{team.name}</h1>
            <p className="mt-0.5 text-xs text-card/60">
              {members.length} {members.length === 1 ? "member" : "members"} · code{" "}
              <span className="font-mono">{team.inviteCode}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Invite friends to this team"
            onClick={() => setInviteOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card/10"
          >
            <Share2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 space-y-4 px-5 pb-8">
        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]">
          <h2 className="text-center text-sm font-bold text-foreground">Team total today</h2>
          <div className="mt-4 flex justify-center">
            <ProgressRing value={teamToday} target={teamTarget} />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground tabular-nums">
            {teamToday} of {teamTarget} combined push-ups
          </p>
          {restingCount > 0 ? (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {restingCount} {restingCount === 1 ? "member is" : "members are"} on a recovery day —
              their target isn't counted today.
            </p>
          ) : null}
        </section>

        <SharedTargetCard
          teamName={team.name}
          isOwner={team.isOwner}
          sharedTarget={team.sharedTarget}
          sharedFrequency={team.sharedFrequency}
          followsShared={data.membership?.followsShared ?? false}
          followerCount={members.filter((m) => m.followsShared).length}
          memberCount={members.length}
          busy={sharedMutation.isPending || followMutation.isPending}
          onSaveShared={async (sharedTargetValue, sharedFrequencyValue) => {
            await sharedMutation.mutateAsync({
              data: {
                teamId: team.id,
                sharedTarget: sharedTargetValue,
                sharedFrequency: sharedFrequencyValue,
              },
            });
            toast.success(
              sharedTargetValue ? "Squad target updated." : "Squad target removed.",
            );
          }}
          onToggleFollow={async (follow) => {
            await followMutation.mutateAsync({ data: { teamId: team.id, follow } });
            toast.success(
              follow ? "You're following the squad target." : "Back to your personal target.",
            );
          }}
        />

        <section aria-labelledby="roster-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="roster-heading" className="text-sm font-bold text-foreground">
              Leaderboard
            </h2>
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              {(["today", "week", "all"] as Board[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={board === key}
                  onClick={() => setBoard(key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    board === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {key === "today" ? "Today" : key === "week" ? "7 days" : "All time"}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2">
            {ranked.map((m, i) => {
              const isMe = m.userId === user.id;
              const pct = Math.min(Math.round((m.repsToday / (m.dailyTarget || 1)) * 100), 100);
              return (
                <li
                  key={m.userId}
                  className={`rounded-2xl bg-card p-3.5 ${isMe ? "ring-2 ring-primary/40" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-extrabold text-muted-foreground">
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl}
                          alt={`${m.displayName}'s profile photo`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">
                          {(m.displayName || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-bold text-foreground">
                        {m.displayName}
                        {isMe ? <span className="text-xs text-primary">(you)</span> : null}
                        {m.role === "owner" ? (
                          <Crown className="size-3.5 text-primary" aria-label="Team owner" />
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {m.onRecoveryDay ? (
                          <>
                            <span>resting today</span>
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                              Recovery day
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold tabular-nums text-foreground">
                              {m.dailyTarget}
                            </span>
                            <span>reps target</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                m.followsShared
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {m.followsShared ? "Squad target" : "Personal"}
                            </span>
                          </>
                        )}
                      </p>


                      <div
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${m.displayName} progress today`}
                      >
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {valueFor(m)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <Button
          variant="ghost"
          className="h-12 w-full rounded-full text-base font-semibold text-destructive"
          disabled={leaveMutation.isPending}
          onClick={async () => {
            await leaveMutation.mutateAsync({ data: { teamId: team.id } });
            toast.success(`You left ${team.name}.`);
            void navigate({ to: "/squad" });
          }}
        >
          <LogOut className="size-5" aria-hidden="true" />
          Leave team
        </Button>
      </main>

      <TabBar active={1} />

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        team={team}
        busy={renameMutation.isPending}
        onCreateTeam={async () => {}}
        onRenameTeam={async (name) => {
          await renameMutation.mutateAsync({ data: { teamId: team.id, name } });
          toast.success(`Team renamed to ${name}.`);
        }}
      />
    </div>
  );
}

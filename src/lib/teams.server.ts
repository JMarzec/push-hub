import { goalForDate, hitDatesFor } from "@/lib/daily-accounting";
import { readPages } from "@/lib/paginate";
import { computeStreaks, isRecoveryDate } from "@/lib/streaks";
import type { TeamMemberStat } from "./teams.functions";

/**
 * Trusted server-only team reads.
 *
 * These replace the SECURITY DEFINER database helpers that used to be callable
 * straight from the Data API. Callers must authorise first: `fetchTeamStats`
 * is only reached after the caller's own membership row is confirmed, and
 * `lookupTeamByCode` exposes nothing beyond a team's name and size.
 */

interface TeamLookup {
  id: string;
  name: string;
  memberCount: number;
}

export async function lookupTeamByCode(code: string): Promise<TeamLookup | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: team, error } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .ilike("invite_code", code.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!team) return null;

  const { count, error: memberError } = await supabaseAdmin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);
  if (memberError) throw new Error(memberError.message);
  return { id: team.id, name: team.name, memberCount: count ?? 0 };
}

/** Caller MUST have verified the requesting user belongs to `teamId` first. */
export async function fetchTeamStats(
  teamId: string,
  sharedTarget: number | null = null,
): Promise<TeamMemberStat[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: roster, error: rosterError } = await supabaseAdmin
    .from("team_members")
    .select("user_id, role, follow_shared_target")
    .eq("team_id", teamId);
  if (rosterError) throw new Error(rosterError.message);
  const memberIds = (roster ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return [];

  // Every member shares the same UTC calendar boundary.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const weekAgo = new Date(todayMs - 6 * 86_400_000).toISOString().slice(0, 10);
  // Targets and recovery days follow UTC so every member of the squad agrees on
  // which calendar day (and weekday) is being counted, wherever they live.
  const utcToday = new Date().toISOString().slice(0, 10);

  const refreshed = await supabaseAdmin.rpc("refresh_squad_daily_goals", { p_team: teamId });
  if (refreshed.error) throw new Error(refreshed.error.message);
  const [profiles, settings, accounting, goals, plans] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", memberIds),
    supabaseAdmin
      .from("user_settings")
      .select("user_id,daily_target,rest_day_of_week,start_date")
      .in("user_id", memberIds),
    readPages((from, to) =>
      supabaseAdmin
        .rpc("squad_daily_accounting", { p_team: teamId })
        .order("user_id")
        .order("day")
        .range(from, to),
    ),
    readPages((from, to) =>
      supabaseAdmin
        .from("daily_goals")
        .select("user_id,goal_date,daily_target,rest_day_of_week")
        .in("user_id", memberIds)
        .lt("goal_date", today)
        .order("user_id")
        .order("goal_date")
        .range(from, to),
    ),
    readPages((from, to) =>
      supabaseAdmin
        .from("target_plans")
        .select("user_id,effective_date,daily_target,applied_at")
        .in("user_id", memberIds)
        .lte("effective_date", today)
        .order("effective_date")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (settings.error) throw new Error(settings.error.message);

  const nameById = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));

  // Avatars live in a private bucket, so teammates get short-lived signed URLs.
  const avatarById = new Map<string, string>();
  await Promise.all(
    (profiles.data ?? [])
      .filter((p) => p.avatar_url)
      .map(async (p) => {
        const signed = await supabaseAdmin.storage
          .from("avatars")
          .createSignedUrl(p.avatar_url ?? "", 3600);
        if (signed.data?.signedUrl) avatarById.set(p.id, signed.data.signedUrl);
      }),
  );
  const targetById = new Map((settings.data ?? []).map((s) => [s.user_id, s.daily_target]));
  const startDateById = new Map((settings.data ?? []).map((s) => [s.user_id, s.start_date]));
  const restDayById = new Map(
    (settings.data ?? []).map((s) => [s.user_id, s.rest_day_of_week ?? null]),
  );
  const todayWeekday = new Date(`${utcToday}T00:00:00Z`).getUTCDay();

  const totals = new Map<string, { today: number; twoDays: number; week: number; all: number }>();
  const repsByMember = new Map<string, Record<string, number>>();
  for (const id of memberIds) {
    const rows = accounting.filter((row) => row.user_id === id && row.day <= today);
    const daily = Object.fromEntries(
      rows.map((row) => [row.day, Math.max(0, Number(row.logged_reps) + Number(row.net_bank))]),
    );
    repsByMember.set(id, daily);
    totals.set(id, {
      today: daily[today] ?? 0,
      twoDays: Math.max(
        0,
        rows.reduce((sum, row) => sum + Number(row.rolling_reps), 0),
      ),
      week: Object.entries(daily)
        .filter(([date]) => date >= weekAgo && date <= today)
        .reduce((sum, [, reps]) => sum + reps, 0),
      all: rows.reduce((sum, row) => sum + Number(row.logged_reps), 0),
    });
  }

  const monthDates: string[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    monthDates.push(new Date(todayMs - i * 86_400_000).toISOString().slice(0, 10));
  }

  return (roster ?? [])
    .map((member) => {
      const bucket = totals.get(member.user_id) ?? { today: 0, twoDays: 0, week: 0, all: 0 };
      const followsShared = Boolean(member.follow_shared_target) && sharedTarget !== null;
      const pendingPlan = plans
        .filter((p) => p.user_id === member.user_id && p.applied_at === null)
        .at(-1);
      const baseTarget = followsShared
        ? (sharedTarget ?? 50)
        : (pendingPlan?.daily_target ?? targetById.get(member.user_id) ?? 50);
      // On a member's weekly recovery day they owe nothing, so the squad total
      // drops by their target instead of counting them as behind.
      const restDay = restDayById.get(member.user_id) ?? null;
      const onRecoveryDay = restDay === todayWeekday;

      const perDay = repsByMember.get(member.user_id) ?? {};
      const memberGoals = goals.filter((g) => g.user_id === member.user_id);
      const monthDays = monthDates.map((date) => {
        const goal = goalForDate(memberGoals, date, baseTarget, restDay);
        const rest = isRecoveryDate(date, goal.restDayOfWeek);
        const target = rest ? 0 : goal.target;
        const reps = perDay[date] ?? 0;
        return { date, reps, target, rest, hit: rest || reps >= target };
      });
      const monthTotal = monthDays.reduce((sum, d) => sum + d.reps, 0);
      const recoveryDaysInMonth = monthDays.filter((d) => d.rest).length;
      const recoveryDates = memberGoals
        .filter((g) => isRecoveryDate(g.goal_date, g.rest_day_of_week))
        .map((g) => g.goal_date);
      if (onRecoveryDay) recoveryDates.push(today);
      const currentStreak = computeStreaks(
        hitDatesFor(perDay, memberGoals, baseTarget, restDay),
        today,
        { recoveryDates, startDate: startDateById.get(member.user_id) },
      ).current;

      return {
        userId: member.user_id,
        displayName: nameById.get(member.user_id)?.trim() || "Member",
        role: member.role,
        repsToday: bucket.today,
        repsTwoDays: bucket.twoDays,
        dailyTarget: onRecoveryDay ? 0 : baseTarget,
        followsShared,
        onRecoveryDay,
        repsWeek: bucket.week,
        repsTotal: bucket.all,
        avatarUrl: avatarById.get(member.user_id) ?? null,
        monthDays,
        monthTotal,
        currentStreak,
        recoveryDaysInMonth,
      };
    })
    .sort((a, b) => b.repsToday - a.repsToday);
}

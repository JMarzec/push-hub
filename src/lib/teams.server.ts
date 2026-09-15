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
  memberIds: string[];
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

  const { data: members, error: memberError } = await supabaseAdmin
    .from("team_members")
    .select("user_id")
    .eq("team_id", team.id);
  if (memberError) throw new Error(memberError.message);

  const memberIds = (members ?? []).map((m) => m.user_id);
  return { id: team.id, name: team.name, memberCount: memberIds.length, memberIds };
}

export async function addTeamMember(teamId: string, userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("team_members")
    .upsert({ team_id: teamId, user_id: userId, role: "member" }, { onConflict: "team_id,user_id" });
  if (error) throw new Error(error.message);
}

/** Caller MUST have verified the requesting user belongs to `teamId` first. */
export async function fetchTeamStats(
  teamId: string,
  sharedTarget: number | null = null,
  viewerToday?: string,
): Promise<TeamMemberStat[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: roster, error: rosterError } = await supabaseAdmin
    .from("team_members")
    .select("user_id, role, follow_shared_target")
    .eq("team_id", teamId);
  if (rosterError) throw new Error(rosterError.message);
  const memberIds = (roster ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return [];

  // The viewer's local date keeps the squad ring in step with their own ring
  // around midnight; UTC is only the fallback for legacy callers.
  const today = viewerToday ?? new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const weekAgo = new Date(todayMs - 6 * 86_400_000).toISOString().slice(0, 10);
  const yesterday = new Date(todayMs - 86_400_000).toISOString().slice(0, 10);
  const monthStart = new Date(todayMs - 29 * 86_400_000).toISOString().slice(0, 10);
  // Targets and recovery days follow UTC so every member of the squad agrees on
  // which calendar day (and weekday) is being counted, wherever they live.
  const utcToday = new Date().toISOString().slice(0, 10);

  const [profiles, settings, logs, bank] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", memberIds),
    supabaseAdmin
      .from("user_settings")
      .select("user_id, daily_target, rest_day_of_week")
      .in("user_id", memberIds),
    supabaseAdmin.from("pushup_logs").select("user_id, reps, log_date").in("user_id", memberIds),
    // Banked reps move progress between days, so today's squad numbers must
    // follow the same maths as each member's own ring.
    supabaseAdmin
      .from("bank_entries")
      .select("user_id, reps, kind, entry_date")
      .in("user_id", memberIds),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (settings.error) throw new Error(settings.error.message);
  if (logs.error) throw new Error(logs.error.message);
  if (bank.error) throw new Error(bank.error.message);

  const nameById = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));

  // Avatars live in a private bucket, so teammates get short-lived signed URLs.
  const avatarById = new Map<string, string>();
  await Promise.all(
    (profiles.data ?? [])
      .filter((p) => p.avatar_url)
      .map(async (p) => {
        const signed = await supabaseAdmin.storage
          .from("avatars")
          .createSignedUrl(p.avatar_url as string, 3600);
        if (signed.data?.signedUrl) avatarById.set(p.id, signed.data.signedUrl);
      }),
  );
  const targetById = new Map((settings.data ?? []).map((s) => [s.user_id, s.daily_target]));
  const restDayById = new Map(
    (settings.data ?? []).map((s) => [s.user_id, s.rest_day_of_week ?? null]),
  );
  const todayWeekday = new Date(`${utcToday}T00:00:00Z`).getUTCDay();

  // Per-day reps for the last 30 days power the monthly squad chart.
  const monthByMember = new Map<string, Map<string, number>>();
  for (const id of memberIds) monthByMember.set(id, new Map());
  const addMonth = (userId: string, date: string, reps: number) => {
    if (date < monthStart || date > today) return;
    const day = monthByMember.get(userId);
    if (!day) return;
    day.set(date, (day.get(date) ?? 0) + reps);
  };

  const totals = new Map<string, { today: number; twoDays: number; week: number; all: number }>();
  for (const id of memberIds) totals.set(id, { today: 0, twoDays: 0, week: 0, all: 0 });
  for (const log of logs.data ?? []) {
    const bucket = totals.get(log.user_id);
    if (!bucket) continue;
    bucket.all += log.reps;
    if (log.log_date >= weekAgo && log.log_date <= today) bucket.week += log.reps;
    if (log.log_date >= yesterday && log.log_date <= today) bucket.twoDays += log.reps;
    if (log.log_date === today) bucket.today += log.reps;
    addMonth(log.user_id, log.log_date, log.reps);
  }
  // Withdrawals add banked reps to the day they were applied; deposits move
  // reps out of that day into the bank — for the 7-day board too, so reps spent
  // this week count here even when they were performed earlier.
  for (const entry of bank.data ?? []) {
    const bucket = totals.get(entry.user_id);
    if (!bucket) continue;
    const signed = entry.kind === "withdrawal" ? entry.reps : -entry.reps;
    if (entry.entry_date === today) bucket.today += signed;
    if (entry.entry_date >= yesterday && entry.entry_date <= today) bucket.twoDays += signed;
    if (entry.entry_date >= weekAgo && entry.entry_date <= today) bucket.week += signed;
    addMonth(entry.user_id, entry.entry_date, signed);
  }

  const monthDates: string[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    monthDates.push(new Date(todayMs - i * 86_400_000).toISOString().slice(0, 10));
  }

  return (roster ?? [])
    .map((member) => {
      const bucket = totals.get(member.user_id) ?? { today: 0, twoDays: 0, week: 0, all: 0 };
      const followsShared = Boolean(member.follow_shared_target) && sharedTarget !== null;
      const baseTarget = followsShared
        ? (sharedTarget as number)
        : (targetById.get(member.user_id) ?? 50);
      // On a member's weekly recovery day they owe nothing, so the squad total
      // drops by their target instead of counting them as behind.
      const restDay = restDayById.get(member.user_id) ?? null;
      const onRecoveryDay = restDay === todayWeekday;

      const perDay = monthByMember.get(member.user_id) ?? new Map<string, number>();
      const monthDays = monthDates.map((date) => {
        const rest = restDay !== null && new Date(`${date}T00:00:00Z`).getUTCDay() === restDay;
        const target = rest ? 0 : baseTarget;
        const reps = Math.max(perDay.get(date) ?? 0, 0);
        return { date, reps, target, rest, hit: rest || reps >= target };
      });
      const monthTotal = monthDays.reduce((sum, d) => sum + d.reps, 0);
      const recoveryDaysInMonth = monthDays.filter((d) => d.rest).length;
      // Current streak: walk back from today, ignoring an unfinished today.
      let currentStreak = 0;
      for (let i = monthDays.length - 1; i >= 0; i -= 1) {
        const day = monthDays[i];
        if (i === monthDays.length - 1 && !day.hit) continue;
        if (!day.hit) break;
        if (!day.rest) currentStreak += 1;
      }

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
      };
    })
    .sort((a, b) => b.repsToday - a.repsToday);
}

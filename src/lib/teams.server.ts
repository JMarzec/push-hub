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
export async function fetchTeamStats(teamId: string): Promise<TeamMemberStat[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: roster, error: rosterError } = await supabaseAdmin
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", teamId);
  if (rosterError) throw new Error(rosterError.message);
  const memberIds = (roster ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [profiles, settings, logs] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", memberIds),
    supabaseAdmin.from("user_settings").select("user_id, daily_target").in("user_id", memberIds),
    supabaseAdmin.from("pushup_logs").select("user_id, reps, log_date").in("user_id", memberIds),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (settings.error) throw new Error(settings.error.message);
  if (logs.error) throw new Error(logs.error.message);

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

  const totals = new Map<string, { today: number; week: number; all: number }>();
  for (const id of memberIds) totals.set(id, { today: 0, week: 0, all: 0 });
  for (const log of logs.data ?? []) {
    const bucket = totals.get(log.user_id);
    if (!bucket) continue;
    bucket.all += log.reps;
    if (log.log_date >= weekAgo) bucket.week += log.reps;
    if (log.log_date === today) bucket.today += log.reps;
  }

  return (roster ?? [])
    .map((member) => {
      const bucket = totals.get(member.user_id) ?? { today: 0, week: 0, all: 0 };
      return {
        userId: member.user_id,
        displayName: nameById.get(member.user_id)?.trim() || "Member",
        role: member.role,
        repsToday: bucket.today,
        dailyTarget: targetById.get(member.user_id) ?? 50,
        repsWeek: bucket.week,
        repsTotal: bucket.all,
        avatarUrl: avatarById.get(member.user_id) ?? null,
      };
    })
    .sort((a, b) => b.repsToday - a.repsToday);
}

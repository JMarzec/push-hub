import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return out;
}

export interface TeamMemberStat {
  userId: string;
  displayName: string;
  role: string;
  repsToday: number;
  dailyTarget: number;
  repsWeek: number;
  repsTotal: number;
}

export const getMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership, error: memberError } = await supabase
      .from("team_members")
      .select("team_id, role, teams(id, name, invite_code, owner_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!membership?.teams) return { team: null, members: [] as TeamMemberStat[] };

    const team = membership.teams as unknown as {
      id: string;
      name: string;
      invite_code: string;
      owner_id: string;
    };

    const { data: stats, error: statsError } = await supabase.rpc("team_today_stats", {
      _team_id: team.id,
    });
    if (statsError) throw new Error(statsError.message);

    const members: TeamMemberStat[] = (stats ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role,
      repsToday: row.reps_today,
      dailyTarget: row.daily_target,
      repsWeek: row.reps_week,
      repsTotal: row.reps_total,
    }));

    return {
      team: {
        id: team.id,
        name: team.name,
        inviteCode: team.invite_code,
        isOwner: team.owner_id === userId,
      },
      members,
    };
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomCode();
      const teamId = crypto.randomUUID();
      // No RETURNING: the team SELECT policy requires membership, which does not exist yet.
      const { error } = await supabase
        .from("teams")
        .insert({ id: teamId, name: data.name, invite_code: code, owner_id: userId });
      if (error) {
        if (error.code === "23505" || error.message.includes("invite_code")) continue;
        throw new Error(error.message);
      }
      const { error: joinError } = await supabase
        .from("team_members")
        .insert({ team_id: teamId, user_id: userId, role: "owner" });
      if (joinError) throw new Error(joinError.message);
      return { id: teamId, name: data.name, inviteCode: code };
    }
    throw new Error("Could not generate an invite code, please try again.");
  });

export const joinTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: teamId, error } = await context.supabase.rpc("join_team_by_code", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return { teamId: teamId as string };
  });

export const renameTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ teamId: z.string().uuid(), name: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("teams")
      .update({ name: data.name })
      .eq("id", data.teamId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ teamId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_members")
      .delete()
      .eq("team_id", data.teamId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

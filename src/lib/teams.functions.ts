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
  avatarUrl: string | null;
  followsShared: boolean;
  /** True when today is this member's chosen weekly recovery day. */
  onRecoveryDay: boolean;
}

export const getMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Squad numbers must line up with each member's own ring, so the caller sends
  // its local date instead of letting the server assume UTC.
  .inputValidator((input: unknown) =>
    z
      .object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .catch({})
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership, error: memberError } = await supabase
      .from("team_members")
      .select(
        "team_id, role, follow_shared_target, teams(id, name, invite_code, owner_id, shared_target, shared_frequency)",
      )
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
      shared_target: number | null;
      shared_frequency: number | null;
    };

    // Roster + teammate stats need to read other members' rows, so they run
    // through trusted server code after membership above is confirmed.
    const { fetchTeamStats } = await import("./teams.server");
    const members = await fetchTeamStats(team.id, team.shared_target, data.today);

    return {
      team: {
        id: team.id,
        name: team.name,
        inviteCode: team.invite_code,
        isOwner: team.owner_id === userId,
        sharedTarget: team.shared_target,
        sharedFrequency: team.shared_frequency,
      },
      membership: {
        role: membership.role,
        followsShared: membership.follow_shared_target ?? false,
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

export const previewTeamByCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ data }) => {
    const { lookupTeamByCode } = await import("./teams.server");
    const team = await lookupTeamByCode(data.code);
    // Invite links are public, so only the team name and size are exposed.
    return team ? { name: team.name, memberCount: team.memberCount } : null;
  });

export const joinTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ data, context }) => {
    const { lookupTeamByCode, addTeamMember } = await import("./teams.server");
    const team = await lookupTeamByCode(data.code);
    if (!team) throw new Error("That invite code is not valid");
    if (team.memberCount >= 50 && !team.memberIds.includes(context.userId)) {
      throw new Error("This team is full");
    }
    await addTeamMember(team.id, context.userId);
    return { teamId: team.id };
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

/** Owner-only: set (or clear) the squad's shared daily target. */
export const setSharedTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        teamId: z.string().uuid(),
        sharedTarget: z.number().int().min(1).max(500).nullable(),
        sharedFrequency: z.number().int().min(1).max(12).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("teams")
      .update({ shared_target: data.sharedTarget, shared_frequency: data.sharedFrequency })
      .eq("id", data.teamId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Each member opts in or out of the shared target for their own membership only. */
export const setFollowSharedTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ teamId: z.string().uuid(), follow: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_members")
      .update({ follow_shared_target: data.follow })
      .eq("team_id", data.teamId)
      .eq("user_id", context.userId);
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

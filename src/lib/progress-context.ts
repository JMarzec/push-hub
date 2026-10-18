import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readPages } from "@/lib/paginate";
import { applyDuePlans } from "@/lib/plans-apply";
import { localToday } from "@/lib/local-date";

export async function progressContext(supabase: SupabaseClient<Database>, userId: string) {
  const applied = await applyDuePlans(supabase, userId, localToday());
  const snapshot = await supabase.rpc("refresh_daily_goals");
  if (snapshot.error) throw new Error(snapshot.error.message);
  const [settings, membership, goals] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
    supabase
      .from("team_members")
      .select("follow_shared_target, teams(name,shared_target,shared_frequency)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(1)
      .maybeSingle(),
    readPages((from, to) =>
      supabase
        .from("daily_goals")
        .select("goal_date,daily_target,rest_day_of_week,history_basis")
        .eq("user_id", userId)
        .lt("goal_date", localToday())
        .order("goal_date")
        .range(from, to),
    ),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  if (membership.error) throw new Error(membership.error.message);
  const squad = membership.data?.teams;
  const follows = Boolean(membership.data?.follow_shared_target && squad?.shared_target);
  return {
    settings: settings.data,
    planApplied: applied.applied !== null,
    target: follows
      ? (squad?.shared_target ?? settings.data.daily_target)
      : settings.data.daily_target,
    frequency: follows
      ? (squad?.shared_frequency ?? settings.data.frequency)
      : settings.data.frequency,
    squadName: follows ? (squad?.name ?? null) : null,
    targetSource: follows ? ("squad" as const) : ("personal" as const),
    goals,
  };
}

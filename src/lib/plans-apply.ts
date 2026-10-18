import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Applies any scheduled goal-plan changes whose effective date has arrived.
 *
 * Plans are stored with an `effective_date`; the newest due-but-unapplied plan
 * wins (so a same-day edit or a missed day still lands the latest intent), and
 * every older due plan is marked applied so it never fires twice.
 *
 * The client is passed in so this can run with the caller's RLS-scoped client.
 */
export async function applyDuePlans(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
): Promise<{ applied: null | { dailyTarget: number; frequency: number; effectiveDate: string } }> {
  const { data, error } = await supabase.rpc("apply_due_goal_plans", { p_today: today });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) return { applied: null };
  if (
    typeof data["dailyTarget"] !== "number" ||
    typeof data["frequency"] !== "number" ||
    typeof data["effectiveDate"] !== "string"
  )
    throw new Error("Invalid scheduled goal result");
  return {
    applied: {
      dailyTarget: data["dailyTarget"],
      frequency: data["frequency"],
      effectiveDate: data["effectiveDate"],
    },
  };
}

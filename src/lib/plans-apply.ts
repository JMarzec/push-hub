import { slotTimesFor } from "@/lib/pushup-schedule";

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
  // Supabase client typing is generated per project; keep this structural.
  supabase: {
    from: (table: string) => any;
  },
  userId: string,
  today: string,
): Promise<{ applied: null | { dailyTarget: number; frequency: number; effectiveDate: string } }> {
  const { data: due, error } = await supabase
    .from("target_plans")
    .select("id, effective_date, daily_target, frequency")
    .eq("user_id", userId)
    .is("applied_at", null)
    .lte("effective_date", today)
    .order("effective_date", { ascending: true });
  if (error) throw new Error(error.message);

  const plans = (due ?? []) as Array<{
    id: string;
    effective_date: string;
    daily_target: number;
    frequency: number;
  }>;
  if (plans.length === 0) return { applied: null };

  const winner = plans[plans.length - 1]!;

  const settingsUpdate = await supabase
    .from("user_settings")
    .update({
      daily_target: winner.daily_target,
      frequency: winner.frequency,
      slot_times: slotTimesFor(winner.frequency),
    })
    .eq("user_id", userId);
  if (settingsUpdate.error) throw new Error(settingsUpdate.error.message);

  const markApplied = await supabase
    .from("target_plans")
    .update({ applied_at: new Date().toISOString() })
    .in(
      "id",
      plans.map((p) => p.id),
    );
  if (markApplied.error) throw new Error(markApplied.error.message);

  return {
    applied: {
      dailyTarget: winner.daily_target,
      frequency: winner.frequency,
      effectiveDate: winner.effective_date,
    },
  };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyDuePlans } from "@/lib/plans-apply";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const listPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ today: dateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const applied = await applyDuePlans(supabase, userId, data.today);

    const [plansRes, settingsRes] = await Promise.all([
      supabase
        .from("target_plans")
        .select("id, effective_date, daily_target, frequency, note, applied_at")
        .eq("user_id", userId)
        .order("effective_date", { ascending: true }),
      supabase
        .from("user_settings")
        .select("daily_target, frequency")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (plansRes.error) throw new Error(plansRes.error.message);

    return {
      justApplied: applied.applied,
      current: {
        dailyTarget: settingsRes.data?.daily_target ?? 50,
        frequency: settingsRes.data?.frequency ?? 4,
      },
      plans: (plansRes.data ?? []).map((p) => ({
        id: p.id,
        effectiveDate: p.effective_date,
        dailyTarget: p.daily_target,
        frequency: p.frequency,
        note: p.note,
        appliedAt: p.applied_at,
      })),
    };
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        effectiveDate: dateSchema,
        dailyTarget: z.number().int().min(10).max(500),
        frequency: z.number().int().min(1).max(6),
        note: z.string().trim().max(120).optional(),
        today: dateSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.effectiveDate < data.today) {
      throw new Error("Pick today or a future date for a scheduled change.");
    }

    const { data: row, error } = await supabase
      .from("target_plans")
      .upsert(
        {
          user_id: userId,
          effective_date: data.effectiveDate,
          daily_target: data.dailyTarget,
          frequency: data.frequency,
          note: data.note?.length ? data.note : null,
          applied_at: null,
        },
        { onConflict: "user_id,effective_date" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // A plan dated today should take effect immediately.
    const applied = await applyDuePlans(supabase, userId, data.today);
    return { id: row.id, appliedNow: applied.applied !== null };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("target_plans")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

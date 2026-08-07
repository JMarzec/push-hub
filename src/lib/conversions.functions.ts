import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CONVERSIONS } from "@/lib/activity-conversions";
import type { ConversionRate, ConversionUnit } from "@/lib/activity-conversions";

const unitSchema = z.enum(["m", "km", "reps", "min"]);

interface ConversionRow {
  id: string;
  activity_key: string;
  label: string;
  unit: string;
  unit_step: number | string;
  pushups_per_unit: number | string;
  is_custom: boolean;
  enabled: boolean;
}

function toRate(row: ConversionRow): ConversionRate {
  return {
    id: row.id,
    activityKey: row.activity_key,
    label: row.label,
    unit: row.unit as ConversionUnit,
    unitStep: Number(row.unit_step),
    pushupsPerUnit: Number(row.pushups_per_unit),
    isCustom: row.is_custom,
    enabled: row.enabled,
  };
}

/**
 * Personal conversion rates. The first time a user opens the feature we seed the
 * defaults into their own rows so every rate is editable from then on.
 */
export const listConversions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("activity_conversions")
      .select("id, activity_key, label, unit, unit_step, pushups_per_unit, is_custom, enabled")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    if ((data ?? []).length === 0) {
      const seeded = await supabase
        .from("activity_conversions")
        .insert(
          DEFAULT_CONVERSIONS.map((c) => ({
            user_id: userId,
            activity_key: c.activityKey,
            label: c.label,
            unit: c.unit,
            unit_step: c.unitStep,
            pushups_per_unit: c.pushupsPerUnit,
            is_custom: false,
            enabled: true,
          })),
        )
        .select("id, activity_key, label, unit, unit_step, pushups_per_unit, is_custom, enabled");
      if (seeded.error) throw new Error(seeded.error.message);
      return { conversions: (seeded.data as ConversionRow[]).map(toRate) };
    }

    const rows = data as ConversionRow[];
    // Backfill any built-in activity added after this user was first seeded.
    const existing = new Set(rows.map((r) => r.activity_key));
    const missing = DEFAULT_CONVERSIONS.filter((c) => !existing.has(c.activityKey));
    if (missing.length > 0) {
      const added = await supabase
        .from("activity_conversions")
        .insert(
          missing.map((c) => ({
            user_id: userId,
            activity_key: c.activityKey,
            label: c.label,
            unit: c.unit,
            unit_step: c.unitStep,
            pushups_per_unit: c.pushupsPerUnit,
            is_custom: false,
            enabled: true,
          })),
        )
        .select("id, activity_key, label, unit, unit_step, pushups_per_unit, is_custom, enabled");
      if (added.error) throw new Error(added.error.message);
      return { conversions: [...rows, ...(added.data as ConversionRow[])].map(toRate) };
    }

    return { conversions: rows.map(toRate) };
  });

export const saveConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        activityKey: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
        label: z.string().trim().min(1, "Name required").max(40),
        unit: unitSchema,
        unitStep: z.number().positive().max(10_000),
        pushupsPerUnit: z.number().positive().max(1_000),
        isCustom: z.boolean(),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = {
      user_id: userId,
      activity_key: data.activityKey,
      label: data.label,
      unit: data.unit,
      unit_step: data.unitStep,
      pushups_per_unit: data.pushupsPerUnit,
      is_custom: data.isCustom,
      enabled: data.enabled,
    };

    if (data.id) {
      const { error } = await supabase
        .from("activity_conversions")
        .update(patch)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("activity_conversions")
      .upsert(patch, { onConflict: "user_id,activity_key" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("activity_conversions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

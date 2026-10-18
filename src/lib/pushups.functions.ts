import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slotTimesFor } from "@/lib/pushup-schedule";
import { progressContext } from "@/lib/progress-context";
import { dailyReps, hitDatesFor } from "@/lib/daily-accounting";
import { readPages } from "@/lib/paginate";
import { computeStreaks, isRecoveryDate } from "@/lib/streaks";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const getToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ today: dateSchema, timezone: z.string().max(64).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const settingsResult = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsResult.error) throw new Error(settingsResult.error.message);
    let settings = settingsResult.data;
    if (!settings) {
      const inserted = await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          start_date: data.today,
          timezone: data.timezone ?? "UTC",
        })
        .select("*")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      settings = inserted.data;
    }

    const effective = await progressContext(supabase, userId);
    settings = {
      ...effective.settings,
      daily_target: effective.target,
      frequency: effective.frequency,
      slot_times:
        effective.targetSource === "squad"
          ? slotTimesFor(effective.frequency)
          : effective.settings.slot_times,
    };
    const targetSource = effective.targetSource;
    const squadName = effective.squadName;
    const sinceDate = settings.start_date;

    const [logs, bankEntries] = await Promise.all([
      readPages((from, to) =>
        supabase
          .from("pushup_logs")
          .select("id,reps,slot,log_date,logged_at,activity_label,activity_amount,activity_unit")
          .eq("user_id", userId)
          .gte("log_date", sinceDate)
          .lte("log_date", data.today)
          .order("logged_at")
          .order("id")
          .range(from, to),
      ),
      readPages((from, to) =>
        supabase
          .from("bank_entries")
          .select("id,reps,kind,entry_date")
          .eq("user_id", userId)
          .order("id")
          .range(from, to),
      ),
    ]);

    const repsBySlot: Record<string, number> = {};
    const repsByDate = dailyReps(logs, bankEntries);
    for (const log of logs) {
      if (log.log_date === data.today) {
        const slot = log.slot ?? "unassigned";
        repsBySlot[slot] = (repsBySlot[slot] ?? 0) + log.reps;
      }
    }

    let bank = 0;
    let depositedToday = 0;
    let withdrawnToday = 0;
    // Withdrawals count towards the day they're used on, deposits are moved out
    // of it — same net rule the ring and the squad total apply.

    for (const entry of bankEntries) {
      const signed = entry.kind === "deposit" ? entry.reps : -entry.reps;
      bank += signed;

      if (entry.entry_date === data.today) {
        if (entry.kind === "deposit") depositedToday += entry.reps;
        else withdrawnToday += entry.reps;
      }
    }
    const restDayOfWeek = settings.rest_day_of_week ?? null;
    const isRecoveryDay = isRecoveryDate(data.today, restDayOfWeek);
    const target = settings.daily_target;
    const targetDates = hitDatesFor(repsByDate, effective.goals, target, restDayOfWeek);
    const streaks = computeStreaks(targetDates, data.today, {
      timelineDays: 30,
      startDate: settings.start_date,
      restDayOfWeek,
      recoveryDates: recoveryDates(effective.goals, data.today, restDayOfWeek),
    });
    const streak = streaks.current;

    const startMs = Date.parse(`${settings.start_date}T00:00:00Z`);
    const todayMs = Date.parse(`${data.today}T00:00:00Z`);
    const dayNumber = Math.max(Math.floor((todayMs - startMs) / 86_400_000) + 1, 1);
    const completedDays = Object.entries(repsByDate)
      .filter(([date]) => targetDates.includes(date) && date !== data.today)
      .map(([date]) => Math.floor((Date.parse(`${date}T00:00:00Z`) - startMs) / 86_400_000) + 1)
      .filter((day) => day >= 1);

    return {
      settings: {
        dailyTarget: settings.daily_target,
        frequency: settings.frequency,
        slotTimes: settings.slot_times,
        startDate: settings.start_date,
        timezone: settings.timezone,
        baselineReps: settings.baseline_reps,
        parqPassed: settings.parq_passed,
        disclaimerAcceptedAt: settings.disclaimer_accepted_at,
        onboardingCompletedAt: settings.onboarding_completed_at,
        remindersEnabled: settings.reminders_enabled,
        emailRemindersEnabled: settings.email_reminders_enabled ?? true,
        emailRemindersPausedUntil: settings.email_reminders_paused_until ?? null,
        restDayOfWeek,
        isRecoveryDay,
        targetSource,
        squadName,
      },
      repsBySlot,
      depositedToday,
      withdrawnToday,
      bank,
      streak,
      dayNumber,
      completedDays,
      planApplied: effective.planApplied,
      todaysLogs: logs
        .filter((l) => l.log_date === data.today)
        .map((l) => ({
          id: l.id,
          reps: l.reps,
          slot: l.slot,
          loggedAt: l.logged_at,
          activityLabel: l.activity_label,
          activityAmount: l.activity_amount === null ? null : Number(l.activity_amount),
          activityUnit: l.activity_unit,
        })),
    };
  });

export const logReps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reps: z.number().int().min(1).max(500),
        slot: z.string().max(10).nullable().optional(),
        today: dateSchema,
        // Set when the reps came from a converted activity (swim, run, squats…).
        activityKey: z.string().max(40).nullable().optional(),
        activityLabel: z.string().max(40).nullable().optional(),
        activityAmount: z.number().positive().max(1_000_000).nullable().optional(),
        activityUnit: z.enum(["m", "km", "reps", "min"]).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("pushup_logs")
      .insert({
        user_id: context.userId,
        reps: data.reps,
        slot: data.slot ?? null,
        log_date: data.today,
        activity_key: data.activityKey ?? null,
        activity_label: data.activityLabel ?? null,
        activity_amount: data.activityAmount ?? null,
        activity_unit: data.activityUnit ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pushup_logs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTargetSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dailyTarget: z.number().int().min(1).max(500),
        frequency: z.number().int().min(1).max(12),
        // 0 = Sunday … 6 = Saturday; null clears the weekly recovery day.
        restDayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      daily_target: number;
      frequency: number;
      slot_times: string[];
      rest_day_of_week?: number | null;
    } = {
      daily_target: data.dailyTarget,
      frequency: data.frequency,
      slot_times: slotTimesFor(data.frequency),
    };
    if (data.restDayOfWeek !== undefined) patch.rest_day_of_week = data.restDayOfWeek;
    const { error } = await context.supabase
      .from("user_settings")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reps: z.number().int().min(1).max(500),
        kind: z.enum(["deposit", "withdrawal"]),
        today: dateSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("transfer_banked_reps", {
      p_reps: data.reps,
      p_kind: data.kind,
      p_day: data.today,
    });
    if (error) throw new Error(error.message);
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      typeof result["entryId"] !== "string" ||
      typeof result["balance"] !== "number"
    )
      throw new Error("Invalid bank result");
    return { entryId: result["entryId"], balance: result["balance"] };
  });

// Reverts a single bank transfer (deposit or withdrawal) by deleting the entry
// it created, so an accidental transfer can be undone from the toast.
export const undoBankEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ entryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("bank_entries")
      .delete()
      .eq("id", data.entryId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reps: z.number().int().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pushup_logs")
      .update({ reps: data.reps })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Reminder preferences: an on/off switch plus the per-set times the browser
 * should nudge at. Times are stored as local "HH:MM" strings.
 */
export const updateReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean(),
        slotTimes: z
          .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM"))
          .min(1)
          .max(6)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { reminders_enabled: boolean; slot_times?: string[] } = {
      reminders_enabled: data.enabled,
    };
    if (data.slotTimes) patch.slot_times = data.slotTimes;
    const { error } = await context.supabase
      .from("user_settings")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Email nudge preferences: a master on/off switch plus an optional "pause until"
 * date so members can mute the weekly email while on holiday.
 */
export const updateEmailReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean().optional(),
        pausedUntil: dateSchema.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      email_reminders_enabled?: boolean;
      email_reminders_paused_until?: string | null;
    } = {};
    if (data.enabled !== undefined) patch.email_reminders_enabled = data.enabled;
    if (data.pausedUntil !== undefined) patch.email_reminders_paused_until = data.pausedUntil;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("user_settings")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function recoveryDates(
  goals: import("@/lib/daily-accounting").DailyGoal[],
  today: string,
  rest: number | null,
) {
  const dates = goals
    .filter((g) => isRecoveryDate(g.goal_date, g.rest_day_of_week))
    .map((g) => g.goal_date);
  if (isRecoveryDate(today, rest)) dates.push(today);
  return dates;
}

export { getStats, getDayLogs } from "./progress-reads.functions";

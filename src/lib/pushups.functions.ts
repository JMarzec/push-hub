import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slotTimesFor } from "@/lib/pushup-schedule";
import { applyDuePlans } from "@/lib/plans-apply";
import {
  computeStreaks,
  isRecoveryDate,
  MAX_REST_DAYS_PER_WINDOW,
  REST_WINDOW_DAYS,
} from "@/lib/streaks";


const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const getToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ today: dateSchema, timezone: z.string().max(64).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

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

    // Scheduled goal-plan changes take effect the first time the day is opened.
    const planApplied = await applyDuePlans(supabase, userId, data.today);
    if (planApplied.applied) {
      const refreshed = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (refreshed.data) settings = refreshed.data;
    }



    // Members who opted in follow their squad's shared target instead of their own.
    let targetSource: "personal" | "squad" = "personal";
    let squadName: string | null = null;
    const { data: membership } = await supabase
      .from("team_members")
      .select("follow_shared_target, teams(name, shared_target, shared_frequency)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const squad = membership?.teams as unknown as
      | { name: string; shared_target: number | null; shared_frequency: number | null }
      | null
      | undefined;
    if (membership?.follow_shared_target && squad?.shared_target) {
      targetSource = "squad";
      squadName = squad.name;
      const frequency = squad.shared_frequency ?? settings.frequency;
      settings = {
        ...settings,
        daily_target: squad.shared_target,
        frequency,
        slot_times: slotTimesFor(frequency),
      };
    }

    const since = new Date(`${data.today}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 60);
    const sinceDate = since.toISOString().slice(0, 10);

    const [logsRes, bankRes] = await Promise.all([
      supabase
        .from("pushup_logs")
        .select("id, reps, slot, log_date, logged_at, activity_label, activity_amount, activity_unit")
        .eq("user_id", userId)
        .gte("log_date", sinceDate)
        .order("logged_at", { ascending: true }),
      supabase
        .from("bank_entries")
        .select("id, reps, kind, entry_date")
        .eq("user_id", userId),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);
    if (bankRes.error) throw new Error(bankRes.error.message);

    const logs = logsRes.data ?? [];
    const bankEntries = bankRes.data ?? [];

    const repsBySlot: Record<string, number> = {};
    const repsByDate: Record<string, number> = {};
    for (const log of logs) {
      repsByDate[log.log_date] = (repsByDate[log.log_date] ?? 0) + log.reps;
      if (log.log_date === data.today) {
        const slot = log.slot ?? "unassigned";
        repsBySlot[slot] = (repsBySlot[slot] ?? 0) + log.reps;
      }
    }

    let bank = 0;
    let depositedToday = 0;
    let withdrawnToday = 0;
    for (const entry of bankEntries) {
      const signed = entry.kind === "deposit" ? entry.reps : -entry.reps;
      bank += signed;
      if (entry.entry_date === data.today) {
        if (entry.kind === "deposit") depositedToday += entry.reps;
        else withdrawnToday += entry.reps;
      }
    }

    // Streak: use the same gap-tolerant rules as the Trophies screen.
    const restDayOfWeek = settings.rest_day_of_week ?? null;
    const isRecoveryDay = isRecoveryDate(data.today, restDayOfWeek);
    const target = settings.daily_target;
    const targetDates = Object.entries(repsByDate)
      .filter(([_, reps]) => reps >= target)
      .map(([date]) => date);
    const streaks = computeStreaks(targetDates, data.today, {
      maxLookbackDays: 60,
      timelineDays: 30,
      restDayOfWeek,
    });
    const streak = streaks.current;


    const startMs = Date.parse(`${settings.start_date}T00:00:00Z`);
    const todayMs = Date.parse(`${data.today}T00:00:00Z`);
    const dayNumber = Math.max(Math.floor((todayMs - startMs) / 86_400_000) + 1, 1);
    const completedDays = Object.entries(repsByDate)
      .filter(([date, reps]) => reps >= target && date !== data.today)
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
      planApplied: planApplied.applied !== null,
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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_settings")
      .update({
        daily_target: data.dailyTarget,
        frequency: data.frequency,
        slot_times: slotTimesFor(data.frequency),
      })
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
    const { supabase, userId } = context;

    const { data: entries, error: readError } = await supabase
      .from("bank_entries")
      .select("reps, kind")
      .eq("user_id", userId);
    if (readError) throw new Error(readError.message);

    const balance = (entries ?? []).reduce(
      (sum, e) => sum + (e.kind === "deposit" ? e.reps : -e.reps),
      0,
    );
    if (data.kind === "withdrawal" && data.reps > balance) {
      throw new Error(`Only ${balance} banked push-ups available.`);
    }

    const { data: inserted, error } = await supabase
      .from("bank_entries")
      .insert({
        user_id: userId,
        reps: data.reps,
        kind: data.kind,
        entry_date: data.today,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      entryId: inserted.id,
      balance: data.kind === "deposit" ? balance + data.reps : balance - data.reps,
    };
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


export const getStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ today: dateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [settingsRes, logsRes, bankRes, teamRes] = await Promise.all([
      supabase.from("user_settings").select("daily_target").eq("user_id", userId).maybeSingle(),
      supabase.from("pushup_logs").select("reps, log_date").eq("user_id", userId),
      supabase.from("bank_entries").select("reps, kind").eq("user_id", userId),
      supabase.from("team_members").select("team_id").eq("user_id", userId).limit(1),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);
    if (bankRes.error) throw new Error(bankRes.error.message);

    const target = settingsRes.data?.daily_target ?? 50;
    const repsByDate: Record<string, number> = {};
    let totalReps = 0;
    for (const log of logsRes.data ?? []) {
      repsByDate[log.log_date] = (repsByDate[log.log_date] ?? 0) + log.reps;
      totalReps += log.reps;
    }

    const dates = Object.keys(repsByDate).sort();
    const bestDay = dates.reduce((max, d) => Math.max(max, repsByDate[d] ?? 0), 0);
    const targetDates = dates.filter((d) => (repsByDate[d] ?? 0) >= target);
    const targetDays = targetDates.length;

    const streaks = computeStreaks(targetDates, data.today);


    const bankedTotal = (bankRes.data ?? [])
      .filter((e) => e.kind === "deposit")
      .reduce((sum, e) => sum + e.reps, 0);

    const weekAgo = new Date(`${data.today}T00:00:00Z`);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
    const weekKey = weekAgo.toISOString().slice(0, 10);
    const weekReps = dates
      .filter((d) => d >= weekKey && d <= data.today)
      .reduce((sum, d) => sum + (repsByDate[d] ?? 0), 0);

    return {
      dailyTarget: target,
      totalReps,
      bestDay,
      daysLogged: dates.length,
      targetDays,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      restDaysUsed: streaks.restDaysUsed,
      restDaysLeft: streaks.restDaysLeft,
      onGrace: streaks.onGrace,
      restAllowance: MAX_REST_DAYS_PER_WINDOW,
      restWindowDays: REST_WINDOW_DAYS,
      streakTimeline: streaks.timeline.map((d) => ({
        ...d,
        reps: repsByDate[d.date] ?? 0,
      })),


      bankedTotal,
      weekReps,
      inTeam: (teamRes.data ?? []).length > 0,
      recentDays: dates
        .slice(-14)
        .map((d) => ({ date: d, reps: repsByDate[d] ?? 0, hit: (repsByDate[d] ?? 0) >= target })),
    };
  });

export const getDayLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ date: dateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [settingsRes, logsRes] = await Promise.all([
      supabase.from("user_settings").select("daily_target").eq("user_id", userId).maybeSingle(),
      supabase
        .from("pushup_logs")
        .select("id, reps, slot, logged_at, activity_label, activity_amount, activity_unit")
        .eq("user_id", userId)
        .eq("log_date", data.date)
        .order("logged_at", { ascending: true }),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);
    const logs = logsRes.data ?? [];
    return {
      date: data.date,
      dailyTarget: settingsRes.data?.daily_target ?? 50,
      totalReps: logs.reduce((sum, l) => sum + l.reps, 0),
      logs: logs.map((l) => ({
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

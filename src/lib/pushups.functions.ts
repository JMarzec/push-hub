import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slotTimesFor } from "@/lib/pushup-schedule";
import { computeStreaks, MAX_REST_DAYS_PER_WINDOW, REST_WINDOW_DAYS } from "@/lib/streaks";


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

    const since = new Date(`${data.today}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 60);
    const sinceDate = since.toISOString().slice(0, 10);

    const [logsRes, bankRes] = await Promise.all([
      supabase
        .from("pushup_logs")
        .select("id, reps, slot, log_date, logged_at")
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

    // Streak: consecutive days up to yesterday that hit the target, plus today if hit.
    const target = settings.daily_target;
    let streak = 0;
    const cursor = new Date(`${data.today}T00:00:00Z`);
    if ((repsByDate[data.today] ?? 0) < target) cursor.setUTCDate(cursor.getUTCDate() - 1);
    for (let i = 0; i < 60; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      if ((repsByDate[key] ?? 0) < target) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

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
      },
      repsBySlot,
      depositedToday,
      withdrawnToday,
      bank,
      streak,
      dayNumber,
      completedDays,
      todaysLogs: logs
        .filter((l) => l.log_date === data.today)
        .map((l) => ({ id: l.id, reps: l.reps, slot: l.slot, loggedAt: l.logged_at })),
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

    const { error } = await supabase.from("bank_entries").insert({
      user_id: userId,
      reps: data.reps,
      kind: data.kind,
      entry_date: data.today,
    });
    if (error) throw new Error(error.message);
    return { balance: data.kind === "deposit" ? balance + data.reps : balance - data.reps };
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

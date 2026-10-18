import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { progressContext } from "@/lib/progress-context";
import { dailyReps, goalForDate, hitDatesFor } from "@/lib/daily-accounting";
import { readPages } from "@/lib/paginate";
import {
  computeStreaks,
  isRecoveryDate,
  MAX_REST_DAYS_PER_WINDOW,
  REST_WINDOW_DAYS,
} from "@/lib/streaks";
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const getStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ today: dateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const effective = await progressContext(supabase, userId);
    const [logs, bankEntries, teamRes] = await Promise.all([
      readPages((from, to) =>
        supabase
          .from("pushup_logs")
          .select("reps,log_date")
          .eq("user_id", userId)
          .lte("log_date", data.today)
          .order("id")
          .range(from, to),
      ),
      readPages((from, to) =>
        supabase
          .from("bank_entries")
          .select("reps,kind,entry_date")
          .eq("user_id", userId)
          .order("id")
          .range(from, to),
      ),
      supabase.from("team_members").select("team_id").eq("user_id", userId).limit(1),
    ]);
    if (teamRes.error) throw new Error(teamRes.error.message);
    const target = effective.target;
    const restDayOfWeek = effective.settings.rest_day_of_week ?? null;
    const repsByDate = dailyReps(logs, bankEntries);
    const totalReps = logs.reduce((sum, log) => sum + log.reps, 0);

    const dates = Object.keys(repsByDate).sort();
    const bestDay = dates.reduce((max, d) => Math.max(max, repsByDate[d] ?? 0), 0);
    const targetDates = hitDatesFor(repsByDate, effective.goals, target, restDayOfWeek);
    const targetDays = targetDates.length;

    const streaks = computeStreaks(targetDates, data.today, {
      startDate: effective.settings.start_date,
      restDayOfWeek,
      recoveryDates: recoveryDates(effective.goals, data.today, restDayOfWeek),
    });

    const bankedTotal = bankEntries
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
        target: (() => {
          const goal = goalForDate(effective.goals, d.date, target, restDayOfWeek);
          return isRecoveryDate(d.date, goal.restDayOfWeek) ? 0 : goal.target;
        })(),
      })),

      bankedTotal,
      weekReps,
      inTeam: (teamRes.data ?? []).length > 0,
      recentDays: dates
        .slice(-14)
        .map((d) => ({ date: d, reps: repsByDate[d] ?? 0, hit: targetDates.includes(d) })),
    };
  });

export const getDayLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ date: dateSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const effective = await progressContext(supabase, userId);
    const [logs, bankEntries] = await Promise.all([
      readPages((from, to) =>
        supabase
          .from("pushup_logs")
          .select("id,reps,slot,logged_at,activity_label,activity_amount,activity_unit")
          .eq("user_id", userId)
          .eq("log_date", data.date)
          .order("logged_at")
          .order("id")
          .range(from, to),
      ),
      readPages((from, to) =>
        supabase
          .from("bank_entries")
          .select("id,reps,kind,entry_date")
          .eq("user_id", userId)
          .eq("entry_date", data.date)
          .order("id")
          .range(from, to),
      ),
    ]);
    const deposited = bankEntries
      .filter((e) => e.kind === "deposit")
      .reduce((sum, e) => sum + e.reps, 0);
    const withdrawn = bankEntries
      .filter((e) => e.kind === "withdrawal")
      .reduce((sum, e) => sum + e.reps, 0);
    return {
      date: data.date,
      historyBasis:
        effective.goals.find((g) => g.goal_date === data.date)?.history_basis ?? "preserved",
      dailyTarget: (() => {
        const goal = goalForDate(
          effective.goals,
          data.date,
          effective.target,
          effective.settings.rest_day_of_week,
        );
        return isRecoveryDate(data.date, goal.restDayOfWeek) ? 0 : goal.target;
      })(),
      // Net of bank movements, so the sheet matches the ring and the streak rules.
      totalReps: Math.max(logs.reduce((sum, l) => sum + l.reps, 0) + withdrawn - deposited, 0),
      deposited,
      withdrawn,
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

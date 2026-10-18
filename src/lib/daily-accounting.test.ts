import { describe, expect, test } from "bun:test";
import { dailyReps, goalForDate, hitDatesFor } from "./daily-accounting";
import { computeStreaks } from "./streaks";
import { addDays } from "./local-date";
import { readPages } from "./paginate";
import { composeSets } from "./pushup-schedule";

describe("daily progress regressions", () => {
  test("net banking does not depend on entry order", () => {
    const entries = [
      { entry_date: "2026-10-17", reps: 50, kind: "deposit" },
      { entry_date: "2026-10-17", reps: 50, kind: "withdrawal" },
    ];
    expect(dailyReps([], entries)["2026-10-17"]).toBe(0);
    expect(dailyReps([], [...entries].reverse())["2026-10-17"]).toBe(0);
  });
  test("spent bank credit counts toward a completed day", () => {
    const reps = dailyReps([], [{ entry_date: "2026-10-17", reps: 50, kind: "withdrawal" }]);
    expect(hitDatesFor(reps, [], 50, null)).toEqual(["2026-10-17"]);
  });
  test("raising the target does not invalidate historical completion", () => {
    const goals = [{ goal_date: "2026-10-17", daily_target: 50, rest_day_of_week: null }];
    expect(hitDatesFor({ "2026-10-17": 60 }, goals, 100, null)).toEqual(["2026-10-17"]);
    expect(goalForDate(goals, "2026-10-17", 100, null).target).toBe(50);
  });
  test("one missed day is forgiven but two consecutive misses break", () => {
    expect(computeStreaks(["2026-10-15", "2026-10-17"], "2026-10-18").current).toBe(2);
    expect(computeStreaks(["2026-10-14", "2026-10-17"], "2026-10-18").current).toBe(1);
  });
  test("unfinished today reports grace when yesterday was forgiven", () => {
    expect(computeStreaks(["2026-10-16"], "2026-10-18").onGrace).toBe(true);
  });
  test("a later missed day does not reduce an already earned longest streak", () => {
    expect(computeStreaks(["2026-10-10", "2026-10-11", "2026-10-13", "2026-10-14", "2026-10-16"],
      "2026-10-18").longest).toBe(4);
  });
  test("weekly allowance excludes forgiven days older than seven days", () => {
    const hits = Array.from({ length: 20 }, (_, i) => addDays("2026-09-29", i)).filter(
      (d) => d !== "2026-10-02" && d !== "2026-10-10",
    );
    expect(computeStreaks(hits, "2026-10-18").restDaysUsed).toBe(0);
  });
  test("squad streak can extend beyond its 30-day chart", () => {
    const hits = Array.from({ length: 45 }, (_, i) => addDays("2026-09-04", i));
    expect(computeStreaks(hits, "2026-10-18").current).toBe(45);
  });
  test("personal and squad streaks exclude days before the challenge start", () => {
    expect(computeStreaks(["2026-10-16", "2026-10-17", "2026-10-18"], "2026-10-18", {
      startDate: "2026-10-17",
    }).current).toBe(2);
  });
  test("planned recovery preserves the streak without spending forgiveness", () => {
    const result = computeStreaks(["2026-10-16", "2026-10-18"], "2026-10-18", {
      recoveryDates: ["2026-10-17"],
    });
    expect(result.current).toBe(2);
    expect(result.restDaysUsed).toBe(0);
  });
  test("all history pages are loaded", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => i);
    expect(
      await readPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null })),
    ).toHaveLength(1001);
  });
  test("ring sets retain orphaned logs after frequency changes", () => {
    const sets = composeSets(50, ["08:00"], { "12:00": 30 }, 0, 20);
    expect(sets.reduce((sum, set) => sum + set.reps, 0)).toBe(50);
  });
  test("ring sets agree with net daily banking", () => {
    const sets = composeSets(50, ["08:00", "18:00"], {}, 50, 50);
    expect(sets.reduce((sum, set) => sum + set.reps, 0)).toBe(0);
  });
  test("recovery weekdays do not retroactively change saved history", () => {
    const goals = [{ goal_date: "2026-10-17", daily_target: 50, rest_day_of_week: null }];
    expect(hitDatesFor({ "2026-10-17": 50 }, goals, 100, 6)).toEqual(["2026-10-17"]);
  });
  test("UTC tomorrow crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("failed history page is not reported as empty success", async () => {
    expect(
      readPages(async () => ({ data: null, error: { message: "Read failed" } })),
    ).rejects.toThrow("Read failed");
  });
});

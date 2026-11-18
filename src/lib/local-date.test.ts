import { describe, expect, test } from "bun:test";
import { addDays, localToday, utcToday, nextLocalMidnight, localSlotDelay } from "./local-date";
import { dailyReps } from "./daily-accounting";
import { isRecoveryDate } from "./streaks";

describe("personal midnight and UTC squad calendar", () => {
  test("midnight and reminder deadlines account for a daylight-saving jump", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const now = new Date("2026-03-08T08:00:00Z");
      expect(nextLocalMidnight(now)).toBe(23 * 60 * 60 * 1000);
      expect(localSlotDelay("08:00", now)).toBe(7 * 60 * 60 * 1000);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  test("Los Angeles evening stays on November 17 across UTC midnight", () => {
    expect(localToday(new Date("2026-11-17T23:59:59Z"), "America/Los_Angeles")).toBe("2026-11-17");
    expect(localToday(new Date("2026-11-18T00:00:01Z"), "America/Los_Angeles")).toBe("2026-11-17");
    expect(utcToday(new Date("2026-11-18T00:00:01Z"))).toBe("2026-11-18");
  });
  test("Los Angeles rolls at its own midnight", () => {
    expect(localToday(new Date("2026-11-18T07:59:59Z"), "America/Los_Angeles")).toBe("2026-11-17");
    expect(localToday(new Date("2026-11-18T08:00:00Z"), "America/Los_Angeles")).toBe("2026-11-18");
  });
  test("Warsaw after midnight is credited to November 18", () => {
    expect(localToday(new Date("2026-11-17T23:01:00Z"), "Europe/Warsaw")).toBe("2026-11-18");
  });
  test("Sydney rolls on November 18 while UTC is still November 17", () => {
    expect(localToday(new Date("2026-11-17T13:00:00Z"), "Australia/Sydney")).toBe("2026-11-18");
  });
  test("UTC users retain the UTC boundary", () => {
    expect(localToday(new Date("2026-11-18T00:00:00Z"), "UTC")).toBe("2026-11-18");
  });
  test("spring-forward and repeated autumn hours do not change the personal date", () => {
    for (const instant of ["2026-03-08T09:59:59Z", "2026-03-08T10:00:00Z"])
      expect(localToday(new Date(instant), "America/Los_Angeles")).toBe("2026-03-08");
    for (const instant of ["2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z"])
      expect(localToday(new Date(instant), "America/Los_Angeles")).toBe("2026-11-01");
  });
  test("bank credit and recovery weekday use the personal date", () => {
    const day = localToday(new Date("2026-11-18T00:01:00Z"), "America/Los_Angeles");
    expect(dailyReps([], [{ entry_date: day, kind: "withdrawal", reps: 50 }])["2026-11-17"]).toBe(
      50,
    );
    expect(isRecoveryDate(day, 2)).toBe(true);
    expect(addDays(day, 1)).toBe("2026-11-18");
  });
  test("local reminder markers do not roll at UTC midnight", () => {
    const marker = (instant: string) =>
      `${localToday(new Date(instant), "America/Los_Angeles")}@18:00`;
    expect(marker("2026-11-17T23:59:59Z")).toBe("2026-11-17@18:00");
    expect(marker("2026-11-18T00:00:01Z")).toBe("2026-11-17@18:00");
  });
});

import { useCallback, useEffect, useState } from "react";

/**
 * Browser-local push-up reminders.
 *
 * The app has no server-side push infrastructure, so reminders are scheduled in
 * the open tab: for each of today's remaining set times we set a timeout that
 * fires a Notification (or falls back to nothing when permission is missing).
 * A localStorage marker keeps a reminder from firing twice for the same slot on
 * the same day, even across reloads.
 */

export type NotificationPermissionState = "unsupported" | NotificationPermission;

const FIRED_KEY = "pd:reminders-fired";

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function readFired(): Record<string, true> {
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function markFired(key: string) {
  try {
    const fired = readFired();
    fired[key] = true;
    // Keep only today's keys so the marker stays small.
    const today = key.split("@")[0];
    const pruned = Object.fromEntries(
      Object.keys(fired)
        .filter((k) => k.startsWith(`${today}@`))
        .map((k) => [k, true as const]),
    );
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(pruned));
  } catch {
    /* storage unavailable — reminders simply may repeat */
  }
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

interface UseRemindersArgs {
  enabled: boolean;
  today: string;
  slotTimes: string[];
  perSet: number;
  remaining: number;
}

export function useReminders({ enabled, today, slotTimes, perSet, remaining }: UseRemindersArgs) {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    supported() ? Notification.permission : "unsupported",
  );

  const request = useCallback(async () => {
    if (!supported()) return "unsupported" as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const sendTest = useCallback(() => {
    if (!supported() || Notification.permission !== "granted") return false;
    new Notification("Push Daily", {
      body: "Reminders are on — this is what a nudge looks like.",
      icon: "/favicon.png",
    });
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || !supported() || Notification.permission !== "granted") return;
    if (remaining <= 0) return;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const fired = readFired();
    const timers: number[] = [];

    slotTimes.forEach((time, index) => {
      const key = `${today}@${time}`;
      if (fired[key]) return;
      const delayMinutes = minutesOfDay(time) - nowMinutes;
      if (delayMinutes < 0) return;
      const timer = window.setTimeout(
        () => {
          markFired(key);
          new Notification("Push-up set time", {
            body: `Set ${index + 1} of ${slotTimes.length}: ${perSet} push-ups. ${remaining} left today.`,
            icon: "/favicon.png",
            tag: key,
          });
        },
        Math.max(delayMinutes, 0) * 60_000,
      );
      timers.push(timer);
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [enabled, today, slotTimes, perSet, remaining, permission]);

  return { permission, request, sendTest, supported: supported() };
}

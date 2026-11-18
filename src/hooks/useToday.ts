import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshProgress } from "@/lib/query-refresh";
import { localToday, localTimezone, nextLocalMidnight, utcToday } from "@/lib/local-date";

export function useToday(calendar = localToday) {
  const queryClient = useQueryClient();
  const [today, setToday] = useState(calendar);
  useEffect(() => {
    let timezone = localTimezone();
    let day = calendar();
    let midnightTimer: number;
    const refresh = () => {
      const nextTimezone = localTimezone();
      if (nextTimezone !== timezone) {
        timezone = nextTimezone;
        void refreshProgress(queryClient);
      }
      const nextDay = calendar();
      if (nextDay !== day) {
        day = nextDay;
        void refreshProgress(queryClient);
      }
      setToday(nextDay);
      window.clearTimeout(midnightTimer);
      const delay =
        calendar === utcToday
          ? Date.parse(`${utcToday()}T00:00:00Z`) + 86_400_000 - Date.now()
          : nextLocalMidnight();
      midnightTimer = window.setTimeout(refresh, delay + 25);
    };
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [calendar, queryClient]);
  return today;
}

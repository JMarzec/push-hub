import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { useToday } from "@/hooks/useToday";
import { useReminders } from "@/hooks/useReminders";
import { getToday } from "@/lib/pushups.functions";

/** Mounted once above all screens; diagnostics elsewhere do not schedule timers. */
export function ReminderScheduler() {
  const session = useSession();
  const today = useToday();
  const { data } = useQuery({
    queryKey: ["today", today],
    queryFn: () => getToday({ data: { today } }),
    enabled: Boolean(session),
    staleTime: 30_000,
    refetchInterval: session ? 60_000 : false,
  });
  const settings = data?.settings;
  const logged = Object.values(data?.repsBySlot ?? {}).reduce((sum, reps) => sum + reps, 0);
  const net = Math.max(0, logged + (data?.withdrawnToday ?? 0) - (data?.depositedToday ?? 0));
  useReminders({
    enabled: Boolean(session && settings?.remindersEnabled),
    today,
    slotTimes: settings?.slotTimes ?? [],
    perSet: Math.ceil((settings?.dailyTarget ?? 0) / (settings?.frequency ?? 1)),
    remaining: settings?.isRecoveryDay ? 0 : Math.max(0, (settings?.dailyTarget ?? 0) - net),
  });
  return null;
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  MonitorSmartphone,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/pushup/TabBar";
import { ReminderSheet } from "@/components/pushup/ReminderSheet";
import { useReminders } from "@/hooks/useReminders";
import { getToday, updateReminderSettings } from "@/lib/pushups.functions";
import { cn } from "@/lib/utils";

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Reminder troubleshooting — Push Daily" },
      {
        name: "description",
        content:
          "Step-by-step checks for Push Daily reminders: browser support, notification permission, set times, and a live view of which nudges are actually scheduled today.",
      },
      { property: "og:title", content: "Reminder troubleshooting — Push Daily" },
      {
        property: "og:description",
        content: "Fix missing push-up reminders and verify your nudges are scheduled for today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemindersHelp,
});

function StepRow({
  ok,
  title,
  detail,
  action,
}: {
  ok: boolean | "warn";
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const Icon = ok === true ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          ok === true ? "text-primary" : ok === "warn" ? "text-muted-foreground" : "text-destructive",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </li>
  );
}

function RemindersHelp() {
  const queryClient = useQueryClient();
  const [today] = useState(localToday);
  const [sheetOpen, setSheetOpen] = useState(false);

  const todayQuery = useQuery({
    queryKey: ["today", today],
    queryFn: () => getToday({ data: { today } }),
    staleTime: 15_000,
  });

  const reminderMutation = useMutation({
    mutationFn: useServerFn(updateReminderSettings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success("Reminder settings saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settings = todayQuery.data?.settings;
  const dailyTarget = settings?.dailyTarget ?? 50;
  const frequency = settings?.frequency ?? 4;
  const slotTimes = settings?.slotTimes ?? ["08:00", "12:00", "17:00", "21:00"];
  const enabled = settings?.remindersEnabled ?? false;
  const loggedToday = Object.values(
    (todayQuery.data?.repsBySlot ?? {}) as Record<string, number>,
  ).reduce((sum, n) => sum + n, 0);
  const remaining = Math.max(dailyTarget - loggedToday, 0);

  const reminders = useReminders({
    enabled,
    today,
    slotTimes,
    perSet: Math.ceil(dailyTarget / frequency),
    remaining,
  });

  const everythingOk =
    reminders.supported &&
    reminders.permission === "granted" &&
    enabled &&
    reminders.scheduledCount > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-foreground px-5 pb-8 pt-6 text-card">
        <div className="mx-auto max-w-md">
          <Link
            to="/me"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-card/70"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Me
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Reminder troubleshooting</h1>
          <p className="mt-1 text-sm text-card/70">
            Work through these checks to make sure your set-time nudges actually arrive.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 space-y-4 px-5 pb-8">
        <section
          className={cn(
            "rounded-3xl p-5 text-center shadow-[var(--shadow-ring)]",
            everythingOk ? "bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          <BellRing
            className={cn("mx-auto size-7", everythingOk ? "" : "text-primary")}
            aria-hidden="true"
          />
          <p className="mt-2 text-lg font-bold">
            {everythingOk
              ? `${reminders.scheduledCount} reminder${reminders.scheduledCount === 1 ? "" : "s"} scheduled`
              : "Reminders aren't fully set up"}
          </p>
          <p
            className={cn(
              "mt-1 text-sm",
              everythingOk ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {everythingOk
              ? "Keep this tab open and you'll be nudged at each remaining set time today."
              : "Fix the failing checks below, then re-verify."}
          </p>
        </section>

        <section
          className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
          aria-labelledby="checks-heading"
        >
          <h2 id="checks-heading" className="text-sm font-bold text-foreground">
            Setup checks
          </h2>
          <ol className="mt-1">
            <StepRow
              ok={reminders.supported}
              title="1. This browser supports notifications"
              detail={
                reminders.supported
                  ? "Notifications API detected."
                  : "This browser or private window blocks the Notifications API. Try Chrome, Edge, Safari 16.4+, or install the app to your home screen."
              }
            />
            <StepRow
              ok={reminders.permission === "granted" ? true : reminders.permission === "default" ? "warn" : false}
              title="2. Notification permission granted"
              detail={
                reminders.permission === "granted"
                  ? "Your browser is allowed to show Push Daily notifications."
                  : reminders.permission === "denied"
                    ? "Permission is blocked. Open the lock/settings icon in your address bar, set Notifications to Allow, then reload this page."
                    : "Permission hasn't been asked yet. Tap Allow notifications below."
              }
              action={
                reminders.permission === "default" ? (
                  <Button
                    size="sm"
                    className="rounded-full font-bold"
                    onClick={() => void reminders.request()}
                  >
                    Allow notifications
                  </Button>
                ) : null
              }
            />
            <StepRow
              ok={enabled}
              title="3. Reminders switched on in Push Daily"
              detail={
                enabled
                  ? "Reminders are enabled on your account."
                  : "Reminders are currently off — turn them on and confirm your set times."
              }
              action={
                <Button
                  size="sm"
                  variant={enabled ? "outline" : "default"}
                  className="rounded-full font-bold"
                  onClick={() => setSheetOpen(true)}
                >
                  {enabled ? "Edit set times" : "Turn on reminders"}
                </Button>
              }
            />
            <StepRow
              ok={remaining > 0 ? true : "warn"}
              title="4. You still have push-ups left today"
              detail={
                remaining > 0
                  ? `${remaining} of ${dailyTarget} push-ups left, so nudges are still relevant.`
                  : "You've already hit today's target, so no more nudges will fire today. They resume tomorrow."
              }
            />
            <StepRow
              ok={reminders.scheduledCount > 0 ? true : "warn"}
              title="5. Reminders are scheduled right now"
              detail={
                reminders.scheduledCount > 0
                  ? `${reminders.scheduledCount} upcoming nudge${reminders.scheduledCount === 1 ? "" : "s"} queued in this tab.`
                  : "Nothing is queued — either all of today's set times have passed, or a check above is failing."
              }
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full font-bold"
                    onClick={() => void todayQuery.refetch()}
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Re-verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full font-bold"
                    disabled={reminders.permission !== "granted"}
                    onClick={() => {
                      if (!reminders.sendTest()) {
                        toast.error("Couldn't send a test — check permission above.");
                        return;
                      }
                      toast.success("Test nudge sent.");
                    }}
                  >
                    Send test nudge
                  </Button>
                </div>
              }
            />
          </ol>
        </section>

        <section
          className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
          aria-labelledby="schedule-heading"
        >
          <h2
            id="schedule-heading"
            className="flex items-center gap-2 text-sm font-bold text-foreground"
          >
            <Clock className="size-4 text-primary" aria-hidden="true" />
            Today's set times
          </h2>
          <ul className="mt-3 space-y-2">
            {reminders.schedule.map((slot, index) => (
              <li
                key={slot.time}
                className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold tabular-nums text-foreground">{slot.time}</p>
                  <p className="text-xs text-muted-foreground">Set {index + 1}</p>
                </div>
                <span
                  className={cn(
                    "text-xs font-bold",
                    slot.status === "scheduled"
                      ? "text-primary"
                      : slot.status === "fired"
                        ? "text-muted-foreground"
                        : "text-destructive",
                  )}
                >
                  {slot.status === "scheduled"
                    ? `in ${Math.floor(slot.minutesAway / 60)}h ${slot.minutesAway % 60}m`
                    : slot.status === "fired"
                      ? "Sent"
                      : "Time passed"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <MonitorSmartphone className="size-4 text-primary" aria-hidden="true" />
            Still not getting nudges?
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
            <li>Reminders fire from an open Push Daily tab — keep one open in the background.</li>
            <li>On iPhone, add Push Daily to your home screen first, then allow notifications.</li>
            <li>Check your operating system's Focus / Do Not Disturb and per-browser alert settings.</li>
            <li>Nudges are skipped once you finish today's target, and reset after midnight.</li>
          </ul>
        </section>
      </main>

      <TabBar active={4} />

      <ReminderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        enabled={enabled}
        slotTimes={slotTimes}
        permission={reminders.permission}
        onRequestPermission={reminders.request}
        onSendTest={reminders.sendTest}
        onSave={(nextEnabled, nextTimes) =>
          reminderMutation.mutate({ data: { enabled: nextEnabled, slotTimes: nextTimes } })
        }
      />
    </div>
  );
}

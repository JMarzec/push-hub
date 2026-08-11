import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteLog, getDayLogs, updateLog } from "@/lib/pushups.functions";
import type { DayStatus } from "@/lib/streaks";

const STATUS_COPY: Record<DayStatus, { label: string; note: string; className: string }> = {
  hit: {
    label: "Counted",
    note: "You hit the target — this day adds +1 to your streak.",
    className: "bg-primary text-primary-foreground",
  },
  rest: {
    label: "Forgiven rest",
    note: "Missed but forgiven — your streak survived, but this day adds nothing.",
    className: "bg-primary/20 text-foreground",
  },
  break: {
    label: "Streak reset",
    note: "No rest day left in the window — the streak ended on this day.",
    className: "bg-destructive text-primary-foreground",
  },
  pending: {
    label: "Today",
    note: "Still open — today never breaks your streak. Hit the target and it counts.",
    className: "bg-secondary text-foreground",
  },
  none: {
    label: "No history",
    note: "This day is outside your logging history.",
    className: "bg-secondary text-muted-foreground",
  },
  recovery: {
    label: "Recovery day",
    note: "Your planned weekly day off — no target, and your streak keeps running.",
    className: "bg-accent text-accent-foreground",
  },
};

type Props = {
  date: string | null;
  status: DayStatus;
  inCurrentStreak: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

export function DayDetailsSheet({ date, status, inCurrentStreak, onOpenChange, onChanged }: Props) {
  const queryClient = useQueryClient();
  const fetchDay = useServerFn(getDayLogs);
  const saveLog = useServerFn(updateLog);
  const removeLog = useServerFn(deleteLog);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftReps, setDraftReps] = useState(0);

  const { data, isPending } = useQuery({
    queryKey: ["day-logs", date],
    queryFn: () => fetchDay({ data: { date: date! } }),
    enabled: !!date,
  });

  useEffect(() => {
    setEditingId(null);
  }, [date]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["day-logs", date] });
    onChanged();
  };

  const editMutation = useMutation({
    mutationFn: (vars: { id: string; reps: number }) => saveLog({ data: vars }),
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeLog({ data: { id } }),
    onSuccess: refresh,
  });

  const meta = STATUS_COPY[status];
  const target = data?.dailyTarget ?? 0;
  const total = data?.totalReps ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;

  return (
    <Sheet open={!!date} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="text-foreground tabular-nums">{date}</SheetTitle>
          <SheetDescription>{meta.note}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${meta.className}`}>
              {meta.label}
            </span>
            {inCurrentStreak ? (
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                In current streak
              </span>
            ) : null}
          </div>

          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-lg font-bold text-foreground tabular-nums">
              {total} / {target} reps
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {isPending ? (
            <p className="text-xs text-muted-foreground">Loading sets…</p>
          ) : data && data.logs.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
              {data.logs.map((log) => (
                <li key={log.id} className="flex items-center gap-2 px-3 py-2.5">
                  {editingId === log.id ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-full"
                        aria-label="Decrease reps"
                        onClick={() => setDraftReps((r) => Math.max(1, r - 5))}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-12 text-center text-sm font-bold text-foreground tabular-nums">
                        {draftReps}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-full"
                        aria-label="Increase reps"
                        onClick={() => setDraftReps((r) => Math.min(500, r + 5))}
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="ml-auto rounded-full"
                        disabled={editMutation.isPending}
                        onClick={() => editMutation.mutate({ id: log.id, reps: draftReps })}
                      >
                        <Check className="mr-1 size-4" /> Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          {log.reps} reps
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {log.activityLabel && log.activityAmount
                            ? `${log.activityAmount} ${log.activityUnit} ${log.activityLabel} · converted`
                            : log.slot
                              ? `Slot ${log.slot}`
                              : "Unassigned set"}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={() => {
                          setEditingId(log.id);
                          setDraftReps(log.reps);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full text-destructive"
                        aria-label={`Delete ${log.reps} rep set`}
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(log.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-secondary p-4 text-xs text-muted-foreground">
              Nothing logged on this day.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

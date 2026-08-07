import { useMemo, useState } from "react";
import { Minus, Plus, Settings2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  convertToPushups,
  describeRate,
  UNIT_LABELS,
  type ConversionRate,
} from "@/lib/activity-conversions";
import type { PushupSet } from "./SetChips";

const QUICK_ADD = [10, 20, 25, 50];
const MAX_SINGLE_LOG = 200;

export interface ActivityLog {
  reps: number;
  slot: string;
  activityKey: string;
  activityLabel: string;
  activityAmount: number;
  activityUnit: ConversionRate["unit"];
}

interface LogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sets: PushupSet[];
  defaultSlot: string;
  onLog: (reps: number, slot: string) => void;
  conversions?: ConversionRate[];
  onLogActivity?: (entry: ActivityLog) => void;
}

export function LogSheet({
  open,
  onOpenChange,
  sets,
  defaultSlot,
  onLog,
  conversions = [],
  onLogActivity,
}: LogSheetProps) {
  const [reps, setReps] = useState(25);
  const [slot, setSlot] = useState(defaultSlot);
  const [mode, setMode] = useState<"pushups" | "activity">("pushups");
  const [activityKey, setActivityKey] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const available = useMemo(() => conversions.filter((c) => c.enabled), [conversions]);
  const rate = available.find((c) => c.activityKey === activityKey) ?? available[0] ?? null;
  const amountValue = Number(amount);
  const convertedReps = rate ? convertToPushups(amountValue, rate) : 0;
  const canLogActivity = Boolean(rate) && amountValue > 0 && convertedReps > 0;

  const clamp = (n: number) => Math.max(1, Math.min(MAX_SINGLE_LOG, n));

  function submit() {
    onLog(reps, slot);
    onOpenChange(false);
    setReps(25);
  }

  function submitActivity() {
    if (!rate || !canLogActivity || !onLogActivity) return;
    onLogActivity({
      reps: convertedReps,
      slot,
      activityKey: rate.activityKey,
      activityLabel: rate.label,
      activityAmount: amountValue,
      activityUnit: rate.unit,
    });
    onOpenChange(false);
    setAmount("");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setSlot(defaultSlot);
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="text-foreground">
            {mode === "pushups" ? "Log push-ups" : "Log another activity"}
          </SheetTitle>
          <SheetDescription>
            {mode === "pushups"
              ? "Only log reps you've actually completed."
              : "Converted into push-up equivalents using your own rates."}
          </SheetDescription>
        </SheetHeader>

        {onLogActivity && (
          <div
            role="tablist"
            aria-label="Log type"
            className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
          >
            {(["pushups", "activity"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "min-h-10 rounded-full px-3 text-sm font-semibold transition-colors",
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "pushups" ? "Push-ups" : "Other activity"}
              </button>
            ))}
          </div>
        )}

        {mode === "pushups" ? (
          <>
            <div className="mt-6 flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="size-12 rounded-full"
                aria-label="Decrease by 5"
                onClick={() => setReps((r) => clamp(r - 5))}
              >
                <Minus className="size-5" />
              </Button>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Push-up count"
                value={reps}
                onChange={(e) => setReps(clamp(Number(e.target.value) || 1))}
                className="w-28 bg-transparent text-center text-5xl font-extrabold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              />
              <Button
                variant="outline"
                size="icon"
                className="size-12 rounded-full"
                aria-label="Increase by 5"
                onClick={() => setReps((r) => clamp(r + 5))}
              >
                <Plus className="size-5" />
              </Button>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              {QUICK_ADD.map((q) => (
                <Button
                  key={q}
                  variant={reps === q ? "default" : "secondary"}
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => setReps(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-muted-foreground">Activity</legend>
              <div className="flex flex-wrap gap-2">
                {available.map((c) => (
                  <button
                    key={c.activityKey}
                    type="button"
                    aria-pressed={rate?.activityKey === c.activityKey}
                    onClick={() => setActivityKey(c.activityKey)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                      rate?.activityKey === c.activityKey
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {available.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No activities set up yet — add your conversion rates first.
                </p>
              )}
            </fieldset>

            {rate && (
              <>
                <div className="mt-5">
                  <label
                    htmlFor="activity-amount"
                    className="mb-2 block text-sm font-medium text-muted-foreground"
                  >
                    Amount in {UNIT_LABELS[rate.unit]}
                  </label>
                  <input
                    id="activity-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder={String(rate.unitStep)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-border bg-card px-4 text-2xl font-bold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Your rate: {describeRate(rate)}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Counts as</p>
                  <p className="text-3xl font-extrabold tabular-nums text-foreground">
                    {convertedReps} push-ups
                  </p>
                </div>
              </>
            )}

            <Button asChild variant="ghost" size="sm" className="mt-3 gap-2 px-0">
              <Link to="/conversions" onClick={() => onOpenChange(false)}>
                <Settings2 className="size-4" aria-hidden="true" />
                Manage conversion rates
              </Link>
            </Button>
          </>
        )}

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Assign to set</legend>
          <div className="flex flex-wrap gap-2">
            {sets.map((s) => (
              <button
                key={s.time}
                type="button"
                aria-pressed={slot === s.time}
                onClick={() => setSlot(s.time)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-semibold tabular-nums transition-colors",
                  slot === s.time
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "pushups" ? (
          <Button className="mt-7 h-12 w-full rounded-full text-base font-bold" onClick={submit}>
            Add {reps} push-ups
          </Button>
        ) : (
          <Button
            className="mt-7 h-12 w-full rounded-full text-base font-bold"
            disabled={!canLogActivity}
            onClick={submitActivity}
          >
            {canLogActivity ? `Add ${convertedReps} push-ups` : "Enter an amount"}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}

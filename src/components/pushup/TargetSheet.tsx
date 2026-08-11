import { useState } from "react";
import { Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const MAX_DAILY = 500;
const MIN_DAILY = 10;
const FREQUENCIES = [1, 2, 3, 4, 6];

interface TargetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyTarget: number;
  frequency: number;
  restDayOfWeek?: number | null;
  onSave: (dailyTarget: number, frequency: number, restDayOfWeek: number | null) => void;
}

const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 0, short: "Sun" },
] as const;

export function TargetSheet({
  open,
  onOpenChange,
  dailyTarget,
  frequency,
  restDayOfWeek = null,
  onSave,
}: TargetSheetProps) {
  const [target, setTarget] = useState(dailyTarget);
  const [freq, setFreq] = useState(frequency);
  const [restDay, setRestDay] = useState<number | null>(restDayOfWeek);

  const perSet = Math.ceil(target / freq);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTarget(dailyTarget);
          setFreq(frequency);
          setRestDay(restDayOfWeek);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Sliders className="size-5 text-primary" aria-hidden="true" />
            Daily target
          </SheetTitle>
          <SheetDescription>
            Choose how many push-ups you want each day and how often you get reminded.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 text-center">
          <span className="text-5xl font-extrabold tabular-nums text-foreground">{target}</span>
          <span className="ml-2 text-sm text-muted-foreground">push-ups / day</span>
        </div>

        <div className="mt-4">
          <Slider
            value={[target]}
            min={MIN_DAILY}
            max={MAX_DAILY}
            step={10}
            aria-label="Daily push-up target"
            onValueChange={([v]) => setTarget(v ?? MIN_DAILY)}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{MIN_DAILY}</span>
            <span>{MAX_DAILY}</span>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">
            Sets per day (frequency)
          </legend>
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={freq === f}
                onClick={() => setFreq(f)}
                className={cn(
                  "min-h-11 min-w-14 rounded-full border px-4 text-sm font-semibold tabular-nums transition-colors",
                  freq === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {f}×
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-1 text-sm font-medium text-muted-foreground">
            Weekly recovery day (optional)
          </legend>
          <p className="mb-2 text-xs text-muted-foreground">
            Pick one day off a week. No target that day, your streak keeps running, and your squad
            total drops by your target.
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={restDay === d.value}
                onClick={() => setRestDay(restDay === d.value ? null : d.value)}
                className={cn(
                  "min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                  restDay === d.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {d.short}
              </button>
            ))}
          </div>
          {restDay !== null ? (
            <button
              type="button"
              onClick={() => setRestDay(null)}
              className="mt-2 text-xs font-semibold text-muted-foreground underline"
            >
              No recovery day
            </button>
          ) : null}
        </fieldset>

        <p className="mt-4 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          That's about <span className="font-bold tabular-nums">{perSet}</span> push-ups per set,{" "}
          <span className="font-bold tabular-nums">{freq}</span>{" "}
          {freq === 1 ? "time" : "times"} a day.
        </p>

        <Button
          className="mt-6 h-12 w-full rounded-full text-base font-bold"
          onClick={() => {
            onSave(target, freq, restDay);
            onOpenChange(false);
          }}
        >
          Save target
        </Button>
      </SheetContent>
    </Sheet>
  );
}

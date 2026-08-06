import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PushupSet } from "./SetChips";

const QUICK_ADD = [10, 20, 25, 50];
const MAX_SINGLE_LOG = 200;

interface LogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sets: PushupSet[];
  defaultSlot: string;
  onLog: (reps: number, slot: string) => void;
}

export function LogSheet({ open, onOpenChange, sets, defaultSlot, onLog }: LogSheetProps) {
  const [reps, setReps] = useState(25);
  const [slot, setSlot] = useState(defaultSlot);

  const clamp = (n: number) => Math.max(1, Math.min(MAX_SINGLE_LOG, n));

  function submit() {
    onLog(reps, slot);
    onOpenChange(false);
    setReps(25);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setSlot(defaultSlot);
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="text-foreground">Log push-ups</SheetTitle>
          <SheetDescription>Only log reps you've actually completed.</SheetDescription>
        </SheetHeader>

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

        <Button
          className="mt-7 h-12 w-full rounded-full text-base font-bold"
          onClick={submit}
        >
          Add {reps} push-ups
        </Button>
      </SheetContent>
    </Sheet>
  );
}

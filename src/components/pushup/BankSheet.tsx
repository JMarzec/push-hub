import { useState } from "react";
import { PiggyBank } from "lucide-react";
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

interface BankSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surplus: number;
  bank: number;
  remainingToday: number;
  onDeposit: (reps: number) => void;
  onWithdraw: (reps: number) => void;
}

export function BankSheet({
  open,
  onOpenChange,
  surplus,
  bank,
  remainingToday,
  onDeposit,
  onWithdraw,
}: BankSheetProps) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const max = mode === "deposit" ? surplus : Math.min(bank, remainingToday);
  const [amount, setAmount] = useState(0);
  const value = Math.min(amount, max);

  function switchMode(next: "deposit" | "withdraw") {
    setMode(next);
    setAmount(next === "deposit" ? surplus : Math.min(bank, remainingToday));
  }

  function submit() {
    if (value <= 0) return;
    if (mode === "deposit") onDeposit(value);
    else onWithdraw(value);
    setAmount(0);
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const startMode = surplus > 0 ? "deposit" : "withdraw";
          setMode(startMode);
          // Pre-fill with everything available so one tap banks the whole surplus.
          setAmount(startMode === "deposit" ? surplus : Math.min(bank, remainingToday));
        }
        onOpenChange(next);
      }}

    >
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <PiggyBank className="size-5 text-primary" aria-hidden="true" />
            Bank push-ups
          </SheetTitle>
          <SheetDescription>
            Save extra reps you've already done for a future day, or spend them on today.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-accent px-4 py-3">
          <span className="text-sm font-semibold text-accent-foreground">Banked balance</span>
          <span className="text-2xl font-extrabold tabular-nums text-accent-foreground">{bank}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2" role="tablist" aria-label="Bank action">
          {(["deposit", "withdraw"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "min-h-11 rounded-full border text-sm font-semibold capitalize transition-colors",
                mode === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {m === "deposit" ? "Bank extra" : "Use banked"}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {mode === "deposit"
            ? surplus > 0
              ? `You're ${surplus} reps past today's target — bank up to ${surplus}.`
              : "Nothing to bank yet. Finish today's target first, then extra reps become bankable."
            : bank > 0
              ? remainingToday > 0
                ? `You can spend up to ${max} banked reps on today's remaining ${remainingToday}.`
                : "Today's target is already met — no need to spend banked reps."
              : "Your bank is empty. Log extra reps on a strong day to build it up."}
        </p>

        <div className="mt-6 text-center">
          <span className="text-5xl font-extrabold tabular-nums text-foreground">{value}</span>
          <span className="ml-2 text-sm text-muted-foreground">reps</span>
        </div>

        <div className="mt-4">
          <Slider
            value={[value]}
            max={Math.max(max, 1)}
            step={5}
            disabled={max <= 0}
            aria-label={mode === "deposit" ? "Reps to bank" : "Banked reps to use"}
            onValueChange={([v]) => setAmount(v ?? 0)}
          />
        </div>

        <Button
          className="mt-7 h-12 w-full rounded-full text-base font-bold"
          disabled={value <= 0}
          onClick={submit}
        >
          {mode === "deposit" ? `Bank ${value} reps` : `Use ${value} banked reps`}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

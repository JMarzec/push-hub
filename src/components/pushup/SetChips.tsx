import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PushupSet {
  time: string;
  reps: number;
  target: number;
}

interface SetChipsProps {
  sets: PushupSet[];
}

export function SetChips({ sets }: SetChipsProps) {
  return (
    <ul className="grid grid-cols-2 gap-2" aria-label="Today's sets">
      {sets.map((set) => {
        const done = set.reps >= set.target;
        return (
          <li
            key={set.time}
            aria-label={`${set.time} set, ${set.reps} of ${set.target} push-ups${done ? ", complete" : ""}`}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5",
              done ? "border-success/30 bg-success/10" : "border-border bg-card",
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full",
                done ? "bg-success text-card" : "bg-secondary text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-4" /> : <Clock className="size-4" />}
            </span>
            <span className="flex flex-col leading-tight" aria-hidden="true">
              <span className="text-sm font-semibold text-foreground tabular-nums">{set.time}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {set.reps}/{set.target}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DayStripProps {
  days: number;
  current: number;
  completed: number[];
}

export function DayStrip({ days, current, completed }: DayStripProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label={`Challenge days, day ${current} selected`}
    >
      {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
        const isDone = completed.includes(day);
        const isCurrent = day === current;
        return (
          <div
            key={day}
            role="listitem"
            aria-label={`Day ${day}${isDone ? ", completed" : isCurrent ? ", today" : ""}`}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
              isCurrent
                ? "border-primary bg-primary text-primary-foreground"
                : isDone
                  ? "border-primary/40 bg-accent text-accent-foreground"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            {isDone && !isCurrent ? <Check className="size-4" aria-hidden="true" /> : day}
          </div>
        );
      })}
    </div>
  );
}

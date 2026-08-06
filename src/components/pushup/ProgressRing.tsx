import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({
  value,
  target,
  size = 236,
  strokeWidth = 18,
  className,
}: ProgressRingProps) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const percentLabel = Math.round(pct * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = value >= target && target > 0;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of ${target} push-ups, ${percentLabel} percent complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none",
            complete ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-6xl font-extrabold tabular-nums tracking-tight text-foreground"
          aria-hidden="true"
        >
          {value}
        </span>
        <span className="mt-1 text-sm font-medium text-muted-foreground" aria-hidden="true">
          of {target}
        </span>
        <span
          className={cn(
            "mt-2 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            complete ? "bg-success/15 text-success" : "bg-accent text-accent-foreground",
          )}
          aria-hidden="true"
        >
          {complete ? "Target smashed" : `${percentLabel}%`}
        </span>
      </div>
    </div>
  );
}

import { Activity, HeartPulse, Trophy, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Progress", icon: Activity },
  { label: "Squad", icon: Users },
  { label: "Trophies", icon: Trophy },
  { label: "Wellbeing", icon: HeartPulse },
  { label: "Me", icon: User },
];

export function TabBar({ active = 0 }: { active?: number }) {
  return (
    <nav
      aria-label="Main navigation"
      className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === active;
          return (
            <li key={item.label} className="flex-1">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

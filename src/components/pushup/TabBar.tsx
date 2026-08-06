import { Activity, HeartPulse, Trophy, User, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Progress", icon: Activity, to: "/today" as const },
  { label: "Squad", icon: Users, to: "/squad" as const },
  { label: "Trophies", icon: Trophy, to: "/trophies" as const },
  { label: "Wellbeing", icon: HeartPulse, to: "/wellbeing" as const },
  { label: "Me", icon: User, to: "/me" as const },
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
          const className = cn(
            "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors",
            isActive ? "text-primary" : "text-muted-foreground",
          );
          return (
            <li key={item.label} className="flex-1">
              {item.to ? (
                <Link
                  to={item.to}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={className}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-label={`${item.label} — coming soon`}
                  disabled
                  className={cn(className, "opacity-50")}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { useEffect, useState } from "react";
import { Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const FREQUENCIES = [1, 2, 3, 4, 6];

interface SharedTargetCardProps {
  teamName: string;
  isOwner: boolean;
  sharedTarget: number | null;
  sharedFrequency: number | null;
  followsShared: boolean;
  followerCount: number;
  memberCount: number;
  busy?: boolean;
  onSaveShared: (sharedTarget: number | null, sharedFrequency: number | null) => void;
  onToggleFollow: (follow: boolean) => void;
}

export function SharedTargetCard({
  teamName,
  isOwner,
  sharedTarget,
  sharedFrequency,
  followsShared,
  followerCount,
  memberCount,
  busy = false,
  onSaveShared,
  onToggleFollow,
}: SharedTargetCardProps) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(sharedTarget ?? 50);
  const [freq, setFreq] = useState(sharedFrequency ?? 4);

  useEffect(() => {
    setTarget(sharedTarget ?? 50);
    setFreq(sharedFrequency ?? 4);
  }, [sharedTarget, sharedFrequency]);

  return (
    <section
      className="rounded-3xl bg-card p-5 shadow-[var(--shadow-ring)]"
      aria-labelledby="shared-target-heading"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent">
          <Target className="size-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="shared-target-heading" className="text-sm font-bold text-foreground">
            Squad target
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {sharedTarget
              ? `${sharedTarget} a day · ${sharedFrequency ?? 4}× sets · ${Math.ceil(
                  sharedTarget / (sharedFrequency ?? 4),
                )} per set`
              : isOwner
                ? "Not set — pick one target for everyone who opts in."
                : `${teamName} hasn't set a shared target yet.`}
          </p>
          {sharedTarget ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Users className="size-3.5" aria-hidden="true" />
              {followerCount} of {memberCount} following
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
        <div className="min-w-0">
          <Label htmlFor="follow-shared" className="text-sm font-semibold text-foreground">
            Follow squad target
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sharedTarget
              ? followsShared
                ? "Your daily target comes from the squad."
                : "You're using your own personal target."
              : "Available once the owner sets a squad target."}
          </p>
        </div>
        <Switch
          id="follow-shared"
          checked={followsShared}
          disabled={busy || !sharedTarget}
          onCheckedChange={onToggleFollow}
          aria-label="Follow the squad shared target instead of my personal target"
        />
      </div>

      {isOwner ? (
        editing ? (
          <div className="mt-4 space-y-4 rounded-2xl border border-border p-4">
            <div>
              <p className="text-center text-3xl font-bold text-foreground tabular-nums">
                {target}
              </p>
              <p className="mt-0.5 text-center text-xs text-muted-foreground">push-ups per day</p>
              <Slider
                className="mt-3"
                min={10}
                max={500}
                step={5}
                value={[target]}
                onValueChange={([next]) => setTarget(next ?? target)}
                aria-label="Shared daily target"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sets per day
              </p>
              <div className="mt-2 flex gap-2">
                {FREQUENCIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={freq === option}
                    onClick={() => setFreq(option)}
                    className={cn(
                      "h-10 flex-1 rounded-full text-sm font-bold",
                      freq === option
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {option}×
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="h-11 flex-1 rounded-full font-bold"
                disabled={busy}
                onClick={() => {
                  onSaveShared(target, freq);
                  setEditing(false);
                }}
              >
                Save squad target
              </Button>
              <Button
                variant="ghost"
                className="h-11 rounded-full font-semibold"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
            {sharedTarget ? (
              <Button
                variant="ghost"
                className="h-10 w-full rounded-full text-sm font-semibold text-destructive"
                disabled={busy}
                onClick={() => {
                  onSaveShared(null, null);
                  setEditing(false);
                }}
              >
                Remove squad target
              </Button>
            ) : null}
          </div>
        ) : (
          <Button
            variant="outline"
            className="mt-3 h-11 w-full rounded-full font-bold"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            {sharedTarget ? "Edit squad target" : "Set a squad target"}
          </Button>
        )
      ) : null}
    </section>
  );
}

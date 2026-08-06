import { useEffect, useState } from "react";
import { Bell, BellOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ReminderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  slotTimes: string[];
  permission: "unsupported" | NotificationPermission;
  onRequestPermission: () => Promise<"unsupported" | NotificationPermission>;
  onSendTest: () => boolean;
  onSave: (enabled: boolean, slotTimes: string[]) => void;
}

export function ReminderSheet({
  open,
  onOpenChange,
  enabled,
  slotTimes,
  permission,
  onRequestPermission,
  onSendTest,
  onSave,
}: ReminderSheetProps) {
  const [on, setOn] = useState(enabled);
  const [times, setTimes] = useState(slotTimes);

  useEffect(() => {
    if (open) {
      setOn(enabled);
      setTimes(slotTimes);
    }
  }, [open, enabled, slotTimes]);

  async function handleToggle(next: boolean) {
    if (next && permission !== "granted") {
      const result = await onRequestPermission();
      if (result !== "granted") {
        setOn(false);
        return;
      }
    }
    setOn(next);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Bell className="size-5 text-primary" aria-hidden="true" />
            Set reminders
          </SheetTitle>
          <SheetDescription>
            Get a nudge at each set time while Push Daily is open in a tab.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
            <div>
              <p className="text-sm font-bold text-foreground">Reminders</p>
              <p className="text-xs text-muted-foreground">
                {permission === "unsupported"
                  ? "This browser doesn't support notifications."
                  : permission === "denied"
                    ? "Notifications are blocked in your browser settings."
                    : on
                      ? "On — you'll be nudged at each set time."
                      : "Off"}
              </p>
            </div>
            <Switch
              checked={on}
              disabled={permission === "unsupported" || permission === "denied"}
              onCheckedChange={(next) => void handleToggle(next)}
              aria-label="Enable set reminders"
            />
          </div>

          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              Set times
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {times.map((time, index) => (
                <div key={index}>
                  <Label htmlFor={`slot-${index}`} className="text-xs text-muted-foreground">
                    Set {index + 1}
                  </Label>
                  <Input
                    id={`slot-${index}`}
                    type="time"
                    value={time}
                    onChange={(e) =>
                      setTimes((prev) =>
                        prev.map((t, i) => (i === index ? e.target.value || t : t)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Times follow your device clock. Change how many sets you get from Daily target.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-full font-bold"
              disabled={permission !== "granted"}
              onClick={() => {
                if (!onSendTest()) return;
              }}
            >
              <BellOff className="size-4" aria-hidden="true" />
              Send test
            </Button>
            <Button
              className="h-11 flex-1 rounded-full font-bold"
              onClick={() => {
                onSave(on, times);
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

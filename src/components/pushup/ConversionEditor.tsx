import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  describeRate,
  perStepToPerUnit,
  perUnitToPerStep,
  UNIT_LABELS,
  type ConversionRate,
} from "@/lib/activity-conversions";

export function ConversionEditor({
  rate,
  save,
  remove,
}: {
  rate: ConversionRate;
  save: (rate: ConversionRate, patch: Partial<ConversionRate>) => Promise<void>;
  remove: (id: string) => Promise<unknown>;
}) {
  const [step, setStep] = useState(String(rate.unitStep));
  const [value, setValue] = useState(String(perUnitToPerStep(rate.pushupsPerUnit, rate.unitStep)));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStep(String(rate.unitStep));
    setValue(String(perUnitToPerStep(rate.pushupsPerUnit, rate.unitStep)));
  }, [rate.unitStep, rate.pushupsPerUnit]);
  async function commit(patch: Partial<ConversionRate>) {
    if (busy) return;
    setBusy(true);
    try {
      await save(rate, patch);
    } catch {
      /* parent displays the save error */
    } finally {
      setBusy(false);
    }
  }
  const valid = Number(step) > 0 && Number(value) > 0;
  const dirty =
    Number(step) !== rate.unitStep ||
    Number(value) !== perUnitToPerStep(rate.pushupsPerUnit, rate.unitStep);
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">{rate.label}</p>
          <p className="text-xs text-muted-foreground">{describeRate(rate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={rate.enabled}
            disabled={busy || dirty}
            aria-label={`Show ${rate.label} when logging`}
            onCheckedChange={(enabled) => void commit({ enabled })}
          />
          {rate.isCustom && rate.id ? (
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={`Delete ${rate.label}`}
              onClick={() => {
                if (rate.id) void remove(rate.id).catch(() => {});
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`step-${rate.activityKey}`} className="text-xs">
            Every
          </Label>
          <Input
            id={`step-${rate.activityKey}`}
            type="number"
            min={0}
            step="any"
            value={step}
            disabled={busy}
            onChange={(e) => setStep(e.target.value)}
          />
        </div>
        <span className="pb-2.5 text-sm text-muted-foreground">{UNIT_LABELS[rate.unit]} =</span>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`value-${rate.activityKey}`} className="text-xs">
            Push-ups
          </Label>
          <Input
            id={`value-${rate.activityKey}`}
            type="number"
            min={0}
            step="any"
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          title="Save conversion"
          aria-label={`Save ${rate.label} conversion`}
          disabled={busy || !valid || !dirty}
          onClick={() =>
            void commit({
              unitStep: Number(step),
              pushupsPerUnit: perStepToPerUnit(Number(value), Number(step)),
            })
          }
        >
          <Save className="size-4" />
        </Button>
      </div>
    </li>
  );
}

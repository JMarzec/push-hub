import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabBar } from "@/components/pushup/TabBar";
import {
  describeRate,
  perStepToPerUnit,
  perUnitToPerStep,
  slugify,
  UNIT_LABELS,
  UNIT_OPTIONS,
  type ConversionRate,
  type ConversionUnit,
} from "@/lib/activity-conversions";
import {
  deleteConversion,
  listConversions,
  saveConversion,
} from "@/lib/conversions.functions";
import { cn } from "@/lib/utils";

const conversionsQueryOptions = queryOptions({
  queryKey: ["conversions"],
  queryFn: () => listConversions(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/conversions")({
  component: ConversionsScreen,
  head: () => ({
    meta: [
      { title: "Activity conversions — Push Daily" },
      {
        name: "description",
        content:
          "Set how swimming, running, squats and your own activities convert into push-up equivalents.",
      },
      { property: "og:title", content: "Activity conversions — Push Daily" },
      {
        property: "og:description",
        content: "Turn swims, runs and squats into push-up equivalents with your own rates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ConversionsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(conversionsQueryOptions);
  const conversions = data?.conversions ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversions"] });
  };

  const saveMutation = useMutation({
    mutationFn: useServerFn(saveConversion),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: useServerFn(deleteConversion),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState<ConversionUnit>("reps");
  const [newStep, setNewStep] = useState("1");
  const [newValue, setNewValue] = useState("1");

  async function persist(rate: ConversionRate, patch: Partial<ConversionRate>) {
    const next = { ...rate, ...patch };
    await saveMutation.mutateAsync({
      data: {
        id: next.id,
        activityKey: next.activityKey,
        label: next.label,
        unit: next.unit,
        unitStep: next.unitStep,
        pushupsPerUnit: next.pushupsPerUnit,
        isCustom: next.isCustom,
        enabled: next.enabled,
      },
    });
  }

  async function addCustom() {
    const label = newLabel.trim();
    const step = Number(newStep);
    const perStep = Number(newValue);
    if (!label) return toast.error("Give the activity a name.");
    if (!(step > 0) || !(perStep > 0)) return toast.error("Amounts must be greater than zero.");
    const key = slugify(label);
    if (conversions.some((c) => c.activityKey === key)) {
      return toast.error("You already have an activity with that name.");
    }
    await saveMutation.mutateAsync({
      data: {
        id: null,
        activityKey: key,
        label,
        unit: newUnit,
        unitStep: step,
        pushupsPerUnit: perStepToPerUnit(perStep, step),
        isCustom: true,
        enabled: true,
      },
    });
    setNewLabel("");
    setNewStep("1");
    setNewValue("1");
    toast.success(`${label} added.`);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
          <Link to="/me">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Me
          </Link>
        </Button>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">
          Activity conversions
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Swim, run or do squats instead? Set what one chunk of each activity is worth in push-ups.
          These rates are yours alone — they never change anyone else's targets.
        </p>

        {isLoading && (
          <div className="mt-6 space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {conversions.map((rate) => (
            <li
              key={rate.activityKey}
              className={cn(
                "rounded-2xl border border-border bg-card p-4",
                !rate.enabled && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{rate.label}</p>
                  <p className="text-xs text-muted-foreground">{describeRate(rate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rate.enabled}
                    aria-label={`Show ${rate.label} when logging`}
                    onCheckedChange={(checked) => void persist(rate, { enabled: checked })}
                  />
                  {rate.isCustom && rate.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${rate.label}`}
                      onClick={() => {
                        void deleteMutation.mutateAsync({ data: { id: rate.id! } });
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-end gap-2">
                <div className="w-24">
                  <Label htmlFor={`step-${rate.activityKey}`} className="text-xs">
                    Every
                  </Label>
                  <Input
                    id={`step-${rate.activityKey}`}
                    type="number"
                    min={0}
                    step="any"
                    defaultValue={rate.unitStep}
                    onBlur={(e) => {
                      const step = Number(e.target.value);
                      if (!(step > 0) || step === rate.unitStep) return;
                      void persist(rate, {
                        unitStep: step,
                        pushupsPerUnit: perStepToPerUnit(
                          perUnitToPerStep(rate.pushupsPerUnit, rate.unitStep),
                          step,
                        ),
                      });
                    }}
                  />
                </div>
                <span className="pb-2.5 text-sm text-muted-foreground">
                  {UNIT_LABELS[rate.unit]} =
                </span>
                <div className="w-24">
                  <Label htmlFor={`value-${rate.activityKey}`} className="text-xs">
                    Push-ups
                  </Label>
                  <Input
                    id={`value-${rate.activityKey}`}
                    type="number"
                    min={0}
                    step="any"
                    defaultValue={perUnitToPerStep(rate.pushupsPerUnit, rate.unitStep)}
                    onBlur={(e) => {
                      const perStep = Number(e.target.value);
                      if (!(perStep > 0)) return;
                      const nextPerUnit = perStepToPerUnit(perStep, rate.unitStep);
                      if (nextPerUnit === rate.pushupsPerUnit) return;
                      void persist(rate, { pushupsPerUnit: nextPerUnit });
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <section className="mt-8 rounded-2xl border border-dashed border-border p-4">
          <h2 className="font-bold text-foreground">Add your own activity</h2>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="new-label">Name</Label>
              <Input
                id="new-label"
                maxLength={40}
                placeholder="Rowing"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-unit">Unit</Label>
              <div className="mt-1 flex flex-wrap gap-2" id="new-unit">
                {UNIT_OPTIONS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={newUnit === u}
                    onClick={() => setNewUnit(u)}
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm font-semibold",
                      newUnit === u
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {UNIT_LABELS[u]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-24">
                <Label htmlFor="new-step" className="text-xs">
                  Every
                </Label>
                <Input
                  id="new-step"
                  type="number"
                  min={0}
                  step="any"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">
                {UNIT_LABELS[newUnit]} =
              </span>
              <div className="w-24">
                <Label htmlFor="new-value" className="text-xs">
                  Push-ups
                </Label>
                <Input
                  id="new-value"
                  type="number"
                  min={0}
                  step="any"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="h-11 w-full gap-2 rounded-full font-bold"
              disabled={saveMutation.isPending}
              onClick={() => void addCustom()}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add activity
            </Button>
          </div>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Converted reps count towards your daily ring, streaks, bank and squad total, and logged
          entries keep a note of the original activity.
        </p>
      </main>

      <TabBar active={4} />
    </div>
  );
}

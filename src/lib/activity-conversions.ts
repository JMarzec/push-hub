/**
 * Activity → push-up conversions.
 *
 * Some days you swim, run or do squats instead of push-ups. Each user keeps
 * their own exchange rate ("100 m swim = 30 push-ups") and logging an activity
 * stores the converted rep count, so the ring, streaks, bank and squad totals
 * all keep working off a single `reps` number.
 *
 * Rates are personal only — they are never shared with or applied to teammates.
 */

export type ConversionUnit = "m" | "km" | "reps" | "min";

export interface ConversionRate {
  id: string | null;
  activityKey: string;
  label: string;
  unit: ConversionUnit;
  /** The chunk the rate is quoted in, e.g. 100 m swim or 1 km run. */
  unitStep: number;
  /** Push-ups earned per single unit (per metre, per rep, per minute). */
  pushupsPerUnit: number;
  isCustom: boolean;
  enabled: boolean;
}

export const UNIT_LABELS: Record<ConversionUnit, string> = {
  m: "metres",
  km: "km",
  reps: "reps",
  min: "minutes",
};

export const UNIT_OPTIONS: ConversionUnit[] = ["m", "km", "reps", "min"];

/**
 * Starting rates, roughly matched on effort rather than calories. They are only
 * a sensible default — everyone can retune them on the Conversions screen.
 */
export const DEFAULT_CONVERSIONS: Omit<ConversionRate, "id">[] = [
  {
    activityKey: "swim",
    label: "Swimming",
    unit: "m",
    unitStep: 100,
    pushupsPerUnit: 0.3,
    isCustom: false,
    enabled: true,
  },
  {
    activityKey: "run",
    label: "Running",
    unit: "km",
    unitStep: 1,
    pushupsPerUnit: 40,
    isCustom: false,
    enabled: true,
  },
  {
    activityKey: "squats",
    label: "Squats",
    unit: "reps",
    unitStep: 1,
    pushupsPerUnit: 0.5,
    isCustom: false,
    enabled: true,
  },
  {
    activityKey: "burpees",
    label: "Burpees",
    unit: "reps",
    unitStep: 1,
    pushupsPerUnit: 1.5,
    isCustom: false,
    enabled: true,
  },
  {
    activityKey: "plank",
    label: "Plank",
    unit: "min",
    unitStep: 1,
    pushupsPerUnit: 15,
    isCustom: false,
    enabled: true,
  },
];

export const MAX_CONVERTED_REPS = 500;

/** Converted reps always land on a whole number, rounded down, and capped. */
export function convertToPushups(amount: number, rate: ConversionRate): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const reps = Math.floor(amount * rate.pushupsPerUnit);
  return Math.max(0, Math.min(MAX_CONVERTED_REPS, reps));
}

/** "100 m = 30 push-ups" — the human-readable rate for a chunk. */
export function describeRate(rate: ConversionRate): string {
  const perStep = rate.unitStep * rate.pushupsPerUnit;
  const rounded = Number.isInteger(perStep) ? perStep : Number(perStep.toFixed(1));
  return `${rate.unitStep} ${UNIT_LABELS[rate.unit]} = ${rounded} push-ups`;

}

/** Turn the per-chunk value a user types into the stored per-unit rate. */
export function perStepToPerUnit(perStep: number, unitStep: number): number {
  if (unitStep <= 0) return perStep;
  return perStep / unitStep;
}

export function perUnitToPerStep(pushupsPerUnit: number, unitStep: number): number {
  const value = pushupsPerUnit * unitStep;
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

export function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || `activity-${Date.now().toString(36)}`;
}

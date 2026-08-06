export type WellbeingCategory = "Sleep" | "Mood" | "Strength" | "Recovery" | "Habits" | "Heart";

export type WellbeingFact = {
  id: string;
  category: WellbeingCategory;
  title: string;
  body: string;
  source: string;
};

export const WELLBEING_CATEGORIES: WellbeingCategory[] = [
  "Sleep",
  "Mood",
  "Strength",
  "Recovery",
  "Habits",
  "Heart",
];

export const WELLBEING_FACTS: WellbeingFact[] = [
  {
    id: "sleep-quality",
    category: "Sleep",
    title: "Movement improves sleep quality",
    body: "Regular moderate exercise is linked with better sleep quality — and better sleep is one of the strongest supports for day-to-day mental wellbeing.",
    source: "General exercise & sleep research",
  },
  {
    id: "mood-short-bouts",
    category: "Mood",
    title: "Short bouts still lift your mood",
    body: "Even a couple of minutes of effort can shift how you feel. A single set of push-ups raises heart rate enough to nudge mood and alertness.",
    source: "Physical activity & affect studies",
  },
  {
    id: "strength-progressive",
    category: "Strength",
    title: "Small increases beat big jumps",
    body: "Adding a few reps at a time lets tendons and connective tissue adapt alongside muscle, which is where most avoidable niggles come from.",
    source: "Progressive overload principles",
  },
  {
    id: "recovery-rest-days",
    category: "Recovery",
    title: "Rest is part of the training",
    body: "Muscle repair happens between sessions, not during them. A planned easy day is not lost progress — it is when the progress lands.",
    source: "Recovery & adaptation basics",
  },
  {
    id: "habits-anchor",
    category: "Habits",
    title: "Anchor reps to something you already do",
    body: "Attaching a set to an existing routine — kettle on, end of a call, before a shower — is far more reliable than relying on motivation.",
    source: "Habit formation research",
  },
  {
    id: "heart-daily-activity",
    category: "Heart",
    title: "Daily activity adds up",
    body: "Cardiovascular benefit tracks total weekly activity more than any single session, so frequent small efforts are genuinely valuable.",
    source: "Physical activity guidelines",
  },
  {
    id: "mood-stress",
    category: "Mood",
    title: "Effort helps discharge stress",
    body: "Brief intense effort gives the stress response somewhere to go, which is why people often feel calmer after a set than before it.",
    source: "Stress physiology overview",
  },
  {
    id: "strength-form-first",
    category: "Strength",
    title: "Form outranks volume",
    body: "Full range with a braced core builds more strength than a higher count with a sagging hip — and it protects your lower back.",
    source: "Resistance training technique",
  },
  {
    id: "sleep-timing",
    category: "Sleep",
    title: "Late sets are fine for most people",
    body: "Evening exercise does not disrupt sleep for most people. If it leaves you wired, shift your last set an hour or two earlier.",
    source: "Exercise timing & sleep reviews",
  },
  {
    id: "recovery-soreness",
    category: "Recovery",
    title: "Soreness is not a scorecard",
    body: "Muscle soreness reflects novelty more than effectiveness. Consistent, unremarkable sessions are what move your baseline.",
    source: "Delayed onset muscle soreness research",
  },
  {
    id: "habits-streaks",
    category: "Habits",
    title: "Never miss twice",
    body: "One missed day changes almost nothing. Two in a row is what quietly ends a streak — so make the return day deliberately small.",
    source: "Behaviour change practice",
  },
  {
    id: "heart-breathing",
    category: "Heart",
    title: "Breathe through the reps",
    body: "Holding your breath spikes blood pressure. Exhale on the push, inhale on the way down, and keep the rhythm steady.",
    source: "Resistance training safety guidance",
  },
  {
    id: "mood-social",
    category: "Mood",
    title: "Training with others sticks better",
    body: "Shared goals raise follow-through. Knowing a squad-mate can see your day is a mild, useful form of accountability.",
    source: "Social support & adherence studies",
  },
  {
    id: "strength-tempo",
    category: "Strength",
    title: "Slow the lowering phase",
    body: "Taking two to three seconds on the way down increases time under tension, so you get more from the same number of reps.",
    source: "Tempo training literature",
  },
];

const DAY_MS = 86_400_000;

function dayIndex(startDate: string, date: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(dateMs)) return 0;
  return Math.floor((dateMs - startMs) / DAY_MS);
}

/** Deterministic fact for a given challenge day, so history never reshuffles. */
export function factForDate(startDate: string, date: string): WellbeingFact {
  const i = dayIndex(startDate, date);
  const wrapped = ((i % WELLBEING_FACTS.length) + WELLBEING_FACTS.length) % WELLBEING_FACTS.length;
  return WELLBEING_FACTS[wrapped]!;
}

export type WellbeingEntry = {
  date: string;
  dayNumber: number;
  fact: WellbeingFact;
};

/** Today first, then every earlier challenge day back to the start date. */
export function buildFactHistory(
  startDate: string,
  today: string,
  limit = 60,
): WellbeingEntry[] {
  const span = Math.max(dayIndex(startDate, today), 0);
  const entries: WellbeingEntry[] = [];
  const startMs = Date.parse(`${startDate}T00:00:00Z`);

  for (let i = span; i >= 0 && entries.length < limit; i -= 1) {
    const date = new Date(startMs + i * DAY_MS).toISOString().slice(0, 10);
    entries.push({ date, dayNumber: i + 1, fact: factForDate(startDate, date) });
  }

  return entries;
}

export function formatFactDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

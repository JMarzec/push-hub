# Push Daily 💪

A mobile-first social fitness app for daily push-up targets. You set how many push-ups you
want to do per day and how often you want to be nudged, log your reps against a circular
progress ring, bank surplus reps for tougher days, and invite friends to train alongside you.

Inspired by "The Pushup Challenge", rebuilt as a private, friend-scale challenge app rather
than a global leaderboard race.

---

## Objectives

- **Make the daily target feel achievable** — one clear number, split into small sets across the day.
- **Give the user real control** — the daily count (10–500) and the frequency (1, 2, 3, 4 or 6 sets) are both user-owned settings, not fixed by the app.
- **Reward consistency, not intensity** — streaks, banked reps and a forgiving schedule instead of punishing all-or-nothing goals.
- **Be social at friend scale** — private squads via an invite link rather than anonymous global rankings.
- **Stay safe** — visible medical disclaimer, a hard daily ceiling, and (planned) a PAR-Q style readiness gate before the first session.

---

## Features

### Live today

| Area | What works |
| --- | --- |
| **Auth** | Email/password and Google sign-in. Profiles are created automatically on signup. Everything except the landing page is behind an auth gate. |
| **Daily ring** | Circular progress meter showing reps done vs. today's target, with a "Target smashed" state. |
| **Per-set schedule** | The daily target is split evenly across the chosen slot times (e.g. 08:00 / 18:00) and shown as chips with per-slot progress. |
| **Logging** | Bottom-sheet logger with a stepper, quick-add buttons and slot assignment. Success toast includes a real **Undo** that deletes the stored log. |
| **Banking** | Surplus reps past the target can be deposited into a bank, and banked reps can be spent to cover today's remaining target. Balance is a server-side ledger. |
| **Target controls** | Daily target and set frequency are editable from the Today screen and persist per user. |
| **Streak & day strip** | Server-computed streak plus a horizontal strip of challenge days with completion status. |
| **Invites** | Team naming plus a shareable `/join/<code>` link (native share sheet or copy to clipboard). Invited visitors land on a public join page and are sent through sign-in/sign-up. |
| **Wellbeing card** | A daily mental-health fact alongside the medical disclaimer. |

### Planned

- **Phase B — Teams & social:** `teams` / `team_members` tables, a real join action, squad roster with each member's status, team total ring, and today/week/all-time leaderboards.
- **Phase C — Retention:** achievement engine (15 launch badges), achievements and profile screens, per-slot reminders (web push or email via a cron route), anti-cheat sanity checks.
- **Phase D — Polish:** adaptive target algorithm (adherence-based ±10% with a 500/day ceiling), content-managed wellbeing facts, legal routes and disclaimer acceptance records, analytics and a full QA pass.

---

## Tech stack

- **TanStack Start** (React 19, file-based routing, server functions) on **Vite 7**
- **Tailwind CSS v4** with design tokens in `src/styles.css` (oklch orange/ink palette, Plus Jakarta Sans)
- **shadcn/ui** primitives + custom `pushup/` components
- **TanStack Query** for caching, route loaders for priming
- **Lovable Cloud** (Postgres, Auth, RLS) as the backend
- **sonner** for toasts

---

## Code structure

```text
src/
├── routes/                        # file-based routing
│   ├── __root.tsx                 # shell: fonts, favicon, Toaster, auth listener
│   ├── index.tsx                  # public landing page (redirects signed-in users to /today)
│   ├── auth.tsx                   # sign in / sign up (email+password, Google), ?redirect support
│   ├── join.$inviteCode.tsx       # public invite landing page
│   └── _authenticated/
│       ├── route.tsx              # auth gate (client-only, redirects to /auth)
│       └── today.tsx              # the main Today dashboard
│
├── components/
│   ├── pushup/
│   │   ├── ProgressRing.tsx       # SVG circular daily meter
│   │   ├── DayStrip.tsx           # challenge-day scroller
│   │   ├── SetChips.tsx           # per-slot progress chips
│   │   ├── LogSheet.tsx           # log reps bottom sheet
│   │   ├── BankSheet.tsx          # deposit / withdraw banked reps
│   │   ├── TargetSheet.tsx        # daily count + frequency controls
│   │   ├── InviteSheet.tsx        # team name + share invite link
│   │   └── TabBar.tsx             # mobile bottom navigation
│   └── ui/                        # shadcn/ui primitives
│
├── lib/
│   ├── pushups.functions.ts       # server functions (see API below)
│   └── pushup-schedule.ts         # slot distribution + bank math (shared, pure)
│
├── hooks/useSession.ts            # reactive auth session
├── integrations/supabase/         # generated clients, auth middleware (do not edit)
├── styles.css                     # design tokens + Tailwind v4 theme
└── start.ts                       # server-fn middleware (bearer attachment)

supabase/migrations/               # SQL schema history
```

### Server functions (`src/lib/pushups.functions.ts`)

All are authenticated and act as the signed-in user, so row-level security scopes every read
and write to that account.

| Function | Purpose |
| --- | --- |
| `getToday` | Settings, today's logs, bank balance, streak, challenge day number, completed days |
| `logReps` | Persist a set of reps against a slot |
| `deleteLog` | Undo support — remove a single log row |
| `updateTargetSettings` | Save daily target + frequency (regenerates slot times) |
| `moveBank` | Deposit or withdraw banked reps (withdrawals are balance-checked server-side) |

### Data model

| Table | Contents |
| --- | --- |
| `profiles` | Display name, linked 1:1 to the auth account, created by trigger on signup |
| `user_settings` | `daily_target`, `frequency`, `slot_times`, `start_date`, onboarding/PAR-Q state |
| `pushup_logs` | One row per logged set: `reps`, `slot`, `logged_at` |
| `bank_entries` | Signed ledger of banked reps (deposits and withdrawals) |

Every table has row-level security enabled with policies scoped to `auth.uid()`, explicit
grants for the Data API, and `updated_at` triggers.

---

## Development

```sh
npm i
npm run dev
```

The app runs on `http://localhost:8080`. Backend environment variables are injected by
Lovable Cloud; no manual setup is required.

Schema changes go through migration files in `supabase/migrations/` — never hand-edit the
generated files in `src/integrations/supabase/`.

---

## Safety note

Push Daily is a fitness tracker, not medical advice. The UI carries a visible disclaimer, and
targets are capped to avoid unsafe daily volumes. Users should consult a clinician before
starting a new exercise programme.

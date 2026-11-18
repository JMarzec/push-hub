# Restore personal midnight without changing squad UTC days

## Confirmed issue
Personal logging, banking, streaks, and reminders currently share the UTC calendar. This resets personal progress before or after the user's midnight outside UTC. The earlier request explicitly aligned squad targets and recovery days to UTC; that shared squad calendar should remain intact.

A one-line date-helper change is unsafe: server-side goal snapshots and due-plan application also use UTC, and squad accounting currently groups the same stored date labels. Changing just the browser date would leave those calculations inconsistent.

## Requested outcome
- Today, personal logs, bank transfers, streaks, recovery days, wellbeing, and goal plans follow the user's local calendar.
- Local reminders refer to the same personal day and remaining reps, with no duplicate reminders at UTC midnight.
- Squad comparisons retain their shared UTC calendar and true rolling 48-hour window.
- Previously saved logs, transfers, and historical goals stay unchanged; reconstructed history remains labeled as fallback.

## Implementation
1. Separate personal-calendar and UTC-calendar helpers. Establish the browser's timezone on signed-in entry and pass it to personal reads and writes; server calculations use a validated stored timezone, never the server's local clock. Handle timezone changes consistently without relabeling historical records.
2. Align personal rollover and cache refresh with local midnight, including open tabs, focus, and visibility changes. Make mutations and their refreshed views use the same personal date. Keep reminder scheduling and fired markers on that calendar.
3. Update goal snapshot refresh, history-preservation triggers, and transactional plan application to use the member's personal calendar. Preserve completed snapshots and avoid prematurely applying tomorrow's plan at UTC midnight.
4. Keep personal accounting by stored personal date. Separately calculate UTC squad totals from event timestamps, checking bank transfers and recovery-day/target snapshots so UTC views do not simply mistake a personal date label for a UTC bucket. Retain rolling 48-hour bank-aware accounting and consistent totals across leaderboard/chart views.
5. Do not bulk-move existing records or silently reconstruct unsaved historical timezone information. Any unavoidable historical limitation must stay explicit.

## Verification
- Add concrete date-boundary tests for Los Angeles, Warsaw, Sydney, and UTC, including daylight-saving transitions.
- Test that UTC midnight does not reset a personal day, while personal midnight does; cover reminders, banking, recovery weekdays, snapshots, and due plans.
- Run existing accounting/streak regressions.
- Verify signed-in Today logging and banking read back on the same personal date under simulated timezones; check open-tab rollover, reminders, and UTC squad comparisons.

## Technical details
- Keep TanStack server functions, authenticated user-scoped access, and serialized banking safeguards.
- Apply necessary database changes through Lovable Cloud migrations; do not weaken permissions or rewrite existing migration history.
- Record the revised personal-versus-squad calendar boundary in the architecture rules.
- Resolve monitoring finding `35924015-a29a-50c4-a1d5-d74830144385` as fixed only after implementation and verification.
# Approved repairs

- [x] Add regression coverage and shared daily accounting (16 passing tests).
- [x] Protect banking and log edits atomically (concurrent withdrawals and unsupported deposits checked live).
- [x] Preserve future dated goals and unify target/streak calculations; label reconstructed older history explicitly.
- [x] Align day boundaries and implement a real rolling 48-hour squad window.
- [x] Repair planner, conversion saves, and transactional squad invitation/ownership flows.
- [x] Consolidate query refresh, reminders, and visible errors.
- [x] Paginate history reads, separate metadata, aggregate squad accounting, and split progress read endpoints.
- [x] Verify signed-in logging, banking/undo, day details, conversion saves, future plans, repeat invites; tests and lint pass (7 existing development warnings).
- [ ] Recover authentic pretracking targets: blocked because the original values were never saved; reconstructed days are labeled, not claimed as exact.
- [ ] Fresh security assessment: requires a new deep scan in the Security tab.
- [ ] Weekly email delivery: blocked by sender-domain setup; retain inactive controls.
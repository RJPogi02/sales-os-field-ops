# Sales OS v0.082 QA ledger

> Historical record for v0.082. For the current v0.09 release, use [QA_V009.md](QA_V009.md).

## Verdict

The v0.082 local-first integration passes its automated workflow suite and production build. The verified code paths cover persistent Lead Finder campaigns, Google request-shape regression, bounded/deduplicated XP rewards, startup device-PIN derivation, historical reports, safer Team Hub claims, UUID payloads, and session refresh. The v0.08 CRM, Call Mode, daily roster, Sir Luke handoff, CSV, map, task, and localStorage foundations remain in place.

This ledger does **not** claim a live Google Places billing/quota test or a live Supabase multi-laptop test. Both services require the user's own project, credentials, configuration, and controlled production-like QA.

## Automated checks

- `npm test`: 45 tests, 45 passed, 0 failed.
- `npm run build`: Vite production build passes.
- Vite reports the existing main bundle as larger than 500 kB after minification; this is a performance/code-splitting warning, not a build failure.
- Package version: `0.8.2`.
- Lead Finder coverage includes campaign restoration after unmount, custom-term normalization, persisted selections/results, bounded seven-day cache behavior, stable cache keys, Philippine Google request shape, lane selection, branch-aware deduplication, and capped unique-import XP metadata.
- Work/progression coverage includes priority/team task rewards, the 60-XP daily cap contract, immutable reward receipts, and reopen/recomplete farming prevention.
- Privacy/report coverage includes 4-8 digit validation, salted PIN credential derivation/verification, daily/operator history upsert deduplication, day comparison, and funnel advice.
- Team coverage includes safe connection/session payloads, remote merges, stable conflict timestamps, denied claims, UUID ownership/event payloads, pre-expiry refresh, one retry after 401, eligibility, and leaderboard determinism.

## Static integration checks

- The header and Settings footer display `v0.082`; Windows and macOS launchers announce `v0.082`.
- Lead Finder owns a persistent campaign state key. Unmounting the view does not discard the current results, custom targets, selected candidates, or review lane.
- Provider refresh remains an explicit action; ordinary navigation does not call Google again.
- A provider request already in flight remains alive when the operator navigates away, and its completed response is saved into the persistent campaign/cache.
- The startup sequence clearly separates the optional local device PIN from Team Hub account authentication.
- The device PIN stores salt, iteration count, and derived digest—not readable PIN text. The UI also states that localStorage is not encrypted.
- Task completion awards XP only on the first completion receipt and respects the daily task-XP cap.
- Reports receive persisted operator/day history and render recent-day navigation, metric comparisons, seven-day bars, call results, and advice.
- Resetting for another mission on the same date closes a new session without overwriting earlier session totals for that day.
- Team Call Mode entry requires a successful current server claim for shared leads. Call events are recorded before claim release, and call-event IDs are stable UUIDs.
- Choosing Solo during onboarding releases owned claims, signs out, and clears active Team Hub state.
- Existing Team Hub deployments have an explicit reliability migration at `supabase/migrations/20260714_team_call_claim_reliability.sql`.
- The top theme control is a compact visual swatch grid for all seven themes, including Aurora Glass Ops.
- Aurora Glass Ops has workspace and Call Mode tokens; themed select controls replace default browser dropdown chrome across the application.
- Reduced-motion behavior remains defined for the new theme and history animations.

## Rendered local smoke test

- Exercised the six-stage onboarding, created and unlocked a disposable local PIN, and confirmed the clearer primary setup actions.
- Selected Aurora Glass Ops from the compact palette and verified matching workspace, startup-lock, and inherited Call Mode presentation.
- Added a custom Lead Finder target, navigated to Tasks and back, and confirmed the saved term remained without another provider request.
- Added and completed a task, verified its one-time XP receipt, then confirmed the Reports history panel recorded the operating day.
- Opened the local-only Team Hub state and verified the connection, private-login, and company-workspace sequence remains visibly staged rather than pretending to be connected.
- Checked the focused call layout at 1440x1000 and 390x844. The mobile pass reported zero horizontal overflow.
- The isolated browser run produced no console warnings, console errors, or uncaught page exceptions. Evidence is in `design/qa-v0082/` and `design/qa-v0082/qa-report.json`.
- This rendered pass intentionally did not call Google Places or Supabase, so the external-service limits below still apply.

## Exact pre-use smoke test

1. Start Sales OS, open **Startup setup**, and confirm Operator, Privacy, Lead Finder, Team readiness, and Ready stages can be traversed without entering cloud credentials.
2. With a disposable PIN, enable the startup device lock, choose **Lock now**, reject one wrong PIN, unlock with the correct PIN, then disable it if the laptop should remain unlocked. Do not test **Reset all local data** without a current CSV export.
3. Export a CRM CSV before testing a real provider or team connection.
4. In Lead Finder, add a specific custom target such as `precast supplier`, choose one small area, and run one intentional lookup.
5. Move to CRM or Tasks, return to Lead Finder, and confirm the same candidates, lane, selections, terms, and status remain visible without searching again.
6. Reload the app and confirm the campaign restores. Use **Refresh** only if another billed/current provider lookup is intended.
7. Approve one genuinely new candidate and confirm the XP burst is 5 XP. Attempting to import that same fingerprint again must not award more discovery XP. Practice Mode must not award discovery XP.
8. Create low, medium, high, urgent, and team-visible disposable tasks. Confirm the first completion awards 4/6/9/12 XP plus 2 XP for team scope, reopening does not create another reward, and total task XP stops at 60 for the day.
9. Open Reports and confirm the current active operator's date appears in history, the day strip and seven-day chart render, and the selected day's call results/advice match the daily data.
10. Open the top theme palette, switch through Light, Dark, Liquid Glass, Frosted Glass, Aurora Glass Ops, Rose Quartz, and Velvet Orchid, then test Call Mode with **Match workspace** and one independent theme.
11. Check selects in Settings, Tasks, CRM, Quote Queue, onboarding, and Call Mode for readable themed text, chevron, hover, and focus states.
12. If Team Hub will be deployed, apply `supabase/schema.sql` plus the v0.082 migration in a non-production project. Sign in with two test accounts on two laptops, join one test workspace, sync, and verify that a denied/shared claim cannot open Call Mode on the second laptop.
13. In the same test Team Hub, assign a team task to the other account, complete/sync it once, and confirm assignee, completion timestamp, and XP receipt do not bounce during the next sync.
14. Record a disposable shared-lead result, sync both devices, and confirm the teammate's same-day queue excludes that lead.
15. Export CRM again and compare record count, updated fields, and source attribution before real calls.

## External-service QA status

- **Google Places:** request construction and mapping are automated-test verified. A live restricted key, API enablement, referrer restrictions, billing, quota consumption, and result quality were not tested by this QA pass.
- **Supabase Team Hub:** schema/client/migration logic is automated-test verified. A live Supabase project, email-delivery policy, two-laptop claim race, row-level-security deployment, and long-running session were not tested by this QA pass.
- **OpenStreetMap/Nominatim:** remains a low-volume manual fallback; no bulk-harvesting behavior is claimed or tested.

## Remaining limits

- The startup PIN protects against casual access only; it does not encrypt browser storage or replace operating-system account security.
- Forgot-PIN recovery intentionally requires deleting all local Sales OS data. Export before enabling or testing the reset path.
- Lead Finder cache and campaign state belong to the current browser profile. Clearing site data removes them, and explicit **Refresh** can spend provider quota.
- Performance history is local unless a future backend explicitly synchronizes it.
- Team collaboration remains opt-in and is only trustworthy after the UI says **Connected & synced** in a correctly deployed project.
- Google Places can return stale, incomplete, duplicate, or non-buying businesses; every candidate still requires operator review.
- Sprite/profile-photo generation and visual class-tree customization are future work. v0.082 keeps the existing earned companion classes and adds a class-up preview only.
- Windows and macOS releases still require Node.js LTS; clean ZIPs install dependencies on first launch.
- The current production build still emits Vite's large-main-chunk warning; route/component code-splitting remains a future performance task.

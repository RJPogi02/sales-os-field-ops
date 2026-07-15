# Changelog

## v0.09.0

### Conversation Flow and configurable operating context

- Replaced the fixed Coach surface with a deterministic, lead-aware Conversation Flow using lead stage, buyer vertical, captured facts, and recent objections.
- Added short verified openings, backup-supplier framing, one-step closes, objection branches, and an explanation of why each suggested line fits the lead.
- Added a central Company Profile for company identity, operator persona, business vertical, human pricing approver, fleet, assets, sources, materials, and verified credentials.
- Routed call language, reports, send packs, pricing queues, dashboard labels, and handoff text through the configured profile while preserving legacy local data.
- Kept every suggested action draft-only and operator-controlled; no automation can change pricing, lead state, assignments, or CRM records.

### Ops Command Center

- Added a role-aware Manager / Command workspace powered by existing CRM, daily activity, call events, team state, territory data, and opportunity values.
- Added calls, answer rate, pipeline value, estimated commission, conversion funnel, 7/30-day field rhythm, territory signals, objection intelligence, team state, and opportunity rollup.
- Added an operations-focused JARVIS motion language with ambient scan/grid, signal core, animated KPI rings, chart traces, funnel transmission, radar sweep, panel staging, and reduced-motion fallbacks.
- Kept the manager recommendation deterministic and descriptive, with no fictional teammates or fabricated metrics in local-only mode.
- Added role gating for authenticated team identities while retaining a private single-operator command view in local mode.

### Reviewed CRM import

- Added CSV and XLSX import with a five-row preview, explicit field mapping, required-field validation, deduplication, and commit summary.
- Added common-header detection and review before any CRM mutation.
- Routed incomplete records into Research and kept private/local scope as the default; sharing to Team Hub remains explicit.
- Added `read-excel-file` as a lazily loaded XLSX parser.

### Team roles and collaboration foundation

- Added owner, manager, and representative roles plus pending/approved membership state and open/approval-required join policies.
- Added role-aware workspace controls, membership approval, assignment metadata, and manager access checks.
- Preserved atomic call claims, same-day queue exclusion, private records, conflict-safe merges, and row-level-security boundaries.
- Added `supabase/migrations/20260715_v009_team_roles.sql` for existing deployments.

### Reliability, compatibility, and QA

- Migrated legacy `Submitted to Sir Luke` records and historical approver note fields into configurable pricing-approver fields without deleting existing CRM history.
- Rejected implausible stored map coordinates and fell back to deterministic location placement so one malformed lead cannot force a world-scale territory view.
- Added centralized app version metadata and updated the Windows/macOS launchers to v0.09.
- Expanded automated coverage to 72 passing tests across workflow, configuration, Conversation Flow, Manager analytics, CRM import, Team Hub roles/schema, tasks, device lock, history, and existing call/queue behavior.
- Verified the rendered Command Center at 1440x900 and 390x844 with zero horizontal overflow, working range controls, corrected map bounds, and no console warnings or errors.
- Production build passes with the existing non-blocking Vite large-main-chunk warning.

## v0.08.2

### Lead Finder continuity and discovery rewards

- Persisted the complete active Lead Finder campaign—including custom target phrases, areas, candidate results, selected rows, review lane, status, and last-search metadata—so leaving the tab no longer clears paid search work.
- Restored an interrupted search as saved/cached results when possible and made **Refresh** the explicit way to request new provider data.
- Added customizable business and supplier targets alongside the built-in prospect categories.
- Corrected the Google Places text-search request to use the supported Philippine `region` property instead of the rejected `includedRegionCodes` field.
- Added import-time discovery XP for approved, genuinely new candidates: 5 XP each, capped at 10 candidates / 50 XP per import.
- Added a persistent candidate-fingerprint reward ledger so duplicate imports, deletions, and re-imports cannot farm discovery XP; Practice Mode remains unrewarded.

### Startup setup and private device gate

- Replaced the short field guide startup with a six-stage setup for operator identity, mission target, territory, optional device PIN, lead provider/key, and optional Team Hub connection staging.
- Added an explicit one-lookup Google Places connection test to onboarding; it never runs without operator action.
- Added an optional startup device PIN with a salted PBKDF2 verifier, session-scoped unlock, **Lock now**, disable, and destructive local-reset recovery flow.
- Kept the privacy language explicit: the PIN is a local casual-access gate, not browser-storage encryption, cloud identity, or Team Hub authentication.
- Added Solo versus Team readiness guidance so the workspace never presents unconfigured cross-laptop sync as connected.

### Work XP and performance history

- Added task-completion XP by priority (4/6/9/12 XP) plus a 2-XP team-work bonus, with a 60-XP daily cap.
- Added immutable per-task XP receipts so reopening and recompleting a task cannot award XP again.
- Added connected workspace members to task assignee choices while keeping private tasks local.
- Added persistent daily/operator performance snapshots, a recent-day browser, seven-day comparison bars, call-result details, and funnel-aware advice in Reports.
- Preserved and aggregated separate same-day mission sessions so a fresh reset cannot erase the day that was just closed.
- Kept up to 120 local history snapshots without mixing them into permanent CRM records.

### Team Hub reliability

- Treated `acquired: false` from the claim RPC as a hard failure rather than opening Call Mode anyway.
- Required a fresh shared-lead claim and same-day teammate activity check for direct, next-lead, and restored Call Mode entry paths.
- Published call events before releasing claims and generated stable UUID event IDs for idempotent retry behavior.
- Prevented local operator IDs from entering UUID ownership fields and preserved server conflict timestamps / task XP receipts during merges.
- Added pre-expiry session refresh plus one refresh-and-retry after an unauthorized response.
- Made **Solo for now** a real disconnect path that releases owned claims, signs out, and clears the active Team Hub workspace instead of only changing onboarding copy.
- Added `supabase/migrations/20260714_team_call_claim_reliability.sql` for existing v0.08 projects. The migration and client logic have automated coverage but were not exercised against a live Supabase project in this build.

### Aurora Glass Ops and control polish

- Added the seventh workspace theme, **Aurora Glass Ops**, using dark translucent operations surfaces with restrained cyan, blue, and violet signals.
- Extended Aurora Glass Ops into Call Mode with matching glass surfaces, progress light, focus treatment, and reduced-motion behavior.
- Replaced the overlong top theme dropdown with a compact accessible swatch palette that shows each theme's color identity.
- Restyled native select controls across the app with theme-aware surfaces, borders, focus rings, and chevrons.
- Kept the operational dashboard dense and calm; the visual reference work informs hierarchy and feedback rather than turning the CRM into a showcase landing page.

### Verification and versioning

- Kept the active Lead Finder campaign mounted while hidden so a paid request already in flight can finish and be saved after the operator navigates away.
- Prevented call-result corrections from repeatedly awarding Profile Sent or Quotation Requested XP.
- Expanded automated coverage to 45 tests, including Lead Finder restoration/cache behavior, Google request shape, discovery-XP caps, task/call reward deduplication, device PIN derivation, same-day session history, Team claims, UUID payloads, and auth refresh.
- Updated the application/package and launcher version to `0.8.2` / `v0.082`.
- Google Places and Supabase still require the user's own credentials and live-environment validation; neither external service is claimed as live-QA verified here.

## v0.08.0

### Lead Finder campaigns

- Replaced the single-query discovery screen with multi-business-type, multi-area campaign planning and 20/40/60/100 candidate targets.
- Connected the Google Places JavaScript text-search provider using a user-supplied, restricted browser key; no key ships with the app.
- Kept OpenStreetMap/Nominatim as a deliberately single-query, user-triggered, low-volume fallback rather than a bulk search provider.
- Added seven-day campaign caching, explicit refresh, incremental results, and preservation of partial results when a later provider job fails.
- Added Callable, Needs research, and Already in CRM review lanes with contact completeness, provenance, operating status, website/address details, and verification links.
- Added provider-place, phone, email, domain/branch, and branch-fingerprint deduplication while preserving legitimate branches at different addresses.
- Added reviewed Add to CRM, Research, and Add + Pick flows plus team/private import scope.
- Kept contacts without a callable phone and provider-marked closed businesses out of the call roster.

### Daily mission and queue integrity

- Added personal daily call goals from 1 to 50 with mission subgoals derived from the selected call target.
- Added stable `rosterLeadIds` and target snapshots for locked daily rosters.
- Split the queue into Ready today and Completed today so completed calls remain visible without returning to auto-pick.
- Centralized queue eligibility across auto-pick, manual selection, Lead Finder imports, and visible queue filtering.
- Excluded completed/contacted-today, invalid, missing-phone, research, wrong-number, conversion, pricing, scheduled-follow-up, future-retry, private-owner, and teammate-claimed leads.
- Added team call-event exclusion and normalized-phone deduplication to prevent same-day duplicate calling.
- Made Wrong Number enter Research and require a different valid, explicitly verified number before queue reactivation.

### Tasks workspace

- Added persistent private/team tasks with due date, category, priority, assignee, and optional linked CRM lead.
- Added Today, Upcoming, and Completed lanes with in-place editing, completion, reopening, and deletion.
- Added optional task suggestions from CRM follow-up, pricing, sample, and quotation dates.
- Kept manual task completion outside Sales XP calculations.

### Optional Team Hub

- Added a local-first Supabase connection screen with browser-safe project URL/anon-key configuration and honest Local-only, Ready, Syncing, Connected, and Error states.
- Added email/password sign-up, sign-in, sign-out, organization creation, invite-code joining, and manual sync controls.
- Added shared lead and team-task upserts, operator profiles, call-event recording, periodic snapshot refresh, and deterministic local/cloud merge helpers.
- Added atomic lead claim/release RPCs so connected operators cannot claim the same shared lead concurrently.
- Added team-visible versus private lead/task behavior; private Lead Finder imports and private tasks remain local.
- Added a cloud team leaderboard and active claim view; local report rankings are labeled as this-device results.
- Added `supabase/schema.sql` with organizations, memberships, profiles, leads, claims, call events, tasks, indexes, row-level security policies, restricted grants, and security-definer organization/claim RPCs.
- Team Hub remains unconfigured by default. Its client/schema logic has automated coverage but was not verified against a live Supabase project in this build.

### Themes and navigation

- Centralized the workspace and Call Mode theme catalogue.
- Added Rose Quartz and Velvet Orchid premium themes, including Call Mode surfaces, pulse effects, fields, scrollbars, and responsive treatment.
- Preserved Match workspace and independent Call Mode theme selection for all six themes.
- Added Tasks and Team Hub to desktop and mobile navigation and adjusted compact navigation for the expanded workspace.

### Verification and packaging foundation

- Added workflow coverage for daily goals, centralized eligibility, Google candidate mapping, provider status handling, campaign deduplication, and branch preservation.
- Added task-model tests for filtering, creation, suggestions, and status transitions.
- Added Team Hub tests for configuration validation, safe payload handling, record merging, eligibility, scoring, and client request behavior.
- Updated the application/package version to 0.8.0 and refreshed README deployment, provider, privacy, and setup guidance.

## v0.7.1

### Call Mode themes

- Made Call Mode inherit the active workspace theme by default.
- Added a separately persisted Call Mode theme override in Settings.
- Added an in-call theme selector for live Light, Dark, Liquid Glass, and Frosted Glass switching.
- Replaced hard-coded dark cockpit colors with theme-aware surfaces, text, controls, fields, scrollbars, and focus waves.

### Call companion

- Promoted the companion from a tiny header badge to a large animated call-partner portal.
- Added live partner status and context-aware coaching copy based on contact and pricing readiness.
- Added responsive 124 px desktop and 76 px mobile companion presentations.

### Polish and QA

- Fixed Light/Liquid Glass contrast regressions caused by older Call Mode token precedence.
- Tightened the mobile theme control and removed unnecessary Call Mode body horizontal overflow.
- Verified inherited and independent themes at 1600 x 900 and 390 x 844 with no relevant console warnings/errors.

## v0.07.0

### Workspace

- Added persistent collapsible left and right rails.
- Added right mini rail with Calls, Profiles, Ready, and Pricing badges.
- Added persistent Focus Mode with automatic prior-state restoration.
- Fixed theme/background layers so they never intercept shell controls.

### Operators and learning

- Added multiple local operators with separate profile, XP, achievements, daily session, and roster.
- Added team/operator reporting while keeping CRM shared.
- Added five-step beginner field guide.
- Added persistent safe Practice Mode and CRM/session restoration.
- Added Demo Mode contact blurring.

### Sales RPG

- Added four-class tree: Prototype Scout, Business Development Officer, Growth Engineer, Revenue Architect.
- Added First Call and First Warm Lead achievements.
- Integrated supplied Tier 2–4 GIFs for idle, XP, Call Mode, and rank-up states.
- Added companion Full/Minimal/Off, location shell, and reduced-motion fallback.

### Lead research

- Added Lead Finder warning and six per-result actions.
- Added Google, Google Maps, Facebook, and source verification links.
- Added staged research phone/email, verification state/date, notes, and Verify + Call Queue.
- Added Nominatim/Manual provider choices and disabled Google Places/Mapbox future placeholders.

### Themes and settings

- Replaced Cosmic Glass with Frosted Glass.
- Added Light, Dark, Liquid Glass, and Frosted Glass theme definitions.
- Added independent background presets/custom upload and glass controls.
- Added grouped Profile, Themes, Sales Mission, Lead Search, API Keys, Data/Export, AI Agents, and Privacy settings.
- Fixed top theme switcher layering in every theme.

### Data and reporting

- Added operator/team totals to Reports.
- Added research verification and operator/export metadata to CSV.
- Preserved Sir Luke stages, commission tracking, supplier context, map/distance, CRM import/merge, follow-up calendar, and localStorage migration.

### Packaging

- Updated visible and package version to 0.7.0.
- Clean Windows/macOS ZIPs exclude `node_modules`; launchers install dependencies when missing.
- Added/updated README, QA, and CHANGELOG.

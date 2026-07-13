# Sales OS // Field Ops

Sales OS is a local-first sales cockpit designed to turn an intimidating outbound workflow into one clear next action. It combines lead planning, guided call execution, CRM capture, follow-up protection, pricing handoffs, reports, and lightweight sales gamification in a single React application.

This repository is a privacy-safe portfolio edition of the working prototype. Every bundled company, contact, phone number, and email address is synthetic demo data.

## Why I built it

Traditional CRMs are good at storing records but often leave a new sales operator asking: **What should I do next, and what information must I capture before moving on?**

Sales OS focuses on that execution gap. The interface guides an operator through a daily mission:

1. Build and lock a 20-lead roster.
2. Call until real procurement contacts answer.
3. Capture material, volume, delivery, pricing, sample, and document requirements.
4. Send the company profile and protect the next follow-up.
5. Move qualified opportunities into a management pricing handoff.
6. Generate a daily report and export the updated CRM.

## Product highlights

- **Mission control:** territory filters, a scored lead queue, roster locking, mission progress, and persistent Focus Mode.
- **Guided Call Mode:** conversation paths, quick results, quotation-readiness checks, notes, keyboard shortcuts, and a large animated call companion.
- **Theme-aware calls:** Light, Dark, Liquid Glass, and Frosted Glass themes can follow the workspace or use an independent Call Mode theme.
- **Local CRM:** editable spreadsheet-style records, CSV import/merge, CSV export, activity history, and localStorage persistence.
- **Follow-up protection:** retry queues, profile-send opportunities, scheduled follow-ups, contact-research staging, and warm-lead tracking.
- **Pricing desk:** structured management handoffs, quote stages, pipeline value, probability, commission estimates, and outcome notes.
- **Lead research:** manual OpenStreetMap/Nominatim discovery with explicit verification and no automatic outreach.
- **Operator progression:** XP, ranks, achievements, streaks, multiple local operators, practice data, and presentation-safe Demo Mode.
- **Territory intelligence:** live map markers, lead/delivery coordinates, source references, and distance context.

## Tech stack

- React 19
- Vite 8
- Leaflet and React Leaflet
- Lucide React
- Browser localStorage
- Node's built-in test runner
- Plain CSS design system with responsive and glass-theme layers

No backend, cloud database, login, payment system, automatic email sender, or AI API is required.

## Run locally

Requirements: Node.js LTS and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Windows users can also double-click `START_SALES_OS.bat`. macOS users can run `START_SALES_OS.command`.

## Test and build

```bash
npm test
npm run build
```

The automated tests cover territory scoring, phone quality, retry progression, conversion queues, CRM import/export, lead discovery mapping, pricing handoffs, commissions, companion ranks, and research verification.

## Privacy and portfolio data

- `src/data/leads.json` contains fictional organizations and `.test` email addresses.
- Demo phone values are intentionally non-routable placeholders.
- The public repository excludes CRM exports, build packages, local settings, and the private working dataset.
- Lead Finder results must still be verified before real-world use.

## Architecture

The app keeps domain logic in `src/lib`, persistent workflow state in React hooks/localStorage, and focused UI modules in `src/components`. See [docs/architecture.md](docs/architecture.md) for the main data flow and design decisions.

## Current limitations

- Multi-operator collaboration is local to one browser/device.
- Search uses public Nominatim for manual, low-volume discovery only.
- Gmail, Calendar, Google Places, Mapbox, voice calling, LLM providers, and automation agents are future connection points rather than active integrations.
- Final pricing remains a human approval step by design.

## Roadmap

- Optional authenticated cloud sync
- Protected email/calendar integrations
- Configurable pipeline and automation rules
- Verified commercial search provider integration
- Analytics history across multiple sales days
- Installable desktop/PWA packaging

## Author

Built by [Randolf Prado](https://github.com/RJPogi02) as an iterative field-sales product prototype.


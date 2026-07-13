# Architecture

## Design goal

Sales OS treats a sales day as an execution loop rather than a collection of disconnected CRM screens. Each action updates the lead, daily mission, operator progress, activity timeline, and downstream queue together.

## Main layers

```text
App.jsx
├── persistent operator, CRM, mission, theme, and practice state
├── workflow actions and cross-view coordination
├── components/
│   ├── mission, lead queue, CRM, reports, pricing, and research views
│   ├── CallMode and conversation guidance
│   └── shared map, activity, profile, and companion components
├── lib/
│   ├── leadModel.js: normalization and workflow rules
│   ├── csv.js: CRM import, merge, and export
│   └── leadDiscovery.js: manual public-source discovery mapping
└── data/
    ├── leads.json: synthetic portfolio seed
    ├── practiceLeads.js: isolated training records
    └── suppliers.js: generic source-reference placeholders
```

## State model

- **Shared CRM:** lead data and activity history.
- **Per operator:** profile, XP, achievements, daily state, goals, and selected roster.
- **Per day:** calls, results, profile sends, warm requirements, pricing handoffs, follow-ups, and XP earned.
- **Workspace:** territory, theme, appearance, rail state, Focus Mode, Practice Mode, and Demo Mode.

The project uses versioned localStorage keys and migration helpers so an updated build can preserve existing browser data.

## Workflow invariants

- Every quick result can update lead status, daily metrics, and activity history.
- An answered call opens a checkpoint before the operator can move on.
- Quote requests require material and delivery context.
- Management pricing requires material, delivery, and price context or an explanation.
- Practice Mode snapshots and restores real local state.
- Public discovery candidates remain unverified until the operator confirms them.

## Why local-first

The prototype was designed for immediate field usability without an account system or backend deployment. Local-first persistence keeps the feedback loop fast and makes the privacy boundary visible. A future sync layer can sit behind the same domain model without changing the core call workflow.


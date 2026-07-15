# Sales OS v0.09 — Ops Command Center

v0.09 is the first release that treats Sales OS as a broader operations cockpit while protecting the parts already usable for real calls.

## The important change

The new **Command** workspace turns current CRM and field activity into an animated operational picture: calls, answer rate, pipeline, commission assumptions, funnel movement, objections, territory signals, connected-team state, and open opportunities. Its JARVIS-inspired motion is deliberately restrained so the dashboard feels alive without obscuring work.

The calling assistant is now **Conversation Flow**. It adapts to the lead's stage, vertical, known needs, and objections, explains why a line is useful, and only uses differentiators stored as verified company facts.

## Also included

- Central Company Profile and configurable human pricing approver.
- CSV/XLSX import with preview, mapping, dedupe, Research routing, and commit summary.
- Owner/manager/representative Team Hub roles with pending approval and join policy foundations.
- Legacy pricing-field migration and safer territory-map coordinate handling.
- 72 passing automated tests plus desktop/mobile rendered QA.

## What remains intentionally manual

- Calling and email sending.
- Final prices and quotation approval.
- Imported-record review and team sharing.
- CRM/status changes.
- Team membership approval and task/lead assignment.

Future AI work should remain suggestion-first, source-linked, and approval-gated.

## Start

- Windows: double-click `START_SALES_OS.bat`.
- macOS: Control-click `START_SALES_OS.command`, choose **Open**, and keep Terminal open.
- Developer: `npm install`, `npm test`, `npm run dev`.

Read `README.md` for setup and `QA_V009.md` for the release boundary and pre-use checklist.

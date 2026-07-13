import { AlertTriangle, ArrowRight, CheckCircle2, Download, Mail, PhoneCall, RotateCcw, UsersRound, X } from 'lucide-react'

export function SessionSummaryModal({ metrics, retryCount, invalidCount, warmCount, onClose, onAction }) {
  const nextAction = metrics.answered > 0 && metrics.profiles === 0
    ? 'Send profiles to every answered lead before the momentum gets cold.'
    : retryCount > 0
      ? 'Take a short reset, then work the Retry Later queue in a new time block.'
      : invalidCount > 0
        ? 'Repair invalid contacts so tomorrow’s roster starts cleaner.'
        : 'Generate the report, export CRM, and protect every follow-up.'
  return (
    <div className="modal-backdrop session-summary-backdrop" role="presentation">
      <section className="session-summary-modal panel" role="dialog" aria-modal="true" aria-label="Calling session summary">
        <header><div><span className="section-label">20-call debrief</span><h2>Calling block complete</h2><p>You finished the roster. Now convert the useful conversations and recycle the unanswered ones.</p></div><button onClick={onClose} aria-label="Close session summary"><X size={19} /></button></header>
        <div className="session-summary-grid">
          <article><PhoneCall size={18} /><span>Calls made</span><strong>{metrics.calls}</strong></article>
          <article><UsersRound size={18} /><span>Real people</span><strong>{metrics.answered}</strong></article>
          <article><Mail size={18} /><span>Profiles sent</span><strong>{metrics.profiles}</strong></article>
          <article><CheckCircle2 size={18} /><span>Quote-ready</span><strong>{metrics.quotes}</strong></article>
          <article><RotateCcw size={18} /><span>Retry leads</span><strong>{retryCount}</strong></article>
          <article><AlertTriangle size={18} /><span>Invalid contacts</span><strong>{invalidCount}</strong></article>
          <article><UsersRound size={18} /><span>Warm leads</span><strong>{warmCount}</strong></article>
        </div>
        <div className="session-next-action"><ArrowRight size={20} /><div><span>Recommended next move</span><strong>{nextAction}</strong></div></div>
        <div className="session-actions">
          <button onClick={() => onAction('conversion')}>Open Conversion Desk</button>
          <button onClick={() => onAction('reports')}>Generate Daily Report</button>
          <button onClick={() => onAction('export')}><Download size={15} />Export CRM CSV</button>
        </div>
      </section>
    </div>
  )
}

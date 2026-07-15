import { ArrowRight, Check, Phone } from 'lucide-react'

function MissionStep({ number, label, value, goal }) {
  return <div className="mission-step"><div className="step-heading"><span>{number}</span><p>{label}</p></div><strong>{value} <em>/ {goal}</em></strong><div className="progress"><span style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} /></div></div>
}

function ExecutionGate({ number, label, value, goal }) {
  const complete = value >= goal
  return <div className={`execution-gate ${complete ? 'complete' : ''}`}><span>{complete ? <Check size={11} /> : number}</span><p>{label}</p><strong>{value}/{goal}</strong></div>
}

export function MissionRail({ selectedCount, answeredCount, quoteCount, capturedCount, profileCount, pricingCount, onStartCall, activeCall, operatorName, goals = { selected: 20, answered: 5, quotes: 2, warm: 3, profiles: 5, pricing: 2 } }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = operatorName.trim().split(/\s+/)[0] || 'Operator'
  return (
    <section className="mission-rail panel">
      <div className="greeting"><h1>{greeting},<br />{firstName}.</h1><p>Let’s build today. One call at a time.</p></div>
      <div className="daily-mission">
        <div className="section-label"><span>Main quest</span><span>Tomorrow-ready workflow</span></div>
        <div className="mission-steps">
          <MissionStep number="1" label={`Pick ${goals.selected} leads`} value={selectedCount} goal={goals.selected} />
          <ArrowRight className="step-arrow" size={18} />
          <MissionStep number="2" label={`Reach ${goals.answered} real people`} value={answeredCount} goal={goals.answered} />
          <ArrowRight className="step-arrow" size={18} />
          <MissionStep number="3" label={`Get ${goals.quotes} quotation-ready`} value={quoteCount} goal={goals.quotes} />
        </div>
        <div className="execution-gates" aria-label="Mission execution gates">
          <ExecutionGate number="4" label={`Capture ${goals.warm} warm requirements`} value={capturedCount} goal={goals.warm} />
          <ExecutionGate number="5" label="Send company profile" value={profileCount} goal={goals.profiles} />
          <ExecutionGate number="6" label="Move serious leads to pricing" value={pricingCount} goal={goals.pricing} />
        </div>
      </div>
      <button className={`primary-action ${activeCall ? 'calling' : ''}`} onClick={onStartCall}><Phone size={16} />{activeCall ? 'Call in progress' : 'Start next call'}</button>
    </section>
  )
}

import { ArrowLeft, ArrowRight, CheckCircle2, Crosshair, FileSpreadsheet, PhoneCall, Play, Send, Target, X } from 'lucide-react'
import { useState } from 'react'

const STEPS = [
  { Icon: Crosshair, eyebrow: 'Welcome to Sales OS', title: 'A guided cockpit for real outbound work.', body: 'Sales OS helps a beginner choose the next lead, make the call, capture the result, and protect every follow-up without learning a giant generic CRM.' },
  { Icon: Target, eyebrow: '1 // Build the mission', title: 'Pick 20 useful leads—not 20 random names.', body: 'Choose a territory, review phone quality, auto-pick the best callable leads, and lock the roster before starting the call block.' },
  { Icon: PhoneCall, eyebrow: '2 // Use Guided Call Mode', title: 'The next question is always visible.', body: 'Follow the conversation coach, tick the mini quest, record one quick result, and schedule a retry or conversion step before moving on.' },
  { Icon: Send, eyebrow: '3 // Convert the answer', title: 'A real contact should create a real next step.', body: 'Confirm the person and email, send the company profile, capture material and delivery needs, then move serious opportunities to Pricing Desk.' },
  { Icon: FileSpreadsheet, eyebrow: '4 // Close the loop', title: 'Finish with a clean report and CRM export.', body: 'Work follow-ups and research, review pricing handoffs, generate the operator report, and export CSV before ending the day.' },
]

export function OnboardingModal({ onClose, onStartPractice }) {
  const [step, setStep] = useState(0)
  const item = STEPS[step]
  const Icon = item.Icon
  return (
    <div className="modal-backdrop onboarding-backdrop" role="presentation">
      <section className="onboarding-modal panel" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header><div className="onboarding-brand"><span>Sales OS</span><em>v0.071 field guide</em></div><button onClick={onClose} aria-label="Skip onboarding"><X size={18} /></button></header>
        <div className="onboarding-progress">{STEPS.map((_, index) => <i key={index} className={index <= step ? 'active' : ''} />)}</div>
        <div className="onboarding-hero"><span className="onboarding-icon"><Icon size={34} /></span><div><span className="section-label">{item.eyebrow}</span><h2 id="onboarding-title">{item.title}</h2><p>{item.body}</p></div></div>
        <div className="onboarding-mission"><CheckCircle2 size={18} /><p><strong>Today’s loop</strong>Pick leads → Call → Send profile → Qualify → Pricing Desk pricing → Follow up → Report</p></div>
        <footer>
          <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={15} />Back</button>
          <span>{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? <button className="primary-action" onClick={() => setStep((value) => value + 1)}>Next<ArrowRight size={15} /></button> : <div className="onboarding-final-actions"><button onClick={onClose}>Enter live workspace</button><button className="primary-action" onClick={onStartPractice}><Play size={15} />Start Practice Mode</button></div>}
        </footer>
      </section>
    </div>
  )
}

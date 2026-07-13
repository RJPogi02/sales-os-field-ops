import {
  Check, CheckCircle2, ChevronRight, Clipboard, Copy, Mail, MapPin,
  Navigation, Palette, Phone, Send, Sparkles, Target, UserRound, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { seedSuppliers } from '../data/suppliers.js'
import {
  buildHandoffMessage, CHECKLIST_LABELS, distanceIntelligence,
  MATERIAL_OPTIONS, pricingReadiness, QUICK_RESULTS, sourceContextForLead,
} from '../lib/leadModel.js'
import { ActivityTimeline } from './ActivityTimeline.jsx'
import { ConversationCoach } from './ConversationCoach.jsx'
import { DeliveryIntel } from './DeliveryIntel.jsx'
import { ProfileSendPack } from './ProfileSendPack.jsx'
import { SampleWorkflow } from './SampleWorkflow.jsx'
import { SupplierContext } from './SupplierContext.jsx'
import { OperatorCompanion } from './OperatorCompanion.jsx'

function CallField({ label, children, wide = false }) {
  return <label className={wide ? 'wide' : ''}><span>{label}</span>{children}</label>
}

const tabs = [
  ['coach', Sparkles, 'Coach'],
  ['quest', Target, 'Quest'],
  ['delivery', Navigation, 'Delivery & distance'],
  ['send', Send, 'Send pack'],
]

const callThemeOptions = [
  ['inherit', 'Match workspace'],
  ['field', 'Light'],
  ['midnight', 'Dark'],
  ['glass', 'Liquid Glass'],
  ['frosted', 'Frosted Glass'],
]

export function CallMode({
  lead, callNumber, totalCalls, operatorName, operatorPhoto, operatorInitials, xp = 0, companionMode = 'full', reducedMotion = false, userLocation,
  workspaceTheme = 'field', callModeTheme = 'inherit', onCallModeThemeChange,
  onClose, onUpdateLead, onQuickResult, onSendProfile, onMovePricing, onSaveNext,
  shortcutsDisabled = false,
}) {
  const [copied, setCopied] = useState('')
  const [tab, setTab] = useState('coach')
  const readiness = pricingReadiness(lead)
  const ready = readiness.every((item) => item.ready)
  const distances = useMemo(() => distanceIntelligence(lead, userLocation.position), [lead, userLocation.position])
  const sourceContext = useMemo(() => sourceContextForLead(lead, seedSuppliers), [lead])
  const effectiveCallTheme = callModeTheme === 'inherit' ? workspaceTheme : callModeTheme
  const companionPrompt = ready
    ? 'Pricing packet ready. I\u2019ll keep the handoff clean.'
    : lead.answered
      ? 'Nice contact. Capture material, delivery, and price context next.'
      : 'I\u2019m with you. Find procurement, then listen for the real need.'

  useEffect(() => {
    document.body.classList.add('call-mode-open')
    return () => document.body.classList.remove('call-mode-open')
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (shortcutsDisabled || event.altKey || event.ctrlKey || event.metaKey) return
      const tag = event.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable) return
      const number = Number(event.key)
      if (number >= 1 && number <= QUICK_RESULTS.length) {
        event.preventDefault()
        onQuickResult(QUICK_RESULTS[number - 1])
      }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); onSaveNext() }
      if (event.key.toLowerCase() === 'p') { event.preventDefault(); setTab('send') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onQuickResult, onSaveNext, shortcutsDisabled])

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1600)
    } catch { setCopied('Copy unavailable') }
  }

  return (
    <div className={`call-mode-backdrop call-theme-${effectiveCallTheme}`} data-call-theme={effectiveCallTheme}>
      <section className="call-mode v004" role="dialog" aria-modal="true" aria-label={`Call mode for ${lead.company}`}>
        <header className="call-mode-header">
          <div className="call-status"><span className="call-live"><i />Live call</span><strong>Lead {String(callNumber).padStart(2, '0')} / {String(totalCalls).padStart(2, '0')}</strong><span className="call-operator-context">{operatorPhoto ? <img src={operatorPhoto} alt="" /> : <i>{operatorInitials || operatorName?.slice(0, 2)}</i>}<b>{operatorName}</b></span></div>
          <div className="call-mode-progress" aria-label={`Call ${callNumber} of ${totalCalls}`}><span style={{ width: `${totalCalls ? (callNumber / totalCalls) * 100 : 0}%` }} /></div>
          <div className="call-header-actions">
            <label className="call-theme-control" title="Choose Call Mode theme"><Palette size={16} /><span>Call theme</span><select aria-label="Call Mode theme" value={callModeTheme} onChange={(event) => onCallModeThemeChange?.(event.target.value)}>{callThemeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <button type="button" onClick={onClose} aria-label="Close call mode"><X size={21} /></button>
          </div>
        </header>

        <div className="call-identity">
          <div className="call-company"><span>Active lead</span><h1>{lead.company}</h1><p>{lead.region} <i /> {lead.status}</p></div>
          {companionMode !== 'off' ? <aside className={`call-pet-dock ${companionMode === 'minimal' ? 'compact' : ''}`} aria-label="Call companion">
            <div className="call-pet-stage"><OperatorCompanion xp={xp} mode="call-mode" size={companionMode === 'minimal' ? 'minimal' : 'pet'} showLabel={false} reducedMotion={reducedMotion || companionMode === 'minimal'} /></div>
            <div className="call-pet-copy"><span><i />Call partner</span><strong>Right here with you</strong><p>{companionPrompt}</p></div>
          </aside> : null}
          <div className="call-contact-hero"><a href={lead.phone ? `tel:${lead.phone.replace(/[^+\d]/g, '')}` : undefined}><Phone size={25} />{lead.phone || 'No phone available'}</a><button type="button" onClick={() => copyText(lead.phone, 'Phone copied')} disabled={!lead.phone}><Copy size={16} />{copied || 'Copy phone'}</button></div>
          <div className="call-contact-grid">
            <span><Mail size={17} /><small>Email</small><strong>{lead.email || 'Not available'}</strong></span>
            <span><UserRound size={17} /><small>Procurement contact</small><strong>{lead.contactPerson || 'Ask during call'}</strong></span>
            <span className={lead.deliveryLocationConfirmed ? 'confirmed' : ''}><MapPin size={17} /><small>Delivery / project</small><strong>{lead.deliveryLocation || 'Search and confirm during call'}</strong></span>
          </div>
        </div>

        <nav className="call-mode-tabs" aria-label="Call workspace tabs">
          {tabs.map(([id, Icon, label]) => <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span></button>)}
        </nav>

        <div className="call-mode-body">
          <div className="call-work-scroll">
            {tab === 'coach' ? <div className="call-tab-stack coach-tab">
              <ConversationCoach compact lead={lead} onChoose={(next, label, reset = false) => onUpdateLead({ conversationNode: next, conversationPath: reset ? [] : [...(lead.conversationPath || []), label] }, reset ? 'Conversation flow reset' : 'Conversation path chosen', label)} />
              <SupplierContext lead={lead} compact />
              <ActivityTimeline items={lead.activityLog} compact limit={7} />
            </div> : null}

            {tab === 'quest' ? <div className="call-tab-stack quest-tab">
              <section className="call-checklist"><header><span>Per-lead mini quest</span><strong>{lead.checklist.filter(Boolean).length}/7 complete</strong></header>{CHECKLIST_LABELS.map((label, index) => <button type="button" key={label} onClick={() => { const checklist = [...lead.checklist]; checklist[index] = !checklist[index]; onUpdateLead({ checklist }, `${checklist[index] ? 'Completed' : 'Reopened'} mini quest`, label) }}><i>{index + 1}</i><span>{label}</span><b className={lead.checklist[index] ? 'done' : ''}>{lead.checklist[index] ? <Check size={16} /> : null}</b></button>)}</section>
              <section className="call-facts"><header><span>Requirement capture</span><strong>Construction-material scope</strong></header><div className="quotation-grid">
                <CallField label="Material needed"><input list="material-options" value={lead.materialNeeded} onChange={(event) => onUpdateLead({ materialNeeded: event.target.value })} placeholder="Aggregates, sand, gravel, S1, hauling..." /><datalist id="material-options">{MATERIAL_OPTIONS.map((item) => <option key={item} value={item} />)}</datalist></CallField>
                <CallField label="Volume needed"><input value={lead.volumeNeeded} onChange={(event) => onUpdateLead({ volumeNeeded: event.target.value })} placeholder="e.g. 300 cu.m. / month" /></CallField>
                <CallField label="Target / current price"><input value={lead.targetPrice} onChange={(event) => onUpdateLead({ targetPrice: event.target.value })} placeholder="Price, range, or best-price request" /></CallField>
                <CallField label="Urgency / deadline"><input value={lead.urgency} onChange={(event) => onUpdateLead({ urgency: event.target.value })} placeholder="Required date or project urgency" /></CallField>
              </div></section>
              <SampleWorkflow lead={lead} onUpdateLead={onUpdateLead} />
            </div> : null}

            {tab === 'delivery' ? <div className="call-tab-stack"><DeliveryIntel lead={lead} userLocation={userLocation} onUpdateLead={onUpdateLead} /></div> : null}

            {tab === 'send' ? <div className="call-tab-stack send-tab"><ProfileSendPack lead={lead} operatorName={operatorName} onUpdateLead={onUpdateLead} onMarkSent={onSendProfile} /><SupplierContext lead={lead} /><ActivityTimeline items={lead.activityLog} limit={10} /></div> : null}
          </div>

          <aside className="call-command-rail">
            <section className={`ready-check ${ready ? 'ready' : ''}`}><header><span>Ready for Pricing Desk?</span><strong>{ready ? 'READY' : `${readiness.filter((item) => item.ready).length}/${readiness.length}`}</strong></header><p className="final-quote-note">Reference only. Final quote requires Pricing Desk.</p>{readiness.map((item) => <p key={item.key} className={item.ready ? 'done' : ''}>{item.ready ? <CheckCircle2 size={15} /> : <i />}{item.label}</p>)}</section>
            <label className="call-notes"><span>Live notes</span><textarea value={lead.notes} onChange={(event) => onUpdateLead({ notes: event.target.value })} placeholder="Objections, people, deadlines, missing price explanation..." maxLength={1200} /><small>{lead.notes.length}/1200</small></label>
            <div className="call-distance-note"><Navigation size={15} /><span>{distances.notes || 'Enable location and plot delivery to see route estimates.'}</span></div>
            <button type="button" className={`profile-call-action ${lead.profileSent ? 'complete' : ''}`} onClick={() => setTab('send')}><Send size={16} />{lead.profileSent ? 'Profile sent' : 'Open send pack'}<kbd>P</kbd></button>
            <button type="button" className={`pricing-call-action ${lead.inPricingQueue ? 'complete' : ''}`} onClick={onMovePricing}><Check size={16} />{lead.inPricingQueue ? lead.pricingStage : 'Move to Pricing Desk queue'}</button>
            {lead.inPricingQueue ? <button type="button" className="handoff-copy" onClick={() => copyText(buildHandoffMessage(lead, distances.notes, sourceContext), 'Handoff copied')}><Clipboard size={16} />{copied || 'Copy complete handoff'}</button> : null}
          </aside>
        </div>

        <div className="call-results"><span>Quick result <em>Auto-saves this call · keyboard 1–9</em></span><div>{QUICK_RESULTS.map((result, index) => <button type="button" key={result} className={lead.callResults?.[0]?.result === result ? 'active' : ''} onClick={() => onQuickResult(result)}><kbd>{index + 1}</kbd>{result}</button>)}</div></div>

        <footer className="call-mode-footer"><p><strong>{lead.lastResult || 'Call in progress'}</strong><span>{lead.deliveryLocationConfirmed ? 'Delivery confirmed' : 'Confirm delivery before pricing'}</span></p><button type="button" onClick={onSaveNext}><kbd>N</kbd><span>Save call & start next lead</span><ChevronRight size={20} /></button></footer>
      </section>
    </div>
  )
}

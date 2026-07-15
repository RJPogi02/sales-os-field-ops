import { Check, CheckCircle2, ChevronDown, Clipboard, Clock, Mail, MapPin, Phone, Save, Send, UserRound } from 'lucide-react'
import { useState } from 'react'
import { seedSuppliers } from '../data/suppliers.js'
import { buildHandoffMessage, CHECKLIST_LABELS, distanceIntelligence, QUICK_RESULTS, miniQuestProgress, pricingReadiness, sourceContextForLead } from '../lib/leadModel.js'
import { ActivityTimeline } from './ActivityTimeline.jsx'
import { ConversationFlow } from './ConversationFlow.jsx'
import { DeliveryIntel } from './DeliveryIntel.jsx'
import { ProfileSendPack } from './ProfileSendPack.jsx'
import { SampleWorkflow } from './SampleWorkflow.jsx'
import { SupplierContext } from './SupplierContext.jsx'

function Field({ label, children, wide = false }) {
  return <label className={wide ? 'wide' : ''}><span>{label}</span>{children}</label>
}

export function LeadWorkspace({
  lead, operatorName, companyProfile, userLocation, onUpdateLead, onSaveCall, onSendProfile,
  onMarkQuoteReady, onQuickResult, selectedCount, selectedLeads, onSelectLead,
}) {
  const [tab, setTab] = useState('checklist')
  const [queueOpen, setQueueOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sendPackOpen, setSendPackOpen] = useState(false)
  if (!lead) return <section className="lead-workspace panel empty">Select a lead to begin.</section>
  const miniProgress = miniQuestProgress(lead)
  const readiness = pricingReadiness(lead)

  return (
    <section className="lead-workspace panel">
      <div className="lead-detail-head">
        <div><span className="section-label">Lead detail</span><h2>{lead.company}</h2><p>{lead.status || 'New lead'} · {lead.region}</p></div>
        <div className="call-result-toggle"><button className={!lead.answered ? 'active' : ''} onClick={() => onQuickResult('No Answer')}>No answer</button><button className={lead.answered ? 'active success' : ''} onClick={() => onQuickResult('Spoke to Staff')}>Real person answered</button></div>
      </div>

      <div className="lead-detail-grid">
        <div className="lead-facts">
          <span><MapPin size={15} /><small>Region</small><strong>{lead.region}</strong></span>
          <span><MapPin size={15} /><small>Lead location</small><strong>{lead.location || 'Needs research'}</strong></span>
          <span><Phone size={15} /><small>Phone</small><strong className="contact-value">{lead.phone || 'Not available'}</strong></span>
          <span><Mail size={15} /><small>Email</small><strong className="contact-value">{lead.email || 'Not available'}</strong></span>
          <span><UserRound size={15} /><small>Contact</small><strong>{lead.contactPerson || 'Ask for procurement'}</strong></span>
          <span><Clock size={15} /><small>Follow-up</small><strong>{lead.nextFollowUp || 'Not scheduled'}</strong></span>
        </div>

        <div className="assistant-panel">
          <div className="assistant-title"><span className="section-label">Sales assistant</span><strong>{miniProgress}/7 mini quest</strong></div>
          <div className="assistant-tabs"><button className={tab === 'checklist' ? 'active' : ''} onClick={() => setTab('checklist')}>Mini quest</button><button className={tab === 'flow' ? 'active' : ''} onClick={() => setTab('flow')}>Conversation flow</button></div>
          {tab === 'checklist' ? <div className="checklist">{CHECKLIST_LABELS.map((label, index) => <button key={label} onClick={() => { const checklist = [...lead.checklist]; checklist[index] = !checklist[index]; onUpdateLead({ checklist }, `${checklist[index] ? 'Completed' : 'Reopened'} mini quest`, label) }}><span>{index + 1}</span><p>{label}</p><i className={lead.checklist[index] ? 'done' : ''}>{lead.checklist[index] ? <Check size={13} /> : null}</i></button>)}</div> : <ConversationFlow lead={lead} companyProfile={companyProfile} operatorProfile={{ name: operatorName }} onChoose={(next, label, reset = false) => onUpdateLead({ conversationNode: next, conversationPath: reset ? [] : [...(lead.conversationPath || []), label] }, reset ? 'Conversation flow reset' : 'Conversation path chosen', label)} />}
        </div>

        <div className="quotation-panel">
          <div className="quotation-heading"><div><span className="section-label">Quotation facts</span><h3>What pricing needs to know</h3></div><span>{[lead.materialNeeded, lead.volumeNeeded, lead.deliveryLocation && lead.deliveryLocationConfirmed, lead.targetPrice, lead.profileSent].filter(Boolean).length}/5 captured</span></div>
          <div className="quotation-grid">
            <Field label="Material needed"><input value={lead.materialNeeded} onChange={(event) => onUpdateLead({ materialNeeded: event.target.value })} onBlur={() => lead.materialNeeded && onUpdateLead({}, 'Material requirement updated', lead.materialNeeded)} placeholder="Aggregates, sand, gravel, S1, hauling..." /></Field>
            <Field label="Volume needed"><input value={lead.volumeNeeded} onChange={(event) => onUpdateLead({ volumeNeeded: event.target.value })} onBlur={() => lead.volumeNeeded && onUpdateLead({}, 'Volume requirement updated', lead.volumeNeeded)} placeholder="e.g. 300 cu.m. / month" /></Field>
            <Field label="Delivery / project location" wide><input value={lead.deliveryLocation} onChange={(event) => onUpdateLead({ deliveryLocation: event.target.value, deliveryLocationConfirmed: false })} onBlur={() => lead.deliveryLocation && onUpdateLead({}, 'Delivery location updated', lead.deliveryLocation)} placeholder="Search and confirm the actual delivery point" /></Field>
            <Field label="Target / current buying price"><input value={lead.targetPrice} onChange={(event) => onUpdateLead({ targetPrice: event.target.value })} onBlur={() => lead.targetPrice && onUpdateLead({}, 'Target price updated', lead.targetPrice)} placeholder="Price per unit or best-price request" /></Field>
            <Field label="Urgency / deadline"><input value={lead.urgency} onChange={(event) => onUpdateLead({ urgency: event.target.value })} placeholder="Required date or project urgency" /></Field>
            <Field label="Documents required"><input value={lead.documentsRequired} onChange={(event) => onUpdateLead({ documentsRequired: event.target.value })} onBlur={() => lead.documentsRequired && onUpdateLead({}, 'Document requirement updated', lead.documentsRequired)} placeholder="Permits, test results, accreditation..." /></Field>
            <Field label="Next follow-up"><input type="date" value={lead.nextFollowUp} onChange={(event) => onUpdateLead({ nextFollowUp: event.target.value }, 'Follow-up scheduled', event.target.value)} /></Field>
          </div>
          <button className={`delivery-confirm-inline ${lead.deliveryLocationConfirmed ? 'active success' : ''}`} disabled={!lead.deliveryLocation} onClick={() => onUpdateLead({ deliveryLocationConfirmed: !lead.deliveryLocationConfirmed }, lead.deliveryLocationConfirmed ? 'Delivery confirmation reopened' : 'Delivery location confirmed', lead.deliveryLocation)}>{lead.deliveryLocationConfirmed ? <Check size={14} /> : <MapPin size={14} />}{lead.deliveryLocationConfirmed ? 'Delivery/project location confirmed' : 'Confirm delivery/project location'}</button>
          <div className="requirement-toggles"><button className={lead.sampleDocStatus === 'Required' ? 'active' : ''} onClick={() => onUpdateLead({ sampleDocStatus: 'Required' }, 'Sample/document status changed', 'Required')}>Sample/docs required</button><button className={lead.sampleDocStatus === 'Not required' ? 'active success' : ''} onClick={() => onUpdateLead({ sampleDocStatus: 'Not required', sampleRequired: false }, 'Sample/document status changed', 'Not required')}>Not required</button><button className={lead.profileSent ? 'active success' : ''} onClick={() => setSendPackOpen(true)}>Profile {lead.profileSent ? 'sent' : 'send pack'}</button><button className={lead.managementPricingNeeded ? 'active' : ''} onClick={() => onUpdateLead({ managementPricingNeeded: !lead.managementPricingNeeded }, 'Management pricing flag changed')}>Management pricing needed</button></div>
          <div className="pricing-readiness-inline"><header><span>Ready for {companyProfile?.approverLabel || 'management'}?</span><strong>{readiness.filter((item) => item.ready).length}/{readiness.length}</strong></header>{readiness.map((item) => <p key={item.key} className={item.ready ? 'done' : ''}>{item.ready ? <CheckCircle2 size={13} /> : <i />}{item.label}</p>)}</div>
        </div>

        <div className="lead-intel-grid"><DeliveryIntel compact lead={lead} userLocation={userLocation} companyProfile={companyProfile} onUpdateLead={onUpdateLead} /><SupplierContext lead={lead} companyProfile={companyProfile} /></div>
        <SampleWorkflow lead={lead} onUpdateLead={onUpdateLead} />
        {sendPackOpen ? <div className="lead-send-pack"><ProfileSendPack lead={lead} operatorName={operatorName} companyProfile={companyProfile} onUpdateLead={onUpdateLead} onMarkSent={onSendProfile} /></div> : null}

        <div className="quick-results"><span className="section-label">Result after call</span><div>{QUICK_RESULTS.map((result) => <button key={result} className={lead.callResults?.[0]?.result === result ? 'active' : ''} onClick={() => onQuickResult(result)}>{result}</button>)}</div></div>

        <div className="notes-panel">
          <label><span>Call notes</span><textarea value={lead.notes} onChange={(event) => onUpdateLead({ notes: event.target.value })} placeholder="Context, objections, missing-price explanation, relationship notes..." maxLength={1200} /><small>{lead.notes.length} / 1200</small></label>
          <div className="action-grid"><button onClick={onSaveCall}><Save size={15} />Save call</button><button className={lead.profileSent ? 'complete' : ''} onClick={() => setSendPackOpen((value) => !value)}><Send size={15} />{lead.profileSent ? 'View send pack' : 'Open send pack'}</button></div>
          <button className={`quote-action ${lead.inPricingQueue ? 'complete' : ''}`} onClick={onMarkQuoteReady}><Check size={17} />{lead.inPricingQueue ? `In ${companyProfile?.approverLabel || 'management'} pricing queue` : `Move to ${companyProfile?.approverLabel || 'management'} pricing queue`}</button>
          {lead.inPricingQueue ? <button className="lead-handoff-copy" onClick={async () => { try { const approverLabel = companyProfile?.approverLabel || 'pricing approver'; await navigator.clipboard.writeText(buildHandoffMessage(lead, distanceIntelligence(lead, userLocation.position).notes, sourceContextForLead(lead, seedSuppliers, approverLabel), approverLabel)); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) } }}><Clipboard size={15} />{copied ? 'Handoff copied' : `Copy ${companyProfile?.approverLabel || 'management'} handoff`}</button> : null}
          <ActivityTimeline items={lead.activityLog} limit={6} compact />
        </div>
      </div>

      <button className="mobile-queue-trigger" onClick={() => setQueueOpen((value) => !value)}><span>{selectedCount} selected leads</span><ChevronDown className={queueOpen ? 'open' : ''} size={17} /></button>
      {queueOpen ? <div className="mobile-selected-drawer">{selectedLeads.map((item) => <button key={item.id} className={item.id === lead.id ? 'active' : ''} onClick={() => onSelectLead(item.id)}><strong>{item.company}</strong><span>{item.region} · {item.lastResult}</span></button>)}</div> : null}
    </section>
  )
}

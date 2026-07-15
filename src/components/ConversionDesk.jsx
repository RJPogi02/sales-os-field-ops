import { AlertTriangle, CalendarDays, CalendarClock, Check, ExternalLink, Mail, Map, MessageCircle, PhoneCall, RefreshCcw, Search, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { leadResearchLinks } from '../lib/leadDiscovery.js'
import { followUpLeads, phoneCountsForLeads, phoneKey, phoneQualityForLead, profileOpportunityLeads, reactivateLeadPatch } from '../lib/leadModel.js'
import { FollowUpCalendar } from './FollowUpCalendar.jsx'

const tabs = [
  ['retry', RefreshCcw, 'Retry Later'],
  ['research', Search, 'Research'],
  ['profiles', Mail, 'Profile Queue'],
  ['followups', CalendarClock, 'Follow-ups'],
  ['calendar', CalendarDays, 'Calendar'],
]

export function ConversionDesk({ leads, onUpdateLead, onOpenLead, onCallLead }) {
  const [tab, setTab] = useState('retry')
  const phoneCounts = useMemo(() => phoneCountsForLeads(leads), [leads])
  const queues = useMemo(() => ({
    retry: leads.filter((lead) => lead.retryStatus),
    research: leads.filter((lead) => lead.researchStatus === 'Needs Research' || lead.status === 'Invalid Contact'),
    profiles: profileOpportunityLeads(leads),
    followups: followUpLeads(leads),
    calendar: followUpLeads(leads),
  }), [leads])
  const visible = queues[tab]
  return (
    <section className="conversion-desk secondary-view panel">
      <div className="view-heading"><div><span className="section-label">Post-call conversion</span><h1>Conversion Desk</h1><p>Protect answered calls, recycle no-answers, verify contact data, and work every scheduled follow-up.</p></div><strong>{queues.profiles.length}</strong></div>
      <div className="conversion-metrics"><article><RefreshCcw size={17} /><span>Retry later</span><strong>{queues.retry.length}</strong></article><article><AlertTriangle size={17} /><span>Needs research</span><strong>{queues.research.length}</strong></article><article><Mail size={17} /><span>Profile opportunity</span><strong>{queues.profiles.length}</strong></article><article><CalendarClock size={17} /><span>Scheduled follow-ups</span><strong>{queues.followups.length}</strong></article></div>
      <nav className="conversion-tabs" aria-label="Conversion queues">{tabs.map(([id, Icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={16} /><span>{label}</span><b>{queues[id].length}</b></button>)}</nav>
      {tab === 'calendar' ? <FollowUpCalendar leads={queues.calendar} onOpenLead={onOpenLead} /> : <div className="conversion-list">{visible.map((lead) => <ConversionCard key={lead.id} tab={tab} lead={lead} quality={phoneQualityForLead(lead, phoneCounts)} onUpdateLead={onUpdateLead} onOpenLead={onOpenLead} onCallLead={onCallLead} />)}{!visible.length ? <div className="conversion-empty"><Check size={28} /><h2>This queue is clear.</h2><p>New post-call actions will appear here automatically.</p></div> : null}</div>}
    </section>
  )
}

function ConversionCard({ tab, lead, quality, onUpdateLead, onOpenLead, onCallLead }) {
  const followUpDate = lead.nextFollowUp || lead.pricingFollowUpDate
  const researchLinks = leadResearchLinks(lead)
  const repairedPhone = phoneKey(lead.researchPhone)
  const repairReady = Boolean(repairedPhone && repairedPhone !== phoneKey(lead.phone) && lead.verificationStatus === 'Verified')
  const verifyLead = () => {
    if (!repairReady) return window.alert('Enter a different valid phone number and set Verification to Verified before returning this lead to the call queue.')
    return onUpdateLead(lead.id, { ...reactivateLeadPatch(), phone: lead.researchPhone, email: lead.researchEmail || lead.email, verificationStatus: 'Verified', verifiedAt: new Date().toISOString() }, 'Lead contact verified and returned to call queue', lead.researchUrl || lead.sourceUrl)
  }
  return <article className="conversion-card">
    <div className="conversion-card-head"><div><span>{lead.region} · {lead.status}</span><h3>{lead.company}</h3><p>{lead.phone || 'No phone'} · {lead.email || 'No email'}</p></div><i className={`phone-quality ${quality.tone}`}>{quality.label}<small>{quality.detail}</small></i></div>
    {tab === 'retry' ? <div className="conversion-card-fields"><label><span>Retry status</span><select value={lead.retryStatus} onChange={(event) => onUpdateLead(lead.id, { retryStatus: event.target.value }, 'Retry status updated', event.target.value)}><option>Retry Later</option><option>Retry Tomorrow</option><option>Ready to Retry</option><option value="">Clear retry</option></select></label><label><span>Next retry</span><input type="datetime-local" value={lead.nextRetryTime || ''} onChange={(event) => onUpdateLead(lead.id, { nextRetryTime: event.target.value }, 'Retry time scheduled', event.target.value)} /></label><div className="conversion-card-actions"><button onClick={() => onCallLead(lead)}><PhoneCall size={14} />Call now</button><button onClick={() => onOpenLead(lead.id)}>Open lead</button></div></div> : null}
    {tab === 'research' ? <div className="conversion-card-fields research"><label><span>New / corrected phone</span><input value={lead.researchPhone || ''} onChange={(event) => onUpdateLead(lead.id, { researchPhone: event.target.value })} placeholder={lead.phone || 'Paste verified phone'} /></label><label><span>New / corrected email</span><input type="email" value={lead.researchEmail || ''} onChange={(event) => onUpdateLead(lead.id, { researchEmail: event.target.value })} placeholder={lead.email || 'Paste verified email'} /></label><label><span>Source / website</span><input value={lead.researchUrl || ''} onChange={(event) => onUpdateLead(lead.id, { researchUrl: event.target.value })} placeholder="Paste the best verification link" /></label><label><span>Verification</span><select value={lead.verificationStatus || 'Needs Research'} onChange={(event) => onUpdateLead(lead.id, { verificationStatus: event.target.value })}><option>Needs Research</option><option>Unverified</option><option>Verified</option><option>Unable to verify</option></select></label><label className="wide"><span>Research notes / contact trail</span><input value={lead.researchNotes || ''} onChange={(event) => onUpdateLead(lead.id, { researchNotes: event.target.value })} placeholder="Name, role, source, evidence, best calling time…" /></label><div className="research-shortcuts"><a href={researchLinks.google} target="_blank" rel="noreferrer"><Search size={13} />Google Search</a><a href={researchLinks.maps} target="_blank" rel="noreferrer"><Map size={13} />Google Maps</a><a href={researchLinks.facebook} target="_blank" rel="noreferrer"><MessageCircle size={13} />Facebook</a>{researchLinks.source ? <a href={researchLinks.source} target="_blank" rel="noreferrer"><ExternalLink size={13} />Source</a> : null}</div><div className="conversion-card-actions"><button onClick={verifyLead} disabled={!(lead.researchPhone || lead.phone || lead.researchEmail || lead.email)}><UserCheck size={14} />Verify + Call Queue</button><button onClick={() => onOpenLead(lead.id)}>Open lead</button></div></div> : null}
    {tab === 'profiles' ? <div className="profile-opportunity"><div><strong>{lead.email ? 'Email available — profile not sent' : 'Answered — email still needed'}</strong><span>{lead.contactPerson || 'Contact name missing'}{lead.contactRole ? ` · ${lead.contactRole}` : ''}</span>{followUpDate ? <small>Follow up: {followUpDate}</small> : null}</div><div className="conversion-card-actions"><button onClick={() => onOpenLead(lead.id)}>Open send pack</button>{lead.email ? <button onClick={() => onUpdateLead(lead.id, { profileSent: true, profileSentAt: new Date().toISOString().slice(0, 10), status: 'Profile Sent' }, 'Profile marked sent from Conversion Desk')}><Mail size={14} />Mark sent</button> : null}</div></div> : null}
    {tab === 'followups' ? <div className="profile-opportunity"><div><strong>{followUpDate}</strong><span>{lead.lastResult || 'Follow-up scheduled'} · {lead.contactPerson || 'Contact not captured'}</span></div><div className="conversion-card-actions"><button onClick={() => onOpenLead(lead.id)}>Open lead</button><button onClick={() => onCallLead(lead)}><PhoneCall size={14} />Call follow-up</button></div></div> : null}
  </article>
}

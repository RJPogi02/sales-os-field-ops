import { AlertTriangle, CalendarClock, Clipboard, Mail, Save, Send, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { buildProfileEmail, phoneKey } from '../lib/leadModel.js'

function tomorrowKey() {
  const value = new Date()
  value.setDate(value.getDate() + 1)
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}

export function AnsweredFollowUpModal({ lead, result, operatorName, companyProfile = {}, onClose, onSave }) {
  const initialPerson = phoneKey(lead.contactPerson).length >= 7 ? '' : lead.contactPerson || ''
  const [form, setForm] = useState({
    person: initialPerson,
    role: lead.contactRole || '',
    directPhone: lead.directPhone || '',
    email: lead.email || '',
    emailConfirmed: Boolean(lead.emailConfirmed || lead.email),
    canSendProfile: lead.canSendProfile === false ? 'no' : 'yes',
    followUp: lead.nextFollowUp || tomorrowKey(),
    notes: '',
  })
  const [copied, setCopied] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const requestClose = () => setCloseConfirm(true)
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); requestClose() } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const payload = () => ({
    contactPerson: form.person.trim(),
    contactRole: form.role.trim(),
    directPhone: form.directPhone.trim(),
    email: form.email.trim(),
    emailConfirmed: form.emailConfirmed,
    canSendProfile: form.canSendProfile === 'yes',
    nextFollowUp: form.followUp,
    warmLead: true,
    notes: [lead.notes, form.notes.trim()].filter(Boolean).join('\n').slice(0, 1200),
  })

  const copyProfileEmail = async () => {
    const nextLead = { ...lead, ...payload() }
    const email = buildProfileEmail(nextLead, operatorName, companyProfile)
    try {
      await navigator.clipboard.writeText(`To: ${nextLead.email || 'Email needed'}\nSubject: ${email.subject}\n\n${email.body}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }

  const sendNow = async () => {
    const nextLead = { ...lead, ...payload() }
    if (!nextLead.email) return
    const email = buildProfileEmail(nextLead, operatorName, companyProfile)
    try { await navigator.clipboard.writeText(`${email.subject}\n\n${email.body}`) } catch { /* mailto still works */ }
    window.open(`mailto:${encodeURIComponent(nextLead.email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`, '_blank', 'noopener,noreferrer')
    onSave('send-profile', payload())
  }

  return (
    <div className="modal-backdrop conversion-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section className="answered-followup-modal panel" role="dialog" aria-modal="true" aria-label="Answered call follow-up">
        <header>
          <div><span className="section-label">Conversion checkpoint</span><h2>Turn this answer into a next step</h2><p><strong>{result}</strong> at {lead.company}. Capture the person, profile path, and follow-up before moving on.</p></div>
          <button onClick={requestClose} aria-label="Close answered call follow-up"><X size={19} /></button>
        </header>

        <div className="answered-call-alert"><UserRound size={20} /><div><strong>Real person reached</strong><span>Next required action: confirm contact → confirm email → send profile → schedule follow-up.</span></div></div>

        <div className="answered-followup-grid">
          <label><span>Person spoken to</span><input autoFocus value={form.person} onChange={(event) => setField('person', event.target.value)} placeholder="Name or guard/staff description" /></label>
          <label><span>Role / department</span><input value={form.role} onChange={(event) => setField('role', event.target.value)} placeholder="Procurement, purchasing, admin…" /></label>
          <label><span>Direct phone</span><input value={form.directPhone} onChange={(event) => setField('directPhone', event.target.value)} placeholder="If different from main number" /></label>
          <label><span>Email for profile</span><input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} placeholder="Ask for the best profile/accreditation email" /></label>
          <label className="followup-toggle"><span>Email confirmed?</span><button type="button" className={form.emailConfirmed ? 'active' : ''} onClick={() => setField('emailConfirmed', !form.emailConfirmed)}>{form.emailConfirmed ? 'Yes, confirmed' : 'Not confirmed'}</button></label>
          <label><span>Can send profile?</span><select value={form.canSendProfile} onChange={(event) => setField('canSendProfile', event.target.value)}><option value="yes">Yes</option><option value="no">No / ask later</option></select></label>
          <label><span>Follow-up date</span><div className="input-with-icon"><CalendarClock size={15} /><input type="date" value={form.followUp} onChange={(event) => setField('followUp', event.target.value)} /></div></label>
          <label className="wide"><span>Quick notes</span><textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="What they said, best time to call, requested information…" /></label>
        </div>

        {!form.email ? <p className="missing-email-prompt"><Mail size={16} />Ask for the best email for company profile and supplier accreditation.</p> : <button className="copy-profile-draft" onClick={copyProfileEmail}><Clipboard size={15} />{copied ? 'Profile email copied' : `Copy profile email for ${form.email}`}</button>}

        {closeConfirm ? <div className="answered-close-guard" role="alert"><AlertTriangle size={19} /><div><strong>Keep this answered result?</strong><p>Closing now discards the answer and the contact details you captured. Nothing has been auto-saved.</p></div><button onClick={() => setCloseConfirm(false)}>Continue editing</button><button className="danger" onClick={onClose}>Discard result</button></div> : null}

        <footer>
          <button className="answered-action send" onClick={sendNow} disabled={!form.email || form.canSendProfile !== 'yes'}><Send size={16} />Send Profile Now</button>
          <button className="answered-action warm" onClick={() => onSave('warm', payload())}><Save size={16} />Save as Warm Lead</button>
          <button className="answered-action next" onClick={() => onSave('next', payload())}>Save + Next Lead</button>
        </footer>
      </section>
    </div>
  )
}

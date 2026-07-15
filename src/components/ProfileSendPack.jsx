import { CalendarClock, Check, Copy, Mail, Paperclip, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildProfileEmail } from '../lib/leadModel.js'

export function ProfileSendPack({ lead, operatorName, companyProfile, onUpdateLead, onMarkSent }) {
  const [copied, setCopied] = useState('')
  const pack = useMemo(() => buildProfileEmail(lead, operatorName, companyProfile), [companyProfile, lead, operatorName])

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1400)
    } catch { setCopied('Copy unavailable') }
  }

  return (
    <section className="profile-send-pack">
      <header><div><Mail size={18} /><span>Company profile send pack</span></div><strong className={lead.profileSent ? 'sent' : ''}>{lead.profileSent ? 'SENT' : 'READY TO COPY'}</strong></header>
      <label><span>Email subject</span><div><input readOnly value={pack.subject} /><button onClick={() => copy(pack.subject, 'Subject copied')}><Copy size={15} />Copy</button></div></label>
      <label><span>Email body</span><textarea readOnly value={pack.body} /><button className="copy-body" onClick={() => copy(pack.body, 'Email copied')}><Copy size={15} />Copy email</button></label>
      <div className="attachment-reminder"><Paperclip size={17} /><div><strong>Attachment check</strong><span>Attach {companyProfile?.shortName || 'your company'} profile before sending.</span></div></div>
      <label className="followup-suggestion"><span><CalendarClock size={14} />Suggested follow-up</span><input type="date" value={lead.nextFollowUp || pack.followUp} onChange={(event) => onUpdateLead({ nextFollowUp: event.target.value }, 'Follow-up scheduled', event.target.value)} /></label>
      <button className={`mark-profile-sent ${lead.profileSent ? 'complete' : ''}`} onClick={onMarkSent}>{lead.profileSent ? <Check size={17} /> : <Send size={17} />}{lead.profileSent ? 'Profile sent and logged' : 'Mark profile sent + earn XP'}</button>
      {copied ? <p className="copy-feedback">{copied}</p> : null}
    </section>
  )
}

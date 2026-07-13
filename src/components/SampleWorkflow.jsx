import { FlaskConical } from 'lucide-react'
import { SAMPLE_STATUSES } from '../lib/leadModel.js'

function SampleField({ label, children, wide = false }) {
  return <label className={wide ? 'wide' : ''}><span>{label}</span>{children}</label>
}

export function SampleWorkflow({ lead, onUpdateLead }) {
  return (
    <section className="sample-workflow">
      <header><div><FlaskConical size={18} /><span>Sample request workflow</span></div><strong>{lead.sampleRequired ? lead.sampleStatus : 'NOT REQUIRED YET'}</strong></header>
      <div className="sample-grid">
        <SampleField label="Material sample needed"><input value={lead.materialSampleNeeded} onChange={(event) => onUpdateLead({ materialSampleNeeded: event.target.value, sampleRequired: Boolean(event.target.value), sampleDocStatus: event.target.value ? 'Required' : lead.sampleDocStatus })} placeholder="e.g. 3/4 aggregate sample" /></SampleField>
        <SampleField label="Sample status"><select value={lead.sampleStatus} onChange={(event) => onUpdateLead({ sampleStatus: event.target.value }, 'Sample status changed', event.target.value)}>{SAMPLE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></SampleField>
        <SampleField label="Where to submit" wide><input value={lead.sampleSubmissionLocation} onChange={(event) => onUpdateLead({ sampleSubmissionLocation: event.target.value })} placeholder="Plant, laboratory, or project address" /></SampleField>
        <SampleField label="Receiving person / contact"><input value={lead.sampleReceivingContact} onChange={(event) => onUpdateLead({ sampleReceivingContact: event.target.value })} placeholder="Name and mobile number" /></SampleField>
        <SampleField label="Required documents / test reports"><input value={lead.documentsRequired} onChange={(event) => onUpdateLead({ documentsRequired: event.target.value })} placeholder="Gradation, test report, permits..." /></SampleField>
        <SampleField label="Deadline"><input type="date" value={lead.sampleDeadline} onChange={(event) => onUpdateLead({ sampleDeadline: event.target.value }, 'Sample deadline recorded', event.target.value)} /></SampleField>
        <SampleField label="Submitted date"><input type="date" value={lead.sampleSubmittedDate} onChange={(event) => onUpdateLead({ sampleSubmittedDate: event.target.value, sampleStatus: event.target.value ? 'Submitted' : lead.sampleStatus }, 'Sample submission recorded', event.target.value)} /></SampleField>
        <SampleField label="Next follow-up"><input type="date" value={lead.nextFollowUp} onChange={(event) => onUpdateLead({ nextFollowUp: event.target.value }, 'Follow-up scheduled', event.target.value)} /></SampleField>
      </div>
    </section>
  )
}

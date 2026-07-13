import { FileSpreadsheet, Merge, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { previewCrmMerge } from '../lib/csv.js'

export function CrmImportModal({ rows, leads, fileName, onClose, onConfirm }) {
  const [mode, setMode] = useState('merge')
  const preview = useMemo(() => previewCrmMerge(leads, rows), [leads, rows])
  return <div className="modal-backdrop crm-import-backdrop" role="presentation">
    <section className="crm-import-modal panel" role="dialog" aria-modal="true" aria-label="CRM CSV import preview">
      <header><div><span className="section-label">CRM merge preview</span><h2>Import without losing history</h2><p>{fileName} · {rows.length} usable rows detected</p></div><button onClick={onClose} aria-label="Close CRM import"><X size={18} /></button></header>
      <div className="import-summary"><article><Plus size={17} /><span>New leads</span><strong>{preview.added}</strong></article><article><Merge size={17} /><span>Matching leads</span><strong>{preview.updated}</strong></article><article><FileSpreadsheet size={17} /><span>Total rows</span><strong>{rows.length}</strong></article></div>
      <div className="import-mode"><label className={mode === 'merge' ? 'active' : ''}><input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /><span><strong>Merge and add</strong><small>Update matching phone/email/company fields and add new leads.</small></span></label><label className={mode === 'add-only' ? 'active' : ''}><input type="radio" name="import-mode" checked={mode === 'add-only'} onChange={() => setMode('add-only')} /><span><strong>Add new only</strong><small>Skip matches and preserve every existing CRM value.</small></span></label></div>
      <div className="import-preview-table"><div><span>Action</span><span>Company</span><span>Phone</span><span>Email</span></div>{preview.rows.slice(0, 10).map(({ row, action }, index) => <div key={`${row.id}-${index}`}><i className={action.toLowerCase()}>{action}</i><strong>{row.company || 'Unnamed lead'}</strong><span>{row.phone || 'No phone'}</span><span>{row.email || 'No email'}</span></div>)}</div>
      {rows.length > 10 ? <p className="import-more">Previewing 10 of {rows.length} rows.</p> : null}
      <footer><p>Import stays in this browser. Export a backup CSV before any large merge.</p><div><button onClick={onClose}>Cancel</button><button className="primary-action" onClick={() => onConfirm(rows, mode)}>Import {mode === 'merge' ? `${preview.added + preview.updated} rows` : `${preview.added} new leads`}</button></div></footer>
    </section>
  </div>
}

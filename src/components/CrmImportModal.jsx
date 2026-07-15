import { AlertTriangle, Check, FileSpreadsheet, LockKeyhole, Merge, Plus, ShieldCheck, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CRM_IMPORT_MAPPING_FIELDS, inferCrmColumnMapping, mapCrmImportRows, previewCrmMerge } from '../lib/csv.js'

export function CrmImportModal({ headers = [], rawRows = [], rows = [], leads, fileName, fileType = 'csv', onClose, onConfirm }) {
  const hasRawTable = headers.length > 0
  const [mode, setMode] = useState('merge')
  const [visibility, setVisibility] = useState('private')
  const [mapping, setMapping] = useState(() => inferCrmColumnMapping(headers))
  const mapped = useMemo(() => hasRawTable
    ? mapCrmImportRows(headers, rawRows, mapping, { visibility, sourceName: fileName, leadSource: `${fileType.toUpperCase()} import` })
    : { rows, missingRequired: rows.filter((row) => row.importMissingFields?.length), blankRows: 0 }, [fileName, fileType, hasRawTable, headers, mapping, rawRows, rows, visibility])
  const preview = useMemo(() => previewCrmMerge(leads, mapped.rows), [leads, mapped.rows])
  const unmappedCompany = hasRawTable && mapping.company === ''
  const importCount = preview.added + (mode === 'merge' ? preview.updated : 0)
  const skippedCount = preview.duplicates + (mode === 'add-only' ? preview.updated : 0)

  const confirm = () => onConfirm(mapped.rows, mode, {
    added: preview.added,
    matches: preview.updated,
    duplicates: preview.duplicates,
    missingRequired: mapped.missingRequired.length,
    visibility,
  })

  return <div className="modal-backdrop crm-import-backdrop" role="presentation">
    <section className="crm-import-modal panel crm-import-v009" role="dialog" aria-modal="true" aria-label="CRM spreadsheet import preview">
      <header>
        <div><span className="section-label">CRM import cockpit</span><h2>Map first. Import with confidence.</h2><p>{fileName} · {rawRows.length || rows.length} source rows · {fileType.toUpperCase()}</p></div>
        <button onClick={onClose} aria-label="Close CRM import"><X size={18} /></button>
      </header>

      <ol className="import-flightpath" aria-label="Import workflow">
        <li className="complete"><Check size={12} /><span>Parsed</span></li>
        <li className="active"><span>02</span><strong>Map columns</strong></li>
        <li><span>03</span><strong>Review five</strong></li>
        <li><span>04</span><strong>Import</strong></li>
      </ol>

      {hasRawTable ? <section className="import-mapping" aria-labelledby="import-mapping-title">
        <header><div><span className="section-label">Column mapping</span><h3 id="import-mapping-title">Tell Sales OS what each column means</h3></div><p>We suggested matches from your header row. Change any field before importing.</p></header>
        <div className="import-field-map">{CRM_IMPORT_MAPPING_FIELDS.map((field) => <label key={field.key} className={field.required && mapping[field.key] === '' ? 'needs-map' : ''}>
          <span>{field.label}{field.required ? <b>Required</b> : null}</span>
          <select value={mapping[field.key] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}>
            <option value="">Do not import</option>
            {headers.map((header, index) => <option key={`${header}-${index}`} value={String(index)}>{header}</option>)}
          </select>
        </label>)}</div>
        {unmappedCompany ? <p className="import-map-warning"><AlertTriangle size={14} />Company is not mapped. Every usable row will be kept, labeled, and routed to Research instead of being discarded.</p> : null}
      </section> : null}

      <div className="import-summary four">
        <article><Plus size={17} /><span>New leads</span><strong>{preview.added}</strong></article>
        <article><Merge size={17} /><span>Existing matches</span><strong>{preview.updated}</strong></article>
        <article><FileSpreadsheet size={17} /><span>Duplicate rows</span><strong>{preview.duplicates}</strong></article>
        <article className={mapped.missingRequired.length ? 'warning' : ''}><AlertTriangle size={17} /><span>Route to Research</span><strong>{mapped.missingRequired.length}</strong></article>
      </div>

      <div className="import-options-grid">
        <section className="import-mode" aria-label="Merge behavior">
          <label className={mode === 'merge' ? 'active' : ''}><input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /><span><strong>Merge and add</strong><small>Update matching leads and add new records without erasing local history.</small></span></label>
          <label className={mode === 'add-only' ? 'active' : ''}><input type="radio" name="import-mode" checked={mode === 'add-only'} onChange={() => setMode('add-only')} /><span><strong>Add new only</strong><small>Skip every existing match and preserve its current CRM values.</small></span></label>
        </section>
        <section className="import-visibility" aria-label="Imported lead visibility">
          <label className={visibility === 'private' ? 'active' : ''}><input type="radio" name="import-visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} /><LockKeyhole size={16} /><span><strong>Private by default</strong><small>Only this operator can use these leads.</small></span></label>
          <label className={visibility === 'team' ? 'active' : ''}><input type="radio" name="import-visibility" checked={visibility === 'team'} onChange={() => setVisibility('team')} /><Users size={16} /><span><strong>Share with team</strong><small>Visible after the team workspace syncs.</small></span></label>
        </section>
      </div>

      <section className="import-review" aria-labelledby="import-review-title">
        <header><div><span className="section-label">Five-row verification</span><h3 id="import-review-title">Check the data before it enters your CRM</h3></div><span>{mapped.rows.length} usable · {mapped.blankRows} blank ignored</span></header>
        <div className="import-preview-table"><div><span>Action</span><span>Company</span><span>Location / branch</span><span>Phone</span><span>Email</span><span>Region / status</span></div>{preview.rows.slice(0, 5).map(({ row, action }, index) => <div key={`${row.id}-${index}`}>
          <i className={action.toLowerCase()}>{action}</i>
          <strong>{row.company || 'Unidentified lead'}</strong>
          <span>{row.location || 'No branch address'}</span>
          <span>{row.phone || 'No phone'}</span>
          <span>{row.email || 'No email'}</span>
          <span>{row.region || 'NCR'} · {row.researchStatus === 'Needs Research' ? 'Research' : row.status || 'New Lead'}</span>
        </div>)}</div>
        {mapped.rows.length > 5 ? <p className="import-more">Previewing the first 5 of {mapped.rows.length} usable rows.</p> : null}
      </section>

      <footer>
        <p><ShieldCheck size={15} />Nothing is uploaded to a third party. Spreadsheet parsing and this merge happen locally in the app.</p>
        <div><button onClick={onClose}>Cancel</button><button className="primary-action" disabled={!mapped.rows.length} onClick={confirm}>Import {importCount} lead{importCount === 1 ? '' : 's'}{skippedCount ? ` · skip ${skippedCount}` : ''}</button></div>
      </footer>
    </section>
  </div>
}

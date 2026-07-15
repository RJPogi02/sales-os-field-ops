import { Check, ChevronLeft, ChevronRight, Mail, Phone, Search, SlidersHorizontal } from 'lucide-react'
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { phoneCountsForLeads, phoneQualityForLead } from '../lib/leadModel.js'

const PAGE_SIZE = 8

const LeadRow = memo(function LeadRow({ lead, active, onOpen, onToggleSelected, phoneCounts }) {
  const priorityDots = lead.priority === 'High' ? 3 : lead.priority === 'Medium' ? 2 : 1
  const quality = phoneQualityForLead(lead, phoneCounts)
  return (
    <div className={`lead-row ${active ? 'active' : ''}`} onClick={() => onOpen(lead.id)}>
      <button className={`lead-check ${lead.selected ? 'checked' : ''}`} onClick={(event) => { event.stopPropagation(); onToggleSelected(lead.id) }} aria-label={`${lead.selected ? 'Remove' : 'Add'} ${lead.company} ${lead.selected ? 'from' : 'to'} mission`}>{lead.selected ? <Check size={12} /> : null}</button>
      <div className="lead-company"><strong>{lead.company}</strong><span>{lead.status || 'New lead'}</span></div>
      <span className="lead-region">{lead.region}</span>
      <div className="lead-channels"><span><Phone size={12} />{lead.phone || 'No phone'}<i className={`phone-quality ${quality.tone}`} title={quality.detail}>{quality.label}</i></span><span><Mail size={12} />{lead.email || 'No email'}</span></div>
      <div className="lead-result"><span>{lead.lastResult}</span><small>{lead.lastContacted || 'No activity'}</small></div>
      <div className={`lead-priority ${(lead.priority || 'Low').toLowerCase()}`}><span>{lead.priority || 'Low'}</span><i>{Array.from({ length: 3 }, (_, index) => <b key={index} className={index < priorityDots ? 'on' : ''} />)}</i></div>
    </div>
  )
})

export function LeadQueue({ leads, selectedLeadId, onOpenLead, onToggleSelected, territory, onTerritoryChange, pageSize = PAGE_SIZE, eligibleLeadIds = null }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const deferredSearch = useDeferredValue(search)
  const phoneCounts = useMemo(() => phoneCountsForLeads(leads), [leads])
  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    const eligible = eligibleLeadIds ? new Set(eligibleLeadIds) : null
    return leads.filter((lead) => (!eligible || eligible.has(lead.id) || lead.selected) && (territory === 'ALL' || lead.region === territory) && (!query || `${lead.company} ${lead.location} ${lead.phone} ${lead.email} ${lead.contactPerson}`.toLowerCase().includes(query)))
  }, [deferredSearch, eligibleLeadIds, leads, territory])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  useEffect(() => setPage(1), [deferredSearch, territory])
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount])
  const start = (page - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => {
    if (pageCount <= 5) return index + 1
    const first = Math.min(Math.max(1, page - 2), pageCount - 4)
    return first + index
  })

  return (
    <section className="lead-queue panel">
      <div className="queue-title"><span className="section-label">Ready today</span><span>{filtered.length} callable leads · page {page}/{pageCount}</span></div>
      <div className="queue-tools">
        <label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads…" /></label>
        <div className="region-filter"><SlidersHorizontal size={14} />{['ALL', 'NCR', 'NORTH', 'SOUTH'].map((item) => <button key={item} className={territory === item ? 'active' : ''} onClick={() => onTerritoryChange(item)}>{item}</button>)}</div>
      </div>
      <div className="lead-table-head"><span /><span>Company</span><span>Region</span><span>Phone / email</span><span>Last result</span><span>Priority</span></div>
      <div className="lead-list">{visible.map((lead) => <LeadRow key={lead.id} lead={lead} active={lead.id === selectedLeadId} onOpen={onOpenLead} onToggleSelected={onToggleSelected} phoneCounts={phoneCounts} />)}{visible.length === 0 ? <div className="queue-empty">No leads match this territory and search.</div> : null}</div>
      <footer className="queue-footer"><span>{filtered.length ? start + 1 : 0}–{Math.min(start + visible.length, filtered.length)} of {filtered.length} leads</span><div><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft size={14} /></button>{pageNumbers.map((number) => <button key={number} className={page === number ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}{pageCount > 5 && pageNumbers.at(-1) < pageCount ? <span>…</span> : null}<button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next page"><ChevronRight size={14} /></button></div></footer>
    </section>
  )
}

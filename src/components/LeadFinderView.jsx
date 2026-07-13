import { AlertTriangle, Check, ExternalLink, Globe2, LoaderCircle, Map, MapPin, MessageCircle, Plus, Search, SearchCheck, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePersistentState } from '../hooks/usePersistentState.js'
import { buildDiscoveryUrl, discoveredLeadDuplicate, leadFromNominatim, leadResearchLinks } from '../lib/leadDiscovery.js'

const KEYWORDS = ['batching plant', 'ready mix concrete', 'concrete supplier', 'aggregate supplier', 'quarry', 'construction materials supplier']
const AREA_DEFAULTS = { ALL: 'Luzon', NCR: 'Metro Manila', NORTH: 'Bulacan', SOUTH: 'Cavite' }

export function LeadFinderView({ leads, territory, endpoint, provider = 'nominatim', onAddDiscoveredLeads }) {
  const [keyword, setKeyword] = useState('batching plant')
  const [area, setArea] = useState(AREA_DEFAULTS[territory] || 'Luzon')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('Results are discovery candidates only. Contact details may be missing or outdated. Verify before outreach.')
  const [cache, setCache] = usePersistentState('sales-os-lead-finder-cache-v1', {})
  const enriched = useMemo(() => results.map((lead) => ({ lead, duplicate: discoveredLeadDuplicate(leads, lead), links: leadResearchLinks(lead) })), [leads, results])
  const importable = enriched.filter(({ lead, duplicate }) => !duplicate && selected.includes(lead.id)).map(({ lead }) => lead)
  const providerAvailable = provider === 'nominatim'

  const searchLeads = async (event) => {
    event.preventDefault()
    if (!providerAvailable) { setStatus('error'); setMessage('This provider is a future placeholder. Choose OpenStreetMap / Nominatim in Settings or use Manual only links.'); return }
    if (!keyword.trim() || !area.trim()) return
    const cacheKey = `${keyword.trim().toLowerCase()}|${area.trim().toLowerCase()}`
    if (cache[cacheKey]?.length) {
      setResults(cache[cacheKey].map((lead) => ({ ...lead })))
      setSelected([])
      setStatus('cached')
      setMessage(`Loaded ${cache[cacheKey].length} cached candidates. Verify every business before outreach.`)
      return
    }
    setStatus('loading')
    setMessage('Searching public OpenStreetMap business data…')
    try {
      const response = await fetch(buildDiscoveryUrl(endpoint, keyword.trim(), area.trim()), { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`Search service returned ${response.status}`)
      const payload = await response.json()
      const next = payload.map((item) => leadFromNominatim(item, `${keyword}, ${area}`, territory))
      setResults(next)
      setSelected([])
      setCache((current) => ({ ...current, [cacheKey]: next }))
      setStatus('done')
      setMessage(next.length ? `${next.length} possible leads found. Missing phone/email records should go to Research first.` : 'No close matches found. Try a specific city or a different business type.')
    } catch (error) {
      setStatus('error')
      setMessage(`${error.message}. Change the endpoint in Settings or try again later.`)
    }
  }

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const importSelected = (pickForQueue) => {
    if (!importable.length) return
    onAddDiscoveredLeads(importable, { pickForQueue })
    setSelected([])
    setMessage(`${importable.length} reviewed lead${importable.length === 1 ? '' : 's'} added${pickForQueue ? ' and picked for the unlocked call roster' : ' to the CRM'}.`)
  }
  const addOne = (lead, mode) => {
    onAddDiscoveredLeads([lead], { pickForQueue: mode === 'pick', forceResearch: mode === 'research' })
    setSelected((current) => current.filter((id) => id !== lead.id))
  }

  return (
    <section className="secondary-view panel lead-finder-view">
      <div className="view-heading"><div><span className="section-label">Public-data prospecting</span><h1>Lead Finder</h1><p>Discover possible businesses, verify the contact trail, then choose exactly where each lead enters Sales OS.</p></div><strong>{results.length}</strong></div>
      <div className="finder-safety"><ShieldCheck size={19} /><div><strong>Discovery candidates—not verified contacts</strong><p>Contact details may be missing or outdated. Verify before outreach. Do not use this tool for bulk scraping. Leads without a phone or email should enter Research first.</p></div></div>
      <form className="lead-finder-form" onSubmit={searchLeads}>
        <label><span>Business type</span><select value={keyword} onChange={(event) => setKeyword(event.target.value)}>{KEYWORDS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>City / province / area</span><div><MapPin size={15} /><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. Bulacan, Cavite, Metro Manila" /></div></label>
        <button type="submit" disabled={status === 'loading' || !providerAvailable}>{status === 'loading' ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}{providerAvailable ? status === 'loading' ? 'Searching…' : 'Search public leads' : 'Provider not connected'}</button>
      </form>
      <div className={`finder-message ${status}`}><Globe2 size={16} /><span>{message}</span></div>
      <div className="finder-toolbar"><span>{importable.length} reviewed result{importable.length === 1 ? '' : 's'} selected</span><div><button disabled={!importable.length} onClick={() => importSelected(false)}><Plus size={14} />Add selected</button><button disabled={!importable.length} onClick={() => importSelected(true)}><Check size={14} />Add + pick selected</button></div></div>
      <div className="finder-results">
        {enriched.map(({ lead, duplicate, links }) => <article key={lead.id} className={duplicate ? 'duplicate' : selected.includes(lead.id) ? 'selected' : ''}>
          <button className="finder-select" disabled={Boolean(duplicate)} onClick={() => toggle(lead.id)} aria-label={`${selected.includes(lead.id) ? 'Unselect' : 'Select'} ${lead.company}`}>{selected.includes(lead.id) ? <Check size={14} /> : null}</button>
          <div className="finder-result-main"><span>{lead.region} · {lead.phone ? 'Phone published' : 'Contact research needed'}</span><h3>{lead.company}</h3><p>{lead.location}</p><small>{lead.phone || 'No published phone'} · {lead.email || 'No published email'}</small></div>
          <div className="finder-source"><i>{duplicate ? 'Already in CRM' : lead.phone || lead.email ? 'Verify contact' : 'Research first'}</i>{links.source ? <a href={links.source} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a> : null}</div>
          <div className="finder-result-actions">
            <button disabled={Boolean(duplicate)} onClick={() => addOne(lead, 'crm')}><Plus size={13} />Add to CRM</button>
            <button disabled={Boolean(duplicate)} onClick={() => addOne(lead, 'pick')}><Check size={13} />Add + Pick</button>
            <button disabled={Boolean(duplicate)} className={!lead.phone && !lead.email ? 'recommended' : ''} onClick={() => addOne(lead, 'research')}><SearchCheck size={13} />Send to Research</button>
            <a href={links.google} target="_blank" rel="noreferrer"><Search size={13} />Google</a>
            <a href={links.maps} target="_blank" rel="noreferrer"><Map size={13} />Maps</a>
            <a href={links.facebook} target="_blank" rel="noreferrer"><MessageCircle size={13} />Facebook</a>
          </div>
        </article>)}
        {!results.length && status !== 'loading' ? <div className="large-empty"><Search size={30} /><h2>Build your next territory list.</h2><p>Search a business type and area. Nothing enters the CRM until you approve it.</p></div> : null}
      </div>
      <footer className="finder-attribution"><AlertTriangle size={14} /><span>Manual, low-volume discovery only. Verify before calling. Search data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, ODbL.</span></footer>
    </section>
  )
}

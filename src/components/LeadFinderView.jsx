import { AlertTriangle, Check, ExternalLink, Globe2, LoaderCircle, LockKeyhole, Map, MapPin, MessageCircle, Plus, RefreshCcw, Search, SearchCheck, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { usePersistentState } from '../hooks/usePersistentState.js'
import {
  bestDiscoveryReviewLane, buildDiscoveryPlan, buildDiscoveryUrl, discoveryCacheKey, discoveryCompleteness,
  discoveryImportRewardMetadata, DISCOVERY_CACHE_TTL, discoveredLeadDuplicate, leadFromGooglePlace,
  leadFromNominatim, leadResearchLinks, mergeDiscoveryCandidates, pruneDiscoveryCache,
} from '../lib/leadDiscovery.js'
import {
  createLeadFinderState, LEAD_FINDER_STATE_KEY, normalizeDiscoveryTerm, reviveLeadFinderState,
} from '../lib/leadFinderState.js'
import { searchGooglePlacesText } from '../lib/googlePlaces.js'

const KEYWORD_GROUPS = [
  { label: 'Customers', terms: ['batching plant', 'ready mix concrete', 'concrete supplier', 'construction contractor'] },
  { label: 'Suppliers', terms: ['aggregate supplier', 'quarry', 'construction materials supplier', 'sand and gravel supplier'] },
]
const PRESET_KEYWORDS = KEYWORD_GROUPS.flatMap((group) => group.terms)

function splitAreas(value) {
  return [...new Set(String(value || '').split(/[\n;,]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 8)
}

function dateLabel(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function LeadFinderView({
  leads, territory, endpoint, provider = 'nominatim', googleApiKey = '', operatorId = '', operatorName = '',
  onAddDiscoveredLeads, onOpenSettings, onProviderChange, onGoogleApiKeyChange, hidden = false,
}) {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [campaign, setCampaign] = usePersistentState(
    LEAD_FINDER_STATE_KEY,
    () => createLeadFinderState(territory),
    (value) => reviveLeadFinderState(value, territory),
  )
  const [cache, setCache] = usePersistentState('sales-os-lead-finder-cache-v2', {})
  const {
    keywords, customKeywords, customKeywordDraft, areasText, targetCount, visibility,
    results, selected, status, message, tab, lastSearchKey, lastSearchAt,
  } = campaign

  const setField = (field, nextValue) => setCampaign((current) => ({
    ...current,
    [field]: typeof nextValue === 'function' ? nextValue(current[field]) : nextValue,
  }))
  const patchCampaign = (patch) => setCampaign((current) => ({ ...current, ...patch }))
  const setKeywords = (value) => setField('keywords', value)
  const setAreasText = (value) => setField('areasText', value)
  const setTargetCount = (value) => setField('targetCount', value)
  const setVisibility = (value) => setField('visibility', value)
  const setResults = (value) => setField('results', value)
  const setSelected = (value) => setField('selected', value)
  const setStatus = (value) => setField('status', value)
  const setMessage = (value) => setField('message', value)
  const setTab = (value) => setField('tab', value)

  const areas = useMemo(() => splitAreas(areasText), [areasText])
  const plan = useMemo(() => buildDiscoveryPlan({ keywords, areas, targetCount }), [areas, keywords, targetCount])
  const enriched = useMemo(() => results.map((lead) => ({
    lead,
    duplicate: discoveredLeadDuplicate(leads, lead),
    links: leadResearchLinks(lead),
    completeness: discoveryCompleteness(lead),
  })), [leads, results])
  const groups = useMemo(() => ({
    new: enriched.filter((item) => !item.duplicate && item.completeness.callable),
    research: enriched.filter((item) => !item.duplicate && !item.completeness.callable),
    duplicates: enriched.filter((item) => item.duplicate),
  }), [enriched])
  const visible = groups[tab] || groups.new
  const selectedItems = enriched.filter(({ lead, duplicate }) => !duplicate && selected.includes(lead.id))
  const selectedCallable = selectedItems.filter(({ completeness }) => completeness.callable).map(({ lead }) => lead)
  const selectedImportable = selectedItems.map(({ lead }) => lead)
  const providerName = provider === 'google-places' ? 'Google Places' : 'OpenStreetMap manual lookup'
  const canSearch = provider === 'google-places' ? Boolean(googleApiKey) : provider === 'nominatim'

  const toggleKeyword = (keyword) => setKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword].slice(0, 16))

  const addCustomKeyword = () => {
    const term = normalizeDiscoveryTerm(customKeywordDraft)
    if (!term) return
    const key = term.toLocaleLowerCase()
    const preset = PRESET_KEYWORDS.find((item) => item.toLocaleLowerCase() === key)
    const known = customKeywords.find((item) => item.toLocaleLowerCase() === key)
    if (!preset && !known && customKeywords.length >= 12) {
      setMessage('Keep up to 12 custom business terms per saved campaign. Remove one before adding another.')
      return
    }
    if (!preset && !known) setField('customKeywords', (current) => [...current, term])
    if (!keywords.some((item) => item.toLocaleLowerCase() === key)) setKeywords((current) => [...current, preset || known || term].slice(0, 16))
    setField('customKeywordDraft', '')
    setMessage(`${preset || known || term} added to this saved campaign.`)
  }

  const removeCustomKeyword = (term) => {
    const key = term.toLocaleLowerCase()
    setField('customKeywords', (current) => current.filter((item) => item.toLocaleLowerCase() !== key))
    setKeywords((current) => current.filter((item) => item.toLocaleLowerCase() !== key))
  }

  const focusBestReviewLane = (candidates) => setTab(bestDiscoveryReviewLane(leads, candidates))

  const runCampaign = async (event, force = false) => {
    event?.preventDefault?.()
    if (!canSearch) {
      setStatus('error')
      setMessage(provider === 'google-places' ? 'Connect a restricted Google Maps browser key in Settings → Lead search.' : 'Choose a connected discovery provider in Settings.')
      return
    }
    if (!keywords.length || !areas.length) {
      setStatus('error')
      setMessage('Choose at least one business type and enter one area.')
      return
    }

    const cacheKey = discoveryCacheKey({ provider, keywords, areas, targetCount })
    const cached = cache[cacheKey]
    if (!force && Array.isArray(cached?.results) && Date.now() - Number(cached.storedAt || 0) < DISCOVERY_CACHE_TTL) {
      patchCampaign({
        results: cached.results,
        selected: lastSearchKey === cacheKey ? selected.filter((id) => cached.results.some((lead) => lead.id === id)) : [],
        tab: bestDiscoveryReviewLane(leads, cached.results),
        status: 'cached',
        message: `Loaded ${cached.results.length} cached candidates. Refresh only when you want a new provider lookup.`,
        lastSearchKey: cacheKey,
        lastSearchAt: new Date(cached.storedAt).toISOString(),
      })
      return
    }

    const previousResults = results
    setStatus('loading')
    setSelected([])
    let next = []
    try {
      let failures = 0
      if (provider === 'google-places') {
        for (let index = 0; index < plan.jobs.length && next.length < plan.targetCount; index += 1) {
          if (!mounted.current) return
          const job = plan.jobs[index]
          setMessage(`Searching ${job.keyword} in ${job.area} · ${index + 1}/${plan.jobs.length} · ${next.length}/${plan.targetCount} candidates`)
          try {
            const places = await searchGooglePlacesText(googleApiKey, job.textQuery, Math.min(20, plan.targetCount - next.length))
            if (!mounted.current) return
            next = mergeDiscoveryCandidates([...next, ...places.map((place) => leadFromGooglePlace(place, job.textQuery, territory))]).slice(0, plan.targetCount)
            setResults(next)
          } catch (error) {
            if (!mounted.current) return
            failures += 1
            if (!next.length && index === plan.jobs.length - 1) throw error
          }
        }
      } else {
        const job = plan.jobs[0]
        setMessage(`Running one policy-safe public lookup for ${job.keyword} in ${job.area}…`)
        const response = await fetch(buildDiscoveryUrl(endpoint, job.keyword, job.area), { headers: { Accept: 'application/json' } })
        if (!mounted.current) return
        if (!response.ok) throw new Error(`Search service returned ${response.status}`)
        const payload = await response.json()
        if (!mounted.current) return
        next = mergeDiscoveryCandidates(payload.map((item) => leadFromNominatim(item, `${job.keyword}, ${job.area}`, territory)))
      }

      const storedAt = Date.now()
      const researchCount = next.filter((lead) => !discoveryCompleteness(lead).callable).length
      patchCampaign({
        results: next,
        tab: bestDiscoveryReviewLane(leads, next),
        status: 'done',
        message: next.length
          ? `${next.length} candidates found${failures ? ` with ${failures} partial search failure${failures === 1 ? '' : 's'}` : ''}. ${researchCount} need contact research before calling.`
          : 'No close matches found. Try more specific areas or another business type.',
        lastSearchKey: cacheKey,
        lastSearchAt: new Date(storedAt).toISOString(),
      })
      setCache((current) => pruneDiscoveryCache({ ...current, [cacheKey]: { storedAt, results: next } }, storedAt))
    } catch (error) {
      if (!mounted.current) return
      if (!next.length && previousResults.length) setResults(previousResults)
      setStatus('error')
      setMessage(`${error.message || 'Search failed'} ${previousResults.length ? 'Your previous saved results are still available.' : 'No partial data was discarded; retry or change provider settings.'}`)
    }
  }

  const testGoogleConnection = async () => {
    if (!googleApiKey) {
      setStatus('error')
      setMessage('Paste a Google Maps browser key before testing the connection.')
      return
    }
    setStatus('loading')
    setMessage('Testing Google Places authorization with one small Philippine business search…')
    try {
      const testQuery = plan.jobs[0]?.textQuery || 'batching plant in Bulacan, Philippines'
      const places = await searchGooglePlacesText(googleApiKey, testQuery, 1)
      if (!mounted.current) return
      setStatus('done')
      setMessage(`Google Places connection works. The test request completed${places.length ? ' and returned a candidate' : ' with zero matches; try a more specific city or business type'}.`)
    } catch (error) {
      if (!mounted.current) return
      setStatus('error')
      setMessage(`${error.message || 'Google Places connection test failed'} Your key was not displayed or transmitted anywhere except Google Maps Platform.`)
    }
  }

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const importOptionsFor = (incoming, extras = {}) => ({
    ...extras,
    visibility,
    ownerId: visibility === 'private' ? operatorId : '',
    ownerName: visibility === 'private' ? operatorName : '',
    discoveryReward: discoveryImportRewardMetadata(leads, incoming),
  })
  const importSelected = (pickForQueue) => {
    const incoming = pickForQueue ? selectedCallable : selectedImportable
    if (!incoming.length) return
    onAddDiscoveredLeads(incoming, importOptionsFor(incoming, { pickForQueue }))
    setSelected([])
    setMessage(`${incoming.length} approved lead${incoming.length === 1 ? '' : 's'} added as ${visibility === 'private' ? 'personal' : 'team-visible'}${pickForQueue ? ' and sent through roster eligibility' : ''}.`)
  }
  const addOne = (lead, mode) => {
    onAddDiscoveredLeads([lead], importOptionsFor([lead], { pickForQueue: mode === 'pick', forceResearch: mode === 'research' }))
    setSelected((current) => current.filter((id) => id !== lead.id))
  }

  return (
    <section className="secondary-view panel lead-finder-view finder-v008" hidden={hidden}>
      <div className="view-heading">
        <div><span className="section-label">Prospecting engine</span><h1>Lead Finder campaigns</h1><p>Search multiple business types and territories, review the contact trail, dedupe, then choose who receives each lead.</p></div>
        <strong>{results.length}</strong>
      </div>
      <div className="finder-provider-strip">
        <div><Sparkles size={18} /><span><strong>{providerName}</strong><small>{provider === 'google-places' ? 'Multi-area business discovery · may incur Google API charges' : 'Single user-triggered lookup · not a bulk lead source'}</small></span></div>
        <label><span>Provider</span><select value={provider} onChange={(event) => onProviderChange?.(event.target.value)}><option value="google-places">Google Places</option><option value="nominatim">OSM manual fallback</option></select></label>
        {provider === 'google-places' && !googleApiKey ? <label className="finder-key-connect"><span>Restricted browser key</span><input type="password" autoComplete="off" placeholder="Paste key to enable campaigns" onChange={(event) => onGoogleApiKeyChange?.(event.target.value.trim())} /></label> : null}
        {provider === 'google-places' && googleApiKey ? <button type="button" onClick={testGoogleConnection} disabled={status === 'loading'}><ShieldCheck size={14} />Test connection</button> : null}
        <button type="button" onClick={onOpenSettings}>{canSearch ? 'Provider settings' : <><LockKeyhole size={14} />Connect provider</>}</button>
      </div>
      <form className="lead-campaign-form" onSubmit={runCampaign}>
        <fieldset>
          <legend>1 · Businesses or suppliers to find</legend>
          {KEYWORD_GROUPS.map((group) => <div className="finder-keyword-group" key={group.label}><small>{group.label}</small><div className="finder-keyword-grid">{group.terms.map((keyword) => <button type="button" key={keyword} className={keywords.includes(keyword) ? 'active' : ''} onClick={() => toggleKeyword(keyword)}>{keywords.includes(keyword) ? <Check size={13} /> : <Plus size={13} />}{keyword}</button>)}</div></div>)}
          {customKeywords.length ? <div className="finder-custom-keywords"><small>Custom terms</small><div>{customKeywords.map((term) => <span className={keywords.includes(term) ? 'active' : ''} key={term}><button type="button" onClick={() => toggleKeyword(term)}>{keywords.includes(term) ? <Check size={12} /> : <Plus size={12} />}{term}</button><button type="button" onClick={() => removeCustomKeyword(term)} aria-label={`Remove ${term}`}><X size={12} /></button></span>)}</div></div> : null}
          <div className="finder-custom-add"><Search size={14} /><input value={customKeywordDraft} maxLength={80} onChange={(event) => setField('customKeywordDraft', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomKeyword() } }} placeholder="Custom target, e.g. precast supplier or hardware store" /><button type="button" onClick={addCustomKeyword}><Plus size={13} />Add term</button></div>
        </fieldset>
        <label className="finder-area-field"><span>2 · Cities / provinces <small>one per line</small></span><div><MapPin size={16} /><textarea value={areasText} onChange={(event) => setAreasText(event.target.value)} placeholder={'Bulacan\nCavite\nMetro Manila'} /></div></label>
        <div className="finder-campaign-options">
          <label><span>Target candidates</span><select value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))}><option value="20">20</option><option value="40">40</option><option value="60">60</option><option value="100">100</option></select></label>
          <label><span>When approved</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="team">Share with company team</option><option value="private">Private to me</option></select></label>
          <div><span>Campaign plan</span><strong>{provider === 'google-places' ? plan.jobs.length : Math.min(1, plan.jobs.length)} search{(provider === 'google-places' ? plan.jobs.length : Math.min(1, plan.jobs.length)) === 1 ? '' : 'es'}</strong><small>{keywords.length} types · {areas.length} areas · first 16 combinations</small></div>
        </div>
        <button className="finder-run" type="submit" disabled={status === 'loading' || !canSearch}>{status === 'loading' ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}{status === 'loading' ? 'Building campaign…' : canSearch ? 'Find leads' : 'Connect provider first'}</button>
      </form>
      <div className={`finder-message ${status}`}><Globe2 size={16} /><span>{message}{lastSearchAt ? <small>Saved automatically · {dateLabel(lastSearchAt)}</small> : null}</span>{lastSearchAt ? <button type="button" onClick={(event) => runCampaign(event, true)} disabled={status === 'loading'}><RefreshCcw size={13} />Refresh</button> : null}</div>
      <div className="finder-review-tabs">{[['new', 'Callable', groups.new.length], ['research', 'Needs research', groups.research.length], ['duplicates', 'Already in CRM', groups.duplicates.length]].map(([id, label, count]) => <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{label}</span><strong>{count}</strong></button>)}</div>
      <div className="finder-toolbar"><span>{selectedImportable.length} reviewed · {selectedCallable.length} callable</span><div><button type="button" disabled={!selectedImportable.length} onClick={() => importSelected(false)}><Plus size={14} />Add selected</button><button type="button" disabled={!selectedCallable.length} onClick={() => importSelected(true)}><Check size={14} />Add callable + pick</button></div></div>
      <div className="finder-results">
        {visible.map(({ lead, duplicate, links, completeness }) => <article key={lead.id} className={duplicate ? 'duplicate' : selected.includes(lead.id) ? 'selected' : ''}>
          <button type="button" className="finder-select" disabled={Boolean(duplicate)} onClick={() => toggle(lead.id)} aria-label={`${selected.includes(lead.id) ? 'Unselect' : 'Select'} ${lead.company}`}>{selected.includes(lead.id) ? <Check size={14} /> : null}</button>
          <div className="finder-result-main"><span>{lead.region} · {lead.sourceBusinessStatus || 'VERIFY STATUS'}</span><h3>{lead.company}</h3><p>{lead.location || 'Address not published'}</p><small>{lead.phone || 'No published phone'} · {lead.sourceWebsite ? 'Website found' : 'No website found'} · {lead.email || 'Email requires research'}</small></div>
          <div className="finder-source"><i className={completeness.callable ? 'callable' : ''}>{duplicate ? `Matches ${duplicate.company}` : `${completeness.score}% · ${completeness.label}`}</i>{links.source ? <a href={links.source} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a> : null}</div>
          <div className="finder-result-actions">
            <button type="button" disabled={Boolean(duplicate)} onClick={() => addOne(lead, 'crm')}><Plus size={13} />Add to CRM</button>
            <button type="button" disabled={Boolean(duplicate) || !completeness.callable} onClick={() => addOne(lead, 'pick')}><Check size={13} />Add + Pick</button>
            <button type="button" disabled={Boolean(duplicate)} className={!completeness.callable ? 'recommended' : ''} onClick={() => addOne(lead, 'research')}><SearchCheck size={13} />Research</button>
            <a href={links.google} target="_blank" rel="noreferrer"><Search size={13} />Google</a><a href={links.maps} target="_blank" rel="noreferrer"><Map size={13} />Maps</a><a href={links.facebook} target="_blank" rel="noreferrer"><MessageCircle size={13} />Facebook</a>
          </div>
        </article>)}
        {!visible.length && status !== 'loading' ? <div className="large-empty"><Search size={30} /><h2>{results.length ? 'No candidates in this review lane.' : 'Build your next territory list.'}</h2><p>{results.length ? 'Choose another review tab.' : 'Choose business types and areas. Nothing enters the CRM until you approve it.'}</p></div> : null}
      </div>
      <footer className="finder-attribution"><AlertTriangle size={14} /><span>{provider === 'google-places' ? 'Google Places does not publish business email. Verify contacts and consent before outreach.' : <>Manual, low-volume discovery only. Search data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, ODbL.</>}</span><span className="finder-scope">{visibility === 'private' ? <LockKeyhole size={13} /> : <Users size={13} />}{visibility === 'private' ? 'Personal import' : 'Team import'}</span></footer>
    </section>
  )
}

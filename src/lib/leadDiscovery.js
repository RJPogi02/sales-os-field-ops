import { normalizeLead, phoneKey } from './leadModel.js'

const SOUTH_MARKERS = ['cavite', 'laguna', 'batangas', 'rizal', 'quezon', 'lucena', 'calabarzon', 'mimaropa', 'bicol']
const NCR_MARKERS = ['metro manila', 'national capital region', 'manila', 'quezon city', 'taguig', 'makati', 'pasig', 'paranaque', 'parañaque', 'caloocan', 'navotas', 'malabon', 'muntinlupa', 'las pinas', 'las piñas']

const first = (...values) => values.find((value) => String(value || '').trim()) || ''
const cleanIdentity = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const DISCOVERY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const normalizedDomain = (value = '') => {
  try { return new URL(/^https?:/i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}

function coordinateValue(value) {
  if (typeof value === 'function') return Number(value())
  return Number(value)
}

export function territoryForDiscoveredLead(result, fallback = 'NORTH') {
  const addressText = `${result.display_name || ''} ${Object.values(result.address || {}).join(' ')}`.toLowerCase()
  if (NCR_MARKERS.some((marker) => addressText.includes(marker))) return 'NCR'
  if (SOUTH_MARKERS.some((marker) => addressText.includes(marker))) return 'SOUTH'
  return fallback === 'ALL' ? 'NORTH' : fallback
}

export function leadFromNominatim(result, query, fallbackTerritory = 'NORTH') {
  const extras = result.extratags || {}
  const names = result.namedetails || {}
  const osmType = result.osm_type === 'node' ? 'node' : result.osm_type === 'relation' ? 'relation' : 'way'
  const sourceUrl = result.osm_id ? `https://www.openstreetmap.org/${osmType}/${result.osm_id}` : 'https://www.openstreetmap.org'
  const company = first(result.name, names.name, names['name:en'], String(result.display_name || '').split(',')[0], 'Discovered business')
  const phone = first(extras['contact:phone'], extras.phone, extras['contact:mobile'], extras.mobile)
  const email = first(extras['contact:email'], extras.email)
  const website = first(extras['contact:website'], extras.website, extras.url)
  return normalizeLead({
    id: `osm-${result.osm_type || 'place'}-${result.osm_id || result.place_id}`,
    company,
    region: territoryForDiscoveredLead(result, fallbackTerritory),
    location: result.display_name || '',
    phone,
    email,
    status: 'New Lead',
    priority: 'Medium',
    leadSource: 'OpenStreetMap Lead Finder',
    sourceName: 'OpenStreetMap / Nominatim',
    sourceUrl,
    sourceFetchedAt: new Date().toISOString(),
    sourceQuery: query,
    importedOnline: true,
    researchUrl: website || sourceUrl,
    researchStatus: phone ? '' : 'Needs Research',
    researchNotes: phone ? 'Review online source before calling.' : 'No phone was published in this result. Research contact details before calling.',
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    lastResult: 'Discovered online',
    notes: `Lead discovered from OpenStreetMap. Verify company details, phone, email, and operating status before outreach. Source: ${sourceUrl}`,
  })
}

export function leadFromGooglePlace(place, query, fallbackTerritory = 'NORTH') {
  const company = typeof place.displayName === 'string' ? place.displayName : first(place.displayName?.text, place.name, 'Discovered business')
  const location = first(place.formattedAddress, place.formatted_address)
  const phone = first(place.nationalPhoneNumber, place.internationalPhoneNumber, place.formatted_phone_number)
  const website = first(place.websiteURI, place.websiteUri, place.website)
  const sourceUrl = first(place.googleMapsURI, place.googleMapsUri, place.url, website, 'https://www.google.com/maps')
  const placeId = first(place.id, place.place_id, cleanIdentity(`${company}-${location}`))
  const lat = coordinateValue(place.location?.lat)
  const lng = coordinateValue(place.location?.lng)
  const businessStatus = first(place.businessStatus, place.business_status, 'UNKNOWN')
  const closed = String(businessStatus).toUpperCase().includes('CLOSED')
  return normalizeLead({
    id: `google-${placeId}`,
    company,
    region: territoryForDiscoveredLead({ display_name: location, address: {} }, fallbackTerritory),
    location,
    phone,
    email: '',
    status: closed ? 'Lost' : 'New Lead',
    priority: 'Medium',
    leadSource: 'Google Places Lead Finder',
    sourceName: 'Google Places',
    sourceUrl,
    sourceFetchedAt: new Date().toISOString(),
    sourceQuery: query,
    sourcePlaceId: placeId,
    sourceWebsite: website,
    sourceBusinessStatus: businessStatus,
    importedOnline: true,
    researchUrl: website || sourceUrl,
    researchStatus: phone && !closed ? '' : 'Needs Research',
    researchNotes: closed ? 'Provider marks this business closed. Keep it out of outreach unless independent research proves it reopened.' : phone ? 'Google Places contact found. Verify the number and operating status before outreach.' : 'Google Places does not list a phone. Research a callable contact before adding to a roster.',
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    lastResult: 'Discovered online',
    notes: `Lead discovered with Google Places. Verify company details and contact authority before outreach. Source: ${sourceUrl}`,
  })
}

export function discoveryCompleteness(lead = {}) {
  const fields = [
    ['Company', Boolean(lead.company)], ['Address', Boolean(lead.location)], ['Phone', Boolean(lead.phone)],
    ['Website', Boolean(lead.sourceWebsite || (lead.researchUrl && lead.researchUrl !== lead.sourceUrl))],
  ]
  const score = fields.reduce((sum, [, ready], index) => sum + (ready ? [25, 25, 35, 15][index] : 0), 0)
  const callable = Boolean(lead.phone) && lead.researchStatus !== 'Needs Research' && !['Lost', 'Not Interested', 'Invalid Contact'].includes(lead.status) && !String(lead.sourceBusinessStatus || '').toUpperCase().includes('CLOSED')
  return { score, callable, fields, label: callable && score >= 85 ? 'Strong contact trail' : callable ? 'Callable, verify first' : 'Research required' }
}

export function buildDiscoveryPlan({ keywords = [], areas = [], targetCount = 40 } = {}) {
  const seen = new Set()
  const jobs = []
  keywords.map((value) => String(value || '').trim()).filter(Boolean).forEach((keyword) => {
    areas.map((value) => String(value || '').trim()).filter(Boolean).forEach((area) => {
      const key = `${keyword.toLowerCase()}|${area.toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      jobs.push({ key, keyword, area, textQuery: `${keyword} in ${area}, Philippines` })
    })
  })
  return { jobs: jobs.slice(0, 16), targetCount: Math.min(100, Math.max(5, Number(targetCount) || 40)) }
}

export function discoveryCacheKey({ provider = '', keywords = [], areas = [], targetCount = 40 } = {}) {
  const normalize = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim().toLocaleLowerCase()).filter(Boolean))].sort()
  return `${String(provider || '').trim().toLocaleLowerCase()}|${normalize(keywords).join(',')}|${normalize(areas).join(',')}|${Math.min(100, Math.max(5, Number(targetCount) || 40))}`
}

export function pruneDiscoveryCache(cache = {}, now = Date.now(), maxEntries = 12) {
  return Object.fromEntries(Object.entries(cache || {})
    .filter(([, entry]) => Array.isArray(entry?.results) && now - Number(entry.storedAt || 0) < DISCOVERY_CACHE_TTL)
    .sort(([, left], [, right]) => Number(right.storedAt || 0) - Number(left.storedAt || 0))
    .slice(0, Math.max(1, Math.min(24, Number(maxEntries) || 12))))
}

function sameBranch(a, b) {
  const left = cleanIdentity(a.location)
  const right = cleanIdentity(b.location)
  if (!left || !right) return false
  return left.includes(right.slice(0, 18)) || right.includes(left.slice(0, 18))
}

export function candidateFingerprint(candidate = {}) {
  const sourceId = candidate.sourcePlaceId || String(candidate.id || '').replace(/^google-|^osm-[^-]+-/, '')
  if (candidate.sourceName && sourceId) return `${candidate.sourceName.toLowerCase()}|${sourceId}`
  const phone = phoneKey(candidate.phone)
  if (phone) return `phone|${phone}`
  const domain = normalizedDomain(candidate.sourceWebsite || candidate.researchUrl)
  if (domain) return `domain|${domain}|${cleanIdentity(candidate.location).slice(0, 24)}`
  return `branch|${cleanIdentity(candidate.company)}|${cleanIdentity(candidate.location).slice(0, 32)}`
}

export function mergeDiscoveryCandidates(candidates = []) {
  const merged = new Map()
  candidates.forEach((candidate) => {
    const key = candidateFingerprint(candidate)
    const previous = merged.get(key)
    if (!previous) { merged.set(key, candidate); return }
    const better = discoveryCompleteness(candidate).score > discoveryCompleteness(previous).score ? candidate : previous
    const other = better === candidate ? previous : candidate
    merged.set(key, {
      ...other, ...better,
      sourceQueries: [...new Set([...(previous.sourceQueries || [previous.sourceQuery]), ...(candidate.sourceQueries || [candidate.sourceQuery])].filter(Boolean))],
    })
  })
  return [...merged.values()]
}

export function discoveredLeadDuplicate(existingLeads, candidate) {
  const phone = phoneKey(candidate.phone)
  const email = String(candidate.email || '').trim().toLowerCase()
  const company = cleanIdentity(candidate.company)
  const domain = normalizedDomain(candidate.sourceWebsite || candidate.researchUrl)
  return existingLeads.find((lead) => {
    if (lead.id === candidate.id) return true
    if (candidate.sourcePlaceId && candidate.sourcePlaceId === lead.sourcePlaceId) return true
    if (phone && phone === phoneKey(lead.phone)) return true
    if (email && email === String(lead.email || '').trim().toLowerCase()) return true
    const leadDomain = normalizedDomain(lead.sourceWebsite || lead.researchUrl)
    if (domain && domain === leadDomain && sameBranch(candidate, lead)) return true
    return company && company === cleanIdentity(lead.company) && sameBranch(candidate, lead)
  })
}

export function bestDiscoveryReviewLane(existingLeads = [], candidates = []) {
  const review = candidates.map((lead) => ({
    duplicate: discoveredLeadDuplicate(existingLeads, lead),
    callable: discoveryCompleteness(lead).callable,
  }))
  if (review.some((item) => !item.duplicate && item.callable)) return 'new'
  if (review.some((item) => !item.duplicate && !item.callable)) return 'research'
  if (review.some((item) => item.duplicate)) return 'duplicates'
  return 'new'
}

export function discoveryImportRewardMetadata(existingLeads = [], incoming = []) {
  const unique = []
  ;(Array.isArray(incoming) ? incoming : []).forEach((lead) => {
    if (!lead || discoveredLeadDuplicate([...existingLeads, ...unique], lead)) return
    unique.push(lead)
  })
  const rewardable = unique.slice(0, 10)
  const rewardKeys = rewardable.map(candidateFingerprint)
  return {
    version: 1,
    kind: 'lead-discovery-import',
    importedUniqueCount: unique.length,
    rewardableCount: rewardable.length,
    rewardKeys,
    suggestedXp: rewardable.length * 5,
    xpPerUniqueLead: 5,
    maxSuggestedXp: 50,
    dedupeScope: 'career',
  }
}

export function buildDiscoveryUrl(endpoint, keyword, area) {
  const url = new URL(endpoint)
  url.search = new URLSearchParams({
    q: `${keyword}, ${area}, Philippines`,
    format: 'jsonv2',
    countrycodes: 'ph',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    dedupe: '1',
    limit: '12',
  }).toString()
  return url.toString()
}

export function leadResearchLinks(lead = {}) {
  const company = String(lead.company || '').trim()
  const place = String(lead.location || '').trim()
  const query = encodeURIComponent([company, place].filter(Boolean).join(' '))
  return {
    google: `https://www.google.com/search?q=${query}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${query}`,
    facebook: `https://www.facebook.com/search/top?q=${query}`,
    source: lead.sourceUrl || lead.researchUrl || '',
  }
}

import { normalizeLead, phoneKey } from './leadModel.js'

const SOUTH_MARKERS = ['cavite', 'laguna', 'batangas', 'rizal', 'quezon', 'lucena', 'calabarzon', 'mimaropa', 'bicol']
const NCR_MARKERS = ['metro manila', 'national capital region', 'manila', 'quezon city', 'taguig', 'makati', 'pasig', 'paranaque', 'parañaque', 'caloocan', 'navotas', 'malabon', 'muntinlupa', 'las pinas', 'las piñas']

const first = (...values) => values.find((value) => String(value || '').trim()) || ''
const cleanIdentity = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

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

export function discoveredLeadDuplicate(existingLeads, candidate) {
  const phone = phoneKey(candidate.phone)
  const email = String(candidate.email || '').trim().toLowerCase()
  const company = cleanIdentity(candidate.company)
  return existingLeads.find((lead) => {
    if (lead.id === candidate.id) return true
    if (phone && phone === phoneKey(lead.phone)) return true
    if (email && email === String(lead.email || '').trim().toLowerCase()) return true
    return company && company === cleanIdentity(lead.company)
  })
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

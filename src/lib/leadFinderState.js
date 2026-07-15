export const LEAD_FINDER_STATE_VERSION = 1
export const LEAD_FINDER_STATE_KEY = 'sales-os-lead-finder-campaign-v1'

export const LEAD_FINDER_DEFAULT_MESSAGE = 'Build a reviewed prospect list in a few clicks. Nothing enters the CRM until you approve it.'

const AREA_DEFAULTS = {
  ALL: 'Bulacan\nCavite\nMetro Manila',
  NCR: 'Metro Manila',
  NORTH: 'Bulacan\nPampanga\nNueva Ecija',
  SOUTH: 'Cavite\nLaguna\nBatangas',
}

const DEFAULT_KEYWORDS = ['batching plant', 'ready mix concrete', 'aggregate supplier']
const VALID_TABS = new Set(['new', 'research', 'duplicates'])
const VALID_STATUSES = new Set(['idle', 'cached', 'done', 'error'])
const VALID_TARGETS = new Set([20, 40, 60, 100])

export function normalizeDiscoveryTerm(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80)
}

function uniqueTerms(values, limit = 16) {
  const seen = new Set()
  const next = []
  ;(Array.isArray(values) ? values : []).forEach((value) => {
    const term = normalizeDiscoveryTerm(value)
    const key = term.toLocaleLowerCase()
    if (!term || seen.has(key) || next.length >= limit) return
    seen.add(key)
    next.push(term)
  })
  return next
}

export function createLeadFinderState(territory = 'ALL') {
  return {
    version: LEAD_FINDER_STATE_VERSION,
    keywords: [...DEFAULT_KEYWORDS],
    customKeywords: [],
    customKeywordDraft: '',
    areasText: AREA_DEFAULTS[territory] || AREA_DEFAULTS.ALL,
    targetCount: 40,
    visibility: 'team',
    results: [],
    selected: [],
    status: 'idle',
    message: LEAD_FINDER_DEFAULT_MESSAGE,
    tab: 'new',
    lastSearchKey: '',
    lastSearchAt: '',
  }
}

export function reviveLeadFinderState(value, territory = 'ALL') {
  const fallback = createLeadFinderState(territory)
  if (!value || typeof value !== 'object') return fallback

  const results = Array.isArray(value.results) ? value.results.filter((item) => item && typeof item === 'object').slice(0, 100) : []
  const resultIds = new Set(results.map((item) => String(item.id || '')).filter(Boolean))
  const selected = [...new Set((Array.isArray(value.selected) ? value.selected : []).map(String))].filter((id) => resultIds.has(id))
  const interrupted = value.status === 'loading'
  const restoredStatus = interrupted ? (results.length ? 'cached' : 'idle') : VALID_STATUSES.has(value.status) ? value.status : fallback.status
  const restoredMessage = interrupted
    ? results.length
      ? `Restored ${results.length} saved candidates. Use Refresh only when you want a new provider lookup.`
      : 'The previous lookup stopped when Lead Finder closed. Start it again when ready.'
    : String(value.message || fallback.message).slice(0, 600)

  return {
    ...fallback,
    version: LEAD_FINDER_STATE_VERSION,
    keywords: uniqueTerms(value.keywords, 16),
    customKeywords: uniqueTerms(value.customKeywords, 12),
    customKeywordDraft: normalizeDiscoveryTerm(value.customKeywordDraft),
    areasText: String(value.areasText || fallback.areasText).slice(0, 500),
    targetCount: VALID_TARGETS.has(Number(value.targetCount)) ? Number(value.targetCount) : fallback.targetCount,
    visibility: value.visibility === 'private' ? 'private' : 'team',
    results,
    selected,
    status: restoredStatus,
    message: restoredMessage,
    tab: VALID_TABS.has(value.tab) ? value.tab : fallback.tab,
    lastSearchKey: String(value.lastSearchKey || '').slice(0, 500),
    lastSearchAt: String(value.lastSearchAt || '').slice(0, 40),
  }
}


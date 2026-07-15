import test from 'node:test'
import assert from 'node:assert/strict'
import { csvTextForLeads, csvToLeadRows, mergeCrmLeads } from '../src/lib/csv.js'
import { bestDiscoveryReviewLane, buildDiscoveryPlan, buildDiscoveryUrl, discoveryCacheKey, discoveryCompleteness, discoveryImportRewardMetadata, DISCOVERY_CACHE_TTL, discoveredLeadDuplicate, leadFromGooglePlace, leadFromNominatim, leadResearchLinks, mergeDiscoveryCandidates, pruneDiscoveryCache } from '../src/lib/leadDiscovery.js'
import { createLeadFinderState, normalizeDiscoveryTerm, reviveLeadFinderState } from '../src/lib/leadFinderState.js'
import { buildGooglePlacesSearchRequest } from '../src/lib/googlePlaces.js'
import {
  autoPickScore, buildBatchHandoffMessage, callResultXp, classForXp, commissionEstimate, dailyGoalForProfile, followUpLeads, leadQueueEligibility, missionGoalsForCallTarget, normalizeLead,
  phoneCountsForLeads, phoneQualityForLead, profileOpportunityLeads, reactivateLeadPatch, retryPatchForLead,
} from '../src/lib/leadModel.js'

test('strict territory scoring never fills from another territory', () => {
  const lead = normalizeLead({ id: 'north-1', company: 'North Plant', region: 'NORTH', phone: '09171234567' })
  assert.equal(autoPickScore(lead, 'SOUTH'), -1000)
  assert.ok(autoPickScore(lead, 'NORTH') > 0)
})

test('phone quality detects duplicates and invalid research contacts', () => {
  const leads = [normalizeLead({ id: '1', phone: '0917 123 4567' }), normalizeLead({ id: '2', phone: '+63 917 123 4567' })]
  const counts = phoneCountsForLeads(leads)
  assert.equal(phoneQualityForLead(leads[0], counts).label, 'Check')
  assert.equal(phoneQualityForLead({ ...leads[0], researchStatus: 'Needs Research' }, counts).label, 'Invalid')
})

test('No Answer progresses from Retry Later to Retry Tomorrow at 9 AM', () => {
  const now = new Date(2026, 6, 3, 14, 15, 0)
  const first = retryPatchForLead({ answered: false, retryDate: '', retryCountToday: 0 }, '2026-07-03', now)
  assert.equal(first.retryStatus, 'Retry Later')
  assert.equal(first.retryCountToday, 1)
  const second = retryPatchForLead({ ...first }, '2026-07-03', now)
  assert.equal(second.retryStatus, 'Retry Tomorrow')
  assert.equal(second.retryCountToday, 2)
  assert.match(second.nextRetryTime, /T09:00$/)
})

test('Profile Queue and Follow-ups are separate concerns', () => {
  const leads = [
    normalizeLead({ id: 'open-profile', answered: true, profileSent: false }),
    normalizeLead({ id: 'sent-followup', answered: true, profileSent: true, nextFollowUp: '2026-07-04' }),
  ]
  assert.deepEqual(profileOpportunityLeads(leads).map((lead) => lead.id), ['open-profile'])
  assert.deepEqual(followUpLeads(leads).map((lead) => lead.id), ['sent-followup'])
})

test('Research reactivation clears every retry field and preserves research notes by omission', () => {
  assert.deepEqual(reactivateLeadPatch(), {
    researchStatus: 'Resolved', status: 'New Lead', lastResult: 'Contact repaired', retryStatus: '', nextRetryTime: '', retryCountToday: 0, retryDate: '',
  })
  assert.equal('researchNotes' in reactivateLeadPatch(), false)
})

test('legacy pricing approver fields revive without losing existing v0.082 history', () => {
  const revived = normalizeLead({
    id: 'legacy-pricing', company: 'Legacy Plant', phone: '09171234567',
    pricingStage: 'Submitted to Sir Luke', submittedToSirLukeAt: '2026-07-10T09:15:00+08:00', sirLukeNotes: 'Waiting for delivered reference price.',
  })
  assert.equal(revived.pricingStage, 'Submitted to pricing approver')
  assert.equal(revived.submittedToApproverAt, '2026-07-10T09:15:00+08:00')
  assert.equal(revived.approverNotes, 'Waiting for delivered reference price.')
})

test('CSV import parses quoted data, merges matches, and export starts with UTF-8 BOM', () => {
  const rows = csvToLeadRows('Company,Phone,Email,Notes\n"Acme, Inc.",09171234567,sales@acme.test,"Warm, call Friday"')
  assert.equal(rows[0].company, 'Acme, Inc.')
  const current = [normalizeLead({ id: 'existing', company: 'Acme Inc', phone: '09171234567', status: 'Contacted' })]
  const merged = mergeCrmLeads(current, rows, 'merge')
  assert.equal(merged.added, 0)
  assert.equal(merged.updated, 1)
  assert.equal(merged.leads[0].email, 'sales@acme.test')
  assert.equal(csvTextForLeads(['company'], merged.leads).charCodeAt(0), 0xFEFF)
})

test('Lead Finder builds a single constrained PH query and maps source attribution', () => {
  const url = new URL(buildDiscoveryUrl('https://nominatim.openstreetmap.org/search', 'batching plant', 'Bulacan'))
  assert.equal(url.searchParams.get('countrycodes'), 'ph')
  assert.equal(url.searchParams.get('limit'), '12')
  const lead = leadFromNominatim({ osm_type: 'node', osm_id: 7, name: 'Sample Ready Mix', lat: '14.8', lon: '121.0', display_name: 'Sample Ready Mix, Bulacan, Philippines', extratags: { phone: '09180000000' } }, 'batching plant, Bulacan', 'NORTH')
  assert.equal(lead.leadSource, 'OpenStreetMap Lead Finder')
  assert.match(lead.sourceUrl, /openstreetmap\.org\/node\/7/)
  assert.equal(discoveredLeadDuplicate([lead], lead)?.id, lead.id)
})

test('Commission and Sir Luke batch helpers produce useful numbers and packets', () => {
  const lead = normalizeLead({ id: 'quote-1', company: 'Quote Plant', inPricingQueue: true, opportunityValue: '500000', commissionRate: '2', materialNeeded: '3/4', deliveryLocation: 'Bulacan' })
  assert.equal(commissionEstimate(lead), 10000)
  assert.match(buildBatchHandoffMessage([lead]), /Quote Plant/)
})

test('v0.07 class tree promotes operators through the four companion tiers', () => {
  assert.equal(classForXp(0).title, 'Prototype Scout')
  assert.equal(classForXp(750).title, 'Business Development Officer')
  assert.equal(classForXp(3000).title, 'Growth Engineer')
  assert.equal(classForXp(5000).title, 'Revenue Architect')
})

test('Lead research links are explicit user-triggered verification searches', () => {
  const links = leadResearchLinks({ company: 'Sample Ready Mix', location: 'Bulacan', sourceUrl: 'https://www.openstreetmap.org/node/7' })
  assert.match(links.google, /google\.com\/search/)
  assert.match(links.maps, /google\.com\/maps\/search/)
  assert.match(links.facebook, /facebook\.com\/search/)
  assert.equal(links.source, 'https://www.openstreetmap.org/node/7')
})

test('Research workflow preserves staged contact data until verification', () => {
  const lead = normalizeLead({ company: 'Research Plant', researchStatus: 'Needs Research', researchPhone: '09170000000', researchEmail: 'buyer@example.test' })
  assert.equal(lead.researchPhone, '09170000000')
  assert.equal(lead.researchEmail, 'buyer@example.test')
  assert.equal(lead.verificationStatus, 'Needs Research')
})

test('personalized mission goals clamp safely and preserve the original 20-call ratios', () => {
  assert.equal(dailyGoalForProfile({ dailyCallGoal: 0 }), 1)
  assert.equal(dailyGoalForProfile({ dailyCallGoal: 99 }), 50)
  assert.deepEqual(missionGoalsForCallTarget(20), { calls: 20, selected: 20, answered: 5, profiles: 5, warm: 3, quotes: 2, pricing: 2 })
  assert.deepEqual(missionGoalsForCallTarget(5), { calls: 5, selected: 5, answered: 2, profiles: 2, warm: 1, quotes: 1, pricing: 1 })
})

test('one queue eligibility rule excludes completed, conversion, research, retry, private and teammate-claimed leads', () => {
  const base = normalizeLead({ id: 'ready', company: 'Ready Plant', phone: '09171234567', region: 'NORTH', status: 'New Lead' })
  const context = { territory: 'NORTH', operatorId: 'rj', today: '2026-07-14', now: new Date('2026-07-14T09:00:00+08:00') }
  assert.equal(leadQueueEligibility(base, context).eligible, true)
  assert.equal(leadQueueEligibility({ ...base, lastContacted: '2026-07-14' }, context).reason, 'Already handled today')
  assert.equal(leadQueueEligibility({ ...base, status: 'Contacted' }, context).eligible, false)
  assert.equal(
    leadQueueEligibility({ ...base, researchStatus: 'Needs Research', lastContacted: '2026-07-14' }, context).reason,
    'Contact needs repair',
  )
  assert.equal(leadQueueEligibility({ ...base, retryStatus: 'Retry Tomorrow' }, context).eligible, false)
  assert.equal(leadQueueEligibility({ ...base, visibility: 'private', ownerId: 'coworker' }, context).eligible, false)
  assert.match(leadQueueEligibility({ ...base, claimOwnerId: 'coworker', claimOwnerName: 'Ana', claimExpiresAt: '2026-07-14T11:00:00+08:00' }, context).reason, /Ana/)
})

test('Google Places candidates retain provenance, route missing or closed contacts to research, and merge repeated place IDs', () => {
  const open = leadFromGooglePlace({ id: 'place-1', displayName: 'North Ready Mix', formattedAddress: 'Bocaue, Bulacan', nationalPhoneNumber: '09170000000', websiteURI: 'https://north.example', googleMapsURI: 'https://maps.google.com/?cid=1', businessStatus: 'OPERATIONAL', location: { lat: 14.8, lng: 120.9 } }, 'batching plant in Bulacan', 'NORTH')
  assert.equal(open.sourcePlaceId, 'place-1')
  assert.equal(discoveryCompleteness(open).callable, true)
  const repeat = { ...open, sourceQuery: 'ready mix in Bulacan', phone: '' }
  assert.equal(mergeDiscoveryCandidates([open, repeat]).length, 1)
  const closed = leadFromGooglePlace({ id: 'place-2', displayName: 'Closed Plant', formattedAddress: 'Cavite', nationalPhoneNumber: '09170000001', businessStatus: 'CLOSED_PERMANENTLY' }, 'plant in Cavite', 'SOUTH')
  assert.equal(discoveryCompleteness(closed).callable, false)
  assert.equal(closed.researchStatus, 'Needs Research')
})

test('Google Places text search uses the supported Philippine region property', () => {
  const request = buildGooglePlacesSearchRequest('batching plant in Bulacan', 99)
  assert.equal(request.textQuery, 'batching plant in Bulacan')
  assert.equal(request.region, 'ph')
  assert.equal(request.maxResultCount, 20)
  assert.equal(request.language, 'en')
  assert.equal(Object.hasOwn(request, 'includedRegionCodes'), false)
  assert.equal(buildGooglePlacesSearchRequest('quarry in Cavite', 0).maxResultCount, 1)
  assert.equal(buildGooglePlacesSearchRequest('ready mix in Manila', 'not-a-number').maxResultCount, 1)
})

test('Lead Finder campaign plans dedupe jobs and same company branches remain separate by address', () => {
  const plan = buildDiscoveryPlan({ keywords: ['batching plant', 'batching plant'], areas: ['Bulacan', 'Bulacan', 'Cavite'], targetCount: 60 })
  assert.equal(plan.jobs.length, 2)
  assert.equal(plan.targetCount, 60)
  const branchOne = normalizeLead({ id: 'a', company: 'Acme Ready Mix', location: 'Bocaue, Bulacan', phone: '' })
  const branchTwo = normalizeLead({ id: 'b', company: 'Acme Ready Mix', location: 'General Trias, Cavite', phone: '' })
  assert.equal(discoveredLeadDuplicate([branchOne], branchTwo), undefined)
})

test('Lead Finder campaign state revives saved results, custom terms, selections and interrupted searches', () => {
  const seed = createLeadFinderState('SOUTH')
  assert.match(seed.areasText, /Cavite/)
  const restored = reviveLeadFinderState({
    ...seed,
    keywords: ['batching plant', '  Hardware   Store  '],
    customKeywords: ['  Hardware   Store  '],
    customKeywordDraft: ' precast   supplier ',
    results: [{ id: 'google-one', company: 'One' }, { id: 'google-two', company: 'Two' }],
    selected: ['google-two', 'missing'],
    status: 'loading',
    tab: 'research',
  }, 'NORTH')
  assert.deepEqual(restored.keywords, ['batching plant', 'Hardware Store'])
  assert.deepEqual(restored.customKeywords, ['Hardware Store'])
  assert.equal(restored.customKeywordDraft, 'precast supplier')
  assert.deepEqual(restored.selected, ['google-two'])
  assert.equal(restored.status, 'cached')
  assert.equal(restored.tab, 'research')
  assert.match(restored.message, /Restored 2 saved candidates/)
  assert.equal(normalizeDiscoveryTerm('  sand   and gravel supplier  '), 'sand and gravel supplier')
})

test('Lead Finder cache keys are stable and seven-day cache pruning retains bounded zero-result campaigns', () => {
  const left = discoveryCacheKey({ provider: 'Google-Places', keywords: ['Quarry', 'batching plant'], areas: ['Cavite', 'Bulacan'], targetCount: 40 })
  const right = discoveryCacheKey({ provider: 'google-places', keywords: ['batching plant', 'quarry'], areas: ['Bulacan', 'Cavite'], targetCount: 40 })
  assert.equal(left, right)
  const now = Date.parse('2026-07-14T10:00:00+08:00')
  const cache = {
    fresh: { storedAt: now - 1000, results: [] },
    older: { storedAt: now - 2000, results: [{ id: 'one' }] },
    stale: { storedAt: now - DISCOVERY_CACHE_TTL, results: [{ id: 'old' }] },
  }
  assert.deepEqual(Object.keys(pruneDiscoveryCache(cache, now, 1)), ['fresh'])
})

test('Lead Finder picks the best review lane and emits capped career-dedupe XP metadata only for unique imports', () => {
  const callable = normalizeLead({ id: 'google-callable', company: 'Callable Plant', location: 'Bulacan', phone: '09170000000', sourceName: 'Google Places', sourcePlaceId: 'callable' })
  const research = normalizeLead({ id: 'google-research', company: 'Research Plant', location: 'Cavite', sourceName: 'Google Places', sourcePlaceId: 'research', researchStatus: 'Needs Research' })
  assert.equal(bestDiscoveryReviewLane([], [research, callable]), 'new')
  assert.equal(bestDiscoveryReviewLane([], [research]), 'research')
  assert.equal(bestDiscoveryReviewLane([callable], [callable]), 'duplicates')

  const candidates = Array.from({ length: 12 }, (_, index) => normalizeLead({
    id: `google-place-${index}`,
    company: `Candidate ${index}`,
    location: `Branch ${index}, Bulacan`,
    sourceName: 'Google Places',
    sourcePlaceId: `place-${index}`,
  }))
  const metadata = discoveryImportRewardMetadata([candidates[0]], [...candidates, candidates[1]])
  assert.equal(metadata.importedUniqueCount, 11)
  assert.equal(metadata.rewardableCount, 10)
  assert.equal(metadata.suggestedXp, 50)
  assert.equal(metadata.maxSuggestedXp, 50)
  assert.equal(metadata.dedupeScope, 'career')
  assert.equal(new Set(metadata.rewardKeys).size, 10)
})

test('call result XP is awarded only for real profile and quote-ready transitions', () => {
  const baseLead = { profileSent: false, quoteReady: false, warmLead: false }
  assert.equal(callResultXp({ existingCall: true, result: 'Profile Sent', lead: baseLead, patch: { profileSent: true } }), 30)
  assert.equal(callResultXp({ existingCall: true, result: 'Profile Sent', lead: { ...baseLead, profileSent: true }, patch: { profileSent: true } }), 0)
  assert.equal(callResultXp({ existingCall: true, result: 'Quotation Requested', lead: baseLead, patch: { quoteReady: true } }), 100)
  assert.equal(callResultXp({ existingCall: true, result: 'Quotation Requested', lead: { ...baseLead, quoteReady: true }, patch: { quoteReady: true } }), 0)
})

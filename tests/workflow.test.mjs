import test from 'node:test'
import assert from 'node:assert/strict'
import { csvTextForLeads, csvToLeadRows, mergeCrmLeads } from '../src/lib/csv.js'
import { buildDiscoveryUrl, discoveredLeadDuplicate, leadFromNominatim, leadResearchLinks } from '../src/lib/leadDiscovery.js'
import {
  autoPickScore, buildBatchHandoffMessage, classForXp, commissionEstimate, followUpLeads, normalizeLead,
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

test('Commission and Pricing Desk batch helpers produce useful numbers and packets', () => {
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

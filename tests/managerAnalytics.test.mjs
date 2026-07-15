import test from 'node:test'
import assert from 'node:assert/strict'
import {
  managerAccess, managerPipeline, managerPipelineRollup, managerTrendSeries, regionalLeadSignals, topObjections,
} from '../src/lib/managerAnalytics.js'

test('manager trend aggregates operators by day and computes answer rate', () => {
  const history = [
    { date: '2026-07-14', operatorId: 'a', calls: 10, answered: 4 },
    { date: '2026-07-14', operatorId: 'b', calls: 5, answered: 1 },
    { date: '2026-07-13', operatorId: 'a', calls: 2, answered: 1 },
  ]
  assert.deepEqual(managerTrendSeries(history, 7, new Date('2026-07-15T12:00:00+08:00')), [
    { date: '2026-07-13', calls: 2, answered: 1, profiles: 0, quotes: 0, pricing: 0, answerRate: 50 },
    { date: '2026-07-14', calls: 15, answered: 5, profiles: 0, quotes: 0, pricing: 0, answerRate: 33 },
  ])
})

test('manager funnel and rollup use only grounded app values', () => {
  const leads = [
    { inPricingQueue: true, pricingStage: 'Needs pricing', opportunityValue: '100,000', dealProbability: 50, commissionRate: 2 },
    { inPricingQueue: true, pricingStage: 'Lost', opportunityValue: 900000, dealProbability: 100, commissionRate: 5 },
  ]
  const pipeline = managerPipeline({ calls: 20, answered: 8, profiles: 5, quotes: 2, pricing: 1 }, leads, 'Commercial desk')
  assert.equal(pipeline[4].label, 'Commercial desk handoffs')
  assert.equal(pipeline[4].value, 1, 'today funnel must not absorb all-current pricing queue totals')
  assert.deepEqual(managerPipelineRollup(leads), { pipelineValue: 100000, weightedValue: 50000, estimatedCommission: 2000, openDeals: 1 })
})

test('manager objections, regions and access stay deterministic', () => {
  const leads = [
    { region: 'NCR', quoteReady: true, inPricingQueue: true, callResults: [{ result: 'Already have a regular supplier', at: '2026-07-14T03:00:00Z' }] },
    { region: 'NORTH', activityLog: [{ action: 'Call note', detail: 'Price is above budget', at: '2026-07-14T03:00:00Z' }] },
  ]
  assert.deepEqual(topObjections(leads, [], 7, new Date('2026-07-15T12:00:00+08:00')), [
    { label: 'Existing supplier', count: 1 }, { label: 'Price concern', count: 1 },
  ])
  assert.equal(regionalLeadSignals(leads)[0].region, 'NCR')
  assert.equal(managerAccess({ teamConnected: true, role: 'manager', localToggle: false }), true)
  assert.equal(managerAccess({ teamConnected: true, role: 'rep', localToggle: true }), false)
  assert.equal(managerAccess({ teamConnected: false, localToggle: true }), true)
})

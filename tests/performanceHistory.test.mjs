import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregatePerformanceHistoryByDate, createPerformanceSnapshot, performanceAdvice, performanceDelta, upsertPerformanceHistory } from '../src/lib/performanceHistory.js'

test('performance history updates a date without creating duplicate rows', () => {
  const daily = { date: '2026-07-14', callGoal: 20, calls: [{ id: 'c1', leadId: 'l1', result: 'Spoke to Staff', answered: true, at: '2026-07-14T09:00:00+08:00' }] }
  const first = createPerformanceSnapshot(daily, { calls: 1, answered: 1, profiles: 0 }, { operatorId: 'rj', operatorName: 'RJ', leads: [{ id: 'l1', company: 'Acme' }] })
  const initial = upsertPerformanceHistory([], first)
  const second = createPerformanceSnapshot(daily, { calls: 1, answered: 1, profiles: 1 }, { operatorId: 'rj', operatorName: 'RJ', leads: [{ id: 'l1', company: 'Acme' }] })
  const updated = upsertPerformanceHistory(initial, second)
  assert.equal(updated.length, 1)
  assert.equal(updated[0].profiles, 1)
  assert.equal(updated[0].callsDetail[0].company, 'Acme')
})

test('history preserves separate operators and computes changes', () => {
  const base = { date: '2026-07-14', calls: [], callGoal: 10 }
  const rj = createPerformanceSnapshot(base, { calls: 4 }, { operatorId: 'rj' })
  const teammate = createPerformanceSnapshot(base, { calls: 7 }, { operatorId: 'teammate' })
  const history = upsertPerformanceHistory(upsertPerformanceHistory([], rj), teammate)
  assert.equal(history.length, 2)
  assert.equal(performanceDelta({ calls: 7 }, { calls: 4 }, 'calls'), 3)
})

test('same-day mission resets preserve each session and aggregate the operating day', () => {
  const first = createPerformanceSnapshot(
    { date: '2026-07-14', sessionId: 'morning', callGoal: 20, calls: [{ id: 'c1', leadId: 'l1', answered: true, at: '2026-07-14T09:00:00+08:00' }] },
    { calls: 1, answered: 1, profiles: 1, xpEarned: 80 },
    { operatorId: 'rj' },
  )
  const fresh = createPerformanceSnapshot(
    { date: '2026-07-14', sessionId: 'afternoon', callGoal: 10, calls: [] },
    { calls: 0, answered: 0, profiles: 0, xpEarned: 0 },
    { operatorId: 'rj' },
  )
  const afternoon = createPerformanceSnapshot(
    { date: '2026-07-14', sessionId: 'afternoon', callGoal: 10, calls: [{ id: 'c2', leadId: 'l2', answered: false, at: '2026-07-14T14:00:00+08:00' }] },
    { calls: 1, answered: 0, profiles: 0, xpEarned: 10 },
    { operatorId: 'rj' },
  )
  let history = upsertPerformanceHistory([], first)
  history = upsertPerformanceHistory(history, fresh)
  history = upsertPerformanceHistory(history, afternoon)
  assert.equal(history.length, 2)
  const [day] = aggregatePerformanceHistoryByDate(history)
  assert.equal(day.calls, 2)
  assert.equal(day.answered, 1)
  assert.equal(day.profiles, 1)
  assert.equal(day.xpEarned, 90)
  assert.equal(day.callsDetail.length, 2)
  assert.equal(day.sessionCount, 2)
})

test('performance advice responds to the daily funnel', () => {
  assert.match(performanceAdvice({ calls: 2 }), /5 calls/i)
  assert.match(performanceAdvice({ calls: 10, answerRate: 10 }), /another time block/i)
  assert.match(performanceAdvice({ calls: 10, answerRate: 50, answered: 5, profiles: 2 }), /confirming email/i)
  assert.match(performanceAdvice({ calls: 20, answerRate: 40, answered: 6, profiles: 6, quotes: 5 }), /export CRM/i)
})

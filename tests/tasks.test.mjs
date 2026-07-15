import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTaskSuggestions,
  createTask,
  filterTasks,
  normalizeTask,
  taskCounts,
  taskDateKey,
} from '../src/lib/tasks.js'

const clock = new Date(2026, 6, 14, 9, 30, 0)

test('task normalization produces a complete local-first task shape', () => {
  const task = normalizeTask({ title: '  Prepare documents  ', priority: 'HIGH', status: 'doing', scope: 'team', dueDate: '2026-07-15T10:00:00Z' }, clock)
  assert.equal(task.title, 'Prepare documents')
  assert.equal(task.priority, 'high')
  assert.equal(task.status, 'in-progress')
  assert.equal(task.scope, 'team')
  assert.equal(task.dueDate, '2026-07-15')
  assert.deepEqual(Object.keys(task), ['id', 'title', 'category', 'priority', 'status', 'dueDate', 'assigneeId', 'scope', 'linkedLeadId', 'createdAt', 'updatedAt', 'completedAt', 'xpAwarded', 'xpAwardedAmount', 'xpAwardedAt'])
})

test('task normalization does not move conflict or XP receipt timestamps', () => {
  const task = normalizeTask({
    id: 'stable', title: 'Stable timestamp', createdAt: '2026-07-14T07:00:00Z', updatedAt: '2026-07-14T08:00:00Z',
    xpAwarded: true, xpAwardedAmount: 9, xpAwardedAt: '2026-07-14T08:30:00Z',
  }, new Date('2026-07-15T12:00:00Z'))
  assert.equal(task.updatedAt, '2026-07-14T08:00:00.000Z')
  assert.equal(task.xpAwarded, true)
  assert.equal(task.xpAwardedAmount, 9)
  assert.equal(task.xpAwardedAt, '2026-07-14T08:30:00.000Z')
})

test('Today includes overdue and undated work while Upcoming and Completed stay distinct', () => {
  const tasks = [
    createTask({ id: 'overdue', title: 'Overdue', dueDate: '2026-07-13', priority: 'urgent' }, clock),
    createTask({ id: 'today', title: 'Today', dueDate: '2026-07-14' }, clock),
    createTask({ id: 'inbox', title: 'No date' }, clock),
    createTask({ id: 'future', title: 'Future', dueDate: '2026-07-16' }, clock),
    createTask({ id: 'done', title: 'Done', dueDate: '2026-07-14', status: 'completed' }, clock),
  ]
  assert.deepEqual(filterTasks(tasks, 'today', '2026-07-14').map((task) => task.id), ['overdue', 'today', 'inbox'])
  assert.deepEqual(filterTasks(tasks, 'upcoming', '2026-07-14').map((task) => task.id), ['future'])
  assert.deepEqual(filterTasks(tasks, 'completed', '2026-07-14').map((task) => task.id), ['done'])
  assert.deepEqual(taskCounts(tasks, '2026-07-14'), { today: 3, upcoming: 1, completed: 1 })
})

test('CRM dates generate actionable follow-up, sample, and quotation suggestions', () => {
  const leads = [{
    id: 'lead-1', company: 'North Plant', ownerId: 'rj', visibility: 'team',
    nextFollowUp: '2026-07-14', pricingFollowUpDate: '2026-07-15',
    sampleDeadline: '2026-07-13', sampleStatus: 'Preparing', quoteDueDate: '2026-07-16', pricingStage: 'Needs pricing',
  }]
  const suggestions = buildTaskSuggestions(leads, [], { today: '2026-07-14', now: clock })
  assert.equal(suggestions.length, 4)
  assert.deepEqual(new Set(suggestions.map((task) => task.category)), new Set(['Follow-up', 'Quotation', 'Sample']))
  assert.equal(suggestions.find((task) => task.category === 'Sample').priority, 'urgent')
  assert.ok(suggestions.every((task) => task.linkedLeadId === 'lead-1' && task.assigneeId === 'rj' && task.scope === 'team'))
})

test('existing accepted work is not suggested twice and finished pipelines do not create stale work', () => {
  const leads = [
    { id: 'lead-1', company: 'Existing', nextFollowUp: '2026-07-14' },
    { id: 'lead-2', company: 'Finished', sampleDeadline: '2026-07-15', sampleStatus: 'Completed', quoteDueDate: '2026-07-15', pricingStage: 'Won' },
  ]
  const existing = [createTask({ id: 'manual-existing', title: 'Call Existing', category: 'Follow-up', dueDate: '2026-07-14', linkedLeadId: 'lead-1' }, clock)]
  assert.deepEqual(buildTaskSuggestions(leads, existing, { today: '2026-07-14', now: clock }), [])
})

test('manual tasks are organizational records and never carry sales XP fields', () => {
  const task = createTask({ title: 'File receipts', category: 'Admin', assigneeId: 'rj', scope: 'private' }, clock)
  assert.equal(taskDateKey(clock), '2026-07-14')
  assert.equal('xp' in task, false)
  assert.equal('xpEarned' in task, false)
  assert.equal('reward' in task, false)
})

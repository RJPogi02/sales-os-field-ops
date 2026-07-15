import test from 'node:test'
import assert from 'node:assert/strict'
import { TASK_XP_DAILY_CAP, taskCompletionReward, taskCompletionRewardPatch } from '../src/lib/taskRewards.js'

test('task rewards are small, priority-aware, and reward collaboration', () => {
  assert.equal(taskCompletionReward({ status: 'todo', priority: 'low', scope: 'private' }), 4)
  assert.equal(taskCompletionReward({ status: 'todo', priority: 'urgent', scope: 'team' }), 14)
  assert.equal(TASK_XP_DAILY_CAP, 60)
})

test('completed or previously rewarded tasks cannot farm XP by reopening', () => {
  const patch = taskCompletionRewardPatch({ status: 'todo' }, 9, new Date('2026-07-14T08:00:00Z'))
  assert.equal(patch.xpAwarded, true)
  assert.equal(patch.xpAwardedAmount, 9)
  assert.equal(taskCompletionReward({ status: 'completed', priority: 'urgent' }), 0)
  assert.equal(taskCompletionReward({ status: 'todo', priority: 'urgent', xpAwardedAt: patch.xpAwardedAt }), 0)
})

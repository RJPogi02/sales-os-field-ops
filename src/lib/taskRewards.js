const PRIORITY_XP = { low: 4, medium: 6, high: 9, urgent: 12 }

export const TASK_XP_DAILY_CAP = 60

export function taskCompletionReward(task = {}) {
  if (task.status === 'completed' || task.xpAwardedAt) return 0
  const base = PRIORITY_XP[String(task.priority || '').toLowerCase()] || PRIORITY_XP.medium
  return base + (task.scope === 'team' ? 2 : 0)
}

export function taskCompletionRewardPatch(task = {}, awardedXp = 0, now = new Date()) {
  const completedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString()
  return {
    status: 'completed',
    completedAt,
    xpAwarded: true,
    xpAwardedAmount: Math.max(0, Number(awardedXp || 0)),
    xpAwardedAt: completedAt,
  }
}

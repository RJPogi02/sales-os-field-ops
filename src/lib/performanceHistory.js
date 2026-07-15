const METRIC_KEYS = ['calls', 'answered', 'profiles', 'warm', 'quotes', 'samples', 'pricing', 'followups', 'retries', 'invalid', 'deliveries', 'xpEarned']

const finite = (value) => {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

const cleanCall = (call = {}, leadById = new Map()) => {
  const leadId = String(call.leadId || '')
  const lead = leadById.get(leadId)
  return {
    id: String(call.id || `${leadId}-${call.at || ''}`),
    leadId,
    company: String(lead?.company || call.company || 'Unknown lead'),
    result: String(call.result || 'Result not recorded'),
    at: String(call.at || call.occurredAt || ''),
    answered: Boolean(call.answered),
  }
}

export function createPerformanceSnapshot(daily = {}, metrics = {}, options = {}) {
  const leads = Array.isArray(options.leads) ? options.leads : []
  const leadById = new Map(leads.map((lead) => [String(lead.id), lead]))
  const snapshot = {
    date: String(daily.date || options.date || ''),
    sessionId: String(daily.sessionId || options.sessionId || ''),
    operatorId: String(options.operatorId || ''),
    operatorName: String(options.operatorName || 'Operator'),
    updatedAt: new Date().toISOString(),
    goal: finite(options.goal || daily.callGoal || 20),
    callsDetail: (Array.isArray(daily.calls) ? daily.calls : []).map((call) => cleanCall(call, leadById)),
  }
  METRIC_KEYS.forEach((key) => { snapshot[key] = finite(metrics[key]) })
  snapshot.answerRate = snapshot.calls ? Math.round((snapshot.answered / snapshot.calls) * 100) : 0
  return snapshot
}

const sameSnapshot = (left, right) => {
  if (!left || !right) return false
  const keys = ['date', 'sessionId', 'operatorId', 'operatorName', 'goal', 'answerRate', ...METRIC_KEYS]
  if (keys.some((key) => left[key] !== right[key])) return false
  return JSON.stringify(left.callsDetail || []) === JSON.stringify(right.callsDetail || [])
}

export function upsertPerformanceHistory(history = [], snapshot, limit = 120) {
  if (!snapshot?.date) return Array.isArray(history) ? history : []
  const safeHistory = Array.isArray(history) ? history : []
  const index = safeHistory.findIndex((item) => item.date === snapshot.date
    && String(item.operatorId || '') === String(snapshot.operatorId || '')
    && String(item.sessionId || '') === String(snapshot.sessionId || ''))
  const sameOperatingDayExists = safeHistory.some((item) => item.date === snapshot.date && String(item.operatorId || '') === String(snapshot.operatorId || ''))
  const hasActivity = METRIC_KEYS.some((key) => finite(snapshot[key]) > 0) || Boolean(snapshot.callsDetail?.length)
  if (index < 0 && sameOperatingDayExists && !hasActivity) return safeHistory
  if (index >= 0 && sameSnapshot(safeHistory[index], snapshot)) return safeHistory
  const next = index >= 0
    ? safeHistory.map((item, itemIndex) => itemIndex === index ? snapshot : item)
    : [...safeHistory, snapshot]
  return next
    .sort((left, right) => String(right.date).localeCompare(String(left.date)) || String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, Math.max(1, limit))
}

export function aggregatePerformanceHistoryByDate(history = []) {
  const grouped = new Map()
  ;(Array.isArray(history) ? history : []).forEach((snapshot) => {
    if (!snapshot?.date) return
    const key = `${String(snapshot.operatorId || '')}|${snapshot.date}`
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        ...snapshot,
        sessionId: '',
        callsDetail: [...(snapshot.callsDetail || [])],
        sessionCount: 1,
      })
      return
    }
    METRIC_KEYS.forEach((metric) => { current[metric] = finite(current[metric]) + finite(snapshot[metric]) })
    const calls = new Map((current.callsDetail || []).map((call) => [String(call.id || ''), call]))
    ;(snapshot.callsDetail || []).forEach((call) => calls.set(String(call.id || ''), call))
    current.callsDetail = [...calls.values()].sort((left, right) => String(left.at || '').localeCompare(String(right.at || '')))
    current.answerRate = current.calls ? Math.round((current.answered / current.calls) * 100) : 0
    current.goal = Math.max(finite(current.goal), finite(snapshot.goal))
    current.updatedAt = String(snapshot.updatedAt || '').localeCompare(String(current.updatedAt || '')) > 0 ? snapshot.updatedAt : current.updatedAt
    current.sessionCount += 1
  })
  return [...grouped.values()].sort((left, right) => String(right.date).localeCompare(String(left.date)) || String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export function performanceDelta(current, previous, key) {
  if (!current || !previous) return null
  return finite(current[key]) - finite(previous[key])
}

export function performanceAdvice(snapshot = {}) {
  if (finite(snapshot.calls) < 5) return 'Start with 5 calls first to build rhythm.'
  if (finite(snapshot.answerRate) < 20) return 'Try another time block and prioritize complete phone numbers.'
  if (finite(snapshot.answered) > finite(snapshot.profiles)) return 'End each real conversation by confirming email and sending the company profile.'
  if (finite(snapshot.profiles) > 0 && finite(snapshot.quotes) === 0) return 'Ask material and delivery location earlier so profile sends can become quote-ready opportunities.'
  if (finite(snapshot.quotes) >= 5) return 'Generate the report, export CRM, and prepare the pricing handoff.'
  return 'Keep the rhythm: call, capture the result, protect the next follow-up.'
}

export const performanceMetricKeys = [...METRIC_KEYS]

import { aggregatePerformanceHistoryByDate } from './performanceHistory.js'

const finite = (value) => {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const dateKey = (value) => {
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(parsed)
}

const cutoffKey = (days, now) => {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - Math.max(1, Number(days || 7)) + 1)
  return dateKey(cutoff)
}

export function managerTrendSeries(history = [], days = 7, now = new Date()) {
  const cutoff = cutoffKey(days, now)
  const byDate = new Map()
  aggregatePerformanceHistoryByDate(history).forEach((snapshot) => {
    if (!snapshot.date || snapshot.date < cutoff) return
    const current = byDate.get(snapshot.date) || {
      date: snapshot.date, calls: 0, answered: 0, profiles: 0, quotes: 0, pricing: 0,
    }
    current.calls += finite(snapshot.calls)
    current.answered += finite(snapshot.answered)
    current.profiles += finite(snapshot.profiles)
    current.quotes += finite(snapshot.quotes)
    current.pricing += finite(snapshot.pricing)
    byDate.set(snapshot.date, current)
  })
  return [...byDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      ...row,
      answerRate: row.calls ? Math.round((row.answered / row.calls) * 100) : 0,
    }))
}

export function managerPipeline(metrics = {}, leads = [], approverLabel = 'Pricing approver') {
  const calls = finite(metrics.calls)
  const answered = finite(metrics.answered)
  const profiles = finite(metrics.profiles)
  const quotes = finite(metrics.quotes)
  // Keep every funnel stage on the same operating-day period. The commercial
  // rollup below intentionally owns the all-current CRM opportunity totals.
  const handoffs = finite(metrics.pricing)
  return [
    { id: 'calls', label: 'Calls', value: calls },
    { id: 'answered', label: 'Real contacts', value: answered },
    { id: 'profiles', label: 'Profiles sent', value: profiles },
    { id: 'quotes', label: 'Quote-ready', value: quotes },
    { id: 'handoffs', label: `${approverLabel} handoffs`, value: handoffs },
  ].map((stage, index, stages) => ({
    ...stage,
    conversion: index === 0 ? 100 : (stages[index - 1].value ? Math.round((stage.value / stages[index - 1].value) * 100) : 0),
  }))
}

export function managerPipelineRollup(leads = []) {
  const open = leads.filter((lead) => lead.inPricingQueue && !['Lost', 'Won'].includes(lead.pricingStage))
  return open.reduce((summary, lead) => {
    const value = finite(lead.opportunityValue)
    const probability = Math.max(0, Math.min(100, finite(lead.dealProbability || 25))) / 100
    const commissionRate = Math.max(0, finite(lead.commissionRate)) / 100
    summary.pipelineValue += value
    summary.weightedValue += value * probability
    summary.estimatedCommission += value * commissionRate
    summary.openDeals += 1
    return summary
  }, { pipelineValue: 0, weightedValue: 0, estimatedCommission: 0, openDeals: 0 })
}

const OBJECTION_PATTERNS = [
  ['Existing supplier', /already (?:have|has)|existing supplier|current supplier|regular supplier|primary supplier/i],
  ['Price concern', /price|expensive|cost|budget|rate/i],
  ['Not interested', /not interested|declined|do not need|no requirement/i],
  ['Timing / no project', /no project|not now|call back|timing|later|next quarter/i],
  ['Need accreditation', /accredit|vendor management|documents?|requirements?/i],
  ['Needs sample', /sample|testing|test result/i],
]

const labelForObjection = (text) => OBJECTION_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || ''

export function topObjections(leads = [], history = [], days = 7, now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - Math.max(1, Number(days || 7)))
  const counts = new Map()
  const capture = (text, at = '') => {
    if (!text) return
    if (at) {
      const parsed = new Date(at)
      if (!Number.isNaN(parsed.getTime()) && parsed < cutoff) return
    }
    const label = labelForObjection(String(text))
    if (label) counts.set(label, (counts.get(label) || 0) + 1)
  }

  leads.forEach((lead) => {
    const objections = Array.isArray(lead.objections) ? lead.objections : [lead.objections, lead.priorObjections]
    objections.filter(Boolean).forEach((item) => capture(typeof item === 'string' ? item : item.text || item.label, item.at))
    ;(lead.callResults || []).forEach((result) => capture(typeof result === 'string' ? result : result.result || result.detail, result.at))
    ;(lead.activityLog || []).forEach((entry) => capture(`${entry.action || ''} ${entry.detail || ''}`, entry.at))
  })
  ;(Array.isArray(history) ? history : []).forEach((snapshot) => {
    ;(snapshot.callsDetail || []).forEach((call) => capture(call.result, call.at))
  })

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6)
}

export function regionalLeadSignals(leads = []) {
  const regions = new Map(['NCR', 'NORTH', 'SOUTH'].map((region) => [region, {
    region, leads: 0, quoteReady: 0, handoffs: 0,
  }]))
  leads.forEach((lead) => {
    const region = String(lead.region || 'NCR').toUpperCase()
    if (!regions.has(region)) regions.set(region, { region, leads: 0, quoteReady: 0, handoffs: 0 })
    const row = regions.get(region)
    row.leads += 1
    if (lead.quoteReady) row.quoteReady += 1
    if (lead.inPricingQueue) row.handoffs += 1
  })
  return [...regions.values()].sort((left, right) => right.leads - left.leads || left.region.localeCompare(right.region))
}

export function managerAccess({ teamConnected = false, role = '', localToggle = false } = {}) {
  if (!teamConnected) return Boolean(localToggle)
  return ['owner', 'manager', 'admin'].includes(String(role).toLowerCase())
}

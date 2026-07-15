export const TASK_CATEGORIES = ['General', 'Sales', 'Follow-up', 'Quotation', 'Sample', 'Admin']

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']

export const TASK_STATUSES = ['todo', 'in-progress', 'completed']

export const TASK_FILTERS = ['today', 'upcoming', 'completed']

const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 }

const cleanDate = (value = '') => {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? `${year}-${month}-${day}`
    : ''
}

const safeIso = (value, fallback) => {
  const date = value ? new Date(value) : fallback
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString()
}

const slug = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'task'

const tinyHash = (value = '') => {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function taskDateKey(value = new Date()) {
  if (typeof value === 'string') {
    const direct = cleanDate(value)
    if (direct) return direct
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return taskDateKey(new Date())
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function normalizeTask(task = {}, now = new Date()) {
  const clock = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const createdAt = safeIso(task.createdAt, clock)
  const updatedAt = safeIso(task.updatedAt || task.teamUpdatedAt || createdAt, new Date(createdAt))
  const rawStatus = String(task.status || '').toLowerCase()
  const status = rawStatus === 'completed' || rawStatus === 'done'
    ? 'completed'
    : rawStatus === 'in-progress' || rawStatus === 'in progress' || rawStatus === 'doing'
      ? 'in-progress'
      : 'todo'
  const rawPriority = String(task.priority || '').toLowerCase()
  const priority = TASK_PRIORITIES.includes(rawPriority) ? rawPriority : 'medium'
  const title = String(task.title || '').trim() || 'Untitled task'
  const assigneeId = String(task.assigneeId || '')
  const linkedLeadId = String(task.linkedLeadId || '')
  const dueDate = cleanDate(task.dueDate)
  const id = String(task.id || `task-${Date.parse(createdAt).toString(36)}-${tinyHash(`${title}|${assigneeId}|${linkedLeadId}`)}`)

  return {
    id,
    title,
    category: String(task.category || '').trim() || 'General',
    priority,
    status,
    dueDate,
    assigneeId,
    scope: task.scope === 'team' ? 'team' : 'private',
    linkedLeadId,
    createdAt,
    updatedAt,
    completedAt: status === 'completed' ? safeIso(task.completedAt, clock) : '',
    xpAwarded: Boolean(task.xpAwarded),
    xpAwardedAmount: Math.max(0, Number(task.xpAwardedAmount || 0)),
    xpAwardedAt: task.xpAwardedAt ? safeIso(task.xpAwardedAt, clock) : '',
  }
}

export function createTask(draft = {}, now = new Date()) {
  return normalizeTask({ ...draft, createdAt: draft.createdAt || now.toISOString() }, now)
}

export function taskMatchesFilter(task, filter = 'today', today = taskDateKey()) {
  const item = normalizeTask(task, new Date(`${taskDateKey(today)}T00:00:00`))
  const date = taskDateKey(today)
  if (filter === 'completed') return item.status === 'completed'
  if (item.status === 'completed') return false
  if (filter === 'upcoming') return Boolean(item.dueDate && item.dueDate > date)
  return !item.dueDate || item.dueDate <= date
}

export function sortTasks(tasks = [], filter = 'today') {
  return [...tasks].sort((left, right) => {
    if (filter === 'completed') return String(right.completedAt).localeCompare(String(left.completedAt))
    const leftDue = left.dueDate || '9999-12-31'
    const rightDue = right.dueDate || '9999-12-31'
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)
    const priorityDifference = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0)
    if (priorityDifference) return priorityDifference
    return String(left.createdAt).localeCompare(String(right.createdAt))
  })
}

export function filterTasks(tasks = [], filter = 'today', today = taskDateKey()) {
  const safeFilter = TASK_FILTERS.includes(filter) ? filter : 'today'
  return sortTasks(tasks.filter((task) => taskMatchesFilter(task, safeFilter, today)), safeFilter)
}

export function taskCounts(tasks = [], today = taskDateKey()) {
  return TASK_FILTERS.reduce((counts, filter) => ({ ...counts, [filter]: filterTasks(tasks, filter, today).length }), {})
}

const suggestionKey = (task) => `${task.linkedLeadId}|${String(task.category).toLowerCase()}|${task.dueDate}`

const priorityForDueDate = (dueDate, today, normalPriority = 'medium') => {
  if (dueDate < today) return 'urgent'
  if (dueDate === today) return 'high'
  return normalPriority
}

export function buildTaskSuggestions(leads = [], existingTasks = [], options = {}) {
  const today = taskDateKey(options.today || new Date())
  const now = options.now instanceof Date ? options.now : new Date(options.now || `${today}T09:00:00`)
  const existingKeys = new Set(existingTasks.map((task) => suggestionKey(normalizeTask(task, now))))
  const existingIds = new Set(existingTasks.map((task) => String(task.id)))
  const suggestions = []

  const offer = (lead, kind, dueDate, category, title, normalPriority = 'medium') => {
    const cleanDueDate = cleanDate(dueDate)
    if (!cleanDueDate || !lead?.id) return
    const task = normalizeTask({
      id: `suggest-${kind}-${slug(lead.id)}-${cleanDueDate}`,
      title,
      category,
      priority: priorityForDueDate(cleanDueDate, today, normalPriority),
      status: 'todo',
      dueDate: cleanDueDate,
      assigneeId: lead.ownerId || options.assigneeId || '',
      scope: lead.visibility === 'private' ? 'private' : (options.scope === 'private' ? 'private' : 'team'),
      linkedLeadId: lead.id,
      createdAt: now.toISOString(),
      completedAt: '',
    }, now)
    const key = suggestionKey(task)
    if (existingKeys.has(key) || existingIds.has(task.id)) return
    existingKeys.add(key)
    existingIds.add(task.id)
    suggestions.push(task)
  }

  for (const lead of leads) {
    const company = String(lead.company || 'lead').trim()
    if (lead.pricingFollowUpDate) offer(lead, 'pricing-followup', lead.pricingFollowUpDate, 'Quotation', `Pricing follow-up with ${company}`, 'high')
    if (lead.nextFollowUp) offer(lead, 'followup', lead.nextFollowUp, 'Follow-up', `Follow up with ${company}`, 'medium')
    if (lead.sampleDeadline && String(lead.sampleStatus || '').toLowerCase() !== 'completed') offer(lead, 'sample', lead.sampleDeadline, 'Sample', `Prepare sample requirements for ${company}`, 'high')
    if (lead.quoteDueDate && !['won', 'lost'].includes(String(lead.pricingStage || '').toLowerCase())) offer(lead, 'quote', lead.quoteDueDate, 'Quotation', `Prepare quotation for ${company}`, 'high')
  }

  return sortTasks(suggestions, 'today')
}

import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Link2,
  ListTodo,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  buildTaskSuggestions,
  createTask,
  filterTasks,
  TASK_CATEGORIES,
  TASK_FILTERS,
  TASK_PRIORITIES,
  taskCounts,
  taskDateKey,
} from '../lib/tasks.js'
import { taskCompletionReward } from '../lib/taskRewards.js'

const filterLabels = { today: 'Today', upcoming: 'Upcoming', completed: 'Completed' }
const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

const formatDueDate = (value) => {
  if (!value) return 'No due date'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TaskWorkspace({
  tasks = [],
  leads = [],
  operators = [],
  activeOperatorId = '',
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onOpenLead,
}) {
  const today = taskDateKey()
  const [filter, setFilter] = useState('today')
  const [draft, setDraft] = useState({
    title: '', category: 'General', priority: 'medium', dueDate: today,
    assigneeId: activeOperatorId, scope: 'private', linkedLeadId: '',
  })
  const counts = useMemo(() => taskCounts(tasks, today), [tasks, today])
  const visibleTasks = useMemo(() => filterTasks(tasks, filter, today), [filter, tasks, today])
  const suggestions = useMemo(() => buildTaskSuggestions(leads, tasks, { assigneeId: activeOperatorId, today }), [activeOperatorId, leads, tasks, today])
  const leadById = useMemo(() => new Map(leads.map((lead) => [String(lead.id), lead])), [leads])
  const operatorById = useMemo(() => new Map(operators.map((operator) => [String(operator.id), operator])), [operators])

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }))
  const submit = (event) => {
    event.preventDefault()
    if (!draft.title.trim() || !onAddTask) return
    onAddTask(createTask({ ...draft, assigneeId: draft.assigneeId || activeOperatorId }))
    setDraft((current) => ({ ...current, title: '', linkedLeadId: '' }))
  }
  const patchTask = (taskId, patch) => onUpdateTask?.(taskId, patch)
  const completeTask = (task) => patchTask(task.id, { status: 'completed', completedAt: new Date().toISOString() })
  const reopenTask = (task) => patchTask(task.id, { status: 'todo', completedAt: '' })

  return <section className="secondary-view panel task-workspace">
    <div className="view-heading task-workspace-heading">
      <div><span className="section-label">Work command center</span><h1>Tasks beyond the call queue</h1><p>Plan follow-ups, samples, quotations, admin work, and shared assignments. Completing real work earns small, daily-capped XP without changing sales funnel stats.</p></div>
      <strong>{counts.today} due</strong>
    </div>

    <form className="task-composer" onSubmit={submit}>
      <label className="task-title-field"><span>Quick add</span><input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="What needs to get done?" autoComplete="off" /></label>
      <label><span>Due</span><input type="date" value={draft.dueDate} onChange={(event) => updateDraft('dueDate', event.target.value)} /></label>
      <label><span>Category</span><select value={draft.category} onChange={(event) => updateDraft('category', event.target.value)}>{TASK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label><span>Priority</span><select value={draft.priority} onChange={(event) => updateDraft('priority', event.target.value)}>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
      <label><span>Assignee</span><select value={draft.assigneeId} onChange={(event) => updateDraft('assigneeId', event.target.value)}><option value="">Unassigned</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></label>
      <label><span>Visibility</span><select value={draft.scope} onChange={(event) => updateDraft('scope', event.target.value)}><option value="private">Private</option><option value="team">Team</option></select></label>
      <label><span>Link lead</span><select value={draft.linkedLeadId} onChange={(event) => updateDraft('linkedLeadId', event.target.value)}><option value="">No linked lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company}</option>)}</select></label>
      <button className="primary-action task-add-button" type="submit" disabled={!draft.title.trim()}><Plus size={16} />Add task</button>
    </form>

    {suggestions.length ? <section className="task-suggestions" aria-label="Suggested tasks">
      <header><div><Sparkles size={16} /><span>Suggested from CRM dates</span></div><strong>{suggestions.length}</strong></header>
      <div>{suggestions.slice(0, 6).map((suggestion) => <article key={suggestion.id}>
        <span><strong>{suggestion.title}</strong><small>{formatDueDate(suggestion.dueDate)} · {priorityLabels[suggestion.priority]}</small></span>
        <button onClick={() => onAddTask?.(suggestion)}><Plus size={13} />Add</button>
      </article>)}</div>
    </section> : null}

    <nav className="task-filter-tabs" aria-label="Task filters">
      {TASK_FILTERS.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'today' ? <ListTodo size={15} /> : item === 'upcoming' ? <CalendarClock size={15} /> : <CheckCircle2 size={15} />}<span>{filterLabels[item]}</span><strong>{counts[item]}</strong></button>)}
    </nav>

    <div className="task-list">
      {visibleTasks.map((task) => {
        const lead = leadById.get(String(task.linkedLeadId))
        const assignee = operatorById.get(String(task.assigneeId))
        const completed = task.status === 'completed'
        const completionXp = taskCompletionReward(task)
        return <article key={task.id} className={`task-card priority-${task.priority} ${completed ? 'completed' : ''}`}>
          <button className="task-state-button" onClick={() => completed ? reopenTask(task) : completeTask(task)} aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
          <div className="task-card-main">
            <input className="task-card-title" value={task.title} onChange={(event) => patchTask(task.id, { title: event.target.value })} aria-label="Task title" />
            <div className="task-card-meta">
              <span><CalendarClock size={12} />{formatDueDate(task.dueDate)}</span>
              <span>{task.scope === 'team' ? <Users size={12} /> : <UserRound size={12} />}{task.scope === 'team' ? 'Team' : 'Private'}</span>
              <span>{assignee?.name || 'Unassigned'}</span>
              {task.xpAwardedAt ? <span className="task-xp-earned">+{Number(task.xpAwardedAmount || 0)} XP earned</span> : null}
              {lead ? <button onClick={() => onOpenLead?.(lead.id)}><Link2 size={12} />{lead.company}</button> : null}
            </div>
          </div>
          <div className="task-card-controls">
            <select aria-label="Task category" value={task.category} onChange={(event) => patchTask(task.id, { category: event.target.value })}>{TASK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
            <select aria-label="Task priority" value={task.priority} onChange={(event) => patchTask(task.id, { priority: event.target.value })}>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select>
            <select aria-label="Task assignee" value={task.assigneeId} onChange={(event) => patchTask(task.id, { assigneeId: event.target.value })}><option value="">Unassigned</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select>
            <select aria-label="Task visibility" value={task.scope} onChange={(event) => patchTask(task.id, { scope: event.target.value })}><option value="private">Private</option><option value="team">Team</option></select>
            <input aria-label="Task due date" type="date" value={task.dueDate} onChange={(event) => patchTask(task.id, { dueDate: event.target.value })} />
          </div>
          <div className="task-card-actions">
            {completed ? <button onClick={() => reopenTask(task)}><RotateCcw size={13} />Reopen</button> : <button onClick={() => completeTask(task)}><CheckCircle2 size={13} />Complete{completionXp ? ` +${completionXp} XP` : ''}</button>}
            <button className="danger" onClick={() => onDeleteTask?.(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={14} /></button>
          </div>
        </article>
      })}
      {!visibleTasks.length ? <div className="large-empty task-empty"><ListTodo size={30} /><h2>{filter === 'completed' ? 'No completed tasks yet.' : filter === 'upcoming' ? 'The runway is clear.' : 'Today is clear.'}</h2><p>{filter === 'today' ? 'Add a task or accept a CRM suggestion to plan your next move.' : 'Tasks will appear here when their timing or status matches this view.'}</p></div> : null}
    </div>
  </section>
}

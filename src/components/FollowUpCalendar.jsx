import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { todayKey } from '../lib/leadModel.js'

const dateKey = (date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

export function FollowUpCalendar({ leads, onOpenLead }) {
  const [cursor, setCursor] = useState(() => { const date = new Date(); date.setDate(1); return date })
  const events = useMemo(() => leads.flatMap((lead) => {
    const items = []
    if (lead.nextFollowUp) items.push({ date: lead.nextFollowUp, lead, type: 'Sales follow-up' })
    if (lead.pricingFollowUpDate && lead.pricingFollowUpDate !== lead.nextFollowUp) items.push({ date: lead.pricingFollowUpDate, lead, type: 'Pricing follow-up' })
    return items
  }), [leads])
  const byDate = useMemo(() => events.reduce((map, event) => { if (!map.has(event.date)) map.set(event.date, []); map.get(event.date).push(event); return map }, new Map()), [events])
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date })
  }, [cursor])
  const today = todayKey()
  const due = events.filter((event) => event.date <= today).length
  const moveMonth = (direction) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  const jumpToday = () => { const date = new Date(); date.setDate(1); setCursor(date) }

  return <section className="followup-calendar">
    <header><div><CalendarDays size={18} /><span>Follow-up calendar</span><strong>{events.length} scheduled · {due} due/overdue</strong></div><nav><button onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button><button onClick={jumpToday}>Today</button><button onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button></nav></header>
    <div className="calendar-title">{cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</div>
    <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">{cells.map((date) => {
      const key = dateKey(date)
      const dayEvents = byDate.get(key) || []
      const outside = date.getMonth() !== cursor.getMonth()
      return <article key={key} className={`${outside ? 'outside' : ''} ${key === today ? 'today' : ''} ${key < today && dayEvents.length ? 'overdue' : ''}`}><header><span>{date.getDate()}</span>{dayEvents.length ? <b>{dayEvents.length}</b> : null}</header>{dayEvents.slice(0, 3).map((event) => <button key={`${event.lead.id}-${event.type}`} onClick={() => onOpenLead(event.lead.id)}><Clock3 size={11} /><span>{event.lead.company}</span><small>{event.type}</small></button>)}{dayEvents.length > 3 ? <em>+{dayEvents.length - 3} more</em> : null}</article>
    })}</div>
  </section>
}

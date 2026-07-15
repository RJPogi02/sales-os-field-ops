import { CalendarDays, ChevronLeft, ChevronRight, Clock3, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { aggregatePerformanceHistoryByDate, performanceAdvice, performanceDelta } from '../lib/performanceHistory.js'

const dayLabel = (date) => {
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const longDayLabel = (date) => {
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const callTime = (value) => {
  if (!value) return 'Time unavailable'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Time unavailable' : parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function Delta({ value, suffix = '' }) {
  if (value === null || value === 0) return <small>No change</small>
  const positive = value > 0
  return <small className={positive ? 'positive' : 'negative'}>{positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{positive ? '+' : ''}{value}{suffix} vs prior day</small>
}

export function PerformanceHistoryPanel({ history = [], activeOperatorId = '' }) {
  const operatorHistory = useMemo(() => aggregatePerformanceHistoryByDate(history
    .filter((snapshot) => !activeOperatorId || !snapshot.operatorId || snapshot.operatorId === activeOperatorId)), [activeOperatorId, history])
  const [selectedDate, setSelectedDate] = useState(() => operatorHistory[0]?.date || '')
  useEffect(() => {
    if (!operatorHistory.length) return setSelectedDate('')
    if (!operatorHistory.some((snapshot) => snapshot.date === selectedDate)) setSelectedDate(operatorHistory[0].date)
  }, [operatorHistory, selectedDate])
  const index = Math.max(0, operatorHistory.findIndex((snapshot) => snapshot.date === selectedDate))
  const selected = operatorHistory[index]
  const previous = operatorHistory[index + 1]
  const chartDays = [...operatorHistory].slice(0, 7).reverse()
  const maxCalls = Math.max(1, ...chartDays.map((day) => Number(day.calls || 0)))

  if (!selected) return <section className="performance-history-panel"><div className="history-empty"><CalendarDays size={24} /><div><strong>Your progress history starts today.</strong><p>Make a call, complete a task, or import verified leads and Sales OS will preserve the day automatically.</p></div></div></section>

  return <section className="performance-history-panel" aria-labelledby="history-title">
    <header>
      <div><CalendarDays size={18} /><span><strong id="history-title">Performance history</strong><small>Compare real operating days, not lifetime CRM totals.</small></span></div>
      <nav aria-label="Change report day"><button disabled={index >= operatorHistory.length - 1} onClick={() => setSelectedDate(operatorHistory[index + 1]?.date || selectedDate)} aria-label="Older day"><ChevronLeft size={15} /></button><strong>{longDayLabel(selected.date)}</strong><button disabled={index === 0} onClick={() => setSelectedDate(operatorHistory[index - 1]?.date || selectedDate)} aria-label="Newer day"><ChevronRight size={15} /></button></nav>
    </header>

    <div className="history-day-strip">{operatorHistory.slice(0, 10).map((snapshot) => <button key={`${snapshot.operatorId}-${snapshot.date}`} className={snapshot.date === selected.date ? 'active' : ''} onClick={() => setSelectedDate(snapshot.date)}><span>{dayLabel(snapshot.date)}</span><strong>{snapshot.calls}</strong><small>calls</small></button>)}</div>

    <div className="history-layout">
      <div className="history-main">
        <div className="history-scorecards">
          <article><span>Calls</span><strong>{selected.calls}</strong><Delta value={performanceDelta(selected, previous, 'calls')} /></article>
          <article><span>Answered</span><strong>{selected.answered}</strong><Delta value={performanceDelta(selected, previous, 'answered')} /></article>
          <article><span>Answer rate</span><strong>{selected.answerRate}%</strong><Delta value={performanceDelta(selected, previous, 'answerRate')} suffix="%" /></article>
          <article><span>Profiles</span><strong>{selected.profiles}</strong><Delta value={performanceDelta(selected, previous, 'profiles')} /></article>
          <article><span>Quote-ready</span><strong>{selected.quotes}</strong><Delta value={performanceDelta(selected, previous, 'quotes')} /></article>
          <article><span>XP earned</span><strong>{selected.xpEarned}</strong><Delta value={performanceDelta(selected, previous, 'xpEarned')} /></article>
        </div>

        <div className="history-chart" aria-label="Seven day calls, answers, and quote-ready trend">
          <header><span>Recent rhythm</span><small>Calls · answered · quote-ready</small></header>
          <div>{chartDays.map((day) => <article key={day.date} title={`${dayLabel(day.date)}: ${day.calls} calls, ${day.answered} answered, ${day.quotes} quote-ready`}><div className="history-bars"><i className="calls" style={{ height: `${Math.max(4, (day.calls / maxCalls) * 100)}%` }} /><i className="answers" style={{ height: `${Math.max(3, (day.answered / maxCalls) * 100)}%` }} /><i className="quotes" style={{ height: `${Math.max(2, (day.quotes / maxCalls) * 100)}%` }} /></div><span>{dayLabel(day.date)}</span></article>)}</div>
        </div>
      </div>

      <aside className="history-detail">
        <div className="history-advice"><TrendingUp size={17} /><p><strong>Flow note</strong>{performanceAdvice(selected)}</p></div>
        <header><span>Calls logged</span><strong>{selected.callsDetail?.length || 0}</strong></header>
        <div className="history-call-list">{(selected.callsDetail || []).map((call) => <article key={call.id}><span className={call.answered ? 'answered' : ''}><Clock3 size={12} />{callTime(call.at)}</span><div><strong>{call.company}</strong><small>{call.result}</small></div></article>)}{!selected.callsDetail?.length ? <p>No call details were recorded on this day.</p> : null}</div>
      </aside>
    </div>
  </section>
}

import {
  Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, Building2, ChevronRight, CircleDollarSign,
  Clock3, MapPinned, Radio, Settings2, ShieldCheck, Signal, Sparkles, Target, Users, WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { computeTeamLeaderboard } from '../lib/teamSync.js'
import {
  managerPipeline, managerPipelineRollup, managerTrendSeries, regionalLeadSignals, topObjections,
} from '../lib/managerAnalytics.js'
import { TerritoryMap } from './TerritoryMap.jsx'

const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })

const shortDay = (date) => {
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function useCountUp(value, reducedMotion) {
  const target = Number(value || 0)
  const systemReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const shouldReduceMotion = reducedMotion || systemReducedMotion
  const [display, setDisplay] = useState(shouldReduceMotion ? target : 0)
  useEffect(() => {
    if (shouldReduceMotion) { setDisplay(target); return undefined }
    const started = performance.now()
    let frame = 0
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 720)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [shouldReduceMotion, target])
  return display
}

function SignalNumber({ value, format = (number) => number.toLocaleString(), reducedMotion = false }) {
  const display = useCountUp(value, reducedMotion)
  return format(display)
}

function TrendChart({ data }) {
  const safe = data.length ? data : [{ date: '', calls: 0, answerRate: 0 }]
  const width = 720
  const height = 238
  const padding = { top: 24, right: 28, bottom: 42, left: 30 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxCalls = Math.max(5, ...safe.map((row) => Number(row.calls || 0)))
  const point = (row, index, key, max) => {
    const x = padding.left + (safe.length === 1 ? plotWidth / 2 : (index / (safe.length - 1)) * plotWidth)
    const y = padding.top + plotHeight - (Number(row[key] || 0) / max) * plotHeight
    return [x, y]
  }
  const calls = safe.map((row, index) => point(row, index, 'calls', maxCalls))
  const rates = safe.map((row, index) => point(row, index, 'answerRate', 100))
  const path = (points) => points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${path(calls)} L ${calls.at(-1)[0]} ${padding.top + plotHeight} L ${calls[0][0]} ${padding.top + plotHeight} Z`

  return <svg className="manager-trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Calls and answer rate trend">
    <defs>
      <linearGradient id="managerArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--command-cyan)" stopOpacity=".34" /><stop offset="1" stopColor="var(--command-cyan)" stopOpacity="0" /></linearGradient>
      <filter id="managerGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {[0, .25, .5, .75, 1].map((line) => <line key={line} className="manager-grid-line" x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight * line} y2={padding.top + plotHeight * line} />)}
    <path className="manager-area" d={area} fill="url(#managerArea)" />
    <path className="manager-line manager-calls-line" pathLength="1" d={path(calls)} filter="url(#managerGlow)" />
    <path className="manager-line manager-rate-line" pathLength="1" d={path(rates)} />
    {calls.map(([x, y], index) => <g key={`${safe[index].date}-call`}><circle className="manager-chart-point call" cx={x} cy={y} r="4" /><title>{safe[index].calls} calls on {shortDay(safe[index].date)}</title></g>)}
    {rates.map(([x, y], index) => <circle key={`${safe[index].date}-rate`} className="manager-chart-point rate" cx={x} cy={y} r="3"><title>{safe[index].answerRate}% answer rate</title></circle>)}
    {safe.map((row, index) => {
      const [x] = point(row, index, 'calls', maxCalls)
      return <text key={`${row.date}-label`} className="manager-axis-label" x={x} y={height - 12} textAnchor="middle">{shortDay(row.date) || 'Today'}</text>
    })}
  </svg>
}

function RingKpi({ icon: Icon, label, value, detail, progress, accent = 'cyan', format, reducedMotion }) {
  const ring = Math.max(0, Math.min(100, Number(progress || 0)))
  return <article className={`manager-kpi command-panel accent-${accent}`} style={{ '--ring-progress': `${ring * 3.6}deg` }}>
    <div className="manager-kpi-ring"><Icon size={18} /><i /></div>
    <div><span>{label}</span><strong><SignalNumber value={value} format={format} reducedMotion={reducedMotion} /></strong><small>{detail}</small></div>
    <b>{Math.round(ring)}%</b>
  </article>
}

function recommendationFor({ trend, pipeline, rollup, metrics }) {
  const latest = trend.at(-1) || metrics
  if (Number(latest.calls || 0) < 5) return { title: 'Build call rhythm', text: 'Start with five verified contacts before expanding the queue.', source: 'Based on the latest operating day.' }
  if (Number(latest.answerRate || 0) < 20) return { title: 'Shift the contact window', text: 'Answer rate is below 20%. Try another time block and prioritize complete phone records.', source: 'Based on saved call results in the selected range.' }
  if (Number(pipeline[1]?.value || 0) > Number(pipeline[2]?.value || 0)) return { title: 'Close the profile gap', text: 'Real contacts are ahead of profile sends. Confirm email before ending each live conversation.', source: 'Based on today’s calls, contacts, and profile events.' }
  if (rollup.openDeals && !Number(pipeline.at(-1)?.value || 0)) return { title: 'Prepare pricing handoffs', text: 'Open opportunities exist without a recorded approver handoff.', source: 'Based on CRM pipeline fields and pricing-queue state.' }
  return { title: 'Protect the next action', text: 'Keep every live opportunity attached to a dated follow-up and a clear owner.', source: 'Based on current CRM and operating history.' }
}

export function ManagerDashboard({
  leads = [], metrics = {}, performanceHistory = [], teamConnected = false, memberships = [], callEvents = [],
  profile = {}, companyProfile = {}, territory = 'ALL', onTerritoryChange = () => {}, userLocation = {},
  onOpenLead = () => {}, onOpenSettings = () => {}, onOpenTasks = () => {}, reducedMotion = false,
}) {
  const [range, setRange] = useState(7)
  const approverLabel = companyProfile.approverLabel || companyProfile.approverRoleLabel || 'Pricing approver'
  const trend = useMemo(() => managerTrendSeries(performanceHistory, range), [performanceHistory, range])
  const pipeline = useMemo(() => managerPipeline(metrics, leads, approverLabel), [approverLabel, leads, metrics])
  const rollup = useMemo(() => managerPipelineRollup(leads), [leads])
  const objections = useMemo(() => topObjections(leads, performanceHistory, range), [leads, performanceHistory, range])
  const regions = useMemo(() => regionalLeadSignals(leads), [leads])
  const leaderboard = useMemo(() => teamConnected ? computeTeamLeaderboard(memberships, callEvents) : [], [callEvents, memberships, teamConnected])
  const visibleLeads = useMemo(() => territory === 'ALL' ? leads : leads.filter((lead) => lead.region === territory), [leads, territory])
  const recentCalls = trend.reduce((sum, row) => sum + Number(row.calls || 0), 0)
  const recentAnswered = trend.reduce((sum, row) => sum + Number(row.answered || 0), 0)
  const answerRate = recentCalls ? Math.round((recentAnswered / recentCalls) * 100) : 0
  const recommendation = recommendationFor({ trend, pipeline, rollup, metrics })

  return <section className="manager-dashboard" aria-labelledby="manager-dashboard-title">
    <div className="command-ambient" aria-hidden="true"><i /><i /><i /><i /></div>

    <header className="manager-command-header command-panel">
      <div className="manager-title-lockup">
        <span className="manager-live"><i /> LIVE OPERATIONS</span>
        <h1 id="manager-dashboard-title">Ops command center</h1>
        <p>{companyProfile.companyName || profile.company || 'Sales operations'} · Grounded in saved CRM and field activity</p>
      </div>
      <div className="manager-signal-core" aria-hidden="true"><span /><span /><span /><Radio size={24} /></div>
      <div className="manager-header-actions">
        <div className="manager-range" aria-label="Analytics range"><button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7D</button><button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30D</button></div>
        <button className="manager-icon-button" onClick={onOpenSettings} aria-label="Open command center settings"><Settings2 size={17} /></button>
      </div>
    </header>

    <div className="manager-kpi-grid">
      <RingKpi icon={Activity} label={`${range}-day calls`} value={recentCalls} detail={`${trend.length} operating day${trend.length === 1 ? '' : 's'}`} progress={Math.min(100, (recentCalls / Math.max(20, range * 8)) * 100)} reducedMotion={reducedMotion} />
      <RingKpi icon={Signal} label="Answer rate" value={answerRate} format={(value) => `${value}%`} detail={`${recentAnswered} real contacts`} progress={answerRate} accent="violet" reducedMotion={reducedMotion} />
      <RingKpi icon={WalletCards} label="Pipeline value" value={rollup.pipelineValue} format={(value) => php.format(value)} detail={`${rollup.openDeals} open opportunities`} progress={rollup.pipelineValue ? Math.min(100, (rollup.weightedValue / rollup.pipelineValue) * 100) : 0} accent="pink" reducedMotion={reducedMotion} />
      <RingKpi icon={CircleDollarSign} label="Est. commission" value={rollup.estimatedCommission} format={(value) => php.format(value)} detail={`${php.format(rollup.weightedValue)} weighted`} progress={rollup.pipelineValue ? Math.min(100, (rollup.estimatedCommission / rollup.pipelineValue) * 1000) : 0} accent="mint" reducedMotion={reducedMotion} />
    </div>

    <div className="manager-command-grid">
      <section className="command-panel manager-funnel-panel">
        <header className="command-panel-heading"><div><Target size={17} /><span><strong>Pipeline transmission</strong><small>Today’s measurable conversion path</small></span></div><b>TODAY</b></header>
        <div className="manager-funnel">
          {pipeline.map((stage, index) => {
            const max = Math.max(1, pipeline[0]?.value || 1)
            const width = Math.max(24, (stage.value / max) * 100)
            return <article key={stage.id} style={{ '--funnel-width': `${width}%`, '--funnel-delay': `${index * 90}ms` }}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><i /><strong>{stage.label}</strong><small>{index ? `${stage.conversion}% from prior stage` : 'Entry signal'}</small></div>
              <b><SignalNumber value={stage.value} reducedMotion={reducedMotion} /></b>
            </article>
          })}
        </div>
      </section>

      <section className="command-panel manager-trend-panel">
        <header className="command-panel-heading"><div><BarChart3 size={17} /><span><strong>Field rhythm</strong><small>Calls and answer-rate telemetry</small></span></div><div className="manager-chart-legend"><i className="calls" />Calls <i className="rate" />Answer rate</div></header>
        <TrendChart data={trend} />
        {!trend.length ? <p className="manager-chart-empty">Your first saved field session will establish the trend line.</p> : null}
      </section>

      <section className="command-panel manager-map-panel">
        <header className="command-panel-heading"><div><MapPinned size={17} /><span><strong>Territory signal map</strong><small>Lead density and quote-ready activity</small></span></div><b>{visibleLeads.length} SIGNALS</b></header>
        <div className="manager-territory-tabs">{['ALL', 'NCR', 'NORTH', 'SOUTH'].map((region) => <button key={region} className={territory === region ? 'active' : ''} onClick={() => onTerritoryChange(region)}>{region}</button>)}</div>
        <div className="manager-map-stage"><div className="manager-radar-sweep" aria-hidden="true" /><TerritoryMap compact operationalOverview leads={visibleLeads} selectedLead={visibleLeads.find((lead) => lead.quoteReady) || visibleLeads[0]} territory={territory} onOpenLead={onOpenLead} /></div>
        <div className="manager-region-signals">{regions.map((row) => <article key={row.region}><span>{row.region}</span><strong>{row.leads}</strong><small>{row.quoteReady} ready · {row.handoffs} handoffs</small></article>)}</div>
      </section>

      <section className="command-panel manager-intelligence-panel">
        <header className="command-panel-heading"><div><Sparkles size={17} /><span><strong>Next-action intelligence</strong><small>Rule-based recommendation · not autonomous</small></span></div><ShieldCheck size={17} /></header>
        <div className="manager-recommendation"><span>PRIORITY SIGNAL</span><h2>{recommendation.title}</h2><p>{recommendation.text}</p><small><BriefcaseBusiness size={12} />{recommendation.source}</small><button onClick={onOpenTasks}>Create or assign task <ChevronRight size={14} /></button></div>
        <div className="manager-objections"><header><span>Top logged objections</span><small>Current CRM + {range}-day history</small></header>{objections.length ? objections.map((item, index) => <article key={item.label}><i style={{ '--bar': `${Math.max(12, (item.count / objections[0].count) * 100)}%` }} /><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong><b>{item.count}</b></article>) : <p>No recognized objections logged yet. Add concise objection notes during calls to build market intelligence.</p>}</div>
      </section>

      <section className="command-panel manager-team-panel">
        <header className="command-panel-heading"><div><Users size={17} /><span><strong>Team performance</strong><small>{teamConnected ? 'Connected workspace telemetry' : 'Connect Team Hub for shared ranking'}</small></span></div><b className={teamConnected ? 'connected' : ''}>{teamConnected ? 'SYNCED' : 'LOCAL'}</b></header>
        {teamConnected && leaderboard.length ? <div className="manager-leaderboard">{leaderboard.slice(0, 6).map((row, index) => <article key={row.userId}><em>#{index + 1}</em><div><strong>{row.name}</strong><small>{row.role} · {row.calls} calls</small></div><span><b>{row.answered}</b>contacts</span><span><b>{row.quotes}</b>ready</span><i>{row.score.toLocaleString()}</i></article>)}</div> : <div className="manager-team-empty"><Users size={28} /><h3>Team signal awaiting connection</h3><p>Leaderboards only appear after a real Team Hub workspace is connected. No sample coworkers are invented.</p><button onClick={onOpenSettings}>Open connection settings <ArrowUpRight size={14} /></button></div>}
      </section>

      <section className="command-panel manager-pipeline-panel">
        <header className="command-panel-heading"><div><Building2 size={17} /><span><strong>Commercial rollup</strong><small>Open pricing opportunities</small></span></div><Clock3 size={16} /></header>
        <div className="manager-rollup-core"><span>WEIGHTED PIPELINE</span><strong><SignalNumber value={rollup.weightedValue} format={(value) => php.format(value)} reducedMotion={reducedMotion} /></strong><small>from {php.format(rollup.pipelineValue)} raw opportunity value</small></div>
        <div className="manager-open-deals">{leads.filter((lead) => lead.inPricingQueue && !['Lost', 'Won'].includes(lead.pricingStage)).sort((a, b) => Number(b.opportunityValue || 0) - Number(a.opportunityValue || 0)).slice(0, 4).map((lead) => <button key={lead.id} onClick={() => onOpenLead(lead.id)}><span><strong>{lead.company}</strong><small>{lead.pricingStage || 'Needs pricing'} · {lead.region}</small></span><b>{php.format(Number(String(lead.opportunityValue || '').replace(/[^\d.]/g, '')) || 0)}</b><ChevronRight size={14} /></button>)}{!rollup.openDeals ? <p>No priced opportunities yet. Quote-ready handoffs appear here once opportunity values are recorded.</p> : null}</div>
      </section>
    </div>
  </section>
}

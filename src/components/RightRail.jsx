import {
  Award, BarChart3, ChevronDown, ChevronUp, Clock3, Flame, MailCheck, Medal,
  PanelRightOpen, PhoneCall, RefreshCcw, SearchCheck, Send, Sparkles, Target, Trophy, WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ACHIEVEMENTS } from '../lib/leadModel.js'
import { OperatorCompanion } from './OperatorCompanion.jsx'

function adviceFor(metrics, callGoal = 20, approverLabel = 'pricing approver') {
  const answeredRate = metrics.calls ? Math.round((metrics.answered / metrics.calls) * 100) : 0
  if (metrics.quotes >= 5) return `Generate report, export CRM, and prepare the ${approverLabel} handoff.`
  if (metrics.answered > 0 && metrics.profiles === 0) return `You reached ${metrics.answered} real ${metrics.answered === 1 ? 'person' : 'people'} but sent no profiles. Confirm email and send the company profile before the lead cools.`
  if (metrics.profiles > 0 && metrics.quotes === 0) return 'You are opening doors. Ask material, volume, delivery location, and target/current price next.'
  if (metrics.calls >= callGoal && answeredRate < 20) return `Answer rate is ${answeredRate}%. Try another time block and prioritize leads with verified phone + email.`
  if (metrics.calls < 5) return 'Start with 5 calls first to build rhythm.'
  if (answeredRate < 25) return 'Try another time block and prioritize complete phone numbers.'
  return 'Keep the loop tight: result, profile, requirements, next lead.'
}

function formatCallTime(value) {
  try { return new Date(value).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}

function RailSection({ id, title, badge, open, onToggle, children, className = '', action }) {
  return (
    <section className={`panel rail-card ${className} ${open ? 'expanded' : 'collapsed'}`}>
      <header>
        <button className="rail-card-toggle" onClick={() => onToggle(id)} aria-expanded={open}>
          <span>{title}</span>
          {badge ? <b>{badge}</b> : null}
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {action}
      </header>
      {open ? <div className="rail-card-body">{children}</div> : null}
    </section>
  )
}

export function RightRail({
  companyProfile = {},
  selectedCount, quoteCount, answeredCount, callsMade, profileCount, sampleCount, pricingCount,
  xp, nextXp, rank, achievements = [], streak, profile, quoteLeads, onOpenLead, daily, leads, metrics,
  conversionCounts = { retry: 0, research: 0, profiles: 0, followups: 0 }, onOpenConversion,
  collapsed = false, onToggleCollapsed, companionMode = 'full', companionState = 'idle', reducedMotion = false,
  goals = { selected: 20, quotes: 2, profiles: 5, answered: 5, warm: 3 },
}) {
  const approverLabel = companyProfile.approverLabel || 'Pricing approver'
  const [open, setOpen] = useState({ mission: true, xp: true, achievements: true, stats: true, conversion: true, pricing: true })
  const [statsOpen, setStatsOpen] = useState(false)
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  const toggle = (id) => setOpen((current) => ({ ...current, [id]: !current[id] }))
  const unlocked = useMemo(() => new Set(achievements), [achievements])
  const nextAchievement = ACHIEVEMENTS.find((item) => !unlocked.has(item.id))
  const level = Math.floor(xp / 500) + 1
  const rankStart = Number(rank.min || 0)
  const rankSpan = Math.max(1, nextXp - rankStart)
  const rankProgress = Math.min(100, Math.max(0, ((xp - rankStart) / rankSpan) * 100))
  const xpNeeded = Math.max(0, nextXp - xp)
  const todayCalls = useMemo(() => (daily?.calls || []).map((call) => {
    const lead = leads.find((item) => item.id === call.leadId)
    return { ...call, leadName: lead?.company || 'Unknown lead' }
  }).sort((a, b) => new Date(b.at) - new Date(a.at)), [daily?.calls, leads])
  const answeredRate = callsMade ? Math.round((answeredCount / callsMade) * 100) : 0

  if (collapsed) return (
    <aside className="right-rail right-rail-collapsed" aria-label="Collapsed performance rail">
      <button className="right-rail-pull" onClick={onToggleCollapsed} aria-label="Expand performance rail"><PanelRightOpen size={17} /><span>Stats</span></button>
      <div className="mini-rail-badges">
        <span title="Calls today"><PhoneCall size={14} /><b>{callsMade}</b><small>Calls</small></span>
        <span title="Profiles sent"><Send size={14} /><b>{profileCount}</b><small>Profiles</small></span>
        <span title="Quote-ready"><Target size={14} /><b>{quoteCount}</b><small>Ready</small></span>
        <span title={`${approverLabel} queue`}><WalletCards size={14} /><b>{quoteLeads.length}</b><small>Pricing</small></span>
      </div>
      {companionMode !== 'off' ? <OperatorCompanion xp={xp} mode={companionState} size="tiny" showLabel={false} reducedMotion={reducedMotion} /> : null}
    </aside>
  )

  return (
    <aside className="right-rail">
      <button className="right-rail-collapse" onClick={onToggleCollapsed} aria-label="Collapse performance rail"><PanelRightOpen size={15} />Collapse rail</button>
      <RailSection id="mission" title="Mission progress" open={open.mission} onToggle={toggle}>
        <Metric label={`Pick ${goals.selected} leads`} value={selectedCount} goal={goals.selected} />
        <Metric label={`Get ${goals.quotes} quotation-ready`} value={quoteCount} goal={goals.quotes} />
        <Metric label={`Send ${goals.profiles}+ profiles`} value={profileCount} goal={goals.profiles} />
        <Metric label="Real people answered" value={answeredCount} goal={goals.answered} />
        <Metric label="Warm leads captured" value={Number(metrics?.warm || 0)} goal={goals.warm} />
      </RailSection>

      <RailSection id="xp" title="XP & rank" open={open.xp} onToggle={toggle} className="xp-card" badge={`L${level}`}>
        <div className="rank-hero">
          {companionMode === 'off' ? <Award size={32} /> : <OperatorCompanion xp={xp} mode={companionState} size={companionMode === 'minimal' ? 'minimal' : 'full'} showLabel={false} reducedMotion={reducedMotion} />}
          <div>
            <span>Current rank</span>
            <strong>{profile.rankTitle || rank.title}</strong>
            <small>Level {level} · {xp.toLocaleString()} XP</small>
          </div>
        </div>
        <div className="xp-progress-head"><span>{xpNeeded.toLocaleString()} XP to {rank.nextTitle}</span><strong>{Math.round(rankProgress)}%</strong></div>
        <div className="progress xp-progress"><span style={{ width: `${rankProgress}%` }} /></div>
        <p className="xp-motivation">Every call pushes the bar.</p>
        <div className="xp-stat-grid">
          <span><Flame size={14} />{streak || 1} day streak</span>
          <span><Sparkles size={14} />+{Number(metrics?.xpEarned || 0).toLocaleString()} XP today</span>
        </div>
        <div className="next-achievement">
          <span>Next achievement</span>
          <strong>{nextAchievement ? nextAchievement.label : 'All current achievements unlocked'}</strong>
        </div>
        {profile.commissionGoal ? <div className="commission-opportunity"><span>Reward target</span><strong>{profile.commissionGoal}</strong></div> : null}
      </RailSection>

      <RailSection
        id="achievements"
        title="Achievements"
        badge={`${unlocked.size}/${ACHIEVEMENTS.length}`}
        open={open.achievements}
        onToggle={toggle}
        className="achievement-card"
        action={<button className="rail-ghost-action" onClick={() => setAchievementsOpen(true)}><Trophy size={13} />View</button>}
      >
        <div className="achievement-preview">
          {ACHIEVEMENTS.slice(0, 4).map((item) => <AchievementPill key={item.id} item={item} unlocked={unlocked.has(item.id)} />)}
        </div>
      </RailSection>

      <RailSection
        id="stats"
        title="Today's stats"
        open={open.stats}
        onToggle={toggle}
        className="stat-card"
        action={<button className="rail-ghost-action" onClick={() => setStatsOpen(true)}><BarChart3 size={13} />Open</button>}
      >
        <button className="stats-popout-trigger" onClick={() => setStatsOpen(true)}>
          <p><span>Calls made</span><strong>{callsMade}</strong></p>
          <p><span>Real people answered</span><strong>{answeredCount}</strong></p>
          <p><span>Profiles sent</span><strong>{profileCount}</strong></p>
          <p><span>Sample requests</span><strong>{sampleCount}</strong></p>
          <p><span>Answered rate</span><strong className="success-text">{answeredRate}%</strong></p>
          <em>Click for call list and advice</em>
        </button>
      </RailSection>

      <RailSection
        id="conversion"
        title="Conversion queues"
        badge={conversionCounts.retry + conversionCounts.research + conversionCounts.profiles}
        open={open.conversion}
        onToggle={toggle}
        className="conversion-rail-card"
        action={<button className="rail-ghost-action" onClick={onOpenConversion}><Target size={13} />Open</button>}
      >
        <button onClick={onOpenConversion}><RefreshCcw size={15} /><span><strong>{conversionCounts.retry}</strong>Retry later</span></button>
        <button onClick={onOpenConversion}><SearchCheck size={15} /><span><strong>{conversionCounts.research}</strong>Needs research</span></button>
        <button onClick={onOpenConversion}><MailCheck size={15} /><span><strong>{conversionCounts.profiles}</strong>Profile opportunity</span></button>
        <button onClick={onOpenConversion}><Clock3 size={15} /><span><strong>{conversionCounts.followups}</strong>Profile follow-ups</span></button>
      </RailSection>

      <RailSection id="pricing" title={`${approverLabel} pricing queue`} badge={quoteLeads.length} open={open.pricing} onToggle={toggle} className="pricing-card">
        {quoteLeads.slice(0, 4).map((lead) => <button key={lead.id} onClick={() => onOpenLead(lead.id)}><strong>{lead.company}</strong><span>{lead.materialNeeded || 'Material needed'}</span><em>{lead.pricingStage || lead.quotationStatus}</em></button>)}
        {quoteLeads.length === 0 ? <p className="empty-state">Quotation-ready leads appear here.</p> : null}
      </RailSection>

      {statsOpen ? <StatsPopout metrics={metrics} calls={todayCalls} approverLabel={approverLabel} advice={adviceFor(metrics, goals.calls, approverLabel)} onClose={() => setStatsOpen(false)} /> : null}
      {achievementsOpen ? <AchievementsPopout unlocked={unlocked} onClose={() => setAchievementsOpen(false)} /> : null}
    </aside>
  )
}

function Metric({ label, value, goal }) {
  return <div className="rail-metric"><p><span>{label}</span><strong>{value} <em>/ {goal}</em></strong></p><div className="progress"><span style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} /></div></div>
}

function AchievementPill({ item, unlocked }) {
  return <span className={`achievement-pill ${unlocked ? 'unlocked' : 'locked'}`}><i>{item.icon}</i>{item.label}</span>
}

function StatsPopout({ metrics, calls, advice, approverLabel, onClose }) {
  const answeredRate = metrics.calls ? Math.round((metrics.answered / metrics.calls) * 100) : 0
  return (
    <div className="modal-backdrop rail-popout-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rail-popout panel" role="dialog" aria-modal="true" aria-label="Today's stats">
        <header><div><span className="section-label">Today’s stats</span><h2>Call rhythm report</h2></div><button onClick={onClose} aria-label="Close stats">×</button></header>
        <div className="stats-grid">
          <Stat label="Calls made" value={metrics.calls} />
          <Stat label="Real people" value={metrics.answered} />
          <Stat label="Profiles sent" value={metrics.profiles} />
          <Stat label="Quote-ready" value={metrics.quotes} />
          <Stat label="Samples" value={metrics.samples} />
          <Stat label={`${approverLabel} handoffs`} value={metrics.pricing} />
          <Stat label="Retry queue" value={metrics.retries || 0} />
          <Stat label="Research queue" value={metrics.invalid || 0} />
          <Stat label="Warm leads" value={metrics.warm || 0} />
          <Stat label="Answered rate" value={`${answeredRate}%`} tone="success" />
        </div>
        <div className="stats-advice"><Target size={18} /><p>{advice}</p></div>
        <div className="called-leads-list">
          <h3>Leads called today</h3>
          {calls.length ? calls.map((call) => <article key={call.id}><Clock3 size={14} /><span><strong>{call.leadName}</strong><small>{call.result}</small></span><em>{formatCallTime(call.at)}</em></article>) : <p>No saved call results yet. Use quick results so this fills automatically.</p>}
        </div>
      </section>
    </div>
  )
}

function AchievementsPopout({ unlocked, onClose }) {
  return (
    <div className="modal-backdrop rail-popout-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rail-popout achievements-popout panel" role="dialog" aria-modal="true" aria-label="Achievements">
        <header><div><span className="section-label">Achievements</span><h2>Sales milestones</h2></div><button onClick={onClose} aria-label="Close achievements">×</button></header>
        <div className="achievement-grid">
          {ACHIEVEMENTS.map((item) => <article key={item.id} className={unlocked.has(item.id) ? 'unlocked' : 'locked'}><Medal size={20} /><i>{item.icon}</i><strong>{item.label}</strong><span>{unlocked.has(item.id) ? 'Unlocked' : 'Locked'}</span></article>)}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, tone = '' }) {
  return <article><span>{label}</span><strong className={tone}>{value}</strong></article>
}

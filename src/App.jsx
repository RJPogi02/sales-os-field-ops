import { useEffect, useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import rawLeads from './data/leads.json'
import { practiceLeads } from './data/practiceLeads.js'
import { CallMode } from './components/CallMode.jsx'
import { AnsweredFollowUpModal } from './components/AnsweredFollowUpModal.jsx'
import { ConversionDesk } from './components/ConversionDesk.jsx'
import { LeadFinderView } from './components/LeadFinderView.jsx'
import { LeadQueue } from './components/LeadQueue.jsx'
import { LeadWorkspace } from './components/LeadWorkspace.jsx'
import { MissionRail } from './components/MissionRail.jsx'
import { MobileNav } from './components/MobileNav.jsx'
import { OnboardingModal } from './components/OnboardingModal.jsx'
import { CrmView, QueuePlannerView, QuoteQueueView, ReportsView } from './components/Views.jsx'
import { ProfileEditor } from './components/ProfileEditor.jsx'
import { RightRail } from './components/RightRail.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { SessionSummaryModal } from './components/SessionSummaryModal.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { SystemRail } from './components/SystemRail.jsx'
import { usePersistentState } from './hooks/usePersistentState.js'
import { useUserLocation } from './hooks/useUserLocation.js'
import { csvTextForLeads, mergeCrmLeads } from './lib/csv.js'
import {
  ANSWERED_FOLLOW_UP_RESULTS, autoPickScore, canEnterPricingQueue, createDailyState, dailyMetrics,
  classForXp, commissionEstimate, distanceIntelligence, followUpLeads, hasQuotationBasics, isFinalCallResult, NOMINATIM_DEFAULT_ENDPOINT, normalizeLead,
  phoneCountsForLeads, pricingReadiness, profileOpportunityLeads, rankForXp, resultAnswered, retryPatchForLead, todayKey, withActivity,
} from './lib/leadModel.js'

const seedLeads = rawLeads.map((lead) => normalizeLead({ ...lead, selected: false, answered: false, quoteReady: false, inPricingQueue: false, quoteReadyToday: false, profileSent: false, checklist: Array(7).fill(false) }))
const defaultProfile = {
  name: 'Demo Operator', initials: 'DO', company: 'Northstar Materials Demo', position: 'Field Representative',
  email: '', phone: '', photo: '', territoryFocus: 'ALL', currentSalesGoal: '5 quote-ready leads daily',
  rankTitle: '', preferredTheme: 'glass', battleCry: 'One call at a time.', commissionGoal: '', companyLogo: '',
  leadSearchEndpoint: NOMINATIM_DEFAULT_ENDPOINT, leadSearchProvider: 'nominatim',
  companionMode: 'full', companionLocation: 'auto', showOperatorPhoto: true, callModeTheme: 'inherit',
}
const createProgress = () => ({ xp: 0, achievements: [], streak: 1, lastActiveDate: todayKey() })
const createCallSession = (leadId) => ({ id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, leadId, startedAt: new Date().toISOString(), counted: false, result: '' })

function migrateLeads() {
  try {
    const previous = JSON.parse(localStorage.getItem('sales-os-leads-v5') || localStorage.getItem('sales-os-leads-v4') || localStorage.getItem('sales-os-leads-v3') || localStorage.getItem('sales-os-leads-v2') || 'null')
    return (Array.isArray(previous) ? previous : seedLeads).map(normalizeLead)
  } catch { return seedLeads }
}

function migrateDaily() {
  try {
    const previous = JSON.parse(localStorage.getItem('sales-os-daily-v5') || localStorage.getItem('sales-os-daily-v4') || localStorage.getItem('sales-os-daily-v3') || 'null')
    return previous?.date === todayKey() ? { ...createDailyState(), ...previous, xpEarned: Number(previous.xpEarned || 0) } : createDailyState()
  } catch { return createDailyState() }
}

function migrateProgress() {
  try { return { ...createProgress(), ...JSON.parse(localStorage.getItem('sales-os-progress-v5') || localStorage.getItem('sales-os-progress-v4') || localStorage.getItem('sales-os-progress-v3') || 'null') } } catch { return createProgress() }
}

function migrateProfile() {
  try {
    const profile = { ...defaultProfile, ...JSON.parse(localStorage.getItem('sales-os-profile-v2') || localStorage.getItem('sales-os-profile-v1') || 'null') }
    return { ...profile, preferredTheme: profile.preferredTheme === 'cosmic' ? 'frosted' : profile.preferredTheme }
  } catch { return defaultProfile }
}

const defaultAppearance = { background: 'auto', customBackground: '', intensity: 68, blur: 72, transparency: 56, reflection: 58, dimBackground: true, reducedMotion: false }

function initialOperators() {
  const profile = migrateProfile()
  const progress = migrateProgress()
  const daily = migrateDaily()
  let selectedLeadIds = []
  try { selectedLeadIds = (JSON.parse(localStorage.getItem('sales-os-leads-v6') || '[]') || []).filter((lead) => lead.selected).map((lead) => lead.id) } catch { /* use empty roster */ }
  return [{ id: 'operator-rj', profile, progress, daily, selectedLeadIds }]
}

function App() {
  const [leads, setLeads] = usePersistentState('sales-os-leads-v6', migrateLeads)
  const [daily, setDaily] = usePersistentState('sales-os-daily-v6', migrateDaily)
  const [progress, setProgress] = usePersistentState('sales-os-progress-v6', migrateProgress)
  const [profile, setProfile] = usePersistentState('sales-os-profile-v3', migrateProfile)
  const [theme, setTheme] = usePersistentState('sales-os-theme-v4', () => {
    try {
      const previous = JSON.parse(localStorage.getItem('sales-os-theme-v3') || 'null')
      if (previous === 'cosmic') return 'frosted'
      if (previous) return previous
      return JSON.parse(localStorage.getItem('sales-os-theme-v1') || 'false') ? 'midnight' : 'field'
    } catch { return 'field' }
  })
  const [territory, setTerritory] = usePersistentState('sales-os-territory-v1', 'ALL')
  const [operators, setOperators] = usePersistentState('sales-os-operators-v1', initialOperators)
  const [activeOperatorId, setActiveOperatorId] = usePersistentState('sales-os-active-operator-v1', 'operator-rj')
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = usePersistentState('sales-os-left-sidebar-v1', false)
  const [rightRailCollapsed, setRightRailCollapsed] = usePersistentState('sales-os-right-rail-v1', false)
  const [focusMode, setFocusMode] = usePersistentState('sales-os-focus-mode-v1', false)
  const [appearance, setAppearance] = usePersistentState('sales-os-appearance-v1', defaultAppearance)
  const [demoMode, setDemoMode] = usePersistentState('sales-os-demo-mode-v1', false)
  const [practiceSession, setPracticeSession] = usePersistentState('sales-os-practice-v1', { active: false, backup: null })
  const [onboardingComplete, setOnboardingComplete] = usePersistentState('sales-os-onboarding-v1', () => Boolean(localStorage.getItem('sales-os-leads-v6')))
  const [activeView, setActiveView] = useState('mission')
  const [selectedLeadId, setSelectedLeadId] = useState(() => daily.activeCall?.leadId || leads[0]?.id)
  const [editingProfile, setEditingProfile] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [answeredFollowUp, setAnsweredFollowUp] = useState(null)
  const [sessionSummaryOpen, setSessionSummaryOpen] = useState(false)
  const [reportText, setReportText] = useState('')
  const [toast, setToast] = useState('')
  const [xpBurst, setXpBurst] = useState(null)
  const [companionEvent, setCompanionEvent] = useState('idle')
  const [onboardingOpen, setOnboardingOpen] = useState(() => !onboardingComplete)
  const userLocation = useUserLocation()
  const today = todayKey()

  useEffect(() => {
    if (daily.date !== today) setDaily(createDailyState())
  }, [daily.date, setDaily, today])

  useEffect(() => {
    setProgress((current) => {
      if (current.lastActiveDate === today) return current
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const continued = current.lastActiveDate === new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterday)
      return { ...current, streak: continued ? Number(current.streak || 0) + 1 : 1, lastActiveDate: today }
    })
  }, [setProgress, today])

  const selectedLead = leads.find((lead) => lead.id === (daily.activeCall?.leadId || selectedLeadId)) || leads[0]
  const selectedLeads = useMemo(() => leads.filter((lead) => lead.selected), [leads])
  const quoteLeads = useMemo(() => leads.filter((lead) => lead.inPricingQueue), [leads])
  const phoneCounts = useMemo(() => phoneCountsForLeads(leads), [leads])
  const retryLeads = useMemo(() => leads.filter((lead) => lead.retryStatus), [leads])
  const researchLeads = useMemo(() => leads.filter((lead) => lead.researchStatus === 'Needs Research' || lead.status === 'Invalid Contact'), [leads])
  const profileQueueLeads = useMemo(() => profileOpportunityLeads(leads), [leads])
  const scheduledFollowUps = useMemo(() => followUpLeads(leads), [leads])
  const warmLeads = useMemo(() => leads.filter((lead) => lead.warmLead), [leads])
  const mapLeads = useMemo(() => leads.filter((lead) => territory === 'ALL' || lead.region === territory), [leads, territory])
  const metrics = useMemo(() => dailyMetrics(daily), [daily])
  const selectedCount = selectedLeads.length
  const capturedCount = selectedLeads.filter(hasQuotationBasics).length
  const xp = progress.xp
  const level = Math.floor(xp / 500) + 1
  const rank = useMemo(() => rankForXp(xp), [xp])
  const nextXp = rank.nextXp
  const activeCallIndex = selectedLeads.findIndex((lead) => lead.id === daily.activeCall?.leadId)
  const activeCallNumber = activeCallIndex >= 0 ? activeCallIndex + 1 : 1
  const activeCallTotal = activeCallIndex >= 0 ? selectedLeads.length : 1
  const effectiveLeftCollapsed = Boolean(focusMode || leftSidebarCollapsed)
  const effectiveRightCollapsed = Boolean(focusMode || rightRailCollapsed)
  const companionState = daily.activeCall ? 'call-mode' : companionEvent

  useEffect(() => {
    if (practiceSession.active) return
    setOperators((current) => current.map((operator) => operator.id === activeOperatorId ? { ...operator, profile, progress, daily, selectedLeadIds: selectedLeads.map((lead) => lead.id) } : operator))
  }, [activeOperatorId, daily, practiceSession.active, profile, progress, selectedLeads, setOperators])

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(window.__salesToast)
    window.__salesToast = window.setTimeout(() => setToast(''), 3200)
  }

  const unlockAchievement = (id) => {
    setProgress((current) => current.achievements.includes(id) ? current : { ...current, achievements: [...current.achievements, id] })
  }

  const awardXp = (amount, reason) => {
    if (!amount) return
    const classBefore = classForXp(xp)
    const classAfter = classForXp(xp + amount)
    setProgress((current) => ({ ...current, xp: current.xp + amount }))
    setDaily((current) => ({ ...current, xpEarned: Number(current.xpEarned || 0) + amount }))
    setXpBurst({ amount, reason, id: Date.now() })
    setCompanionEvent(classAfter.tier > classBefore.tier ? 'rank-up' : 'xp')
    window.clearTimeout(window.__xpBurst)
    window.__xpBurst = window.setTimeout(() => { setXpBurst(null); setCompanionEvent('idle') }, classAfter.tier > classBefore.tier ? 3200 : 1800)
  }

  useEffect(() => {
    const earned = new Set()
    if (metrics.calls > 0 || leads.some((lead) => lead.callsMade > 0)) earned.add('first-call')
    if (metrics.answered > 0 || leads.some((lead) => lead.answered)) earned.add('first-contact')
    if (metrics.profiles > 0 || leads.some((lead) => lead.profileSent)) earned.add('first-profile')
    if (metrics.quotes > 0 || leads.some((lead) => lead.quoteReady)) earned.add('first-quote')
    if (metrics.quotes >= 5 || quoteLeads.length >= 5) earned.add('five-quotes')
    if (metrics.pricing > 0 || leads.some((lead) => lead.inPricingQueue)) earned.add('first-handoff')
    if (metrics.samples > 0 || leads.some((lead) => lead.sampleRequired)) earned.add('first-sample')
    if (metrics.followups > 0 || leads.some((lead) => lead.nextFollowUp || lead.pricingFollowUpDate)) earned.add('first-followup')
    if (metrics.warm > 0 || leads.some((lead) => lead.warmLead)) earned.add('first-warm')
    if (leads.some((lead) => lead.status === 'Won' || lead.pricingStage === 'Won')) earned.add('first-win')
    if (!earned.size) return
    setProgress((current) => {
      const currentAchievements = current.achievements || []
      const merged = [...new Set([...currentAchievements, ...earned])]
      return merged.length === currentAchievements.length ? current : { ...current, achievements: merged }
    })
  }, [leads, metrics.answered, metrics.calls, metrics.followups, metrics.pricing, metrics.profiles, metrics.quotes, metrics.samples, metrics.warm, quoteLeads.length, setProgress])

  const updateLead = (id, patch, action = '', detail = '') => {
    if (patch.pricingStage === 'Won' || patch.status === 'Won') unlockAchievement('first-win')
    if (patch.profileSent) { unlockAchievement('first-profile'); addDailyEvents([{ type: 'profile', leadId: id }]) }
    if (patch.deliveryLocationConfirmed) addDailyEvents([{ type: 'deliveryConfirmed', leadId: id, detail: patch.deliveryLocation || detail }])
    if (patch.nextFollowUp || patch.pricingFollowUpDate) { unlockAchievement('first-followup'); addDailyEvents([{ type: 'followup', leadId: id, detail: patch.nextFollowUp || patch.pricingFollowUpDate }]) }
    const operatorPatch = { ...patch, lastOperator: profile.name }
    setLeads((current) => current.map((lead) => lead.id === id ? (action ? withActivity(lead, operatorPatch, action, detail) : { ...lead, ...operatorPatch }) : lead))
  }

  const addDailyEvents = (events) => setDaily((current) => {
    const additions = events.filter((event) => !current.events.some((item) => item.type === event.type && item.leadId === event.leadId && item.date === today))
    return additions.length ? { ...current, events: [...current.events, ...additions.map((event) => ({ ...event, id: `${event.type}-${event.leadId}-${Date.now()}`, date: today, at: new Date().toISOString() }))] } : current
  })

  const updateSelectedLead = (patch, action, detail) => {
    updateLead(selectedLead.id, patch, action, detail)
    const events = []
    if (patch.nextFollowUp && patch.nextFollowUp !== selectedLead.nextFollowUp) { events.push({ type: 'followup', leadId: selectedLead.id, detail: patch.nextFollowUp }); unlockAchievement('first-followup') }
    if (patch.sampleRequired && !selectedLead.sampleRequired) { events.push({ type: 'sample', leadId: selectedLead.id }); unlockAchievement('first-sample') }
    if (patch.deliveryLocationConfirmed && !selectedLead.deliveryLocationConfirmed) events.push({ type: 'deliveryConfirmed', leadId: selectedLead.id, detail: patch.deliveryLocation || selectedLead.deliveryLocation })
    if (events.length) addDailyEvents(events)
  }

  const toggleSelected = (id) => {
    if (daily.rosterLocked) return notify('Quest roster is locked. Unlock it from Lead Queue before changing picks.')
    const lead = leads.find((item) => item.id === id)
    if (!lead.selected && selectedCount >= 20) return notify('Mission roster is full: 20 leads selected.')
    updateLead(id, { selected: !lead.selected }, lead.selected ? 'Removed from daily mission' : 'Added to daily mission')
  }

  const autoPick = () => {
    if (daily.rosterLocked) return notify('Unlock the roster before replacing its leads.')
    const completed = new Set(daily.completedLeadIds)
    const territoryLeads = territory === 'ALL' ? leads : leads.filter((lead) => lead.region === territory)
    const candidates = territoryLeads
      .map((lead) => ({ lead, score: autoPickScore(lead, territory, completed, userLocation.position, phoneCounts) }))
      .filter((item) => item.score > -1000)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((item) => item.lead)
    const ids = new Set(candidates.map((lead) => lead.id))
    setLeads((current) => current.map((lead) => ({ ...lead, selected: ids.has(lead.id) })))
    if (candidates[0]) setSelectedLeadId(candidates[0].id)
    if (candidates.length < 20) return notify(`Only ${candidates.length} callable ${territory} lead${candidates.length === 1 ? '' : 's'} available. No other territory was mixed in; use Lead Finder or add CRM leads before locking.`)
    notify(`20 callable ${territory} leads selected. Review them, then lock the quest roster.`)
  }

  const toggleRosterLock = () => {
    if (!daily.rosterLocked && selectedCount !== 20) return notify(`Pick exactly 20 leads before locking the quest roster (${selectedCount}/20).`)
    setDaily((current) => ({ ...current, rosterLocked: !current.rosterLocked }))
    notify(daily.rosterLocked ? 'Quest roster unlocked.' : 'Quest roster locked. Call mode is ready.')
  }

  const clearPicks = () => {
    if (daily.rosterLocked) return notify('Unlock the roster before clearing it.')
    setLeads((current) => current.map((lead) => ({ ...lead, selected: false })))
    notify('Daily roster cleared.')
  }

  const openLead = (id, view = 'mission') => {
    setSelectedLeadId(id)
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startCallForLead = (lead) => {
    const session = createCallSession(lead.id)
    setSelectedLeadId(lead.id)
    setDaily((current) => ({ ...current, activeCall: session }))
    updateLead(lead.id, {}, 'Call started', session.id)
  }

  const startNextCall = () => {
    if (!daily.rosterLocked) return notify('Build and lock your 20-lead quest roster first.')
    const completed = new Set(daily.completedLeadIds)
    const next = selectedLeads.find((lead) => !completed.has(lead.id))
    if (!next) { setSessionSummaryOpen(true); return notify('Every lead in today’s roster is complete. Review the session summary.') }
    startCallForLead(next)
    notify(`Call Mode opened for ${next.company}.`)
  }

  const closeCallMode = () => setDaily((current) => ({ ...current, activeCall: null }))

  const commitQuickResult = (result, extraPatch = {}) => {
    const lead = selectedLead
    const session = daily.activeCall?.leadId === lead.id ? daily.activeCall : createCallSession(lead.id)
    const existingCall = daily.calls.find((call) => call.id === session.id)
    const firstAnswerForLead = resultAnswered(result) && !daily.calls.some((call) => call.leadId === lead.id && call.answered)
    const answered = resultAnswered(result)
    const resultEntry = { result, at: new Date().toISOString(), sessionId: session.id }
    const patch = { lastResult: result, lastContacted: today, callResults: [resultEntry, ...(lead.callResults || [])].slice(0, 30) }
    if (result === 'No Answer') {
      Object.assign(patch, retryPatchForLead(lead, today))
    }
    if (result === 'Wrong Number') Object.assign(patch, { answered: Boolean(lead.answered), status: 'Invalid Contact', researchStatus: 'Needs Research', retryStatus: '' })
    if (['Spoke to Staff', 'Procurement Contact Found', 'Asked for Email'].includes(result)) Object.assign(patch, { answered: true, status: result === 'Asked for Email' ? 'Follow-up Needed' : 'Contacted' })
    if (result === 'Profile Sent') Object.assign(patch, { answered: true, profileSent: true, profileSentAt: today, status: 'Profile Sent' })
    if (result === 'Sample Requested') Object.assign(patch, { answered: true, sampleRequired: true, sampleDocStatus: 'Required', status: 'Follow-up Needed' })
    if (result === 'Quotation Requested') Object.assign(patch, { answered: true, quoteReady: hasQuotationBasics(lead), quotationStatus: hasQuotationBasics(lead) ? 'Quotation requested' : 'Needs requirements', status: hasQuotationBasics(lead) ? 'Quotation Requested' : 'Follow-up Needed' })
    if (result === 'Not Interested') Object.assign(patch, { answered: true, status: 'Not Interested' })
    if (!existingCall) patch.callsMade = Number(lead.callsMade || 0) + 1
    Object.assign(patch, extraPatch)

    const events = []
    if (result === 'No Answer') events.push({ type: 'retry', leadId: lead.id })
    if (result === 'Wrong Number') events.push({ type: 'research', leadId: lead.id })
    if (result === 'Profile Sent' || (patch.profileSent && !lead.profileSent)) events.push({ type: 'profile', leadId: lead.id })
    if (result === 'Sample Requested') events.push({ type: 'sample', leadId: lead.id })
    if (result === 'Quotation Requested' && hasQuotationBasics(lead)) events.push({ type: 'quoteReady', leadId: lead.id })
    if (patch.warmLead && !lead.warmLead) events.push({ type: 'warm', leadId: lead.id })

    setDaily((current) => {
      const call = { id: session.id, leadId: lead.id, result, answered, at: new Date().toISOString() }
      const calls = current.calls.some((item) => item.id === session.id) ? current.calls.map((item) => item.id === session.id ? call : item) : [...current.calls, call]
      const completedLeadIds = isFinalCallResult(result) && !current.completedLeadIds.includes(lead.id) ? [...current.completedLeadIds, lead.id] : current.completedLeadIds
      const eventAdditions = events.filter((event) => !current.events.some((item) => item.type === event.type && item.leadId === event.leadId && item.date === today)).map((event) => ({ ...event, id: `${event.type}-${event.leadId}-${Date.now()}`, date: today, at: new Date().toISOString() }))
      return { ...current, activeCall: { ...session, counted: true, result }, calls, completedLeadIds, events: [...current.events, ...eventAdditions] }
    })
    updateLead(lead.id, patch, existingCall ? 'Call result corrected' : 'Call attempt auto-saved', result)
    awardXp((existingCall ? 0 : 10) + (firstAnswerForLead ? 40 : 0) + ((result === 'Profile Sent' || (patch.profileSent && !lead.profileSent)) ? 30 : 0) + (patch.warmLead && !lead.warmLead ? 20 : 0) + (result === 'Quotation Requested' && hasQuotationBasics(lead) ? 100 : 0), result)
    if (firstAnswerForLead) unlockAchievement('first-contact')
    if (result === 'Profile Sent') unlockAchievement('first-profile')
    if (result === 'Sample Requested') unlockAchievement('first-sample')
    if (result === 'Quotation Requested' && hasQuotationBasics(lead)) unlockAchievement('first-quote')
    if (result === 'Quotation Requested' && !hasQuotationBasics(lead)) notify('Call saved. Quotation still needs Material and Delivery Location.')
    else if (result === 'No Answer') notify(`${patch.retryStatus}: ${lead.company} added to the retry queue for ${patch.nextRetryTime.replace('T', ' ')}.`)
    else if (result === 'Wrong Number') notify(`${lead.company} moved to Lead Research. It will be excluded from future auto-pick.`)
    else notify(`${result} auto-saved. Call count, CRM, activity, XP, and daily stats updated.`)
    return session
  }

  const recordQuickResult = (result) => {
    if (ANSWERED_FOLLOW_UP_RESULTS.includes(result)) {
      setAnsweredFollowUp({ leadId: selectedLead.id, result })
      return null
    }
    return commitQuickResult(result)
  }

  const advanceToNext = (session) => {
    const inRoster = selectedLeads.some((lead) => lead.id === session.leadId)
    if (!inRoster) {
      setDaily((current) => ({ ...current, activeCall: null }))
      setActiveView('conversion')
      notify('Follow-up call saved. Returned to Conversion Desk.')
      return
    }
    const completed = new Set([...daily.completedLeadIds, session.leadId])
    const next = selectedLeads.find((lead) => !completed.has(lead.id))
    if (!next) {
      setDaily((current) => ({ ...current, activeCall: null, completedLeadIds: [...completed] }))
      setSessionSummaryOpen(true)
      notify('20-call block complete. Review the conversion summary.')
      return
    }
    const nextSession = createCallSession(next.id)
    setSelectedLeadId(next.id)
    setDaily((current) => ({ ...current, completedLeadIds: [...completed], activeCall: nextSession }))
    updateLead(next.id, {}, 'Call started', nextSession.id)
    notify(`Saved. Next lead: ${next.company}`)
  }

  const saveAndNext = () => {
    const session = daily.activeCall
    if (!session || !daily.calls.some((call) => call.id === session.id)) return notify('Choose a Quick Result first so this call can be saved safely.')
    advanceToNext(session)
  }

  const saveAnsweredFollowUp = (action, payload) => {
    if (!answeredFollowUp || answeredFollowUp.leadId !== selectedLead.id) return
    const profileSent = action === 'send-profile'
    const patch = {
      ...payload,
      warmLead: true,
      ...(profileSent ? { profileSent: true, profileSentAt: today, status: 'Profile Sent', lastResult: 'Profile Sent' } : {}),
    }
    const session = commitQuickResult(answeredFollowUp.result, patch)
    setAnsweredFollowUp(null)
    if (action === 'next') advanceToNext(session)
    else notify(profileSent ? 'Profile email opened and the lead was saved as warm.' : 'Answered lead saved as warm with a follow-up path.')
  }

  const sendProfile = () => {
    const checklist = [...selectedLead.checklist]
    checklist[6] = true
    const alreadyToday = daily.events.some((event) => event.type === 'profile' && event.leadId === selectedLead.id && event.date === today)
    updateSelectedLead({ profileSent: true, profileSentAt: today, checklist, lastResult: 'Profile Sent', status: 'Profile Sent' }, selectedLead.profileSent ? 'Profile send reconfirmed' : 'Company profile sent')
    addDailyEvents([{ type: 'profile', leadId: selectedLead.id }])
    if (!alreadyToday) awardXp(30, 'Profile sent')
    unlockAchievement('first-profile')
    notify('Profile sent recorded in CRM and today’s mission.')
  }

  const moveToPricingQueue = () => {
    const missing = pricingReadiness(selectedLead).filter((item) => !item.ready)
    if (!canEnterPricingQueue(selectedLead)) return notify(`Still needed for Pricing Desk: ${missing.map((item) => item.label).join(' · ')}`)
    const alreadyToday = daily.events.some((event) => event.type === 'pricing' && event.leadId === selectedLead.id && event.date === today)
    updateSelectedLead({ quoteReady: true, inPricingQueue: true, managementPricingNeeded: true, pricingQueueAt: today, pricingStage: selectedLead.pricingStage || 'Needs pricing', quotationStatus: 'Pricing queue', status: 'Pricing Queue', lastResult: 'Moved to Pricing Desk pricing queue' }, 'Moved to Pricing Desk pricing queue')
    addDailyEvents([{ type: 'quoteReady', leadId: selectedLead.id }, { type: 'pricing', leadId: selectedLead.id }])
    if (!alreadyToday) awardXp(160, 'Pricing Desk handoff')
    unlockAchievement('first-quote')
    unlockAchievement('first-handoff')
    if (quoteLeads.length + (selectedLead.inPricingQueue ? 0 : 1) >= 5) unlockAchievement('five-quotes')
    notify('Handoff ready. Copy the Pricing Desk message from Call Mode or Quote Queue.')
  }

  const addLead = () => {
    const lead = normalizeLead({ id: `custom-${Date.now()}`, company: 'New lead', region: territory === 'ALL' ? 'NCR' : territory, status: 'New Lead', priority: 'Low', lastResult: 'Not called' })
    setLeads((current) => [withActivity(lead, {}, 'Lead created in CRM'), ...current])
    setSelectedLeadId(lead.id)
    notify('New editable CRM row added.')
  }

  const addDiscoveredLeads = (incoming, options = {}) => {
    const { pickForQueue = false, forceResearch = false } = typeof options === 'boolean' ? { pickForQueue: options } : options
    const availableSlots = daily.rosterLocked ? 0 : Math.max(0, 20 - selectedCount)
    const existingIds = new Set(leads.map((lead) => lead.id))
    const additions = incoming.filter((lead) => !existingIds.has(lead.id)).map((lead, index) => withActivity(normalizeLead({ ...lead, selected: Boolean(pickForQueue && index < availableSlots), researchStatus: forceResearch ? 'Needs Research' : lead.researchStatus, verificationStatus: forceResearch ? 'Needs Research' : lead.verificationStatus, researchNotes: forceResearch ? `${lead.researchNotes || ''} Sent directly to Research Queue for contact verification.`.trim() : lead.researchNotes }), {}, forceResearch ? 'Discovered lead sent to Research Queue' : 'Lead approved from online discovery', lead.sourceUrl))
    if (!additions.length) return notify('Those discovered leads are already in the CRM.')
    setLeads((current) => [...additions, ...current])
    setSelectedLeadId(additions[0].id)
    setActiveView(forceResearch ? 'conversion' : pickForQueue ? 'queue' : 'crm')
    notify(`${additions.length} online lead${additions.length === 1 ? '' : 's'} added${forceResearch ? ' to the Research Queue' : pickForQueue && availableSlots ? '; available roster slots were picked' : ' to the local CRM'}. Verify contact data before calling.`)
  }

  const importCrmRows = (rows, mode) => {
    const result = mergeCrmLeads(leads, rows, mode)
    setLeads(result.leads)
    notify(`CRM import complete: ${result.added} added, ${result.updated} updated.`)
  }

  const deleteLead = (id) => {
    const lead = leads.find((item) => item.id === id)
    if (!window.confirm(`Delete ${lead?.company || 'this lead'} from the local CRM?`)) return
    setLeads((current) => current.filter((item) => item.id !== id))
    if (selectedLeadId === id) setSelectedLeadId(leads.find((item) => item.id !== id)?.id)
    notify('Lead removed from the local CRM.')
  }

  const exportCsv = () => {
    const fields = ['company', 'region', 'location', 'phone', 'email', 'contactPerson', 'contactRole', 'directPhone', 'emailConfirmed', 'canSendProfile', 'status', 'lastResult', 'lastContacted', 'nextFollowUp', 'warmLead', 'retryStatus', 'retryCountToday', 'nextRetryTime', 'researchStatus', 'verificationStatus', 'verifiedAt', 'researchPhone', 'researchEmail', 'researchUrl', 'researchNotes', 'leadSource', 'sourceName', 'sourceUrl', 'sourceFetchedAt', 'sourceQuery', 'materialNeeded', 'volumeNeeded', 'deliveryLocation', 'deliveryLocationConfirmed', 'deliveryLatitude', 'deliveryLongitude', 'targetPrice', 'urgency', 'sampleDocStatus', 'sampleRequired', 'materialSampleNeeded', 'sampleSubmissionLocation', 'sampleReceivingContact', 'sampleDeadline', 'sampleStatus', 'sampleSubmittedDate', 'documentsRequired', 'profileSent', 'quotationStatus', 'managementPricingNeeded', 'inPricingQueue', 'pricingStage', 'quotedPrice', 'quoteDueDate', 'submittedToSirLukeAt', 'quotationSentAt', 'pricingFollowUpDate', 'opportunityValue', 'commissionRate', 'dealProbability', 'sirLukeNotes', 'outcomeNotes', 'callsMade', 'lastOperator', 'exportedBy', 'exportedAt', 'notes']
    const exportedAt = new Date().toISOString()
    const csv = csvTextForLeads(fields, leads.map((lead) => ({ ...lead, exportedBy: profile.name, exportedAt })))
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sales-os-crm-${today}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('Updated CRM CSV exported.')
  }

  const generateReport = async () => {
    const followups = leads.filter((lead) => daily.events.some((event) => event.type === 'followup' && event.leadId === lead.id && event.date === today)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp))
    const warmLeads = leads.filter((lead) => daily.calls.some((call) => call.leadId === lead.id && call.answered) || daily.events.some((event) => event.leadId === lead.id && ['quoteReady', 'pricing'].includes(event.type))).sort((a, b) => Number(b.inPricingQueue) - Number(a.inPricingQueue)).slice(0, 5)
    const confirmedDeliveries = leads.filter((lead) => daily.events.some((event) => event.type === 'deliveryConfirmed' && event.leadId === lead.id && event.date === today))
    const sirLukeIssues = leads.filter((lead) => lead.inPricingQueue && (!lead.volumeNeeded || (!lead.targetPrice && !lead.notes))).slice(0, 5)
    const openPipeline = leads.filter((lead) => lead.inPricingQueue && lead.pricingStage !== 'Lost')
    const pipelineValue = openPipeline.reduce((sum, lead) => sum + Number(String(lead.opportunityValue || '').replace(/[^\d.]/g, '') || 0), 0)
    const estimatedCommission = openPipeline.reduce((sum, lead) => sum + commissionEstimate(lead), 0)
    const report = [
      `SALES OS DAILY REPORT — ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`,
      `Operator: ${profile.name} · ${profile.company}`,
      `Mission focus: ${profile.currentSalesGoal || '5 quote-ready leads daily'}`,
      '', 'TODAY',
      `Calls made: ${metrics.calls}`, `Real people answered: ${metrics.answered}`, `Profiles sent: ${metrics.profiles}`,
      `Quotation-ready leads: ${metrics.quotes}`, `Sample requests: ${metrics.samples}`, `Pricing Desk handoffs: ${metrics.pricing}`,
      `Retry-later leads: ${metrics.retries}`, `Invalid/research leads: ${metrics.invalid}`, `Warm leads captured: ${metrics.warm}`,
      `Delivery/project locations confirmed: ${metrics.deliveries}`, `XP earned: ${metrics.xpEarned}`,
      `Open pipeline value: PHP ${pipelineValue.toLocaleString()}`, `Estimated commission: PHP ${Math.round(estimatedCommission).toLocaleString()}`,
      '', 'TOP WARM LEADS',
      ...(warmLeads.length ? warmLeads.map((lead) => `- ${lead.company} · ${lead.lastResult} · ${lead.materialNeeded || 'Material pending'} · ${lead.pricingStage || 'Not queued'}`) : ['- None yet']),
      '', 'CONFIRMED DELIVERY / DISTANCE NOTES',
      ...(confirmedDeliveries.length ? confirmedDeliveries.map((lead) => `- ${lead.company}: ${lead.deliveryLocation} · ${distanceIntelligence(lead, userLocation.position).notes || 'Live location unavailable'}`) : ['- None confirmed today']),
      '', 'NEXT FOLLOW-UPS',
      ...(followups.length ? followups.map((lead) => `- ${lead.nextFollowUp} · ${lead.company} · ${lead.lastResult}`) : ['- None scheduled today']),
      '', 'QUESTIONS / ISSUES FOR PRICING DESK',
      ...(sirLukeIssues.length ? sirLukeIssues.map((lead) => `- ${lead.company}: ${!lead.volumeNeeded ? 'Volume missing. ' : ''}${!lead.targetPrice && !lead.notes ? 'Target/current price context missing.' : ''}`) : ['- No open pricing-data issues found']),
      '', 'REMINDER: Export the updated CRM CSV before closing the day.',
    ].join('\n')
    setReportText(report)
    try { await navigator.clipboard.writeText(report); notify('Daily report generated and copied to clipboard.') } catch { notify('Daily report generated below.') }
  }

  const resetDay = () => {
    setLeads((current) => current.map((lead) => ({ ...lead, selected: false, checklist: Array(7).fill(false), conversationNode: 'opening', conversationPath: [] })))
    setDaily(createDailyState())
    setActiveView('mission')
    setReportText('')
    notify('New daily mission started. Permanent CRM history and career XP were preserved.')
  }

  const resetDailyFromSettings = () => {
    if (!window.confirm('Start a fresh daily mission? This clears today’s roster, active call, and mission counters but keeps CRM history, XP, profile, and settings.')) return
    resetDay()
    setSettingsOpen(false)
  }

  const factoryResetLocal = () => {
    if (!window.confirm('Factory reset local Sales OS data? This removes local CRM edits, test calls, XP, profile/settings, and reloads seed leads. Export CRM first if needed.')) return
    Object.keys(localStorage).filter((key) => key.startsWith('sales-os-')).forEach((key) => localStorage.removeItem(key))
    window.location.reload()
  }

  const changeTheme = (value) => {
    setTheme(value)
    setProfile((current) => ({ ...current, preferredTheme: value }))
  }

  const changeProfile = (next) => {
    setProfile(next)
    if (next.preferredTheme && next.preferredTheme !== theme) setTheme(next.preferredTheme)
    if (next.territoryFocus && next.territoryFocus !== profile.territoryFocus) setTerritory(next.territoryFocus)
  }

  const switchOperator = (id) => {
    if (id === activeOperatorId) return
    const saved = operators.map((operator) => operator.id === activeOperatorId ? { ...operator, profile, progress, daily, selectedLeadIds: selectedLeads.map((lead) => lead.id) } : operator)
    const target = saved.find((operator) => operator.id === id)
    if (!target) return
    setOperators(saved)
    setActiveOperatorId(id)
    setProfile({ ...defaultProfile, ...target.profile })
    setProgress({ ...createProgress(), ...target.progress })
    setDaily(target.daily?.date === today ? { ...createDailyState(), ...target.daily, activeCall: null } : createDailyState())
    const targetIds = new Set(target.selectedLeadIds || [])
    setLeads((current) => current.map((lead) => ({ ...lead, selected: targetIds.has(lead.id) })))
    setSelectedLeadId(target.selectedLeadIds?.[0] || leads[0]?.id)
    setTerritory(target.profile?.territoryFocus || 'ALL')
    setActiveView('mission')
    notify(`Operator switched to ${target.profile?.name || 'Operator'}. Personal XP, goals, and daily session loaded.`)
  }

  const addOperator = () => {
    const id = `operator-${Date.now()}`
    const nextProfile = { ...defaultProfile, name: `Operator ${operators.length + 1}`, initials: `O${operators.length + 1}`.slice(0, 3), photo: '', companyLogo: profile.companyLogo, company: profile.company, territoryFocus: territory }
    const next = { id, profile: nextProfile, progress: createProgress(), daily: createDailyState(), selectedLeadIds: [] }
    setOperators((current) => [...current.map((operator) => operator.id === activeOperatorId ? { ...operator, profile, progress, daily, selectedLeadIds: selectedLeads.map((lead) => lead.id) } : operator), next])
    setActiveOperatorId(id)
    setProfile(nextProfile)
    setProgress(createProgress())
    setDaily(createDailyState())
    setLeads((current) => current.map((lead) => ({ ...lead, selected: false })))
    setEditingProfile(true)
    notify('New operator created. Add their name, photo, role, goals, and territory.')
  }

  const removeOperator = (id) => {
    if (operators.length <= 1) return notify('Sales OS needs at least one operator.')
    const target = operators.find((operator) => operator.id === id)
    if (!window.confirm(`Remove ${target?.profile?.name || 'this operator'} and their personal XP/session data? Shared CRM leads will remain.`)) return
    const remaining = operators.filter((operator) => operator.id !== id)
    setOperators(remaining)
    if (id === activeOperatorId) {
      const next = remaining[0]
      setActiveOperatorId(next.id)
      setProfile({ ...defaultProfile, ...next.profile })
      setProgress({ ...createProgress(), ...next.progress })
      setDaily(next.daily?.date === today ? { ...createDailyState(), ...next.daily, activeCall: null } : createDailyState())
      const targetIds = new Set(next.selectedLeadIds || [])
      setLeads((current) => current.map((lead) => ({ ...lead, selected: targetIds.has(lead.id) })))
    }
    notify('Operator removed. Shared CRM history was preserved.')
  }

  const startPracticeMode = () => {
    if (practiceSession.active) return setOnboardingOpen(false)
    setPracticeSession({ active: true, backup: { leads, daily, progress, territory, selectedLeadId, activeView } })
    setLeads(practiceLeads.map((lead) => ({ ...lead, selected: true })))
    setDaily({ ...createDailyState(), rosterLocked: true })
    setProgress(createProgress())
    setTerritory('ALL')
    setSelectedLeadId(practiceLeads[0].id)
    setActiveView('mission')
    setOnboardingComplete(true)
    setOnboardingOpen(false)
    notify('Practice Mode started. These sample leads are safe and never belong to the real CRM.')
  }

  const endPracticeMode = () => {
    const backup = practiceSession.backup
    if (!backup) return
    setLeads(backup.leads)
    setDaily(backup.daily)
    setProgress(backup.progress)
    setTerritory(backup.territory)
    setSelectedLeadId(backup.selectedLeadId)
    setActiveView(backup.activeView || 'mission')
    setPracticeSession({ active: false, backup: null })
    notify('Practice Mode closed. Your real CRM and operator session are restored.')
  }

  const closeOnboarding = () => { setOnboardingComplete(true); setOnboardingOpen(false) }

  const changeLogo = (companyLogo) => setProfile((current) => ({ ...current, companyLogo }))

  const handleSummaryAction = (action) => {
    setSessionSummaryOpen(false)
    if (action === 'conversion') setActiveView('conversion')
    if (action === 'reports') { setActiveView('reports'); generateReport() }
    if (action === 'export') exportCsv()
  }

  const appStyle = {
    '--glass-blur': `${Math.max(8, Math.round((appearance.blur || 0) * .42))}px`,
    '--glass-alpha': Math.max(.28, Math.min(.92, 1 - Number(appearance.transparency || 0) / 135)),
    '--glass-intensity': Number(appearance.intensity || 0) / 100,
    '--glass-reflection': Number(appearance.reflection || 0) / 100,
    ...(appearance.customBackground ? { '--custom-background': `url("${appearance.customBackground}")` } : {}),
  }

  return (
    <div style={appStyle} className={`app view-${activeView} theme-${theme}${theme === 'midnight' ? ' dark' : ''} background-${appearance.background || 'auto'}${appearance.dimBackground ? ' dim-background' : ''}${appearance.reducedMotion ? ' reduced-motion' : ''}${effectiveLeftCollapsed ? ' left-collapsed' : ''}${effectiveRightCollapsed ? ' right-collapsed' : ''}${focusMode ? ' focus-mode' : ''}${demoMode ? ' demo-mode' : ''}${practiceSession.active ? ' practice-mode' : ''}`}>
      <SystemRail theme={theme} onThemeChange={changeTheme} territory={territory} onTerritoryChange={setTerritory} profile={profile} onLogoChange={changeLogo} onOpenSettings={() => setSettingsOpen(true)} leftCollapsed={effectiveLeftCollapsed} onToggleLeft={() => focusMode ? setFocusMode(false) : setLeftSidebarCollapsed((value) => !value)} rightCollapsed={effectiveRightCollapsed} onToggleRight={() => focusMode ? setFocusMode(false) : setRightRailCollapsed((value) => !value)} focusMode={focusMode} onToggleFocus={() => setFocusMode((value) => !value)} onOpenOnboarding={() => setOnboardingOpen(true)} practiceMode={practiceSession.active} demoMode={demoMode} />
      <Sidebar activeView={activeView} onViewChange={setActiveView} level={level} xp={xp} nextXp={nextXp} rank={rank} selectedCount={selectedCount} rosterLocked={daily.rosterLocked} profile={profile} onEditProfile={() => setEditingProfile(true)} leads={mapLeads} selectedLead={selectedLead} territory={territory} userLocation={userLocation} onEnableLocation={userLocation.enable} onOpenLead={(id) => openLead(id)} collapsed={effectiveLeftCollapsed} rightCollapsed={effectiveRightCollapsed} operators={operators} activeOperatorId={activeOperatorId} onOperatorChange={switchOperator} companionMode={profile.companionMode} reducedMotion={appearance.reducedMotion} />
      <main className="main-content">
        {activeView === 'mission' ? <><MissionRail selectedCount={selectedCount} answeredCount={metrics.answered} quoteCount={metrics.quotes} capturedCount={capturedCount} profileCount={metrics.profiles} pricingCount={metrics.pricing} onStartCall={startNextCall} activeCall={Boolean(daily.activeCall)} operatorName={profile.name} /><div className="mission-workspace"><LeadQueue leads={leads} selectedLeadId={selectedLeadId} onOpenLead={setSelectedLeadId} onToggleSelected={toggleSelected} territory={territory} onTerritoryChange={setTerritory} /><LeadWorkspace lead={selectedLead} operatorName={profile.name} userLocation={userLocation} selectedCount={selectedCount} selectedLeads={selectedLeads} onSelectLead={setSelectedLeadId} onUpdateLead={updateSelectedLead} onSaveCall={() => daily.activeCall ? notify('Use Save Call & Start Next Lead inside Call Mode.') : startCallForLead(selectedLead)} onSendProfile={sendProfile} onMarkQuoteReady={moveToPricingQueue} onQuickResult={recordQuickResult} /></div></> : null}
        {activeView === 'queue' ? <QueuePlannerView leads={leads} selectedLeadId={selectedLeadId} selectedLeads={selectedLeads} onOpenLead={(id) => openLead(id, 'queue')} onToggleSelected={toggleSelected} territory={territory} onTerritoryChange={setTerritory} rosterLocked={daily.rosterLocked} onAutoPick={autoPick} onToggleLock={toggleRosterLock} onClear={clearPicks} /> : null}
        {activeView === 'quotes' ? <QuoteQueueView leads={leads} onUpdateLead={updateLead} onOpenLead={(id) => openLead(id)} /> : null}
        {activeView === 'conversion' ? <ConversionDesk leads={leads} onUpdateLead={updateLead} onOpenLead={(id) => openLead(id)} onCallLead={startCallForLead} /> : null}
        {activeView === 'finder' ? <LeadFinderView leads={leads} territory={territory} endpoint={profile.leadSearchEndpoint || NOMINATIM_DEFAULT_ENDPOINT} provider={profile.leadSearchProvider || 'nominatim'} onAddDiscoveredLeads={addDiscoveredLeads} /> : null}
        {activeView === 'crm' ? <CrmView leads={leads} onUpdateLead={updateLead} onAddLead={addLead} onDeleteLead={deleteLead} onOpenLead={(id) => openLead(id)} onExport={exportCsv} onImport={importCrmRows} /> : null}
        {activeView === 'reports' ? <ReportsView leads={leads} metrics={metrics} progress={progress} rank={rank} profile={profile} operators={operators} activeOperatorId={activeOperatorId} onExport={exportCsv} onReset={resetDay} reportText={reportText} onGenerateReport={generateReport} /> : null}
      </main>
      <RightRail selectedCount={selectedCount} quoteCount={metrics.quotes} answeredCount={metrics.answered} callsMade={metrics.calls} profileCount={metrics.profiles} sampleCount={metrics.samples} pricingCount={metrics.pricing} xp={xp} nextXp={nextXp} rank={rank} achievements={progress.achievements || []} streak={progress.streak || 1} profile={profile} quoteLeads={quoteLeads} onOpenLead={(id) => openLead(id)} daily={daily} leads={leads} metrics={metrics} conversionCounts={{ retry: retryLeads.length, research: researchLeads.length, profiles: profileQueueLeads.length, followups: scheduledFollowUps.length }} onOpenConversion={() => setActiveView('conversion')} collapsed={effectiveRightCollapsed} onToggleCollapsed={() => focusMode ? setFocusMode(false) : setRightRailCollapsed((value) => !value)} companionMode={profile.companionMode} companionState={companionState} reducedMotion={appearance.reducedMotion} />
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
      {editingProfile ? <ProfileEditor profile={profile} onChange={changeProfile} onClose={() => setEditingProfile(false)} /> : null}
      {settingsOpen ? <SettingsModal theme={theme} onThemeChange={changeTheme} territory={territory} onTerritoryChange={setTerritory} profile={profile} onProfileChange={changeProfile} onClose={() => setSettingsOpen(false)} onResetDaily={resetDailyFromSettings} onFactoryReset={factoryResetLocal} appearance={appearance} onAppearanceChange={setAppearance} operators={operators} activeOperatorId={activeOperatorId} onOperatorChange={switchOperator} onAddOperator={addOperator} onRemoveOperator={removeOperator} demoMode={demoMode} onToggleDemo={() => setDemoMode((value) => !value)} practiceMode={practiceSession.active} onStartPractice={startPracticeMode} onEndPractice={endPracticeMode} onOpenOnboarding={() => setOnboardingOpen(true)} onExport={exportCsv} /> : null}
      {daily.activeCall && selectedLead ? <CallMode lead={selectedLead} operatorName={profile.name} operatorPhoto={profile.photo} operatorInitials={profile.initials} xp={xp} companionMode={profile.companionMode} reducedMotion={appearance.reducedMotion} userLocation={userLocation} callNumber={activeCallNumber} totalCalls={activeCallTotal} workspaceTheme={theme} callModeTheme={profile.callModeTheme || 'inherit'} onCallModeThemeChange={(value) => setProfile((current) => ({ ...current, callModeTheme: value }))} onClose={closeCallMode} onUpdateLead={updateSelectedLead} onQuickResult={recordQuickResult} onSendProfile={sendProfile} onMovePricing={moveToPricingQueue} onSaveNext={saveAndNext} shortcutsDisabled={Boolean(answeredFollowUp)} /> : null}
      {answeredFollowUp && selectedLead ? <AnsweredFollowUpModal lead={selectedLead} result={answeredFollowUp.result} operatorName={profile.name} onClose={() => { setAnsweredFollowUp(null); notify('Answered result discarded. The call remains open so you can choose a result again.') }} onSave={saveAnsweredFollowUp} /> : null}
      {sessionSummaryOpen ? <SessionSummaryModal metrics={metrics} retryCount={retryLeads.length} invalidCount={researchLeads.length} warmCount={warmLeads.length} onClose={() => setSessionSummaryOpen(false)} onAction={handleSummaryAction} /> : null}
      {xpBurst ? <div className="xp-burst" key={xpBurst.id}><strong>+{xpBurst.amount} XP</strong><span>{xpBurst.reason}</span></div> : null}
      {practiceSession.active ? <div className="practice-banner"><Play size={14} /><span><strong>Practice Mode</strong> Safe sample leads · nothing here belongs to your real CRM.</span><button onClick={endPracticeMode}>Exit practice</button></div> : null}
      {onboardingOpen ? <OnboardingModal onClose={closeOnboarding} onStartPractice={startPracticeMode} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}

export default App

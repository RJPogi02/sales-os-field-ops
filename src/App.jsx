import { useEffect, useMemo, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import rawLeads from './data/leads.json'
import { practiceLeads } from './data/practiceLeads.js'
import { CallMode } from './components/CallMode.jsx'
import { AnsweredFollowUpModal } from './components/AnsweredFollowUpModal.jsx'
import { ConversionDesk } from './components/ConversionDesk.jsx'
import { DeviceLockScreen } from './components/DeviceLockScreen.jsx'
import { LeadFinderView } from './components/LeadFinderView.jsx'
import { LeadQueue } from './components/LeadQueue.jsx'
import { LeadWorkspace } from './components/LeadWorkspace.jsx'
import { MissionRail } from './components/MissionRail.jsx'
import { ManagerDashboard } from './components/ManagerDashboard.jsx'
import { MobileNav } from './components/MobileNav.jsx'
import { OnboardingModal } from './components/OnboardingModal.jsx'
import { CrmView, QueuePlannerView, QuoteQueueView, ReportsView } from './components/Views.jsx'
import { ProfileEditor } from './components/ProfileEditor.jsx'
import { RightRail } from './components/RightRail.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { SessionSummaryModal } from './components/SessionSummaryModal.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { SystemRail } from './components/SystemRail.jsx'
import { TaskWorkspace } from './components/TaskWorkspace.jsx'
import { TeamWorkspace } from './components/TeamWorkspace.jsx'
import { usePersistentState } from './hooks/usePersistentState.js'
import { useUserLocation } from './hooks/useUserLocation.js'
import { defaultCompanyProfile, normalizeCompanyProfile } from './config/companyProfile.js'
import { csvTextForLeads, mergeCrmLeads } from './lib/csv.js'
import { candidateFingerprint, discoveredLeadDuplicate } from './lib/leadDiscovery.js'
import { createDeviceCredential, deviceUnlockSessionKey, verifyDevicePin } from './lib/deviceLock.js'
import { searchGooglePlacesText } from './lib/googlePlaces.js'
import { createPerformanceSnapshot, upsertPerformanceHistory } from './lib/performanceHistory.js'
import { managerAccess } from './lib/managerAnalytics.js'
import { normalizeTask } from './lib/tasks.js'
import { TASK_XP_DAILY_CAP, taskCompletionReward, taskCompletionRewardPatch } from './lib/taskRewards.js'
import {
  createTeamSyncClient, materializeTeamTask, membershipForUser, mergeTeamRecords, teamRoleCapabilities,
} from './lib/teamSync.js'
import {
  ANSWERED_FOLLOW_UP_RESULTS, autoPickScore, callResultXp, canEnterPricingQueue, createDailyState, dailyGoalForProfile, dailyMetrics,
  classForXp, commissionEstimate, distanceIntelligence, followUpLeads, hasQuotationBasics, isFinalCallResult, NOMINATIM_DEFAULT_ENDPOINT, normalizeLead,
  leadQueueEligibility, missionGoalsForCallTarget, phoneCountsForLeads, phoneKey, pricingReadiness, profileOpportunityLeads, rankForXp, resultAnswered, retryPatchForLead, todayKey, withActivity,
} from './lib/leadModel.js'

const seedLeads = rawLeads.map((lead) => normalizeLead({ ...lead, selected: false, answered: false, quoteReady: false, inPricingQueue: false, quoteReadyToday: false, profileSent: false, checklist: Array(7).fill(false) }))
const initialsForName = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OP'
const defaultProfile = {
  name: defaultCompanyProfile.operatorName, initials: initialsForName(defaultCompanyProfile.operatorName), company: defaultCompanyProfile.companyName, position: defaultCompanyProfile.operatorRole,
  email: '', phone: '', photo: '', territoryFocus: 'ALL', currentSalesGoal: '5 quote-ready leads daily',
  dailyCallGoal: 20,
  rankTitle: '', preferredTheme: 'glass', battleCry: 'One call at a time.', commissionGoal: '', companyLogo: '',
  leadSearchEndpoint: NOMINATIM_DEFAULT_ENDPOINT, leadSearchProvider: 'nominatim', googlePlacesApiKey: '',
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

function reviveLeads(value) {
  return (Array.isArray(value) ? value : seedLeads).map(normalizeLead)
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

function migrateCompanyProfile() {
  const operator = migrateProfile()
  try {
    const previous = JSON.parse(localStorage.getItem('sales-os-company-profile-v1') || 'null')
    return normalizeCompanyProfile(previous || {
      ...defaultCompanyProfile,
      companyName: operator.company,
      operatorName: operator.name,
      operatorRole: operator.position,
    })
  } catch {
    return normalizeCompanyProfile({
      ...defaultCompanyProfile,
      companyName: operator.company,
      operatorName: operator.name,
      operatorRole: operator.position,
    })
  }
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
  const [leads, setLeads] = usePersistentState('sales-os-leads-v6', migrateLeads, reviveLeads)
  const [daily, setDaily] = usePersistentState('sales-os-daily-v6', migrateDaily)
  const [progress, setProgress] = usePersistentState('sales-os-progress-v6', migrateProgress)
  const [profile, setProfile] = usePersistentState('sales-os-profile-v3', migrateProfile)
  const [companyProfile, setCompanyProfile] = usePersistentState('sales-os-company-profile-v1', migrateCompanyProfile)
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
  const [tasks, setTasks] = usePersistentState('sales-os-tasks-v1', [])
  const [performanceHistory, setPerformanceHistory] = usePersistentState('sales-os-performance-history-v1', [])
  const [deviceLock, setDeviceLock] = usePersistentState('sales-os-device-lock-v1', { enabled: false })
  const [discoveryXpLedger, setDiscoveryXpLedger] = usePersistentState('sales-os-discovery-xp-ledger-v1', [])
  const [teamConfig, setTeamConfig] = usePersistentState('sales-os-team-config-v1', { url: '', anonKey: '' })
  const [teamSession, setTeamSession] = usePersistentState('sales-os-team-session-v1', null)
  const [teamWorkspace, setTeamWorkspace] = usePersistentState('sales-os-team-workspace-v1', null)
  const [teamSyncMeta, setTeamSyncMeta] = usePersistentState('sales-os-team-sync-meta-v1', { syncedCallIds: [] })
  const [managerViewEnabled, setManagerViewEnabled] = usePersistentState('sales-os-manager-view-v1', true)
  const [teamSnapshot, setTeamSnapshot] = useState({ memberships: [], claims: [], callEvents: [], tasks: [] })
  const [teamSyncState, setTeamSyncState] = useState({ status: 'local', error: '', lastSyncedAt: '' })
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = usePersistentState('sales-os-left-sidebar-v1', false)
  const [rightRailCollapsed, setRightRailCollapsed] = usePersistentState('sales-os-right-rail-v1', false)
  const [focusMode, setFocusMode] = usePersistentState('sales-os-focus-mode-v1', false)
  const [appearance, setAppearance] = usePersistentState('sales-os-appearance-v1', defaultAppearance)
  const [demoMode, setDemoMode] = usePersistentState('sales-os-demo-mode-v1', false)
  const [practiceSession, setPracticeSession] = usePersistentState('sales-os-practice-v1', { active: false, backup: null })
  const [onboardingComplete, setOnboardingComplete] = usePersistentState('sales-os-onboarding-v2', false)
  const [activeView, setActiveView] = useState('mission')
  const mainContentRef = useRef(null)
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
  const [deviceUnlocked, setDeviceUnlocked] = useState(() => {
    if (!deviceLock?.enabled) return true
    try { return sessionStorage.getItem(deviceUnlockSessionKey) === '1' } catch { return false }
  })
  const userLocation = useUserLocation()
  const today = todayKey()
  const teamClient = useMemo(() => {
    try { return createTeamSyncClient(teamConfig, teamSession, { onSession: setTeamSession }) } catch { return null }
  }, [setTeamSession, teamConfig, teamSession])
  const currentTeamMembership = useMemo(() => membershipForUser(teamSnapshot.memberships, teamSession?.user?.id) || (teamWorkspace?.id && teamSession?.user?.id ? {
    user_id: teamSession.user.id,
    role: teamWorkspace.role || (String(teamWorkspace.created_by || '') === String(teamSession.user.id) ? 'owner' : 'rep'),
    status: teamWorkspace.membership_status || teamWorkspace.status || 'active',
  } : null), [teamSession?.user?.id, teamSnapshot.memberships, teamWorkspace])
  const teamCapabilities = useMemo(() => teamRoleCapabilities(currentTeamMembership?.role, currentTeamMembership?.status), [currentTeamMembership?.role, currentTeamMembership?.status])
  const teamGuardEnabled = Boolean(teamClient && teamSession?.user?.id && teamWorkspace?.id && teamCapabilities.canUseTeamWorkspace)
  const teamConnected = Boolean(teamGuardEnabled && teamSyncState.status === 'connected')
  const teamIdentityEstablished = Boolean(teamSession?.user?.id && teamWorkspace?.id)
  const managerDashboardAllowed = teamIdentityEstablished
    ? teamCapabilities.canViewManagerDashboard
    : managerAccess({ localToggle: managerViewEnabled })
  const queueActorId = teamGuardEnabled ? teamSession.user.id : activeOperatorId
  const [validatedTeamCallId, setValidatedTeamCallId] = useState('')

  useEffect(() => {
    if (activeView === 'manager' && !managerDashboardAllowed) setActiveView('mission')
  }, [activeView, managerDashboardAllowed])

  useEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeView])

  useEffect(() => {
    if (daily.date !== today) setDaily(createDailyState(dailyGoalForProfile(profile)))
  }, [daily.date, profile, setDaily, today])

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
  const taskOperators = useMemo(() => {
    const rows = operators.map((operator) => ({ id: operator.id, name: operator.profile?.name || 'Operator', source: 'device' }))
    teamSnapshot.memberships.forEach((membership) => {
      const id = String(membership.user_id || membership.userId || '')
      if (!id || rows.some((operator) => operator.id === id)) return
      rows.push({ id, name: membership.profile?.display_name || membership.displayName || membership.email || 'Team member', source: 'team' })
    })
    return rows
  }, [operators, teamSnapshot.memberships])
  const preferredCallGoal = dailyGoalForProfile(profile)
  const missionTarget = daily.rosterLocked || daily.calls.length ? Number(daily.callGoal || preferredCallGoal) : preferredCallGoal
  const missionGoals = useMemo(() => missionGoalsForCallTarget(missionTarget), [missionTarget])
  const rosterLeadIds = daily.rosterLeadIds?.length ? daily.rosterLeadIds : selectedLeads.map((lead) => lead.id)
  const rosterLeads = useMemo(() => {
    const positions = new Map(rosterLeadIds.map((id, index) => [id, index]))
    return leads.filter((lead) => positions.has(lead.id)).sort((a, b) => positions.get(a.id) - positions.get(b.id))
  }, [leads, rosterLeadIds])
  const quoteLeads = useMemo(() => leads.filter((lead) => lead.inPricingQueue), [leads])
  const phoneCounts = useMemo(() => phoneCountsForLeads(leads), [leads])
  const completedTodayIds = useMemo(() => {
    const ids = new Set(daily.completedLeadIds || [])
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
    teamSnapshot.callEvents.forEach((event) => {
      const occurredAt = event.occurred_at || event.occurredAt
      if (occurredAt && formatter.format(new Date(occurredAt)) === today) ids.add(String(event.lead_id || event.leadId || ''))
    })
    return ids
  }, [daily.completedLeadIds, teamSnapshot.callEvents, today])
  const queueEligibleIds = useMemo(() => leads.filter((lead) => leadQueueEligibility(lead, {
    territory, completedIds: completedTodayIds, phoneCounts, operatorId: queueActorId, today,
  }).eligible).map((lead) => lead.id), [completedTodayIds, leads, phoneCounts, queueActorId, territory, today])
  const retryLeads = useMemo(() => leads.filter((lead) => lead.retryStatus), [leads])
  const researchLeads = useMemo(() => leads.filter((lead) => lead.researchStatus === 'Needs Research' || lead.status === 'Invalid Contact'), [leads])
  const profileQueueLeads = useMemo(() => profileOpportunityLeads(leads), [leads])
  const scheduledFollowUps = useMemo(() => followUpLeads(leads), [leads])
  const warmLeads = useMemo(() => leads.filter((lead) => lead.warmLead), [leads])
  const mapLeads = useMemo(() => leads.filter((lead) => territory === 'ALL' || lead.region === territory), [leads, territory])
  const metrics = useMemo(() => dailyMetrics(daily), [daily])
  const currentPerformanceSnapshot = useMemo(() => createPerformanceSnapshot(daily, metrics, {
    leads, operatorId: queueActorId, operatorName: profile.name, goal: missionTarget,
  }), [daily, leads, metrics, missionTarget, profile.name, queueActorId])
  const selectedCount = selectedLeads.length
  const rosterProgressCount = daily.rosterLocked ? rosterLeadIds.length : selectedCount
  const capturedCount = selectedLeads.filter(hasQuotationBasics).length
  const xp = progress.xp
  const level = Math.floor(xp / 500) + 1
  const rank = useMemo(() => rankForXp(xp), [xp])
  const nextXp = rank.nextXp
  const activeCallIndex = rosterLeads.findIndex((lead) => lead.id === daily.activeCall?.leadId)
  const activeCallNumber = activeCallIndex >= 0 ? activeCallIndex + 1 : 1
  const activeCallTotal = activeCallIndex >= 0 ? rosterLeads.length : 1
  const effectiveLeftCollapsed = Boolean(focusMode || leftSidebarCollapsed)
  const effectiveRightCollapsed = Boolean(focusMode || rightRailCollapsed)
  const companionState = daily.activeCall ? 'call-mode' : companionEvent

  useEffect(() => {
    if (practiceSession.active) return
    setPerformanceHistory((current) => upsertPerformanceHistory(current, currentPerformanceSnapshot))
  }, [currentPerformanceSnapshot, practiceSession.active, setPerformanceHistory])

  useEffect(() => {
    if (!deviceLock?.enabled) setDeviceUnlocked(true)
  }, [deviceLock?.enabled])

  useEffect(() => {
    if (practiceSession.active) return
    setOperators((current) => current.map((operator) => operator.id === activeOperatorId ? { ...operator, profile, progress, daily, selectedLeadIds: selectedLeads.map((lead) => lead.id) } : operator))
  }, [activeOperatorId, daily, practiceSession.active, profile, progress, selectedLeads, setOperators])

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(window.__salesToast)
    window.__salesToast = window.setTimeout(() => setToast(''), 3200)
  }

  const addTask = (task) => {
    const normalized = normalizeTask({ ...task, assigneeId: task.assigneeId || queueActorId })
    setTasks((current) => current.some((item) => item.id === normalized.id) ? current : [normalized, ...current])
    notify('Task added. Complete it to earn small, daily-capped work XP.')
  }

  const updateTask = (id, patch) => {
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    let nextPatch = patch
    let awarded = 0
    if (patch.status === 'completed' && task.status !== 'completed' && !task.xpAwardedAt) {
      const remaining = Math.max(0, TASK_XP_DAILY_CAP - Number(daily.taskXpEarned || 0))
      awarded = Math.min(taskCompletionReward(task), remaining)
      nextPatch = { ...patch, ...taskCompletionRewardPatch(task, awarded) }
    }
    setTasks((current) => current.map((item) => item.id === id ? normalizeTask({ ...item, ...nextPatch, id, updatedAt: new Date().toISOString() }) : item))
    if (nextPatch.xpAwardedAt) {
      setDaily((current) => ({ ...current, taskXpEarned: Number(current.taskXpEarned || 0) + awarded }))
      if (awarded) awardXp(awarded, `Task complete · ${task.title}`)
      notify(awarded ? `Task completed · +${awarded} XP.` : `Task completed. Today’s ${TASK_XP_DAILY_CAP} task-XP cap is already reached.`)
    }
  }
  const deleteTask = (id) => setTasks((current) => current.filter((task) => task.id !== id))

  const saveTeamConfig = async (next) => {
    setTeamConfig(next)
    setTeamSession(null)
    setTeamWorkspace(null)
    setTeamSnapshot({ memberships: [], claims: [], callEvents: [], tasks: [] })
    setTeamSyncState({ status: 'configured', error: '', lastSyncedAt: '' })
    notify('Team service saved locally. Sign in to activate cross-laptop sync.')
  }

  const signInTeam = async ({ email, password }) => {
    const session = await createTeamSyncClient(teamConfig, null).signIn(email, password)
    setTeamSession(session)
    setTeamSyncState({ status: 'signed-in', error: '', lastSyncedAt: '' })
    notify('Signed in. Create or join the company workspace next.')
  }

  const signUpTeam = async ({ email, password, displayName }) => {
    const result = await createTeamSyncClient(teamConfig, null).signUp(email, password, displayName || profile.name)
    if (result.pendingConfirmation) {
      setTeamSyncState({ status: 'configured', error: '', lastSyncedAt: '' })
      notify('Account created. Confirm the email, then sign in.')
      return
    }
    setTeamSession(result)
    setTeamSyncState({ status: 'signed-in', error: '', lastSyncedAt: '' })
    notify('Account ready. Create or join the company workspace.')
  }

  const signOutTeam = async () => {
    try { await teamClient?.signOut() } catch { /* clear this device even if the remote session expired */ }
    setTeamSession(null)
    setTeamWorkspace(null)
    setTeamSnapshot({ memberships: [], claims: [], callEvents: [], tasks: [] })
    setTeamSyncState({ status: teamConfig.url ? 'configured' : 'local', error: '', lastSyncedAt: '' })
    notify('Team session signed out. Local CRM remains available.')
  }

  const createTeamWorkspace = async (name) => {
    if (!teamClient) throw new Error('Save a valid Supabase connection first.')
    const workspace = await teamClient.createOrganization(name)
    setTeamWorkspace(workspace)
    setTeamSyncState({ status: 'ready', error: '', lastSyncedAt: '' })
    notify('Company workspace created. Share the invite code with your coworker.')
  }

  const joinTeamWorkspace = async (inviteCode) => {
    if (!teamClient) throw new Error('Save a valid Supabase connection first.')
    const workspace = await teamClient.joinOrganization(inviteCode)
    setTeamWorkspace(workspace)
    const pending = workspace?.membership_status === 'pending' || workspace?.status === 'pending'
    setTeamSyncState({ status: pending ? 'pending' : 'ready', error: '', lastSyncedAt: '' })
    notify(pending ? 'Team access requested. An owner or manager must approve you before sync starts.' : 'Joined the company workspace. Run the first sync when ready.')
  }

  const syncTeam = async ({ push = true, quiet = false, membershipOverride = null } = {}) => {
    if (!teamClient || !teamWorkspace?.id || !teamSession?.user?.id) throw new Error('Sign in and choose a team before syncing.')
    const syncCapabilities = membershipOverride
      ? teamRoleCapabilities(membershipOverride.role, membershipOverride.status || membershipOverride.membership_status)
      : teamCapabilities
    if (!syncCapabilities.canUseTeamWorkspace) throw new Error(syncCapabilities.status === 'pending' ? 'Team access is awaiting owner or manager approval.' : 'This team membership is not active.')
    setTeamSyncState((current) => ({ ...current, status: 'syncing', error: '' }))
    try {
      if (push) {
        await teamClient.upsertProfile({ id: teamSession.user.id, displayName: profile.name })
        const sharedLeads = leads.filter((lead) => lead.visibility !== 'private')
        const sharedTasks = tasks.filter((task) => task.scope === 'team').map((task) => ({ ...task, visibility: 'team', completed: task.status === 'completed', dueAt: task.dueDate ? `${task.dueDate}T09:00:00+08:00` : null }))
        await teamClient.upsertLeads(teamWorkspace.id, sharedLeads)
        await teamClient.upsertTasks(teamWorkspace.id, sharedTasks)
        const synced = new Set(teamSyncMeta.syncedCallIds || [])
        const unsyncedCalls = daily.calls.filter((call) => !synced.has(call.id)).map((call) => ({ ...call, leadId: call.leadId, occurredAt: call.at, payload: { result: call.result, answered: call.answered } }))
        if (unsyncedCalls.length) {
          await teamClient.recordCallEvents(teamWorkspace.id, unsyncedCalls)
          setTeamSyncMeta((current) => ({ ...current, syncedCallIds: [...new Set([...(current.syncedCallIds || []), ...unsyncedCalls.map((call) => call.id)])].slice(-5000) }))
        }
      }
      const snapshot = await teamClient.getSnapshot(teamWorkspace.id)
      setLeads((current) => {
        const claimsByLead = new Map(snapshot.claims.map((claim) => [String(claim.lead_id || claim.leadId), claim]))
        return mergeTeamRecords(current, snapshot.leads).map((lead) => {
          const claim = claimsByLead.get(String(lead.id))
          return normalizeLead(claim ? { ...lead, claimOwnerId: claim.claimed_by || claim.claimedBy, claimOwnerName: claim.claimedByName || claim.profile?.display_name || '', claimExpiresAt: claim.expires_at || claim.expiresAt } : { ...lead, claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' })
        })
      })
      setTasks((current) => mergeTeamRecords(current, snapshot.tasks, { remoteId: 'task_id', materialize: materializeTeamTask }).map(normalizeTask))
      setTeamWorkspace({
        ...(snapshot.organization || teamWorkspace),
        role: membershipOverride?.role || currentTeamMembership?.role || teamWorkspace.role || 'rep',
        membership_status: membershipOverride?.status || membershipOverride?.membership_status || currentTeamMembership?.status || teamWorkspace.membership_status || 'active',
      })
      setTeamSnapshot({ memberships: snapshot.memberships, claims: snapshot.claims, callEvents: snapshot.callEvents, tasks: snapshot.tasks })
      setTeamSyncState({ status: 'connected', error: '', lastSyncedAt: snapshot.syncedAt })
      if (!quiet) notify('Team CRM synced. Shared leads, claims, tasks, and leaderboard are current.')
      return snapshot
    } catch (error) {
      setTeamSyncState((current) => ({ ...current, status: 'error', error: error.message || 'Team sync failed.' }))
      if (!quiet) notify('Team sync failed. Local data was kept unchanged.')
      throw error
    }
  }

  const refreshTeamMembership = async ({ quiet = false } = {}) => {
    if (!teamClient || !teamWorkspace?.id || !teamSession?.user?.id) throw new Error('Sign in and choose a team before checking access.')
    if (!quiet) setTeamSyncState((current) => ({ ...current, status: 'checking-access', error: '' }))
    try {
      const refreshed = await teamClient.getMyMembership(teamWorkspace.id)
      if (!refreshed) throw new Error('Your membership could not be found. Ask the workspace owner to verify the invite request.')
      const membershipStatus = refreshed.status || 'pending'
      setTeamWorkspace((current) => ({ ...current, role: refreshed.role || 'rep', membership_status: membershipStatus, status: membershipStatus }))
      setTeamSnapshot((current) => ({
        ...current,
        memberships: [...current.memberships.filter((item) => String(item.user_id || item.userId) !== String(teamSession.user.id)), refreshed],
      }))
      if (membershipStatus === 'active') {
        await syncTeam({ push: false, quiet: true, membershipOverride: refreshed })
        if (!quiet) notify('Access approved. Team leads, tasks, and performance are now connected.')
      } else {
        setTeamSyncState((current) => ({ ...current, status: membershipStatus, error: '', lastSyncedAt: current.lastSyncedAt || '' }))
        if (!quiet) notify(membershipStatus === 'rejected' ? 'This team access request was declined.' : 'Approval is still pending. We will keep checking while Team Hub is open.')
      }
      return refreshed
    } catch (error) {
      if (!quiet) {
        setTeamSyncState((current) => ({ ...current, status: 'error', error: error.message || 'Could not check team access.' }))
        notify('Could not check team access. Your local CRM was not changed.')
      }
      throw error
    }
  }

  const releaseTeamClaim = async (claim) => {
    if (!teamClient || !teamWorkspace?.id) return
    const leadId = claim.lead_id || claim.leadId
    await teamClient.releaseLead(teamWorkspace.id, leadId)
    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' } : lead))
    await syncTeam({ push: false, quiet: true })
  }

  const setTeamOpenJoin = async (enabled) => {
    if (!teamClient || !teamWorkspace?.id || !teamCapabilities.canConfigureOpenJoin) throw new Error('Owner or manager access is required.')
    await teamClient.setOrganizationOpenJoin(teamWorkspace.id, enabled)
    setTeamWorkspace((current) => ({ ...current, open_join: Boolean(enabled) }))
    await syncTeam({ push: false, quiet: true })
    notify(enabled ? 'Invite-code joins now activate automatically as reps.' : 'New invite-code joins now require approval.')
  }

  const reviewTeamMembership = async (userId, approved) => {
    if (!teamClient || !teamWorkspace?.id || !teamCapabilities.canApproveMembers) throw new Error('Owner or manager access is required.')
    await teamClient.reviewMembership(teamWorkspace.id, userId, approved)
    await syncTeam({ push: false, quiet: true })
    notify(approved ? 'Teammate approved as a rep.' : 'Team access request declined.')
  }

  const changeTeamMemberRole = async (userId, role) => {
    if (!teamClient || !teamWorkspace?.id || !teamCapabilities.canChangeMemberRoles) throw new Error('Only the workspace owner can change team roles.')
    await teamClient.setMemberRole(teamWorkspace.id, userId, role)
    await syncTeam({ push: false, quiet: true })
    notify(`Team role updated to ${role}.`)
  }

  const assignTeamTask = async (task) => {
    if (!teamClient || !teamWorkspace?.id || !teamCapabilities.canAssignTeamTasks) throw new Error('Owner or manager access is required.')
    await teamClient.assignTeamTask(teamWorkspace.id, task)
    await syncTeam({ push: false, quiet: true })
    notify('Team task assigned and synchronized.')
  }

  useEffect(() => {
    if (activeView !== 'team' || currentTeamMembership?.status !== 'pending' || !teamClient || !teamWorkspace?.id || !teamSession?.user?.id) return undefined
    let cancelled = false
    const check = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      refreshTeamMembership({ quiet: true }).catch(() => {})
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') check() }
    check()
    const timer = window.setInterval(check, 20_000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [activeView, currentTeamMembership?.status, teamClient, teamSession?.user?.id, teamWorkspace?.id])

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
    const operatorPatch = { ...patch, lastOperator: profile.name, updatedAt: new Date().toISOString() }
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

  const toggleSelected = async (id) => {
    if (daily.rosterLocked) return notify('Quest roster is locked. Unlock it from Lead Queue before changing picks.')
    const lead = leads.find((item) => item.id === id)
    if (!lead) return
    if (!lead.selected) {
      const eligibility = leadQueueEligibility(lead, { territory, completedIds: completedTodayIds, phoneCounts, operatorId: queueActorId, today })
      if (!eligibility.eligible) return notify(`${lead.company} cannot enter today's cold-call roster: ${eligibility.reason}.`)
      if (selectedCount >= missionTarget) return notify(`Mission roster is full: ${missionTarget} leads selected.`)
      if (teamConnected) {
        try { await teamClient.claimLead(teamWorkspace.id, lead.id, 7200) } catch (error) { return notify(`${lead.company} was not picked: ${error.message || 'another teammate claimed it first'}.`) }
      }
    } else if (teamConnected && lead.claimOwnerId === queueActorId) {
      try { await teamClient.releaseLead(teamWorkspace.id, lead.id) } catch { /* local deselection still remains safe */ }
    }
    const claimPatch = lead.selected ? (lead.claimOwnerId === queueActorId ? { claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' } : {}) : {
      claimOwnerId: queueActorId, claimOwnerName: profile.name, claimExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }
    updateLead(id, { selected: !lead.selected, ...claimPatch }, lead.selected ? 'Removed from daily mission' : 'Added to daily mission')
  }

  const autoPick = async () => {
    if (daily.rosterLocked) return notify('Unlock the roster before replacing its leads.')
    const completed = completedTodayIds
    const territoryLeads = territory === 'ALL' ? leads : leads.filter((lead) => lead.region === territory)
    const seenPhones = new Set()
    const candidates = territoryLeads
      .map((lead) => ({ lead, score: autoPickScore(lead, territory, completed, userLocation.position, phoneCounts, { operatorId: queueActorId, today }) }))
      .filter((item) => item.score > -1000)
      .sort((a, b) => b.score - a.score)
      .filter(({ lead }) => { const key = phoneKey(lead.phone); if (!key || seenPhones.has(key)) return false; seenPhones.add(key); return true })
      .slice(0, missionTarget)
      .map((item) => item.lead)
    const claimedCandidates = []
    if (teamConnected) {
      for (const candidate of candidates) {
        try { await teamClient.claimLead(teamWorkspace.id, candidate.id, 7200); claimedCandidates.push(candidate) } catch { /* atomic server claim keeps this candidate out */ }
      }
    } else claimedCandidates.push(...candidates)
    const finalCandidates = claimedCandidates
    const ids = new Set(finalCandidates.map((lead) => lead.id))
    const claimExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    setLeads((current) => current.map((lead) => {
      if (ids.has(lead.id)) return { ...lead, selected: true, claimOwnerId: queueActorId, claimOwnerName: profile.name, claimExpiresAt, updatedAt: new Date().toISOString() }
      if (lead.claimOwnerId === queueActorId) return { ...lead, selected: false, claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '', updatedAt: new Date().toISOString() }
      return { ...lead, selected: false }
    }))
    if (finalCandidates[0]) setSelectedLeadId(finalCandidates[0].id)
    if (finalCandidates.length < missionTarget) return notify(`Only ${finalCandidates.length} callable ${territory} lead${finalCandidates.length === 1 ? '' : 's'} available. Completed, claimed, private, invalid, retry, and conversion leads were kept out.`)
    notify(`${missionTarget} callable ${territory} leads selected and reserved for ${profile.name}. Review them, then lock the quest roster.`)
  }

  const toggleRosterLock = () => {
    if (!daily.rosterLocked && selectedCount !== missionTarget) return notify(`Pick exactly ${missionTarget} leads before locking the quest roster (${selectedCount}/${missionTarget}).`)
    if (daily.rosterLocked && daily.calls.length) return notify('A mission with saved calls cannot be unlocked. Finish it or start a fresh daily mission from Settings.')
    setDaily((current) => ({ ...current, rosterLocked: !current.rosterLocked, callGoal: missionTarget, rosterLeadIds: current.rosterLocked ? [] : selectedLeads.map((lead) => lead.id) }))
    notify(daily.rosterLocked ? 'Quest roster unlocked.' : 'Quest roster locked. Call mode is ready.')
  }

  const clearPicks = () => {
    if (daily.rosterLocked) return notify('Unlock the roster before clearing it.')
    setLeads((current) => current.map((lead) => lead.claimOwnerId === queueActorId ? { ...lead, selected: false, claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' } : { ...lead, selected: false }))
    setDaily((current) => ({ ...current, rosterLeadIds: [] }))
    notify('Daily roster cleared.')
  }

  const openLead = (id, view = 'mission') => {
    setSelectedLeadId(id)
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reserveLeadForCall = async (lead) => {
    if (!teamGuardEnabled || lead.visibility === 'private') return true
    try {
      await teamClient.claimLead(teamWorkspace.id, lead.id, 7200)
      return true
    } catch (error) {
      // A direct CRM action and a stale locked roster must obey the same server-side
      // claim and teammate-completion check as the queue picker.
      await syncTeam({ push: false, quiet: true }).catch(() => null)
      notify(`${lead.company} was not opened: ${error.message || 'a teammate already handled or reserved it'}`)
      return false
    }
  }

  const startCallForLead = async (lead) => {
    const currentLead = leads.find((item) => item.id === lead?.id)
    if (!currentLead) { notify('That lead is no longer in the CRM. Refresh the queue and choose another.'); return null }
    const callSafety = leadQueueEligibility(currentLead, { territory: 'ALL', completedIds: new Set(), phoneCounts, operatorId: queueActorId, today })
    if (!callSafety.eligible && callSafety.reason === 'Contact needs repair') {
      setActiveView('conversion')
      notify(`${currentLead.company} cannot be called yet: ${callSafety.reason}. Verify the contact in Lead Research first.`)
      return null
    }
    if (!await reserveLeadForCall(currentLead)) return null
    const session = createCallSession(currentLead.id)
    setValidatedTeamCallId(session.id)
    setSelectedLeadId(currentLead.id)
    setDaily((current) => ({ ...current, activeCall: session }))
    updateLead(currentLead.id, { claimOwnerId: queueActorId, claimOwnerName: profile.name, claimExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }, 'Call started', session.id)
    return session
  }

  const startNextCall = async () => {
    if (!daily.rosterLocked) return notify(`Build and lock your ${missionTarget}-lead quest roster first.`)
    const completed = new Set(daily.completedLeadIds)
    const next = rosterLeads.find((lead) => !completed.has(lead.id))
    if (!next) { setSessionSummaryOpen(true); return notify('Every lead in today’s roster is complete. Review the session summary.') }
    const session = await startCallForLead(next)
    if (session) notify(`Call Mode opened for ${next.company}.`)
  }

  const closeCallMode = () => {
    setValidatedTeamCallId('')
    setDaily((current) => ({ ...current, activeCall: null }))
  }

  const commitQuickResult = (result, extraPatch = {}) => {
    const lead = selectedLead
    const session = daily.activeCall?.leadId === lead.id ? daily.activeCall : createCallSession(lead.id)
    const existingCall = daily.calls.find((call) => call.id === session.id)
    const firstAnswerForLead = resultAnswered(result) && !daily.calls.some((call) => call.leadId === lead.id && call.answered)
    const answered = resultAnswered(result)
    const resultEntry = { result, at: new Date().toISOString(), sessionId: session.id }
    const patch = { lastResult: result, lastContacted: today, lastContactedAt: resultEntry.at, callResults: [resultEntry, ...(lead.callResults || [])].slice(0, 30) }
    if (result === 'No Answer') {
      Object.assign(patch, retryPatchForLead(lead, today))
    }
    if (result === 'Wrong Number') Object.assign(patch, { answered: Boolean(lead.answered), status: 'Invalid Contact', researchStatus: 'Needs Research', retryStatus: '' })
    if (['Spoke to Staff', 'Procurement Contact Found', 'Asked for Email'].includes(result)) Object.assign(patch, { answered: true, status: result === 'Asked for Email' ? 'Follow-up Needed' : 'Contacted' })
    if (result === 'Profile Sent') Object.assign(patch, { answered: true, profileSent: true, profileSentAt: today, status: 'Profile Sent' })
    if (result === 'Sample Requested') Object.assign(patch, { answered: true, sampleRequired: true, sampleDocStatus: 'Required', status: 'Follow-up Needed' })
    if (result === 'Quotation Requested') Object.assign(patch, { answered: true })
    if (result === 'Not Interested') Object.assign(patch, { answered: true, status: 'Not Interested' })
    if (!existingCall) patch.callsMade = Number(lead.callsMade || 0) + 1
    Object.assign(patch, extraPatch)
    if (result === 'Quotation Requested') {
      const quoteReady = hasQuotationBasics({ ...lead, ...patch })
      Object.assign(patch, { quoteReady, quotationStatus: quoteReady ? 'Quotation requested' : 'Needs requirements', status: quoteReady ? 'Quotation Requested' : 'Follow-up Needed' })
    }
    if (isFinalCallResult(result)) Object.assign(patch, { selected: false, claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' })
    if (answered) Object.assign(patch, { ownerId: lead.ownerId || activeOperatorId, ownerName: lead.ownerName || profile.name })

    const events = []
    if (result === 'No Answer') events.push({ type: 'retry', leadId: lead.id })
    if (result === 'Wrong Number') events.push({ type: 'research', leadId: lead.id })
    if (result === 'Profile Sent' || (patch.profileSent && !lead.profileSent)) events.push({ type: 'profile', leadId: lead.id })
    if (result === 'Sample Requested') events.push({ type: 'sample', leadId: lead.id })
    if (result === 'Quotation Requested' && patch.quoteReady) events.push({ type: 'quoteReady', leadId: lead.id })
    if (patch.warmLead && !lead.warmLead) events.push({ type: 'warm', leadId: lead.id })

    setDaily((current) => {
      const call = { id: session.id, leadId: lead.id, result, answered, at: new Date().toISOString() }
      const calls = current.calls.some((item) => item.id === session.id) ? current.calls.map((item) => item.id === session.id ? call : item) : [...current.calls, call]
      const completedLeadIds = isFinalCallResult(result) && !current.completedLeadIds.includes(lead.id) ? [...current.completedLeadIds, lead.id] : current.completedLeadIds
      const eventAdditions = events.filter((event) => !current.events.some((item) => item.type === event.type && item.leadId === event.leadId && item.date === today)).map((event) => ({ ...event, id: `${event.type}-${event.leadId}-${Date.now()}`, date: today, at: new Date().toISOString() }))
      return { ...current, activeCall: { ...session, counted: true, result }, calls, completedLeadIds, events: [...current.events, ...eventAdditions] }
    })
    if (teamConnected && !existingCall) {
      // Publish the completion before releasing the claim. A teammate can never
      // acquire the lead in the gap between those two server operations.
      teamClient.recordCallEvents(teamWorkspace.id, [{ id: session.id, leadId: lead.id, result, occurredAt: resultEntry.at, payload: { result, answered, profileSent: Boolean(patch.profileSent), quoteReady: Boolean(patch.quoteReady) } }])
        .then(() => teamClient.releaseLead(teamWorkspace.id, lead.id).catch(() => false))
        .then(() => {
        setTeamSyncMeta((current) => ({ ...current, syncedCallIds: [...new Set([...(current.syncedCallIds || []), session.id])].slice(-5000) }))
      }).catch((error) => setTeamSyncState((current) => ({ ...current, status: 'error', error: `Call saved locally; team event sync needs retry: ${error.message}` })))
    }
    updateLead(lead.id, patch, existingCall ? 'Call result corrected' : 'Call attempt auto-saved', result)
    awardXp(callResultXp({ existingCall: Boolean(existingCall), firstAnswerForLead, result, lead, patch }), result)
    if (firstAnswerForLead) unlockAchievement('first-contact')
    if (result === 'Profile Sent') unlockAchievement('first-profile')
    if (result === 'Sample Requested') unlockAchievement('first-sample')
    if (result === 'Quotation Requested' && patch.quoteReady) unlockAchievement('first-quote')
    if (result === 'Quotation Requested' && !patch.quoteReady) notify('Call saved. Quotation still needs Material and a confirmed Delivery Location.')
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

  const advanceToNext = async (session) => {
    const inRoster = rosterLeadIds.includes(session.leadId)
    if (!inRoster) {
      setDaily((current) => ({ ...current, activeCall: null }))
      setActiveView('conversion')
      notify('Follow-up call saved. Returned to Conversion Desk.')
      return
    }
    const completed = new Set([...daily.completedLeadIds, session.leadId])
    const next = rosterLeads.find((lead) => !completed.has(lead.id))
    if (!next) {
      setDaily((current) => ({ ...current, activeCall: null, completedLeadIds: [...completed] }))
      setSessionSummaryOpen(true)
      notify(`${missionTarget}-call block complete. Review the conversion summary.`)
      return
    }
    setDaily((current) => ({ ...current, completedLeadIds: [...completed], activeCall: null }))
    const nextSession = await startCallForLead(next)
    if (nextSession) notify(`Saved. Next lead: ${next.company}`)
    else setActiveView('queue')
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
    const approverLabel = companyProfile.approverLabel || 'Pricing approver'
    const missing = pricingReadiness(selectedLead).filter((item) => !item.ready)
    if (!canEnterPricingQueue(selectedLead)) return notify(`Still needed for ${approverLabel}: ${missing.map((item) => item.label).join(' · ')}`)
    const alreadyToday = daily.events.some((event) => event.type === 'pricing' && event.leadId === selectedLead.id && event.date === today)
    updateSelectedLead({ quoteReady: true, inPricingQueue: true, managementPricingNeeded: true, pricingQueueAt: today, pricingStage: selectedLead.pricingStage || 'Needs pricing', quotationStatus: 'Pricing queue', status: 'Pricing Queue', lastResult: `Moved to ${approverLabel} pricing queue` }, `Moved to ${approverLabel} pricing queue`)
    addDailyEvents([{ type: 'quoteReady', leadId: selectedLead.id }, { type: 'pricing', leadId: selectedLead.id }])
    if (!alreadyToday) awardXp(160, `${approverLabel} handoff`)
    unlockAchievement('first-quote')
    unlockAchievement('first-handoff')
    if (quoteLeads.length + (selectedLead.inPricingQueue ? 0 : 1) >= 5) unlockAchievement('five-quotes')
    notify(`Handoff ready. Copy the ${approverLabel} message from Call Mode or Quote Queue.`)
  }

  const addLead = () => {
    const lead = normalizeLead({ id: `custom-${Date.now()}`, company: 'New lead', region: territory === 'ALL' ? 'NCR' : territory, status: 'New Lead', priority: 'Low', lastResult: 'Not called' })
    setLeads((current) => [withActivity(lead, {}, 'Lead created in CRM'), ...current])
    setSelectedLeadId(lead.id)
    notify('New editable CRM row added.')
  }

  const addDiscoveredLeads = async (incoming, options = {}) => {
    const { pickForQueue = false, forceResearch = false, visibility = 'team', ownerId = '', ownerName = '', discoveryReward = null } = typeof options === 'boolean' ? { pickForQueue: options } : options
    const availableSlots = daily.rosterLocked ? 0 : Math.max(0, missionTarget - selectedCount)
    const uniqueIncoming = []
    incoming.forEach((lead) => {
      if (!discoveredLeadDuplicate([...leads, ...uniqueIncoming], lead)) uniqueIncoming.push(lead)
    })
    let picked = 0
    const claimExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    let additions = uniqueIncoming.map((lead) => {
      const candidate = normalizeLead({
        ...lead, selected: false, visibility, ownerId, ownerName,
        researchStatus: forceResearch ? 'Needs Research' : lead.researchStatus,
        verificationStatus: forceResearch ? 'Needs Research' : lead.verificationStatus,
        researchNotes: forceResearch ? `${lead.researchNotes || ''} Sent directly to Research Queue for contact verification.`.trim() : lead.researchNotes,
      })
      const eligibility = leadQueueEligibility(candidate, { territory, completedIds: completedTodayIds, operatorId: queueActorId, today })
      const canPick = pickForQueue && picked < availableSlots && !forceResearch && eligibility.eligible
      if (canPick) picked += 1
      return withActivity(normalizeLead({ ...candidate, selected: canPick, ...(canPick ? { claimOwnerId: queueActorId, claimOwnerName: profile.name, claimExpiresAt } : {}) }), {}, forceResearch ? 'Discovered lead sent to Research Queue' : 'Lead approved from online discovery', lead.sourceUrl)
    })
    if (!additions.length) return notify('Those discovered leads are already in the CRM.')
    if (teamConnected) {
      try {
        await teamClient.upsertLeads(teamWorkspace.id, additions.filter((lead) => lead.visibility !== 'private'))
        const failed = new Set()
        for (const lead of additions.filter((item) => item.selected)) {
          try { await teamClient.claimLead(teamWorkspace.id, lead.id, 7200) } catch { failed.add(lead.id) }
        }
        if (failed.size) {
          additions = additions.map((lead) => failed.has(lead.id) ? { ...lead, selected: false, claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' } : lead)
          picked -= failed.size
        }
      } catch (error) {
        notify(`Leads stayed local because team sync could not reserve them: ${error.message}`)
      }
    }
    setLeads((current) => [...additions, ...current])
    if (!practiceSession.active && discoveryReward?.kind === 'lead-discovery-import') {
      const addedKeys = new Set(additions.map(candidateFingerprint))
      const careerKeys = new Set(Array.isArray(discoveryXpLedger) ? discoveryXpLedger : [])
      const rewardKeys = [...new Set(discoveryReward.rewardKeys || [])].filter((key) => addedKeys.has(key) && !careerKeys.has(key)).slice(0, 10)
      if (rewardKeys.length) {
        const reward = Math.min(Number(discoveryReward.maxSuggestedXp || 50), rewardKeys.length * Number(discoveryReward.xpPerUniqueLead || 5))
        setDiscoveryXpLedger((current) => [...new Set([...(Array.isArray(current) ? current : []), ...rewardKeys])].slice(-10000))
        awardXp(reward, `${rewardKeys.length} verified lead${rewardKeys.length === 1 ? '' : 's'} discovered`)
      }
    }
    setSelectedLeadId(additions[0].id)
    setActiveView(forceResearch ? 'conversion' : pickForQueue ? 'queue' : 'crm')
    notify(`${additions.length} online lead${additions.length === 1 ? '' : 's'} added${forceResearch ? ' to the Research Queue' : picked ? `; ${picked} callable lead${picked === 1 ? '' : 's'} picked` : ' to the CRM'}. ${visibility === 'private' ? 'Personal visibility' : 'Team visibility'} recorded.`)
  }

  const importCrmRows = (rows, mode, summary = {}) => {
    const result = mergeCrmLeads(leads, rows, mode)
    setLeads(result.leads)
    const duplicates = Number(summary.duplicates ?? result.duplicates ?? 0)
    const research = Number(summary.missingRequired ?? result.missingRequired ?? 0)
    notify(`CRM import complete: ${result.added} added, ${result.updated} updated, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped${research ? `, ${research} routed to Research` : ''}.`)
  }

  const deleteLead = (id) => {
    const lead = leads.find((item) => item.id === id)
    if (!window.confirm(`Delete ${lead?.company || 'this lead'} from the local CRM?`)) return
    setLeads((current) => current.filter((item) => item.id !== id))
    if (selectedLeadId === id) setSelectedLeadId(leads.find((item) => item.id !== id)?.id)
    notify('Lead removed from the local CRM.')
  }

  const exportCsv = () => {
    const fields = ['company', 'region', 'location', 'phone', 'email', 'contactPerson', 'contactRole', 'directPhone', 'emailConfirmed', 'canSendProfile', 'status', 'lastResult', 'lastContacted', 'nextFollowUp', 'warmLead', 'retryStatus', 'retryCountToday', 'nextRetryTime', 'researchStatus', 'verificationStatus', 'verifiedAt', 'researchPhone', 'researchEmail', 'researchUrl', 'researchNotes', 'leadSource', 'sourceName', 'sourceUrl', 'sourceWebsite', 'sourceFetchedAt', 'sourceQuery', 'materialNeeded', 'volumeNeeded', 'deliveryLocation', 'deliveryLocationConfirmed', 'deliveryLatitude', 'deliveryLongitude', 'targetPrice', 'urgency', 'sampleDocStatus', 'sampleRequired', 'materialSampleNeeded', 'sampleSubmissionLocation', 'sampleReceivingContact', 'sampleDeadline', 'sampleStatus', 'sampleSubmittedDate', 'documentsRequired', 'profileSent', 'quotationStatus', 'managementPricingNeeded', 'inPricingQueue', 'pricingStage', 'quotedPrice', 'quoteDueDate', 'submittedToApproverAt', 'quotationSentAt', 'pricingFollowUpDate', 'opportunityValue', 'commissionRate', 'dealProbability', 'approverNotes', 'outcomeNotes', 'callsMade', 'lastOperator', 'exportedBy', 'exportedAt', 'notes']
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
    const approverLabel = companyProfile.approverLabel || 'Pricing approver'
    const approverIssues = leads.filter((lead) => lead.inPricingQueue && (!lead.volumeNeeded || (!lead.targetPrice && !lead.notes))).slice(0, 5)
    const openPipeline = leads.filter((lead) => lead.inPricingQueue && lead.pricingStage !== 'Lost')
    const pipelineValue = openPipeline.reduce((sum, lead) => sum + Number(String(lead.opportunityValue || '').replace(/[^\d.]/g, '') || 0), 0)
    const estimatedCommission = openPipeline.reduce((sum, lead) => sum + commissionEstimate(lead), 0)
    const report = [
      `SALES OS DAILY REPORT — ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`,
      `Operator: ${profile.name} · ${profile.company}`,
      `Mission focus: ${profile.currentSalesGoal || '5 quote-ready leads daily'}`,
      '', 'TODAY',
      `Calls made: ${metrics.calls}`, `Real people answered: ${metrics.answered}`, `Profiles sent: ${metrics.profiles}`,
      `Quotation-ready leads: ${metrics.quotes}`, `Sample requests: ${metrics.samples}`, `${approverLabel} handoffs: ${metrics.pricing}`,
      `Retry-later leads: ${metrics.retries}`, `Invalid/research leads: ${metrics.invalid}`, `Warm leads captured: ${metrics.warm}`,
      `Delivery/project locations confirmed: ${metrics.deliveries}`, `XP earned: ${metrics.xpEarned}`,
      `Open pipeline value: PHP ${pipelineValue.toLocaleString()}`, `Estimated commission: PHP ${Math.round(estimatedCommission).toLocaleString()}`,
      '', 'TOP WARM LEADS',
      ...(warmLeads.length ? warmLeads.map((lead) => `- ${lead.company} · ${lead.lastResult} · ${lead.materialNeeded || 'Material pending'} · ${lead.pricingStage || 'Not queued'}`) : ['- None yet']),
      '', 'CONFIRMED DELIVERY / DISTANCE NOTES',
      ...(confirmedDeliveries.length ? confirmedDeliveries.map((lead) => `- ${lead.company}: ${lead.deliveryLocation} · ${distanceIntelligence(lead, userLocation.position).notes || 'Live location unavailable'}`) : ['- None confirmed today']),
      '', 'NEXT FOLLOW-UPS',
      ...(followups.length ? followups.map((lead) => `- ${lead.nextFollowUp} · ${lead.company} · ${lead.lastResult}`) : ['- None scheduled today']),
      '', `QUESTIONS / ISSUES FOR ${approverLabel.toUpperCase()}`,
      ...(approverIssues.length ? approverIssues.map((lead) => `- ${lead.company}: ${!lead.volumeNeeded ? 'Volume missing. ' : ''}${!lead.targetPrice && !lead.notes ? 'Target/current price context missing.' : ''}`) : ['- No open pricing-data issues found']),
      '', 'REMINDER: Export the updated CRM CSV before closing the day.',
    ].join('\n')
    setReportText(report)
    try { await navigator.clipboard.writeText(report); notify('Daily report generated and copied to clipboard.') } catch { notify('Daily report generated below.') }
  }

  const resetDay = () => {
    if (!practiceSession.active) setPerformanceHistory((current) => upsertPerformanceHistory(current, currentPerformanceSnapshot))
    setLeads((current) => current.map((lead) => ({ ...lead, selected: false, ...(lead.claimOwnerId === queueActorId ? { claimOwnerId: '', claimOwnerName: '', claimExpiresAt: '' } : {}), checklist: Array(7).fill(false), conversationNode: 'opening', conversationPath: [] })))
    setDaily(createDailyState(preferredCallGoal))
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
    try { sessionStorage.removeItem(deviceUnlockSessionKey) } catch { /* browser may block session storage */ }
    window.location.reload()
  }

  const changeTheme = (value) => {
    setTheme(value)
    setProfile((current) => ({ ...current, preferredTheme: value }))
  }

  const changeProfile = (next) => {
    setProfile(next)
    setCompanyProfile((current) => normalizeCompanyProfile({
      ...current,
      companyName: next.company || current.companyName,
      operatorName: next.name || current.operatorName,
      operatorRole: next.position || current.operatorRole,
    }))
    if (next.preferredTheme && next.preferredTheme !== theme) setTheme(next.preferredTheme)
    if (next.territoryFocus && next.territoryFocus !== profile.territoryFocus) setTerritory(next.territoryFocus)
  }

  const changeCompanyProfile = (next) => {
    const normalized = normalizeCompanyProfile(next)
    setCompanyProfile(normalized)
    setProfile((current) => ({
      ...current,
      name: normalized.operatorName || current.name,
      position: normalized.operatorRole || current.position,
      company: normalized.companyName || current.company,
    }))
  }

  const switchOperator = (id) => {
    if (id === activeOperatorId) return
    const saved = operators.map((operator) => operator.id === activeOperatorId ? { ...operator, profile, progress, daily, selectedLeadIds: selectedLeads.map((lead) => lead.id) } : operator)
    const target = saved.find((operator) => operator.id === id)
    if (!target) return
    setOperators(saved)
    setActiveOperatorId(id)
    const nextProfile = { ...defaultProfile, ...target.profile }
    setProfile(nextProfile)
    setCompanyProfile((current) => normalizeCompanyProfile({
      ...current,
      companyName: nextProfile.company || current.companyName,
      operatorName: nextProfile.name || current.operatorName,
      operatorRole: nextProfile.position || current.operatorRole,
    }))
    setProgress({ ...createProgress(), ...target.progress })
    const targetGoal = dailyGoalForProfile({ ...defaultProfile, ...target.profile })
    setDaily(target.daily?.date === today ? { ...createDailyState(targetGoal), ...target.daily, activeCall: null } : createDailyState(targetGoal))
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
    const next = { id, profile: nextProfile, progress: createProgress(), daily: createDailyState(nextProfile.dailyCallGoal), selectedLeadIds: [] }
    setOperators((current) => [...current.map((operator) => operator.id === activeOperatorId ? { ...operator, profile, progress, daily, selectedLeadIds: selectedLeads.map((lead) => lead.id) } : operator), next])
    setActiveOperatorId(id)
    setProfile(nextProfile)
    setProgress(createProgress())
    setDaily(createDailyState(nextProfile.dailyCallGoal))
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
      const nextGoal = dailyGoalForProfile({ ...defaultProfile, ...next.profile })
      setDaily(next.daily?.date === today ? { ...createDailyState(nextGoal), ...next.daily, activeCall: null } : createDailyState(nextGoal))
      const targetIds = new Set(next.selectedLeadIds || [])
      setLeads((current) => current.map((lead) => ({ ...lead, selected: targetIds.has(lead.id) })))
    }
    notify('Operator removed. Shared CRM history was preserved.')
  }

  const startPracticeMode = () => {
    if (practiceSession.active) return setOnboardingOpen(false)
    setPracticeSession({ active: true, backup: { leads, daily, progress, territory, selectedLeadId, activeView } })
    setLeads(practiceLeads.map((lead) => ({ ...lead, selected: true })))
    setDaily({ ...createDailyState(practiceLeads.length), rosterLocked: true, rosterLeadIds: practiceLeads.map((lead) => lead.id) })
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

  const setDevicePin = async (pin) => {
    const credential = await createDeviceCredential(pin)
    setDeviceLock(credential)
    try { sessionStorage.setItem(deviceUnlockSessionKey, '1') } catch { /* a current unlocked session still works in memory */ }
    setDeviceUnlocked(true)
    return credential
  }

  const disableDevicePin = () => {
    if (!window.confirm('Disable the startup PIN on this browser? Team account security is unchanged.')) return
    setDeviceLock({ enabled: false })
    try { sessionStorage.removeItem(deviceUnlockSessionKey) } catch { /* ignore blocked session storage */ }
    setDeviceUnlocked(true)
    notify('Startup device PIN disabled.')
  }

  const lockDeviceNow = () => {
    if (!deviceLock?.enabled) return
    try { sessionStorage.removeItem(deviceUnlockSessionKey) } catch { /* in-memory lock still applies */ }
    setSettingsOpen(false)
    setDeviceUnlocked(false)
  }

  const unlockDevice = async (pin) => {
    const accepted = await verifyDevicePin(pin, deviceLock)
    if (!accepted) return false
    try { sessionStorage.setItem(deviceUnlockSessionKey, '1') } catch { /* unlocked until this page closes */ }
    setDeviceUnlocked(true)
    return true
  }

  const resetFromDeviceLock = () => {
    const confirmation = window.prompt('This permanently removes this browser’s Sales OS CRM, settings, XP, and PIN. Type RESET to continue.')
    if (confirmation !== 'RESET') return
    Object.keys(localStorage).filter((key) => key.startsWith('sales-os-')).forEach((key) => localStorage.removeItem(key))
    try { sessionStorage.removeItem(deviceUnlockSessionKey) } catch { /* ignore blocked session storage */ }
    window.location.reload()
  }

  const testOnboardingGoogleKey = async (apiKey) => {
    const places = await searchGooglePlacesText(apiKey, 'batching plant in Metro Manila, Philippines', 1)
    return { message: places.length ? 'Connection works and returned a Philippine business candidate.' : 'Connection works. This small test returned zero matches.' }
  }

  const saveOnboardingSetup = async ({ profile: nextProfile, territory: nextTerritory, devicePin, enableDeviceLock, teamConfig: nextTeamConfig, teamMode }) => {
    setProfile(nextProfile)
    setTerritory(nextTerritory)
    if (devicePin) await setDevicePin(devicePin)
    if (!enableDeviceLock && deviceLock?.enabled) setDeviceLock({ enabled: false })
    if (teamMode === 'solo') {
      if (teamClient && teamWorkspace?.id && teamSession?.user?.id) {
        const claimedLeadIds = new Set([
          ...teamSnapshot.claims.filter((claim) => String(claim.claimed_by || claim.claimedBy || '') === String(teamSession.user.id)).map((claim) => String(claim.lead_id || claim.leadId || '')),
          ...leads.filter((lead) => String(lead.claimOwnerId || '') === String(teamSession.user.id)).map((lead) => String(lead.id)),
        ].filter(Boolean))
        await Promise.allSettled([...claimedLeadIds].map((leadId) => teamClient.releaseLead(teamWorkspace.id, leadId)))
      }
      try { await teamClient?.signOut() } catch { /* local solo mode must still disengage an expired remote session */ }
      setTeamSession(null)
      setTeamWorkspace(null)
      setTeamSnapshot({ memberships: [], claims: [], callEvents: [], tasks: [] })
      setTeamSyncState({ status: teamConfig.url ? 'configured' : 'local', error: '', lastSyncedAt: '' })
      setValidatedTeamCallId('')
    } else if (nextTeamConfig?.url && (nextTeamConfig.url !== teamConfig.url || nextTeamConfig.anonKey !== teamConfig.anonKey)) {
      await saveTeamConfig(nextTeamConfig)
    }
    setOnboardingComplete(true)
  }

  const previewRankUp = () => {
    setCompanionEvent('rank-up')
    setXpBurst({ amount: 0, reason: 'Class-up preview · no XP changed', id: Date.now() })
    window.clearTimeout(window.__xpBurst)
    window.__xpBurst = window.setTimeout(() => { setXpBurst(null); setCompanionEvent('idle') }, 3200)
    setSettingsOpen(false)
  }

  const closeOnboarding = () => { setOnboardingComplete(true); setOnboardingOpen(false) }

  const changeLogo = (companyLogo) => setProfile((current) => ({ ...current, companyLogo }))

  const handleSummaryAction = (action) => {
    setSessionSummaryOpen(false)
    if (action === 'conversion') setActiveView('conversion')
    if (action === 'reports') { setActiveView('reports'); generateReport() }
    if (action === 'export') exportCsv()
    if (action === 'tasks') setActiveView('tasks')
  }

  useEffect(() => {
    const activeCall = daily.activeCall
    if (!activeCall) {
      if (validatedTeamCallId) setValidatedTeamCallId('')
      return undefined
    }
    if (!teamGuardEnabled || validatedTeamCallId === activeCall.id) return undefined
    const lead = leads.find((item) => item.id === activeCall.leadId)
    if (!lead) {
      setDaily((current) => ({ ...current, activeCall: null }))
      notify('The saved Call Mode lead no longer exists, so the stale session was closed.')
      return undefined
    }
    if (lead.visibility === 'private') {
      setValidatedTeamCallId(activeCall.id)
      return undefined
    }
    let cancelled = false
    teamClient.claimLead(teamWorkspace.id, lead.id, 7200).then(() => {
      if (!cancelled) setValidatedTeamCallId(activeCall.id)
    }).catch((error) => {
      if (cancelled) return
      setDaily((current) => current.activeCall?.id === activeCall.id ? { ...current, activeCall: null } : current)
      syncTeam({ push: false, quiet: true }).catch(() => null)
      notify(`${lead.company} was closed before Call Mode: ${error.message || 'a teammate already handled or reserved it'}`)
    })
    return () => { cancelled = true }
  // Revalidate persisted Call Mode only when its server identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily.activeCall?.id, teamGuardEnabled, teamSession?.user?.id, teamWorkspace?.id, validatedTeamCallId])

  useEffect(() => {
    if (!teamGuardEnabled) return undefined
    const pull = () => {
      if (document.visibilityState === 'visible') syncTeam({ push: false, quiet: true }).catch(() => {})
    }
    pull()
    const interval = window.setInterval(pull, 30000)
    return () => window.clearInterval(interval)
  // The stable connection identifiers intentionally control polling; data changes are pushed by explicit sync/actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamClient, teamGuardEnabled, teamSession?.user?.id, teamWorkspace?.id])

  const appStyle = {
    '--glass-blur': `${Math.max(8, Math.round((appearance.blur || 0) * .42))}px`,
    '--glass-alpha': Math.max(.28, Math.min(.92, 1 - Number(appearance.transparency || 0) / 135)),
    '--glass-intensity': Number(appearance.intensity || 0) / 100,
    '--glass-reflection': Number(appearance.reflection || 0) / 100,
    ...(appearance.customBackground ? { '--custom-background': `url("${appearance.customBackground}")` } : {}),
  }

  if (deviceLock?.enabled && !deviceUnlocked) {
    return <DeviceLockScreen operatorName={profile.name} company={profile.company} theme={theme} onUnlock={unlockDevice} onReset={resetFromDeviceLock} />
  }

  return (
    <div style={appStyle} className={`app view-${activeView} theme-${theme}${['midnight', 'orchid', 'aurora'].includes(theme) ? ' dark' : ''} background-${appearance.background || 'auto'}${appearance.dimBackground ? ' dim-background' : ''}${appearance.reducedMotion ? ' reduced-motion' : ''}${effectiveLeftCollapsed ? ' left-collapsed' : ''}${effectiveRightCollapsed ? ' right-collapsed' : ''}${focusMode ? ' focus-mode' : ''}${demoMode ? ' demo-mode' : ''}${practiceSession.active ? ' practice-mode' : ''}`}>
      <SystemRail theme={theme} onThemeChange={changeTheme} territory={territory} onTerritoryChange={setTerritory} profile={profile} onLogoChange={changeLogo} onOpenSettings={() => setSettingsOpen(true)} leftCollapsed={effectiveLeftCollapsed} onToggleLeft={() => focusMode ? setFocusMode(false) : setLeftSidebarCollapsed((value) => !value)} rightCollapsed={effectiveRightCollapsed} onToggleRight={() => focusMode ? setFocusMode(false) : setRightRailCollapsed((value) => !value)} focusMode={focusMode} onToggleFocus={() => setFocusMode((value) => !value)} onOpenOnboarding={() => setOnboardingOpen(true)} practiceMode={practiceSession.active} demoMode={demoMode} teamConnected={teamConnected} />
      <Sidebar activeView={activeView} onViewChange={setActiveView} showManager={managerDashboardAllowed} level={level} xp={xp} nextXp={nextXp} rank={rank} selectedCount={rosterProgressCount} missionTarget={missionTarget} rosterLocked={daily.rosterLocked} profile={profile} onEditProfile={() => setEditingProfile(true)} leads={mapLeads} selectedLead={selectedLead} territory={territory} userLocation={userLocation} onEnableLocation={userLocation.enable} onOpenLead={(id) => openLead(id)} collapsed={effectiveLeftCollapsed} rightCollapsed={effectiveRightCollapsed} operators={operators} activeOperatorId={activeOperatorId} onOperatorChange={switchOperator} companionMode={profile.companionMode} reducedMotion={appearance.reducedMotion} />
      <main ref={mainContentRef} className="main-content">
        {activeView === 'mission' ? <><MissionRail selectedCount={rosterProgressCount} answeredCount={metrics.answered} quoteCount={metrics.quotes} capturedCount={capturedCount} profileCount={metrics.profiles} pricingCount={metrics.pricing} goals={missionGoals} onStartCall={startNextCall} activeCall={Boolean(daily.activeCall)} operatorName={profile.name} /><div className="mission-workspace"><LeadQueue leads={leads} selectedLeadId={selectedLeadId} onOpenLead={setSelectedLeadId} onToggleSelected={toggleSelected} territory={territory} onTerritoryChange={setTerritory} eligibleLeadIds={queueEligibleIds} /><LeadWorkspace lead={selectedLead} operatorName={profile.name} companyProfile={companyProfile} userLocation={userLocation} selectedCount={selectedCount} selectedLeads={selectedLeads} onSelectLead={setSelectedLeadId} onUpdateLead={updateSelectedLead} onSaveCall={() => daily.activeCall ? notify('Use Save Call & Start Next Lead inside Call Mode.') : startCallForLead(selectedLead)} onSendProfile={sendProfile} onMarkQuoteReady={moveToPricingQueue} onQuickResult={recordQuickResult} /></div></> : null}
        {activeView === 'manager' && managerDashboardAllowed ? <ManagerDashboard leads={leads} metrics={metrics} performanceHistory={performanceHistory} teamConnected={teamConnected} memberships={teamSnapshot.memberships} callEvents={teamSnapshot.callEvents} profile={profile} companyProfile={companyProfile} territory={territory} onTerritoryChange={setTerritory} userLocation={userLocation} onOpenLead={(id) => openLead(id)} onOpenSettings={() => setSettingsOpen(true)} onOpenTasks={() => setActiveView('tasks')} reducedMotion={appearance.reducedMotion} /> : null}
        {activeView === 'tasks' ? <TaskWorkspace tasks={tasks} leads={leads} operators={taskOperators} activeOperatorId={queueActorId} onAddTask={addTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} onOpenLead={(id) => openLead(id)} /> : null}
        {activeView === 'queue' ? <QueuePlannerView leads={leads} selectedLeadId={selectedLeadId} selectedLeads={selectedLeads} rosterLeads={rosterLeads} completedLeadIds={daily.completedLeadIds} eligibleLeadIds={queueEligibleIds} missionTarget={missionTarget} onMissionTargetChange={(goal) => setProfile((current) => ({ ...current, dailyCallGoal: goal }))} onOpenLead={(id) => openLead(id, 'queue')} onToggleSelected={toggleSelected} territory={territory} onTerritoryChange={setTerritory} rosterLocked={daily.rosterLocked} onAutoPick={autoPick} onToggleLock={toggleRosterLock} onClear={clearPicks} /> : null}
        {activeView === 'quotes' ? <QuoteQueueView leads={leads} companyProfile={companyProfile} onUpdateLead={updateLead} onOpenLead={(id) => openLead(id)} /> : null}
        {activeView === 'conversion' ? <ConversionDesk leads={leads} onUpdateLead={updateLead} onOpenLead={(id) => openLead(id)} onCallLead={startCallForLead} /> : null}
        <LeadFinderView hidden={activeView !== 'finder'} leads={leads} territory={territory} endpoint={profile.leadSearchEndpoint || NOMINATIM_DEFAULT_ENDPOINT} provider={profile.leadSearchProvider || 'nominatim'} googleApiKey={profile.googlePlacesApiKey || ''} operatorId={queueActorId} operatorName={profile.name} onProviderChange={(value) => setProfile((current) => ({ ...current, leadSearchProvider: value }))} onGoogleApiKeyChange={(value) => setProfile((current) => ({ ...current, googlePlacesApiKey: value }))} onOpenSettings={() => setSettingsOpen(true)} onAddDiscoveredLeads={addDiscoveredLeads} />
        {activeView === 'crm' ? <CrmView leads={leads} onUpdateLead={updateLead} onAddLead={addLead} onDeleteLead={deleteLead} onOpenLead={(id) => openLead(id)} onExport={exportCsv} onImport={importCrmRows} /> : null}
        {activeView === 'team' ? <TeamWorkspace config={teamConfig} session={teamSession} workspace={teamWorkspace} syncState={teamSyncState} memberships={teamSnapshot.memberships} membership={currentTeamMembership} callEvents={teamSnapshot.callEvents} claims={teamSnapshot.claims} teamTasks={teamSnapshot.tasks} activeOperator={{ id: activeOperatorId, name: profile.name, profile }} onConfigChange={saveTeamConfig} onSignIn={signInTeam} onSignUp={signUpTeam} onSignOut={signOutTeam} onCreateOrganization={createTeamWorkspace} onJoinOrganization={joinTeamWorkspace} onCheckMembership={() => refreshTeamMembership({ quiet: false })} onSync={() => syncTeam({ push: true })} onReleaseClaim={releaseTeamClaim} onSetOpenJoin={setTeamOpenJoin} onReviewMembership={reviewTeamMembership} onChangeMemberRole={changeTeamMemberRole} onAssignTask={assignTeamTask} /> : null}
        {activeView === 'reports' ? <ReportsView leads={leads} metrics={metrics} progress={progress} rank={rank} profile={profile} companyProfile={companyProfile} operators={operators} activeOperatorId={activeOperatorId} performanceOperatorId={queueActorId} performanceHistory={performanceHistory} goals={missionGoals} onExport={exportCsv} onReset={resetDay} reportText={reportText} onGenerateReport={generateReport} /> : null}
      </main>
      <RightRail companyProfile={companyProfile} selectedCount={rosterProgressCount} goals={missionGoals} quoteCount={metrics.quotes} answeredCount={metrics.answered} callsMade={metrics.calls} profileCount={metrics.profiles} sampleCount={metrics.samples} pricingCount={metrics.pricing} xp={xp} nextXp={nextXp} rank={rank} achievements={progress.achievements || []} streak={progress.streak || 1} profile={profile} quoteLeads={quoteLeads} onOpenLead={(id) => openLead(id)} daily={daily} leads={leads} metrics={metrics} conversionCounts={{ retry: retryLeads.length, research: researchLeads.length, profiles: profileQueueLeads.length, followups: scheduledFollowUps.length }} onOpenConversion={() => setActiveView('conversion')} collapsed={effectiveRightCollapsed} onToggleCollapsed={() => focusMode ? setFocusMode(false) : setRightRailCollapsed((value) => !value)} companionMode={profile.companionMode} companionState={companionState} reducedMotion={appearance.reducedMotion} />
      <MobileNav activeView={activeView} onViewChange={setActiveView} showManager={managerDashboardAllowed} />
      {editingProfile ? <ProfileEditor profile={profile} onChange={changeProfile} onClose={() => setEditingProfile(false)} /> : null}
      {settingsOpen ? <SettingsModal theme={theme} onThemeChange={changeTheme} territory={territory} onTerritoryChange={setTerritory} profile={profile} onProfileChange={changeProfile} companyProfile={companyProfile} onCompanyProfileChange={changeCompanyProfile} managerViewEnabled={managerViewEnabled} onManagerViewChange={setManagerViewEnabled} managerRole={teamIdentityEstablished ? teamCapabilities.role : 'local owner'} teamIdentityEstablished={teamIdentityEstablished} managerDashboardAllowed={managerDashboardAllowed} onClose={() => setSettingsOpen(false)} onResetDaily={resetDailyFromSettings} onFactoryReset={factoryResetLocal} appearance={appearance} onAppearanceChange={setAppearance} operators={operators} activeOperatorId={activeOperatorId} onOperatorChange={switchOperator} onAddOperator={addOperator} onRemoveOperator={removeOperator} demoMode={demoMode} onToggleDemo={() => setDemoMode((value) => !value)} practiceMode={practiceSession.active} onStartPractice={startPracticeMode} onEndPractice={endPracticeMode} onOpenOnboarding={() => setOnboardingOpen(true)} onExport={exportCsv} deviceLock={deviceLock} onSetDevicePin={setDevicePin} onDisableDeviceLock={disableDevicePin} onLockNow={lockDeviceNow} onPreviewRankUp={previewRankUp} /> : null}
      {daily.activeCall && selectedLead && (!teamGuardEnabled || selectedLead.visibility === 'private' || validatedTeamCallId === daily.activeCall.id) ? <CallMode lead={selectedLead} operatorName={profile.name} operatorPhoto={profile.photo} operatorInitials={profile.initials} companyProfile={companyProfile} xp={xp} companionMode={profile.companionMode} reducedMotion={appearance.reducedMotion} userLocation={userLocation} callNumber={activeCallNumber} totalCalls={activeCallTotal} workspaceTheme={theme} callModeTheme={profile.callModeTheme || 'inherit'} onCallModeThemeChange={(value) => setProfile((current) => ({ ...current, callModeTheme: value }))} onClose={closeCallMode} onUpdateLead={updateSelectedLead} onQuickResult={recordQuickResult} onSendProfile={sendProfile} onMovePricing={moveToPricingQueue} onSaveNext={saveAndNext} shortcutsDisabled={Boolean(answeredFollowUp)} /> : null}
      {answeredFollowUp && selectedLead ? <AnsweredFollowUpModal lead={selectedLead} result={answeredFollowUp.result} operatorName={profile.name} companyProfile={companyProfile} onClose={() => { setAnsweredFollowUp(null); notify('Answered result discarded. The call remains open so you can choose a result again.') }} onSave={saveAnsweredFollowUp} /> : null}
      {sessionSummaryOpen ? <SessionSummaryModal metrics={metrics} callGoal={missionTarget} retryCount={retryLeads.length} invalidCount={researchLeads.length} warmCount={warmLeads.length} onClose={() => setSessionSummaryOpen(false)} onAction={handleSummaryAction} /> : null}
      {xpBurst ? <div className="xp-burst" key={xpBurst.id}><strong>{xpBurst.amount ? `+${xpBurst.amount} XP` : 'CLASS PREVIEW'}</strong><span>{xpBurst.reason}</span></div> : null}
      {practiceSession.active ? <div className="practice-banner"><Play size={14} /><span><strong>Practice Mode</strong> Safe sample leads · nothing here belongs to your real CRM.</span><button onClick={endPracticeMode}>Exit practice</button></div> : null}
      {onboardingOpen ? <OnboardingModal profile={profile} territory={territory} teamConfig={teamConfig} deviceLock={deviceLock} firstRun={!onboardingComplete} onSaveSetup={saveOnboardingSetup} onTestGoogleKey={testOnboardingGoogleKey} onClose={closeOnboarding} onStartPractice={startPracticeMode} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}

export default App

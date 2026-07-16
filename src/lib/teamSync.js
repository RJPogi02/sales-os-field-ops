import { isUnsafeSupabaseKey } from './teamBootstrap.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const DEFAULT_TIMEOUT_MS = 20_000
const SESSION_REFRESH_SKEW_SECONDS = 90
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const TEAM_ROLES = Object.freeze(['owner', 'manager', 'rep'])
export const TEAM_MEMBERSHIP_STATUSES = Object.freeze(['pending', 'active', 'rejected'])

export function normalizeTeamRole(value = 'rep') {
  const role = String(value || '').trim().toLowerCase()
  if (role === 'admin') return 'manager'
  if (role === 'member') return 'rep'
  return TEAM_ROLES.includes(role) ? role : 'rep'
}

export function normalizeMembershipStatus(value = 'active') {
  const status = String(value || '').trim().toLowerCase()
  return TEAM_MEMBERSHIP_STATUSES.includes(status) ? status : 'active'
}

export function teamRoleCapabilities(role = 'rep', status = 'active') {
  const normalizedRole = normalizeTeamRole(role)
  const normalizedStatus = normalizeMembershipStatus(status)
  const active = normalizedStatus === 'active'
  const manager = active && (normalizedRole === 'owner' || normalizedRole === 'manager')
  const owner = active && normalizedRole === 'owner'
  return Object.freeze({
    role: normalizedRole,
    status: normalizedStatus,
    active,
    canUseTeamWorkspace: active,
    canViewManagerDashboard: manager,
    canApproveMembers: manager,
    canAssignTeamTasks: manager,
    canConfigureOpenJoin: manager,
    canChangeMemberRoles: owner,
    canManageOwners: owner,
  })
}

export function membershipForUser(memberships = [], userId = '') {
  const id = String(userId || '')
  const membership = memberships.find((item) => String(item?.user_id || item?.userId || '') === id) || null
  if (!membership) return null
  return {
    ...membership,
    role: normalizeTeamRole(membership.role),
    status: normalizeMembershipStatus(membership.status || membership.membership_status),
  }
}

export function canManageMemberRole(actorMembership, targetMembership, nextRole) {
  const actor = teamRoleCapabilities(actorMembership?.role, actorMembership?.status || actorMembership?.membership_status)
  const targetRole = normalizeTeamRole(targetMembership?.role)
  const requestedRole = normalizeTeamRole(nextRole)
  if (!actor.active || !actor.canChangeMemberRoles) return false
  if (targetRole === 'owner' || requestedRole === 'owner') return false
  return requestedRole === 'manager' || requestedRole === 'rep'
}

export function filterTeamTasksForMembership(tasks = [], membership = null, userId = '') {
  const capabilities = teamRoleCapabilities(membership?.role, membership?.status || membership?.membership_status)
  if (!capabilities.active) return []
  if (capabilities.canAssignTeamTasks) return [...tasks]
  const actor = String(userId || membership?.user_id || membership?.userId || '')
  return tasks.filter((task) => {
    const owner = String(task.owner_user_id || task.ownerId || task.assigneeId || '')
    const creator = String(task.created_by || task.createdBy || task.teamCreatedBy || '')
    return owner === actor || creator === actor || (!owner && (task.visibility === 'team' || task.scope === 'team'))
  })
}

export class TeamSyncError extends Error {
  constructor(message, { status = 0, code = '', details = null } = {}) {
    super(message)
    this.name = 'TeamSyncError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function isLocalUrl(url) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)
}

export function validateTeamConfig(config = {}) {
  const url = cleanUrl(config.url || config.supabaseUrl)
  const anonKey = String(config.anonKey || config.supabaseAnonKey || '').trim()
  const errors = []
  if (!url) errors.push('Supabase project URL is required.')
  else {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && !isLocalUrl(url)) errors.push('Use an HTTPS Supabase URL (localhost is allowed for development).')
    } catch {
      errors.push('Supabase project URL is not valid.')
    }
  }
  if (!anonKey) errors.push('Supabase anon key is required.')
  else if (isUnsafeSupabaseKey(anonKey)) errors.push('Use a publishable or anon key, never a secret or service-role key.')
  return { valid: errors.length === 0, errors, url, anonKey }
}

function jsonSafe(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value, (key, entry) => {
    if (key.toLowerCase().includes('password')) return undefined
    if (typeof entry === 'function') return undefined
    return entry
  }))
}

export function authSessionFromResponse(payload = {}) {
  const accessToken = String(payload.access_token || '')
  if (!accessToken) throw new TeamSyncError('Authentication response did not include an access token.', { code: 'invalid_auth_response' })
  const expiresIn = Number(payload.expires_in || 3600)
  return {
    access_token: accessToken,
    refresh_token: String(payload.refresh_token || ''),
    token_type: String(payload.token_type || 'bearer'),
    expires_at: Number(payload.expires_at || Math.floor(Date.now() / 1000) + expiresIn),
    user: jsonSafe(payload.user || null),
  }
}

function readableError(payload, status) {
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  return payload?.msg || payload?.message || payload?.error_description || payload?.error || `Team service returned ${status}`
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ''))
}

function unwrapRpc(payload) {
  return Array.isArray(payload) ? (payload[0] || null) : payload
}

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim())
}

// Existing local call IDs predate the cloud schema. Convert them to a stable UUID so
// retrying the same local event remains idempotent instead of creating duplicates.
export function stableEventUuid(value = '') {
  const input = String(value || '').trim()
  if (isUuid(input)) return input.toLowerCase()
  const text = input || 'sales-os-call-event'
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    for (let word = 0; word < words.length; word += 1) {
      words[word] ^= code + Math.imul(index + 1, word + 17)
      words[word] = Math.imul(words[word], 0x01000193 + word * 2) >>> 0
    }
  }
  const characters = words.map((word) => word.toString(16).padStart(8, '0')).join('').split('')
  characters[12] = '5'
  characters[16] = (8 + (Number.parseInt(characters[16], 16) % 4)).toString(16)
  const hex = characters.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function asDateNumber(value) {
  const number = Date.parse(value || '')
  return Number.isFinite(number) ? number : 0
}

export function materializeTeamLead(row = {}) {
  return {
    ...(jsonSafe(row.payload || {})),
    id: String(row.lead_id || row.payload?.id || ''),
    visibility: row.visibility || row.payload?.visibility || 'team',
    ownerId: row.owner_user_id || row.payload?.ownerId || '',
    teamUpdatedAt: row.updated_at || '',
    teamCreatedBy: row.created_by || '',
  }
}

export function materializeTeamTask(row = {}) {
  const payload = jsonSafe(row.payload || {})
  return {
    ...payload,
    id: String(row.task_id || payload.id || ''),
    scope: row.visibility === 'team' ? 'team' : (payload.scope === 'team' ? 'team' : 'private'),
    assigneeId: row.owner_user_id || payload.assigneeId || '',
    status: row.completed ? 'completed' : payload.status,
    dueDate: row.due_at ? String(row.due_at).slice(0, 10) : (payload.dueDate || ''),
    updatedAt: row.updated_at || payload.updatedAt || payload.createdAt || '',
    teamUpdatedAt: row.updated_at || payload.teamUpdatedAt || '',
    teamCreatedBy: row.created_by || payload.teamCreatedBy || '',
  }
}

export function mergeTeamRecords(localRecords = [], remoteRows = [], {
  localId = 'id', remoteId = 'lead_id', materialize = materializeTeamLead,
} = {}) {
  const merged = new Map(localRecords.map((record) => [String(record?.[localId] || ''), jsonSafe(record)]).filter(([id]) => id))
  remoteRows.forEach((row) => {
    const id = String(row?.[remoteId] || row?.payload?.[localId] || '')
    if (!id) return
    const local = merged.get(id)
    const localTime = asDateNumber(local?.teamUpdatedAt || local?.updatedAt || local?.updated_at)
    const remoteTime = asDateNumber(row?.updated_at || row?.payload?.updatedAt)
    if (!local || remoteTime >= localTime) merged.set(id, materialize(row))
  })
  return [...merged.values()]
}

export function teamLeadEligibility(lead = {}, claims = [], actorId = '', now = new Date()) {
  const actor = String(actorId || '')
  if (lead.visibility === 'private' && String(lead.ownerId || lead.owner_user_id || '') !== actor) {
    return { eligible: false, reason: 'Private lead owned by another operator.' }
  }
  const claim = claims.find((item) => String(item.lead_id || item.leadId) === String(lead.id))
  const active = claim && asDateNumber(claim.expires_at || claim.expiresAt) > now.getTime()
  if (active && String(claim.claimed_by || claim.claimedBy || '') !== actor) {
    return { eligible: false, reason: `Claimed by ${claim.claimedByName || claim.claimed_by_name || 'another operator'}.`, claim }
  }
  return { eligible: true, reason: active ? 'Already claimed by this operator.' : 'Available to claim.', claim: active ? claim : null }
}

function eventFlags(event = {}) {
  const payload = event.payload || {}
  const result = String(event.result || payload.result || '').toLowerCase()
  return {
    answered: Boolean(payload.answered) || /contact|answered|profile sent|sample|quotation/.test(result),
    profile: Boolean(payload.profileSent) || /profile sent/.test(result),
    quote: Boolean(payload.quoteReady || payload.quotationRequested) || /quotation requested|quote.ready/.test(result),
    handoff: Boolean(payload.sirLukeHandoff || payload.pricingHandoff) || /handoff|pricing queue/.test(result),
  }
}

export function computeTeamLeaderboard(memberships = [], callEvents = []) {
  const rows = new Map()
  memberships.forEach((membership) => {
    const id = String(membership.user_id || membership.userId || membership.id || '')
    if (!id) return
    rows.set(id, {
      userId: id,
      name: membership.profile?.display_name || membership.display_name || membership.name || 'Sales operator',
      role: normalizeTeamRole(membership.role), calls: 0, answered: 0, profiles: 0, quotes: 0, handoffs: 0, score: 0,
    })
  })
  callEvents.forEach((event) => {
    const id = String(event.user_id || event.userId || '')
    if (!id) return
    if (!rows.has(id)) rows.set(id, { userId: id, name: event.user_name || 'Sales operator', role: 'rep', calls: 0, answered: 0, profiles: 0, quotes: 0, handoffs: 0, score: 0 })
    const row = rows.get(id)
    const flags = eventFlags(event)
    row.calls += 1
    if (flags.answered) row.answered += 1
    if (flags.profile) row.profiles += 1
    if (flags.quote) row.quotes += 1
    if (flags.handoff) row.handoffs += 1
  })
  return [...rows.values()].map((row) => ({
    ...row,
    score: row.calls * 10 + row.answered * 25 + row.profiles * 20 + row.quotes * 75 + row.handoffs * 100,
  })).sort((a, b) => b.score - a.score || b.quotes - a.quotes || b.calls - a.calls || a.name.localeCompare(b.name))
}

export function createTeamSyncClient(rawConfig = {}, session = null, {
  fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, onSession = null,
} = {}) {
  const config = validateTeamConfig(rawConfig)
  if (!config.valid) throw new TeamSyncError(config.errors.join(' '), { code: 'invalid_config', details: config.errors })
  if (typeof fetchImpl !== 'function') throw new TeamSyncError('A fetch implementation is required.', { code: 'missing_fetch' })

  let activeSession = session ? jsonSafe(session) : null

  const publishSession = (nextSession) => {
    activeSession = nextSession
    if (typeof onSession === 'function') onSession(jsonSafe(nextSession))
    return nextSession
  }

  const sessionNeedsRefresh = () => {
    if (!activeSession?.access_token || !activeSession?.refresh_token) return false
    const expiresAt = Number(activeSession.expires_at || 0)
    return Boolean(expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + SESSION_REFRESH_SKEW_SECONDS)
  }

  let refreshPromise = null

  const request = async (path, {
    method = 'GET', body, token, headers = {}, query = '', authBody = false, retryAuth = true,
  } = {}) => {
    if (!token && retryAuth && sessionNeedsRefresh()) await refreshActiveSession()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const authorization = token || activeSession?.access_token || config.anonKey
    try {
      const response = await fetchImpl(`${config.url}${path}${query}`, {
        method,
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${authorization}`,
          ...((body !== undefined) ? JSON_HEADERS : {}),
          ...headers,
        },
        // Passwords are allowed only on the private Auth request path. All persisted/team payloads are scrubbed.
        body: body === undefined ? undefined : JSON.stringify(authBody ? body : jsonSafe(body)),
        signal: controller.signal,
      })
      const text = await response.text()
      let payload = null
      if (text) {
        try { payload = JSON.parse(text) } catch { payload = text }
      }
      if (!response.ok) {
        if (response.status === 401 && !token && retryAuth && activeSession?.refresh_token) {
          // Another concurrent request may already have rotated the token while this
          // response was in flight. Reuse it instead of refreshing the session twice.
          if (authorization === activeSession.access_token) await refreshActiveSession()
          return request(path, { method, body, headers, query, authBody, retryAuth: false })
        }
        throw new TeamSyncError(readableError(payload, response.status), { status: response.status, code: payload?.code || '', details: payload })
      }
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') throw new TeamSyncError('Team service timed out. Local data was not changed.', { code: 'timeout' })
      if (error instanceof TeamSyncError) throw error
      let hostname = config.url
      try { hostname = new URL(config.url).hostname } catch { /* validation already reports malformed URLs */ }
      throw new TeamSyncError(
        `Could not reach ${hostname}. Check the Supabase project URL, internet connection, and project status, then test the connection again.`,
        { code: 'network_error', details: { cause: error?.message || 'Network request failed' } },
      )
    } finally {
      clearTimeout(timer)
    }
  }

  const refreshActiveSession = async (refreshToken = activeSession?.refresh_token) => {
    if (!refreshToken) throw new TeamSyncError('The team session expired. Sign in again.', { code: 'missing_refresh_token' })
    if (!refreshPromise) {
      refreshPromise = request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', token: config.anonKey, authBody: true, retryAuth: false,
        body: { refresh_token: String(refreshToken) },
      }).then((payload) => {
        const refreshed = authSessionFromResponse(payload)
        if (!refreshed.user && activeSession?.user) refreshed.user = jsonSafe(activeSession.user)
        return publishSession(refreshed)
      }).finally(() => { refreshPromise = null })
    }
    return refreshPromise
  }

  const requireSession = () => {
    if (!activeSession?.access_token) throw new TeamSyncError('Sign in before using team sync.', { code: 'not_authenticated' })
  }

  const auth = async (path, body) => authSessionFromResponse(await request(path, { method: 'POST', body, token: config.anonKey, authBody: true }))
  const rpc = async (name, body = {}) => {
    requireSession()
    return request(`/rest/v1/rpc/${encodeURIComponent(name)}`, { method: 'POST', body })
  }
  const rest = async (table, { method = 'GET', body, query = '', prefer = '' } = {}) => {
    requireSession()
    return request(`/rest/v1/${encodeURIComponent(table)}`, { method, body, query, headers: prefer ? { Prefer: prefer } : {} })
  }

  return Object.freeze({
    config: Object.freeze({ url: config.url, anonKey: config.anonKey }),

    // A read-only Auth settings request catches mistyped project references and
    // invalid browser keys before a user enters credentials.
    testConnection: () => request('/auth/v1/settings', {
      token: config.anonKey,
      retryAuth: false,
    }).then(() => ({ connected: true, url: config.url })),

    signIn: (email, password) => auth('/auth/v1/token?grant_type=password', { email: String(email || '').trim(), password: String(password || '') }),
    signUp: async (email, password, displayName = '') => {
      const payload = await request('/auth/v1/signup', {
        method: 'POST', token: config.anonKey, authBody: true,
        body: { email: String(email || '').trim(), password: String(password || ''), data: { display_name: String(displayName || '').trim() } },
      })
      return payload?.access_token ? authSessionFromResponse(payload) : { pendingConfirmation: true, user: jsonSafe(payload?.user || null) }
    },
    refreshSession: (refreshToken) => refreshActiveSession(refreshToken),
    signOut: async () => {
      requireSession()
      await request('/auth/v1/logout', { method: 'POST' })
      return true
    },

    createOrganization: async (name) => unwrapRpc(await rpc('create_organization', { p_name: String(name || '').trim() })),
    joinOrganization: async (inviteCode) => unwrapRpc(await rpc('join_organization_by_code', { p_invite_code: String(inviteCode || '').trim().toUpperCase() })),
    getMyMembership: async (organizationId) => {
      requireSession()
      const rows = await rest('memberships', {
        query: `?organization_id=eq.${encodeFilter(organizationId)}&user_id=eq.${encodeFilter(activeSession.user?.id)}&select=organization_id,user_id,role,status,requested_at,joined_at,approved_at,approved_by`,
      })
      return rows?.[0] || null
    },
    setOrganizationOpenJoin: async (organizationId, enabled) => unwrapRpc(await rest('organizations', {
      method: 'PATCH', prefer: 'return=representation', query: `?id=eq.${encodeFilter(organizationId)}`,
      body: { open_join: Boolean(enabled) },
    })),
    reviewMembership: async (organizationId, userId, approved = true) => unwrapRpc(await rpc('review_organization_membership', {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_approved: Boolean(approved),
    })),
    setMemberRole: async (organizationId, userId, role) => {
      const normalizedRole = normalizeTeamRole(role)
      if (normalizedRole === 'owner') throw new TeamSyncError('Ownership transfer needs a dedicated owner workflow.', { code: 'owner_transfer_not_supported' })
      if (!['manager', 'rep'].includes(String(role || '').trim().toLowerCase())) throw new TeamSyncError('Role must be manager or rep.', { code: 'invalid_team_role' })
      return unwrapRpc(await rpc('set_organization_member_role', {
        p_organization_id: organizationId,
        p_user_id: userId,
        p_role: normalizedRole,
      }))
    },
    assignTeamTask: async (organizationId, task = {}) => {
      const taskId = String(task.id || task.taskId || '').trim()
      const assigneeId = String(task.assigneeId || task.ownerId || '').trim()
      if (!taskId) throw new TeamSyncError('A task ID is required.', { code: 'missing_task_id' })
      if (!isUuid(assigneeId)) throw new TeamSyncError('Choose an active teammate before assigning the task.', { code: 'invalid_assignee' })
      return unwrapRpc(await rpc('assign_team_task', {
        p_organization_id: organizationId,
        p_task_id: taskId,
        p_assignee_id: assigneeId,
        p_payload: jsonSafe({ ...(task.payload || {}), ...task, id: taskId, assigneeId }),
        p_due_at: task.dueAt || task.due_at || null,
      }))
    },
    claimLead: async (organizationId, leadId, ttlSeconds = 1800) => {
      const result = unwrapRpc(await rpc('claim_team_lead', { p_organization_id: organizationId, p_lead_id: String(leadId), p_ttl_seconds: Math.max(60, Math.min(14_400, Number(ttlSeconds) || 1800)) }))
      if (!result || result.acquired !== true) {
        throw new TeamSyncError('Lead is reserved or already handled by a teammate.', { code: 'claim_unavailable', details: result })
      }
      return result
    },
    releaseLead: async (organizationId, leadId) => Boolean(unwrapRpc(await rpc('release_team_lead', { p_organization_id: organizationId, p_lead_id: String(leadId) }))),

    upsertProfile: async ({ id, displayName, avatarUrl = '' }) => unwrapRpc(await rest('profiles', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', query: '?on_conflict=id',
      body: { id, display_name: String(displayName || '').trim(), avatar_url: String(avatarUrl || '') },
    })),

    upsertLeads: (organizationId, leads = [], { visibility = 'team', ownerUserId = null } = {}) => {
      if (!leads.length) return Promise.resolve([])
      const now = new Date().toISOString()
      return rest('team_leads', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', query: '?on_conflict=organization_id,lead_id',
        body: leads.map((lead) => ({
          organization_id: organizationId,
          lead_id: String(lead.id),
          visibility: lead.visibility || visibility,
          owner_user_id: isUuid(lead.ownerId)
            ? lead.ownerId
            : isUuid(ownerUserId)
              ? ownerUserId
              : (lead.visibility === 'private' || visibility === 'private') && isUuid(activeSession?.user?.id)
                ? activeSession.user.id
                : null,
          payload: jsonSafe(lead),
          updated_at: lead.updatedAt || lead.teamUpdatedAt || now,
        })),
      })
    },

    upsertTasks: (organizationId, tasks = [], { visibility = 'team', ownerUserId = null } = {}) => {
      if (!tasks.length) return Promise.resolve([])
      const now = new Date().toISOString()
      return rest('team_tasks', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', query: '?on_conflict=organization_id,task_id',
        body: tasks.map((task) => ({
          organization_id: organizationId,
          task_id: String(task.id),
          visibility: task.visibility || visibility,
          owner_user_id: isUuid(task.ownerId || task.assigneeId)
            ? (task.ownerId || task.assigneeId)
            : isUuid(ownerUserId)
              ? ownerUserId
              : (task.visibility === 'private' || visibility === 'private') && isUuid(activeSession?.user?.id)
                ? activeSession.user.id
                : null,
          payload: jsonSafe(task),
          completed: Boolean(task.completed),
          due_at: task.dueAt || null,
          updated_at: task.updatedAt || now,
        })),
      })
    },

    recordCallEvents: (organizationId, events = []) => {
      if (!events.length) return Promise.resolve([])
      return rest('call_events', {
        method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation', query: '?on_conflict=id',
        body: events.map((event) => {
          const localEventId = String(event.id || '')
          return {
            id: stableEventUuid(localEventId || `${organizationId}|${event.leadId || event.lead_id || ''}|${event.occurredAt || event.occurred_at || ''}|${event.result || ''}`),
            organization_id: organizationId,
            lead_id: String(event.leadId || event.lead_id || ''),
            user_id: activeSession?.user?.id,
            result: String(event.result || ''),
            occurred_at: event.occurredAt || event.occurred_at || new Date().toISOString(),
            payload: jsonSafe({ ...(event.payload || event), ...(localEventId ? { localEventId } : {}) }),
          }
        }),
      })
    },

    getSnapshot: async (organizationId, { eventLimit = 500 } = {}) => {
      requireSession()
      const org = encodeFilter(organizationId)
      const [organizations, memberships, leads, claims, callEvents, tasks] = await Promise.all([
        rest('organizations', { query: `?id=eq.${org}&select=id,name,invite_code,open_join,created_at,created_by` }),
        rest('memberships', { query: `?organization_id=eq.${org}&select=organization_id,user_id,role,status,requested_at,joined_at,approved_at,approved_by,profile:profiles!memberships_user_id_fkey(id,display_name,avatar_url)` }),
        rest('team_leads', { query: `?organization_id=eq.${org}&select=organization_id,lead_id,visibility,owner_user_id,payload,updated_at,created_by&order=updated_at.desc` }),
        rest('lead_claims', { query: `?organization_id=eq.${org}&expires_at=gt.${encodeFilter(new Date().toISOString())}&select=organization_id,lead_id,claimed_by,claimed_at,expires_at,profile:profiles!lead_claims_claimed_by_fkey(display_name)` }),
        rest('call_events', { query: `?organization_id=eq.${org}&select=id,organization_id,lead_id,user_id,result,occurred_at,payload&order=occurred_at.desc&limit=${Math.max(1, Math.min(2000, Number(eventLimit) || 500))}` }),
        rest('team_tasks', { query: `?organization_id=eq.${org}&select=organization_id,task_id,visibility,owner_user_id,payload,completed,due_at,updated_at,created_by&order=updated_at.desc` }),
      ])
      return {
        organization: organizations?.[0] || null,
        memberships: memberships || [],
        leads: leads || [],
        claims: (claims || []).map((claim) => ({ ...claim, claimedByName: claim.profile?.display_name || '' })),
        callEvents: callEvents || [],
        tasks: tasks || [],
        syncedAt: new Date().toISOString(),
      }
    },
  })
}

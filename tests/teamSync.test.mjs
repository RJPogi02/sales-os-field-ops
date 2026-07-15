import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authSessionFromResponse, canManageMemberRole, computeTeamLeaderboard, createTeamSyncClient,
  filterTeamTasksForMembership, isUuid, materializeTeamLead, materializeTeamTask, membershipForUser,
  mergeTeamRecords, normalizeTeamRole, stableEventUuid, teamLeadEligibility, teamRoleCapabilities,
  validateTeamConfig,
} from '../src/lib/teamSync.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'
const ORGANIZATION_ID = '33333333-3333-4333-8333-333333333333'

const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => payload == null ? '' : JSON.stringify(payload),
})

test('team configuration requires a browser-safe URL and anon key', () => {
  assert.equal(validateTeamConfig({}).valid, false)
  assert.equal(validateTeamConfig({ url: 'http://example.com', anonKey: 'anon' }).valid, false)
  const local = validateTeamConfig({ url: 'http://127.0.0.1:54321/', anonKey: 'anon' })
  assert.equal(local.valid, true)
  assert.equal(local.url, 'http://127.0.0.1:54321')
  assert.equal(validateTeamConfig({ url: 'https://demo.supabase.co', anonKey: 'anon' }).valid, true)
})

test('auth session keeps tokens but strips password-shaped metadata', () => {
  const session = authSessionFromResponse({
    access_token: 'access', refresh_token: 'refresh', expires_in: 120,
    user: { id: 'user-1', email: 'rj@example.test', user_metadata: { display_name: 'RJ', passwordHint: 'never retain this' } },
  })
  assert.equal(session.access_token, 'access')
  assert.equal(session.user.user_metadata.display_name, 'RJ')
  assert.equal('passwordHint' in session.user.user_metadata, false)
})

test('remote lead merge uses timestamps and materializes team ownership', () => {
  const local = [{ id: 'a', company: 'Old name', updatedAt: '2026-07-14T08:00:00Z' }, { id: 'b', company: 'Local only' }]
  const remote = [{ lead_id: 'a', visibility: 'private', owner_user_id: 'u1', payload: { id: 'a', company: 'New name' }, updated_at: '2026-07-14T09:00:00Z' }]
  const merged = mergeTeamRecords(local, remote)
  assert.equal(merged.find((lead) => lead.id === 'a').company, 'New name')
  assert.equal(merged.find((lead) => lead.id === 'a').ownerId, 'u1')
  assert.equal(merged.find((lead) => lead.id === 'b').company, 'Local only')
  assert.equal(materializeTeamLead(remote[0]).visibility, 'private')
})

test('remote task materialization preserves the server conflict timestamp', () => {
  const task = materializeTeamTask({
    task_id: 'task-1', visibility: 'team', owner_user_id: USER_ID, completed: true,
    updated_at: '2026-07-14T09:15:00Z', payload: { id: 'task-1', title: 'Call client', updatedAt: '2026-07-14T08:00:00Z' },
  })
  assert.equal(task.updatedAt, '2026-07-14T09:15:00Z')
  assert.equal(task.assigneeId, USER_ID)
  assert.equal(task.status, 'completed')
})

test('team eligibility blocks private leads and another operators active claim', () => {
  const now = new Date('2026-07-14T08:00:00Z')
  assert.equal(teamLeadEligibility({ id: 'private', visibility: 'private', ownerId: 'u2' }, [], 'u1', now).eligible, false)
  const claims = [{ lead_id: 'shared', claimed_by: 'u2', claimedByName: 'Anna', expires_at: '2026-07-14T08:30:00Z' }]
  const blocked = teamLeadEligibility({ id: 'shared', visibility: 'team' }, claims, 'u1', now)
  assert.equal(blocked.eligible, false)
  assert.match(blocked.reason, /Anna/)
  assert.equal(teamLeadEligibility({ id: 'shared', visibility: 'team' }, claims, 'u1', new Date('2026-07-14T09:00:00Z')).eligible, true)
})

test('team leaderboard rewards quality outcomes and remains deterministic', () => {
  const members = [
    { user_id: 'u1', role: 'member', profile: { display_name: 'RJ' } },
    { user_id: 'u2', role: 'member', profile: { display_name: 'Anna' } },
  ]
  const events = [
    { user_id: 'u1', result: 'No Answer' },
    { user_id: 'u1', result: 'Quotation Requested' },
    { user_id: 'u2', result: 'Profile Sent', payload: { answered: true, profileSent: true } },
  ]
  const rows = computeTeamLeaderboard(members, events)
  assert.equal(rows[0].name, 'RJ')
  assert.equal(rows[0].calls, 2)
  assert.equal(rows[0].quotes, 1)
  assert.equal(rows[1].profiles, 1)
})

test('legacy team roles map safely into owner manager and rep capabilities', () => {
  assert.equal(normalizeTeamRole('admin'), 'manager')
  assert.equal(normalizeTeamRole('member'), 'rep')
  assert.equal(teamRoleCapabilities('owner', 'active').canAssignTeamTasks, true)
  assert.equal(teamRoleCapabilities('manager', 'active').canApproveMembers, true)
  assert.equal(teamRoleCapabilities('owner', 'active').canChangeMemberRoles, true)
  assert.equal(teamRoleCapabilities('manager', 'active').canChangeMemberRoles, false)
  assert.equal(teamRoleCapabilities('rep', 'active').canViewManagerDashboard, false)
  assert.equal(teamRoleCapabilities('manager', 'pending').canUseTeamWorkspace, false)
})

test('membership helpers enforce rep task scope and protect the owner role', () => {
  const memberships = [
    { user_id: USER_ID, role: 'member', status: 'active' },
    { user_id: OTHER_USER_ID, role: 'admin', status: 'active' },
  ]
  const actor = membershipForUser(memberships, USER_ID)
  assert.equal(actor.role, 'rep')
  assert.equal(canManageMemberRole(membershipForUser(memberships, OTHER_USER_ID), actor, 'manager'), false)
  assert.equal(canManageMemberRole({ role: 'owner', status: 'active' }, actor, 'manager'), true)
  assert.equal(canManageMemberRole({ role: 'owner', status: 'active' }, actor, 'owner'), false)
  const tasks = [
    { id: 'mine', visibility: 'team', owner_user_id: USER_ID },
    { id: 'other', visibility: 'team', owner_user_id: OTHER_USER_ID },
    { id: 'shared', visibility: 'team', owner_user_id: null },
  ]
  assert.deepEqual(filterTeamTasksForMembership(tasks, actor, USER_ID).map((task) => task.id), ['mine', 'shared'])
  assert.equal(filterTeamTasksForMembership(tasks, memberships[1], OTHER_USER_ID).length, 3)
})

test('raw client sends password only to auth and never retains it in client or session', async () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, init })
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({ access_token: 'token', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1', email: 'rj@example.test' } }),
    }
  }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, null, { fetchImpl })
  const session = await client.signIn('rj@example.test', 'one-time-input')
  assert.match(requests[0].url, /grant_type=password/)
  assert.match(requests[0].init.body, /one-time-input/)
  assert.deepEqual(Object.keys(client.config).sort(), ['anonKey', 'url'])
  assert.equal(JSON.stringify(session).includes('one-time-input'), false)
})

test('connection test verifies Supabase Auth without sending credentials', async () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, init })
    return response(200, { external: { email: true } })
  }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'browser-key' }, null, { fetchImpl })
  const result = await client.testConnection()
  assert.equal(result.connected, true)
  assert.match(requests[0].url, /\/auth\/v1\/settings$/)
  assert.equal(requests[0].init.method, 'GET')
  assert.equal(requests[0].init.body, undefined)
  assert.equal(requests[0].init.headers.apikey, 'browser-key')
})

test('network failures name the unreachable Supabase host and next checks', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch') }
  const client = createTeamSyncClient({ url: 'https://mistyped.supabase.co', anonKey: 'browser-key' }, null, { fetchImpl })
  await assert.rejects(
    () => client.testConnection(),
    (error) => error.code === 'network_error' && /mistyped\.supabase\.co/.test(error.message) && /project URL/.test(error.message),
  )
})

test('claim RPC acquired false is a hard failure', async () => {
  const fetchImpl = async () => response(200, [{ acquired: false, claimed_by: OTHER_USER_ID, expires_at: '2026-07-14T10:00:00Z' }])
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, {
    access_token: 'token', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER_ID },
  }, { fetchImpl })
  await assert.rejects(() => client.claimLead(ORGANIZATION_ID, 'lead-1'), (error) => error.code === 'claim_unavailable')
})

test('cloud payloads use UUID owner fields and stable UUID call-event IDs', async () => {
  const requests = []
  const fetchImpl = async (url, init) => { requests.push({ url, init }); return response(200, []) }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, {
    access_token: 'token', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER_ID },
  }, { fetchImpl })

  await client.upsertLeads(ORGANIZATION_ID, [
    { id: 'shared', visibility: 'team', ownerId: 'operator-rj', updatedAt: '2026-07-14T09:00:00Z' },
    { id: 'private', visibility: 'private', ownerId: 'operator-rj', updatedAt: '2026-07-14T09:00:00Z' },
  ])
  await client.upsertTasks(ORGANIZATION_ID, [
    { id: 'local-task', visibility: 'team', assigneeId: 'operator-rj', updatedAt: '2026-07-14T09:00:00Z' },
    { id: 'team-task', visibility: 'team', assigneeId: OTHER_USER_ID, updatedAt: '2026-07-14T09:00:00Z' },
  ])
  await client.recordCallEvents(ORGANIZATION_ID, [{ id: 'call-legacy-1', leadId: 'shared', result: 'Profile Sent', occurredAt: '2026-07-14T09:30:00Z' }])

  const leadsBody = JSON.parse(requests.find((item) => item.url.includes('/team_leads')).init.body)
  const tasksBody = JSON.parse(requests.find((item) => item.url.includes('/team_tasks')).init.body)
  const eventsBody = JSON.parse(requests.find((item) => item.url.includes('/call_events')).init.body)
  assert.equal(leadsBody[0].owner_user_id, null)
  assert.equal(leadsBody[1].owner_user_id, USER_ID)
  assert.equal(tasksBody[0].owner_user_id, null)
  assert.equal(tasksBody[1].owner_user_id, OTHER_USER_ID)
  assert.equal(isUuid(eventsBody[0].id), true)
  assert.equal(eventsBody[0].id, stableEventUuid('call-legacy-1'))
  assert.equal(eventsBody[0].payload.localEventId, 'call-legacy-1')
  assert.equal(stableEventUuid('call-legacy-1'), stableEventUuid('call-legacy-1'))
})

test('team role client methods use approval, role, open-join, and assignment endpoints', async () => {
  const requests = []
  const fetchImpl = async (url, init) => { requests.push({ url, init }); return response(200, [{ user_id: OTHER_USER_ID, role: 'rep', status: 'active' }]) }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, {
    access_token: 'token', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER_ID },
  }, { fetchImpl })

  await client.reviewMembership(ORGANIZATION_ID, OTHER_USER_ID, true)
  await client.setMemberRole(ORGANIZATION_ID, OTHER_USER_ID, 'manager')
  await client.setOrganizationOpenJoin(ORGANIZATION_ID, true)
  await client.assignTeamTask(ORGANIZATION_ID, { id: 'task-1', title: 'Call the Cavite list', assigneeId: OTHER_USER_ID })

  assert.match(requests[0].url, /review_organization_membership/)
  assert.deepEqual(JSON.parse(requests[0].init.body), { p_organization_id: ORGANIZATION_ID, p_user_id: OTHER_USER_ID, p_approved: true })
  assert.match(requests[1].url, /set_organization_member_role/)
  assert.equal(JSON.parse(requests[1].init.body).p_role, 'manager')
  assert.match(requests[2].url, /organizations\?id=eq/)
  assert.equal(JSON.parse(requests[2].init.body).open_join, true)
  assert.match(requests[3].url, /assign_team_task/)
  assert.equal(JSON.parse(requests[3].init.body).p_assignee_id, OTHER_USER_ID)
  await assert.rejects(() => client.setMemberRole(ORGANIZATION_ID, OTHER_USER_ID, 'owner'), (error) => error.code === 'owner_transfer_not_supported')
})

test('pending users can refresh only their own membership before full sync', async () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, init })
    return response(200, [{ organization_id: ORGANIZATION_ID, user_id: USER_ID, role: 'rep', status: 'active' }])
  }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, {
    access_token: 'token', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER_ID },
  }, { fetchImpl })
  const membership = await client.getMyMembership(ORGANIZATION_ID)
  assert.equal(membership.status, 'active')
  assert.match(requests[0].url, /memberships\?organization_id=eq\./)
  assert.match(requests[0].url, new RegExp(`user_id=eq\\.${USER_ID}`))
  assert.doesNotMatch(requests[0].url, /team_leads|call_events|team_tasks/)
})

test('session refresh happens before expiry and publishes the replacement session', async () => {
  const requests = []
  let published = null
  const fetchImpl = async (url, init) => {
    requests.push({ url, init })
    if (url.includes('grant_type=refresh_token')) return response(200, { access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 3600, user: { id: USER_ID } })
    return response(200, [{ id: USER_ID }])
  }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, {
    access_token: 'nearly-expired', refresh_token: 'refresh-1', expires_at: Math.floor(Date.now() / 1000) + 20, user: { id: USER_ID },
  }, { fetchImpl, onSession: (session) => { published = session } })
  await client.upsertProfile({ id: USER_ID, displayName: 'RJ' })
  assert.match(requests[0].url, /grant_type=refresh_token/)
  assert.equal(requests[1].init.headers.Authorization, 'Bearer fresh')
  assert.equal(published.access_token, 'fresh')
})

test('a 401 refreshes the session and retries the request once', async () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, init })
    if (url.includes('grant_type=refresh_token')) return response(200, { access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 3600, user: { id: USER_ID } })
    if (init.headers.Authorization === 'Bearer stale') return response(401, { message: 'JWT expired' })
    return response(200, [{ id: USER_ID }])
  }
  const client = createTeamSyncClient({ url: 'https://demo.supabase.co', anonKey: 'anon' }, {
    access_token: 'stale', refresh_token: 'refresh-1', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER_ID },
  }, { fetchImpl })
  await client.upsertProfile({ id: USER_ID, displayName: 'RJ' })
  assert.equal(requests.length, 3)
  assert.equal(requests[0].init.headers.Authorization, 'Bearer stale')
  assert.match(requests[1].url, /grant_type=refresh_token/)
  assert.equal(requests[2].init.headers.Authorization, 'Bearer fresh')
})

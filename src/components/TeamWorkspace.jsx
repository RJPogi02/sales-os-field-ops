import {
  AlertTriangle, Check, ClipboardList, Cloud, CloudOff, Copy, Crown, KeyRound, Link2, LoaderCircle,
  LockKeyhole, LogIn, LogOut, PhoneCall, Plus, RefreshCcw, ShieldCheck, Target, Trophy,
  UserCog, UserRoundCheck, Users, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  canManageMemberRole, computeTeamLeaderboard, filterTeamTasksForMembership, membershipForUser,
  createTeamSyncClient, normalizeMembershipStatus, normalizeTeamRole, teamRoleCapabilities, validateTeamConfig,
} from '../lib/teamSync.js'

const shell = { display: 'grid', gap: 16 }
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }
const card = { padding: 16, border: '1px solid var(--line, rgba(125,160,190,.24))', borderRadius: 16, background: 'var(--panel-soft, rgba(10,31,47,.45))' }
const field = { display: 'grid', gap: 6, minWidth: 0 }
const input = { width: '100%', minHeight: 42, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line, rgba(125,160,190,.28))', background: 'var(--input-bg, rgba(4,19,30,.5))', color: 'inherit' }
const actionRow = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
const button = { minHeight: 40, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line, rgba(125,160,190,.3))', background: 'var(--panel, rgba(8,31,48,.72))', color: 'inherit', cursor: 'pointer', display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center' }
const primary = { ...button, background: 'var(--accent, #2196f3)', color: '#fff', border: '1px solid transparent', fontWeight: 800 }

function cleanConfig(config = {}) {
  return { url: config.url || config.supabaseUrl || '', anonKey: config.anonKey || config.supabaseAnonKey || '' }
}

function statusCopy({ configured, signedIn, workspace, syncState, membershipStatus }) {
  if (syncState?.status === 'syncing') return { label: 'Syncing now', tone: '#60a5fa', Icon: LoaderCircle, spin: true }
  if (syncState?.status === 'checking-access') return { label: 'Checking approval', tone: '#60a5fa', Icon: LoaderCircle, spin: true }
  if (signedIn && workspace?.id && membershipStatus === 'pending') return { label: 'Awaiting owner approval', tone: '#fbbf24', Icon: ShieldCheck }
  if (signedIn && workspace?.id && membershipStatus === 'rejected') return { label: 'Join request declined', tone: '#fb7185', Icon: AlertTriangle }
  if (syncState?.status === 'connected' && signedIn && workspace?.id) return { label: 'Connected & synced', tone: '#34d399', Icon: Cloud }
  if (syncState?.status === 'error') return { label: 'Sync needs attention', tone: '#fb7185', Icon: AlertTriangle }
  if (signedIn && workspace?.id) return { label: 'Ready to sync', tone: '#fbbf24', Icon: Cloud }
  if (signedIn) return { label: 'Signed in · choose a team', tone: '#fbbf24', Icon: UserRoundCheck }
  if (configured) return { label: 'Configured · sign in', tone: '#fbbf24', Icon: KeyRound }
  return { label: 'Local-only', tone: '#94a3b8', Icon: CloudOff }
}

function ErrorNotice({ message }) {
  if (!message) return null
  return <div role="alert" style={{ ...card, padding: 12, display: 'flex', gap: 9, alignItems: 'flex-start', border: '1px solid rgba(251,113,133,.5)' }}><AlertTriangle size={17} color="#fb7185" /><span>{message}</span></div>
}

export function TeamWorkspace({
  config = {}, session = null, workspace = null, syncState = { status: 'local' },
  managedTeamConnection = false,
  memberships = [], callEvents = [], claims = [], teamTasks = [], leaderboard = null, membership = null,
  activeOperator = null,
  onConfigChange, onSignIn, onSignUp, onSignOut,
  onCreateOrganization, onJoinOrganization, onCheckMembership, onSync, onReleaseClaim,
  onSetOpenJoin, onReviewMembership, onChangeMemberRole, onAssignTask,
}) {
  const [draftConfig, setDraftConfig] = useState(() => cleanConfig(config))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState(activeOperator?.name || activeOperator?.profile?.name || '')
  const [authMode, setAuthMode] = useState('signin')
  const [organizationName, setOrganizationName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDue, setTaskDue] = useState('')

  useEffect(() => setDraftConfig(cleanConfig(config)), [config.anonKey, config.supabaseAnonKey, config.supabaseUrl, config.url])
  useEffect(() => {
    if (!displayName && (activeOperator?.name || activeOperator?.profile?.name)) setDisplayName(activeOperator?.name || activeOperator?.profile?.name)
  }, [activeOperator, displayName])

  const validation = useMemo(() => validateTeamConfig(draftConfig), [draftConfig])
  const savedValidation = useMemo(() => validateTeamConfig(config), [config])
  const configured = managedTeamConnection || savedValidation.valid
  const signedIn = Boolean(session?.access_token && session?.user?.id)
  const currentMembership = useMemo(() => membership
    ? { ...membership, role: normalizeTeamRole(membership.role), status: normalizeMembershipStatus(membership.status || membership.membership_status) }
    : membershipForUser(memberships, session?.user?.id)
      || (workspace?.id ? {
        user_id: session?.user?.id,
        role: normalizeTeamRole(workspace.role || (String(workspace.created_by || '') === String(session?.user?.id || '') ? 'owner' : 'rep')),
        status: normalizeMembershipStatus(workspace.membership_status || workspace.status || 'active'),
      } : null),
  [membership, memberships, session?.user?.id, workspace?.created_by, workspace?.id, workspace?.membership_status, workspace?.role, workspace?.status])
  const capabilities = useMemo(() => teamRoleCapabilities(currentMembership?.role, currentMembership?.status), [currentMembership?.role, currentMembership?.status])
  const membershipStatus = currentMembership?.status || 'active'
  const status = statusCopy({ configured, signedIn, workspace, syncState, membershipStatus })
  const rows = useMemo(() => leaderboard || computeTeamLeaderboard(memberships.filter((item) => normalizeMembershipStatus(item.status) === 'active'), callEvents), [callEvents, leaderboard, memberships])
  const activeClaims = useMemo(() => claims.filter((claim) => Date.parse(claim.expires_at || claim.expiresAt || '') > Date.now()), [claims])
  const activeMembers = useMemo(() => memberships.filter((item) => normalizeMembershipStatus(item.status) === 'active'), [memberships])
  const pendingMembers = useMemo(() => memberships.filter((item) => normalizeMembershipStatus(item.status) === 'pending'), [memberships])
  const visibleTasks = useMemo(() => filterTeamTasksForMembership(teamTasks, currentMembership, session?.user?.id), [currentMembership, session?.user?.id, teamTasks])

  useEffect(() => {
    if (!taskAssignee && activeMembers.length) setTaskAssignee(String(activeMembers[0].user_id || activeMembers[0].userId || ''))
  }, [activeMembers, taskAssignee])

  const run = async (name, task, { clearPassword = false } = {}) => {
    if (typeof task !== 'function') return
    setBusy(name)
    setError('')
    try {
      await task()
      if (clearPassword) setPassword('')
    } catch (caught) {
      setError(caught?.message || 'The team action could not be completed. Your local data was not changed.')
    } finally {
      setBusy('')
    }
  }

  const saveConfiguration = () => {
    if (managedTeamConnection) return
    if (!validation.valid) { setError(validation.errors.join(' ')); return }
    run('config', async () => {
      await createTeamSyncClient({ url: validation.url, anonKey: validation.anonKey }).testConnection()
      await onConfigChange?.({ url: validation.url, anonKey: validation.anonKey })
    })
  }

  const authenticate = () => {
    if (!email.trim() || !password) { setError('Enter an email and password.'); return }
    const callback = authMode === 'signup' ? onSignUp : onSignIn
    run('auth', () => callback?.({ email: email.trim(), password, displayName: displayName.trim() }), { clearPassword: true })
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(workspace?.invite_code || workspace?.inviteCode || '')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { setError('Copy was blocked. Select the invite code manually.') }
  }

  const assignTask = () => {
    if (!taskTitle.trim() || !taskAssignee) { setError('Enter a task and choose an active teammate.'); return }
    const draft = {
      id: `team-task-${Date.now().toString(36)}`,
      title: taskTitle.trim(),
      assigneeId: taskAssignee,
      dueAt: taskDue ? new Date(`${taskDue}T17:00:00`).toISOString() : null,
      visibility: 'team',
      scope: 'team',
      createdAt: new Date().toISOString(),
    }
    run('assign-task', async () => {
      await onAssignTask?.(draft)
      setTaskTitle('')
      setTaskDue('')
    })
  }

  return (
    <section className="secondary-view panel team-workspace-v009" style={shell}>
      <div className="view-heading" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div><span className="section-label">Company workspace</span><h1>Team Hub</h1><p>One shared prospect pool, clear ownership, protected call claims, and friendly performance competition.</p></div>
        <div style={{ ...card, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${status.tone}` }}><status.Icon className={status.spin ? 'spin' : ''} size={16} color={status.tone} /><strong>{status.label}</strong></div>
      </div>

      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid rgba(96,165,250,.45)' }}>
        <ShieldCheck size={21} color="#60a5fa" />
        {managedTeamConnection
          ? <div><strong>Company cloud ready</strong><p style={{ margin: '5px 0 0', opacity: .78 }}>The hosted app already has the shared company connection. Sign in with your own account, create or join a workspace, then sync with your coworkers—no project URL or API key setup is needed.</p></div>
          : <div><strong>Local-first, cloud when you choose</strong><p style={{ margin: '5px 0 0', opacity: .78 }}>Cross-laptop sharing starts only after a successful sign-in, team selection, and sync. Until then this device stays local-only; the screen never pretends a cloud connection exists.</p></div>}
      </div>

      <ErrorNotice message={error || syncState?.error} />

      <div style={cardGrid}>
        <article style={card}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 12 }}><KeyRound size={18} /><div><strong>1 · {managedTeamConnection ? 'Company cloud' : 'Supabase connection'}</strong><small style={{ display: 'block', opacity: .68 }}>{managedTeamConnection ? 'Managed securely for this hosted workspace.' : 'Project settings stay on this device.'}</small></div></div>
          {managedTeamConnection ? <div style={{ ...card, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid rgba(52,211,153,.45)' }}><Cloud size={19} color="#34d399" /><span><strong style={{ display: 'block' }}>Company cloud ready</strong><small style={{ display: 'block', marginTop: 5, opacity: .72 }}>Your browser uses the managed public connection automatically. Continue with your private account; administrators keep backend credentials and access rules out of this screen.</small></span></div> : <div style={{ display: 'grid', gap: 10 }}>
            <label style={field}><span>Project URL</span><input style={input} inputMode="url" autoComplete="url" value={draftConfig.url} onChange={(event) => setDraftConfig((current) => ({ ...current, url: event.target.value }))} placeholder="https://your-project.supabase.co" /></label>
            <label style={field}><span>Anon / publishable key</span><input style={input} type="password" autoComplete="off" value={draftConfig.anonKey} onChange={(event) => setDraftConfig((current) => ({ ...current, anonKey: event.target.value }))} placeholder="Use the browser-safe anon key" /></label>
            <button type="button" style={primary} disabled={busy === 'config'} onClick={saveConfiguration}>{busy === 'config' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{busy === 'config' ? 'Testing connection' : 'Test & save connection'}</button>
            <small style={{ opacity: .68 }}>Never enter a service-role key here. Apply the included RLS schema before inviting coworkers.</small>
          </div>}
        </article>

        <article style={{ ...card, opacity: configured ? 1 : .58 }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 12 }}><LogIn size={18} /><div><strong>2 · Private login</strong><small style={{ display: 'block', opacity: .68 }}>{signedIn ? `Signed in as ${session.user?.email || session.user?.id}` : 'Each coworker gets their own account.'}</small></div></div>
          {signedIn ? <div style={{ display: 'grid', gap: 12 }}><div style={{ ...card, padding: 12 }}><UserRoundCheck size={18} color="#34d399" /><p style={{ margin: '6px 0 0' }}>Your session is active. Passwords are never stored by this component.</p></div><button type="button" style={button} onClick={() => run('signout', onSignOut)} disabled={busy === 'signout'}><LogOut size={15} />Sign out</button></div> : <div style={{ display: 'grid', gap: 10 }}>
            <div style={actionRow}><button type="button" style={authMode === 'signin' ? primary : button} onClick={() => setAuthMode('signin')}>Sign in</button><button type="button" style={authMode === 'signup' ? primary : button} onClick={() => setAuthMode('signup')}>Create account</button></div>
            {authMode === 'signup' ? <label style={field}><span>Display name</span><input style={input} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label> : null}
            <label style={field}><span>Work email</span><input style={input} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label style={field}><span>Password</span><input style={input} type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button type="button" style={primary} disabled={!configured || busy === 'auth'} onClick={authenticate}>{busy === 'auth' ? <LoaderCircle className="spin" size={15} /> : <LogIn size={15} />}{authMode === 'signin' ? 'Sign in securely' : 'Create account'}</button>
          </div>}
        </article>

        <article style={{ ...card, opacity: signedIn ? 1 : .58 }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 12 }}><Users size={18} /><div><strong>3 · Company team</strong><small style={{ display: 'block', opacity: .68 }}>{workspace?.name || 'Create a workspace or join by invite.'}</small></div></div>
          {workspace?.id ? <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...card, padding: 12 }}><span style={{ opacity: .7 }}>Invite code</span><div style={{ ...actionRow, marginTop: 5 }}><strong style={{ fontSize: 20, letterSpacing: 2 }}>{workspace.invite_code || workspace.inviteCode || 'Unavailable'}</strong><button type="button" style={button} disabled={!workspace.invite_code && !workspace.inviteCode} onClick={copyInvite}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></div></div>
            {membershipStatus === 'pending' ? <div style={{ ...card, padding: 12, border: '1px solid rgba(251,191,36,.45)' }}><ShieldCheck size={18} color="#fbbf24" /><strong style={{ display: 'block', marginTop: 6 }}>Join request sent</strong><p style={{ margin: '4px 0 10px', opacity: .72 }}>An owner or manager must approve this account before team leads, tasks, and performance data can sync. Team Hub checks again every 20 seconds while this screen is open.</p><button type="button" style={button} disabled={!onCheckMembership || busy === 'check-membership' || syncState?.status === 'checking-access'} onClick={() => run('check-membership', onCheckMembership)}>{busy === 'check-membership' || syncState?.status === 'checking-access' ? <LoaderCircle className="spin" size={15} /> : <RefreshCcw size={15} />}Check approval now</button></div> : null}
            {membershipStatus === 'rejected' ? <div style={{ ...card, padding: 12, border: '1px solid rgba(251,113,133,.45)' }}><AlertTriangle size={18} color="#fb7185" /><strong style={{ display: 'block', marginTop: 6 }}>This request was declined</strong><p style={{ margin: '4px 0 0', opacity: .72 }}>Ask the workspace owner before requesting access again.</p></div> : null}
            {capabilities.active ? <>
              <div style={{ ...actionRow, justifyContent: 'space-between' }}>
                <span><small style={{ display: 'block', opacity: .64 }}>Your team role</small><strong style={{ textTransform: 'capitalize' }}>{capabilities.role}</strong></span>
                {capabilities.canConfigureOpenJoin && !managedTeamConnection ? <label style={{ ...actionRow, cursor: onSetOpenJoin ? 'pointer' : 'default' }}><input type="checkbox" checked={Boolean(workspace.open_join ?? workspace.openJoin)} disabled={!onSetOpenJoin || busy === 'open-join'} onChange={(event) => run('open-join', () => onSetOpenJoin?.(event.target.checked))} /><span>Approve invite-code joins automatically</span></label> : null}
              </div>
              <button type="button" style={primary} disabled={busy === 'sync' || syncState?.status === 'syncing'} onClick={() => run('sync', onSync)}>{busy === 'sync' || syncState?.status === 'syncing' ? <LoaderCircle className="spin" size={15} /> : <RefreshCcw size={15} />}Sync team now</button>
              <small style={{ opacity: .7 }}>Last successful sync: {syncState?.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString() : 'Not yet synced'}</small>
            </> : null}
          </div> : <div style={{ display: 'grid', gap: 12 }}>
            {!managedTeamConnection ? <><label style={field}><span>New team name</span><input style={input} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder={`${config?.companyName || 'Company'} Sales`} /></label>
            <button type="button" style={button} disabled={!signedIn || !organizationName.trim() || busy === 'create'} onClick={() => run('create', () => onCreateOrganization?.(organizationName.trim()))}><Plus size={15} />Create company workspace</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: .55 }}><span style={{ height: 1, flex: 1, background: 'currentColor' }} /><small>OR</small><span style={{ height: 1, flex: 1, background: 'currentColor' }} /></div></> : <div style={{ ...card, padding: 12, border: '1px solid rgba(96,165,250,.35)' }}><ShieldCheck size={17} color="#60a5fa" /><strong style={{ display: 'block', marginTop: 6 }}>Invite-only company access</strong><small style={{ display: 'block', marginTop: 5, opacity: .72 }}>Enter the private code supplied by your workspace owner. Every hosted join request stays pending until an owner or manager approves it.</small></div>}
            <label style={field}><span>Invite code</span><input style={input} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="AB12CD34EF56" /></label>
            <button type="button" style={button} disabled={!signedIn || !inviteCode.trim() || busy === 'join'} onClick={() => run('join', () => onJoinOrganization?.(inviteCode.trim()))}><Link2 size={15} />Request team access</button>
          </div>}
        </article>
      </div>

      {capabilities.active ? <div style={cardGrid}>
        <section style={{ ...card, display: 'grid', gap: 13 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><UserCog size={19} color="#60a5fa" /><div><strong>People &amp; access</strong><small style={{ display: 'block', opacity: .67 }}>{capabilities.canApproveMembers ? 'Approve access and keep responsibilities explicit.' : 'Your operator workspace shows only the work assigned to you.'}</small></div></div><strong style={{ textTransform: 'capitalize' }}>{capabilities.role}</strong></header>

          {capabilities.canApproveMembers && pendingMembers.length ? <div style={{ display: 'grid', gap: 8 }}><span className="section-label">Pending approval</span>{pendingMembers.map((item) => {
            const userId = String(item.user_id || item.userId || '')
            const name = item.profile?.display_name || item.display_name || item.name || 'New teammate'
            return <article key={userId} style={{ ...card, padding: 11, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}><span><strong style={{ display: 'block' }}>{name}</strong><small style={{ opacity: .65 }}>Requested {item.requested_at ? new Date(item.requested_at).toLocaleString() : 'recently'} · joins as rep</small></span><span style={actionRow}><button type="button" style={primary} disabled={!onReviewMembership || busy === `approve-${userId}`} onClick={() => run(`approve-${userId}`, () => onReviewMembership?.(userId, true))}><Check size={14} />Approve</button><button type="button" style={button} disabled={!onReviewMembership || busy === `reject-${userId}`} onClick={() => run(`reject-${userId}`, () => onReviewMembership?.(userId, false))}><X size={14} />Decline</button></span></article>
          })}</div> : null}

          {capabilities.canApproveMembers ? <div style={{ display: 'grid', gap: 8 }}><span className="section-label">Active team</span>{activeMembers.map((item) => {
            const userId = String(item.user_id || item.userId || '')
            const role = normalizeTeamRole(item.role)
            const name = item.profile?.display_name || item.display_name || item.name || 'Sales operator'
            const maySetManager = canManageMemberRole(currentMembership, item, 'manager')
            const maySetRep = canManageMemberRole(currentMembership, item, 'rep')
            const canChange = role !== 'owner' && userId !== String(session?.user?.id || '') && (maySetManager || maySetRep) && Boolean(onChangeMemberRole)
            return <article key={userId} style={{ ...card, padding: 11, display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(120px, 170px)', gap: 10, alignItems: 'center' }}><span><strong style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{role === 'owner' ? <Crown size={14} color="#fbbf24" /> : null}{name}{userId === session?.user?.id ? ' · You' : ''}</strong><small style={{ opacity: .64 }}>{role === 'owner' ? 'Workspace owner' : role === 'manager' ? 'Can approve, assign, and review' : 'Assigned operator scope'}</small></span><select style={input} value={role} disabled={!canChange || busy === `role-${userId}`} onChange={(event) => run(`role-${userId}`, () => onChangeMemberRole?.(userId, event.target.value))}><option value="owner" disabled>Owner</option><option value="manager" disabled={!maySetManager}>Manager</option><option value="rep" disabled={!maySetRep}>Rep</option></select></article>
          })}</div> : <div style={{ ...card, padding: 12 }}><ShieldCheck size={18} color="#34d399" /><p style={{ margin: '6px 0 0', opacity: .76 }}>Private profile data stays yours. Shared leads remain claim-protected, and only tasks assigned to you appear in your team workload.</p></div>}
        </section>

        <section style={{ ...card, display: 'grid', gap: 13 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><ClipboardList size={19} color="#34d399" /><div><strong>Team tasks</strong><small style={{ display: 'block', opacity: .67 }}>{capabilities.canAssignTeamTasks ? 'Assign focused work without exposing private device tasks.' : 'Only shared work assigned to you is shown.'}</small></div></div><strong>{visibleTasks.length}</strong></header>
          {capabilities.canAssignTeamTasks ? <div style={{ ...card, padding: 12, display: 'grid', gap: 9 }}><label style={field}><span>Task</span><input style={input} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Follow up Cavite quote requests" /></label><div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(140px, .7fr)', gap: 9 }}><label style={field}><span>Assign to</span><select style={input} value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}>{activeMembers.map((item) => <option key={item.user_id || item.userId} value={item.user_id || item.userId}>{item.profile?.display_name || item.display_name || item.name || normalizeTeamRole(item.role)}</option>)}</select></label><label style={field}><span>Due date</span><input style={input} type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label></div><button type="button" style={primary} disabled={!onAssignTask || !taskTitle.trim() || !taskAssignee || busy === 'assign-task'} onClick={assignTask}>{busy === 'assign-task' ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Assign team task</button></div> : null}
          {visibleTasks.length ? <div style={{ display: 'grid', gap: 8 }}>{visibleTasks.slice(0, 8).map((task) => <article key={task.id || task.task_id} style={{ ...card, padding: 11, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}><span><strong style={{ display: 'block' }}>{task.title || task.payload?.title || 'Team task'}</strong><small style={{ opacity: .65 }}>{task.dueDate || task.due_at ? `Due ${new Date(task.due_at || `${task.dueDate}T12:00:00`).toLocaleDateString()}` : 'No due date'} · {task.completed || task.status === 'completed' ? 'Completed' : 'Open'}</small></span><span style={{ fontSize: 12, opacity: .68 }}>{activeMembers.find((member) => String(member.user_id || member.userId) === String(task.owner_user_id || task.assigneeId))?.profile?.display_name || 'Assigned'}</span></article>)}</div> : <div style={{ ...card, padding: 14, textAlign: 'center' }}><ClipboardList size={24} style={{ opacity: .4 }} /><p style={{ margin: '7px 0 0', opacity: .68 }}>No team tasks in your scope yet.</p></div>}
        </section>
      </div> : null}

      <section style={{ ...card, display: 'grid', gap: 14 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Trophy size={19} color="#fbbf24" /><div><strong>Team leaderboard</strong><small style={{ display: 'block', opacity: .67 }}>Calls reward consistency; quality outcomes score higher.</small></div></div><strong>{rows.length} operator{rows.length === 1 ? '' : 's'}</strong></header>
        {rows.length ? <div style={{ display: 'grid', gap: 8 }}>{rows.map((row, index) => <article key={row.userId} style={{ display: 'grid', gridTemplateColumns: '42px minmax(140px, 1fr) repeat(4, minmax(54px, auto)) minmax(76px, auto)', gap: 10, alignItems: 'center', padding: 11, borderRadius: 12, border: `1px solid ${index === 0 ? 'rgba(251,191,36,.45)' : 'var(--line, rgba(125,160,190,.2))'}`, background: index === 0 ? 'rgba(251,191,36,.07)' : 'transparent' }}>
          <strong style={{ fontSize: 18, color: index === 0 ? '#fbbf24' : 'inherit' }}>#{index + 1}</strong><span><strong style={{ display: 'block' }}>{row.name}</strong><small style={{ opacity: .65 }}>{row.role}{row.userId === session?.user?.id ? ' · You' : ''}</small></span><small><b style={{ display: 'block', fontSize: 15 }}>{row.calls}</b>calls</small><small><b style={{ display: 'block', fontSize: 15 }}>{row.answered}</b>contacts</small><small><b style={{ display: 'block', fontSize: 15 }}>{row.profiles}</b>profiles</small><small><b style={{ display: 'block', fontSize: 15 }}>{row.quotes}</b>ready</small><strong>{row.score} pts</strong>
        </article>)}</div> : <div style={{ ...card, textAlign: 'center' }}><Trophy size={28} style={{ opacity: .45 }} /><h3 style={{ margin: '8px 0 4px' }}>Leaderboard starts after the first synced call.</h3><p style={{ margin: 0, opacity: .68 }}>Local operators do not appear as cloud teammates until they sign in and join this workspace.</p></div>}
      </section>

      <div style={cardGrid}>
        <article style={card}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><LockKeyhole size={18} /><strong>Live lead claims</strong></div><strong style={{ display: 'block', fontSize: 30, marginTop: 10 }}>{activeClaims.length}</strong><p style={{ opacity: .7 }}>Active claim{activeClaims.length === 1 ? '' : 's'} prevent coworkers from calling the same lead at the same time.</p>{activeClaims.slice(0, 5).map((claim) => <div key={`${claim.lead_id || claim.leadId}-${claim.claimed_by || claim.claimedBy}`} style={{ ...actionRow, justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line, rgba(125,160,190,.2))' }}><span><b>{claim.leadName || claim.lead_id || claim.leadId}</b><small style={{ display: 'block', opacity: .65 }}>{claim.claimedByName || claim.profile?.display_name || 'Team member'} · until {new Date(claim.expires_at || claim.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span>{String(claim.claimed_by || claim.claimedBy) === String(session?.user?.id) && onReleaseClaim ? <button type="button" style={button} onClick={() => run(`release-${claim.lead_id || claim.leadId}`, () => onReleaseClaim(claim))}>Release</button> : null}</div>)}</article>
        <article style={card}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Target size={18} /><strong>Fair-play scoring</strong></div><ul style={{ paddingLeft: 20, lineHeight: 1.75, opacity: .78 }}><li><PhoneCall size={13} /> Call logged: 10 points</li><li>Real contact: +25 points</li><li>Profile sent: +20 points</li><li>Quote-ready: +75 points</li><li>Pricing handoff: +100 points</li></ul><small style={{ opacity: .65 }}>Points motivate good workflow; they are not payroll or commission records.</small></article>
      </div>
    </section>
  )
}

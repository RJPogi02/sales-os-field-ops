import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Compass,
  KeyRound,
  LockKeyhole,
  MapPinned,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { APP_VERSION_LABEL } from '../config/version.js'
import { validDevicePin } from '../lib/deviceLock.js'

const STEPS = [
  { Icon: Compass, eyebrow: `Welcome / ${APP_VERSION_LABEL}`, title: 'Set up your private field cockpit.' },
  { Icon: UserRound, eyebrow: '01 / Operator', title: 'Make the mission yours.' },
  { Icon: LockKeyhole, eyebrow: '02 / Privacy', title: 'Lock this device between sessions.' },
  { Icon: Radar, eyebrow: '03 / Lead Finder', title: 'Configure discovery once, then protect every result.' },
  { Icon: Users, eyebrow: '04 / Team readiness', title: 'Start solo or prepare a shared company workspace.' },
  { Icon: Sparkles, eyebrow: 'Ready', title: 'Your first mission is ready to launch.' },
]

const cleanGoal = (value) => Math.min(50, Math.max(1, Number.parseInt(value, 10) || 20))

export function OnboardingModal({
  profile = {},
  territory = 'ALL',
  teamConfig = { url: '', anonKey: '' },
  managedTeamConnection = false,
  deviceLock = { enabled: false },
  firstRun = false,
  onSaveSetup,
  onTestGoogleKey,
  onClose,
  onStartPractice,
}) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testState, setTestState] = useState({ status: 'idle', message: '' })
  const [setup, setSetup] = useState(() => ({
    name: profile.name || '',
    company: profile.company || '',
    position: profile.position || '',
    dailyCallGoal: cleanGoal(profile.dailyCallGoal),
    territory: territory || profile.territoryFocus || 'ALL',
    enableDeviceLock: Boolean(deviceLock?.enabled) || firstRun,
    pin: '',
    confirmPin: '',
    leadSearchProvider: profile.leadSearchProvider || 'nominatim',
    googlePlacesApiKey: profile.googlePlacesApiKey || '',
    teamMode: managedTeamConnection || teamConfig?.url ? 'team' : 'solo',
    teamUrl: teamConfig?.url || '',
    teamAnonKey: teamConfig?.anonKey || '',
  }))
  const item = STEPS[step]
  const Icon = item.Icon
  const update = (field, value) => {
    setSetup((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const summary = useMemo(() => [
    { label: 'Operator', value: setup.name || 'Not set', Icon: UserRound },
    { label: 'Daily mission', value: `${cleanGoal(setup.dailyCallGoal)} calls · ${setup.territory}`, Icon: MapPinned },
    { label: 'Device privacy', value: setup.enableDeviceLock || deviceLock?.enabled ? 'PIN gate enabled' : 'No local PIN', Icon: ShieldCheck },
    { label: 'Lead discovery', value: setup.leadSearchProvider === 'google-places' ? 'Google Places' : 'OpenStreetMap', Icon: Radar },
    { label: 'Collaboration', value: setup.teamMode === 'team' ? (managedTeamConnection ? 'Company cloud ready' : 'Team connection staged') : 'Solo workspace', Icon: Users },
  ], [deviceLock?.enabled, managedTeamConnection, setup])

  const validateStep = () => {
    if (step === 1 && !setup.name.trim()) return 'Add your operator name before continuing.'
    if (step === 2 && setup.enableDeviceLock && !deviceLock?.enabled) {
      if (!validDevicePin(setup.pin)) return 'Choose a 4-8 digit PIN.'
      if (setup.pin !== setup.confirmPin) return 'The PIN confirmation does not match.'
    }
    if (step === 3 && setup.leadSearchProvider === 'google-places' && !setup.googlePlacesApiKey.trim()) return 'Paste a restricted Google Maps browser key or choose OpenStreetMap for now.'
    if (step === 4 && setup.teamMode === 'team' && !managedTeamConnection && (!setup.teamUrl.trim() || !setup.teamAnonKey.trim())) return 'Add both company connection fields, or choose Solo for now.'
    return ''
  }

  const next = () => {
    const problem = validateStep()
    if (problem) return setError(problem)
    setError('')
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
  }

  const testGoogle = async () => {
    const key = setup.googlePlacesApiKey.trim()
    if (!key) return setTestState({ status: 'error', message: 'Paste the browser key first.' })
    setTestState({ status: 'testing', message: 'Running one small Places lookup…' })
    try {
      const result = await onTestGoogleKey?.(key)
      setTestState({ status: 'success', message: result?.message || 'Connection works. Lead Finder is ready.' })
    } catch (testError) {
      setTestState({ status: 'error', message: testError?.message || 'Google Places could not be reached.' })
    }
  }

  const finish = async (practice = false) => {
    const problem = validateStep()
    if (problem) return setError(problem)
    setSaving(true)
    setError('')
    try {
      await onSaveSetup?.({
        profile: {
          ...profile,
          name: setup.name.trim() || profile.name,
          company: setup.company.trim(),
          position: setup.position.trim(),
          dailyCallGoal: cleanGoal(setup.dailyCallGoal),
          territoryFocus: setup.territory,
          leadSearchProvider: setup.leadSearchProvider,
          googlePlacesApiKey: setup.leadSearchProvider === 'google-places' ? setup.googlePlacesApiKey.trim() : profile.googlePlacesApiKey || '',
        },
        territory: setup.territory,
        devicePin: setup.enableDeviceLock && !deviceLock?.enabled ? setup.pin : '',
        enableDeviceLock: setup.enableDeviceLock,
        teamConfig: setup.teamMode === 'team'
          ? (managedTeamConnection ? teamConfig : { url: setup.teamUrl.trim(), anonKey: setup.teamAnonKey.trim() })
          : teamConfig,
        teamMode: setup.teamMode,
      })
      if (practice) onStartPractice?.()
      else onClose?.()
    } catch (saveError) {
      setError(saveError?.message || 'Setup could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop onboarding-backdrop" role="presentation">
      <section className="onboarding-modal onboarding-v0082 panel" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header>
          <div className="onboarding-brand"><span>Sales OS</span><em>Private field setup · {APP_VERSION_LABEL}</em></div>
          <button onClick={onClose} aria-label="Set up later"><X size={18} /></button>
        </header>

        <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((entry, index) => <button type="button" key={entry.eyebrow} className={index <= step ? 'active' : ''} onClick={() => index < step && setStep(index)} aria-label={`Go to ${entry.eyebrow}`}><i /></button>)}
        </div>

        <div className="onboarding-stage-head">
          <span className="onboarding-icon"><Icon size={28} /></span>
          <div><span className="section-label">{item.eyebrow}</span><h2 id="onboarding-title">{item.title}</h2></div>
        </div>

        <div className="onboarding-stage">
          {step === 0 ? <div className="setup-welcome">
            <div><strong>A calmer first launch</strong><p>Set your identity, mission target, local privacy, and lead provider before the first real call. Your data stays local unless you deliberately connect a team workspace.</p></div>
            <div className="setup-loop"><span>Discover</span><i /><span>Call</span><i /><span>Qualify</span><i /><span>Handoff</span><i /><span>Improve</span></div>
            <div className="onboarding-mission"><CheckCircle2 size={18} /><p><strong>Nothing is sent automatically.</strong> Search results, CRM changes, and team sharing remain explicit operator actions.</p></div>
          </div> : null}

          {step === 1 ? <div className="setup-form setup-operator-grid">
            <label><span>Operator name</span><input value={setup.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" autoFocus /></label>
            <label><span>Role / position</span><input value={setup.position} onChange={(event) => update('position', event.target.value)} placeholder="Sales operator" /></label>
            <label className="setup-wide"><span>Company</span><input value={setup.company} onChange={(event) => update('company', event.target.value)} placeholder="Company name" /></label>
            <label><span>Daily call goal</span><input type="number" min="1" max="50" value={setup.dailyCallGoal} onChange={(event) => update('dailyCallGoal', event.target.value)} /></label>
            <label><span>Territory focus</span><select value={setup.territory} onChange={(event) => update('territory', event.target.value)}><option value="ALL">All territories</option><option value="NCR">NCR</option><option value="NORTH">North Luzon</option><option value="SOUTH">South Luzon</option></select></label>
          </div> : null}

          {step === 2 ? <div className="setup-privacy">
            <button type="button" className={`setup-choice ${setup.enableDeviceLock ? 'selected' : ''}`} onClick={() => update('enableDeviceLock', !setup.enableDeviceLock)}><span><LockKeyhole size={20} /><strong>Require a PIN when Sales OS starts</strong><small>Recommended on a shared or work laptop.</small></span><i>{setup.enableDeviceLock ? <Check size={15} /> : null}</i></button>
            {setup.enableDeviceLock && !deviceLock?.enabled ? <div className="setup-form setup-pin-grid"><label><span>Create PIN</span><input type="password" inputMode="numeric" maxLength="8" value={setup.pin} onChange={(event) => update('pin', event.target.value.replace(/\D/g, ''))} placeholder="4-8 digits" /></label><label><span>Confirm PIN</span><input type="password" inputMode="numeric" maxLength="8" value={setup.confirmPin} onChange={(event) => update('confirmPin', event.target.value.replace(/\D/g, ''))} placeholder="Repeat PIN" /></label></div> : null}
            {deviceLock?.enabled ? <div className="setup-status success"><ShieldCheck size={18} /><span><strong>Device lock already configured</strong><small>You can disable or replace it later in Settings.</small></span></div> : null}
            <p className="setup-fineprint"><ShieldCheck size={14} />The PIN is converted into a salted verifier and is never saved as readable text. This is a local privacy gate, not file encryption or a cloud account.</p>
          </div> : null}

          {step === 3 ? <div className="setup-discovery">
            <div className="setup-choice-grid">
              <button type="button" className={`setup-provider-card ${setup.leadSearchProvider === 'google-places' ? 'selected' : ''}`} onClick={() => update('leadSearchProvider', 'google-places')}><Cloud size={21} /><strong>Google Places</strong><small>Rich business details and broad coverage. Requires your restricted browser key.</small></button>
              <button type="button" className={`setup-provider-card ${setup.leadSearchProvider === 'nominatim' ? 'selected' : ''}`} onClick={() => update('leadSearchProvider', 'nominatim')}><MapPinned size={21} /><strong>OpenStreetMap</strong><small>Useful fallback for light manual discovery. Public-service limits still apply.</small></button>
            </div>
            {setup.leadSearchProvider === 'google-places' ? <div className="setup-api-key"><label><span>Restricted Google Maps browser key</span><div><KeyRound size={16} /><input type="password" value={setup.googlePlacesApiKey} onChange={(event) => { update('googlePlacesApiKey', event.target.value); setTestState({ status: 'idle', message: '' }) }} placeholder="AIza…" autoComplete="off" /><button type="button" onClick={testGoogle} disabled={testState.status === 'testing'}>{testState.status === 'testing' ? 'Testing…' : 'Test one lookup'}</button></div></label>{testState.message ? <p className={`setup-test-result ${testState.status}`}>{testState.message}</p> : null}<small>Restrict this key to your Sales OS origin and the Places API. Sales OS caches each completed search so tab changes do not spend another request.</small></div> : <div className="setup-status"><MapPinned size={18} /><span><strong>No key required</strong><small>Keep searches small and operator-triggered; use Google Places for production-scale discovery.</small></span></div>}
          </div> : null}

          {step === 4 ? <div className="setup-team">
            <div className="setup-choice-grid">
              <button type="button" className={`setup-provider-card ${setup.teamMode === 'solo' ? 'selected' : ''}`} onClick={() => update('teamMode', 'solo')}><UserRound size={21} /><strong>Solo for now</strong><small>Everything works locally. Team setup remains available in Team Hub.</small></button>
              <button type="button" className={`setup-provider-card ${setup.teamMode === 'team' ? 'selected' : ''}`} onClick={() => update('teamMode', 'team')}><Users size={21} /><strong>Connect my company</strong><small>Stage the shared connection now, then create or join the workspace with an account.</small></button>
            </div>
            {setup.teamMode === 'team' ? (managedTeamConnection
              ? <div className="setup-status success"><Cloud size={18} /><span><strong>Company cloud ready</strong><small>The hosted app already knows where to connect. You and your coworkers only need private accounts and the same workspace invite code.</small></span></div>
              : <div className="setup-form setup-team-grid"><label><span>Company Supabase URL</span><input value={setup.teamUrl} onChange={(event) => update('teamUrl', event.target.value)} placeholder="https://your-project.supabase.co" /></label><label><span>Public anon key</span><input type="password" value={setup.teamAnonKey} onChange={(event) => update('teamAnonKey', event.target.value)} placeholder="Public anon key" autoComplete="off" /></label></div>) : null}
            <div className="team-setup-roadmap"><span className={setup.teamMode === 'team' ? 'active' : ''}><i>1</i><strong>Company connection</strong><small>One admin configures the shared backend.</small></span><span><i>2</i><strong>Private account</strong><small>Each coworker signs in separately.</small></span><span><i>3</i><strong>Invite & sync</strong><small>Join the same workspace and claim leads.</small></span></div>
            <p className="setup-fineprint"><Users size={14} />{managedTeamConnection ? 'The shared connection is managed for this hosted app. Live claims, assignments, and rankings begin after coworkers sign in and join the same workspace.' : 'Solo mode is ready immediately. Live cross-laptop claims, assignments, and rankings only appear after a real company workspace connects successfully.'}</p>
          </div> : null}

          {step === 5 ? <div className="setup-ready">
            <div className="setup-summary-grid">{summary.map(({ label, value, Icon: SummaryIcon }) => <article key={label}><SummaryIcon size={17} /><span><small>{label}</small><strong>{value}</strong></span></article>)}</div>
            <div className="setup-next-note"><Sparkles size={20} /><p><strong>Your companion grows through real work.</strong> Calls, verified lead imports, completed tasks, profiles, quote-ready leads, and handoffs can now move your XP bar. Visual sprite customization stays a future class-tree upgrade—not a fake generator.</p></div>
          </div> : null}
        </div>

        {error ? <p className="onboarding-error" role="alert">{error}</p> : null}

        <footer>
          <button disabled={step === 0 || saving} onClick={() => { setError(''); setStep((value) => Math.max(0, value - 1)) }}><ArrowLeft size={15} />Back</button>
          <span>{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? <button className="primary-action" onClick={next}>Continue<ArrowRight size={15} /></button> : <div className="onboarding-final-actions"><button disabled={saving} onClick={() => finish(true)}><Play size={15} />Practice first</button><button disabled={saving} className="primary-action" onClick={() => finish(false)}>{saving ? 'Saving…' : 'Launch workspace'}<ArrowRight size={15} /></button></div>}
        </footer>
      </section>
    </div>
  )
}

import { AlertTriangle, Bot, Database, Download, Eye, Globe2, KeyRound, Palette, Play, Plus, RotateCcw, Save, ShieldCheck, Target, Trash2, Upload, UserRound, Users, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { themes } from './SystemRail.jsx'

const territories = [['ALL', 'All territories'], ['NCR', 'NCR'], ['NORTH', 'North Luzon'], ['SOUTH', 'South Luzon']]
const tabs = [
  ['profile', UserRound, 'Profile'], ['themes', Palette, 'Themes'], ['mission', Target, 'Sales mission'],
  ['search', Globe2, 'Lead search'], ['keys', KeyRound, 'API keys'], ['data', Database, 'Data / export'],
  ['agents', Bot, 'AI agents'], ['privacy', ShieldCheck, 'Privacy'],
]
const backgrounds = [
  ['auto', 'Theme default'], ['light-gradient', 'Light gradient'], ['dark-gradient', 'Dark gradient'],
  ['blue-landscape', 'Soft blue landscape'], ['space', 'Stars / space'], ['butterfly', 'Butterfly bokeh'], ['abstract', 'Minimal abstract blur'],
]
const providers = [
  ['nominatim', 'OpenStreetMap / Nominatim', false], ['google-places', 'Google Places — future', true],
  ['mapbox', 'Mapbox — future', true], ['manual', 'Manual only', false],
]
const agents = ['Lead Research Agent', 'Follow-Up Agent', 'Call Coach Agent', 'Report Agent', 'Source Match Agent', 'QA / Verifier Agent']

async function resizeBackground(file) {
  const source = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const maxWidth = 1600
  const scale = Math.min(1, maxWidth / source.width)
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close()
  return canvas.toDataURL('image/jpeg', .82)
}

export function SettingsModal({
  theme, onThemeChange, territory, onTerritoryChange, profile, onProfileChange, onClose, onResetDaily, onFactoryReset,
  appearance, onAppearanceChange, operators = [], activeOperatorId, onOperatorChange, onAddOperator, onRemoveOperator,
  demoMode, onToggleDemo, practiceMode, onStartPractice, onEndPractice, onOpenOnboarding, onExport,
}) {
  const [tab, setTab] = useState('profile')
  const backgroundRef = useRef(null)
  const setProfileField = (field, value) => onProfileChange({ ...profile, [field]: value })
  const setAppearance = (field, value) => onAppearanceChange({ ...appearance, [field]: value })

  return (
    <div className="modal-backdrop settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal settings-v007 panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><div><span className="section-label">System settings</span><h2 id="settings-title">Sales OS controls</h2><p>Operator identity, workspace feel, sales tools, and local-first data.</p></div><button onClick={onClose} aria-label="Close settings"><X size={18} /></button></header>
        <div className="settings-shell">
          <nav aria-label="Settings sections">{tabs.map(([id, Icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={16} /><span>{label}</span></button>)}</nav>
          <div className="settings-pane">
            {tab === 'profile' ? <section><h3><Users size={17} />Operator identity</h3><p className="settings-intro">The user photo is the hero. The animated character represents the earned sales class.</p><label><span>Active operator</span><select value={activeOperatorId} onChange={(event) => onOperatorChange(event.target.value)}>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.profile?.name || 'Operator'}</option>)}</select></label><div className="operator-settings-actions"><button onClick={onAddOperator}><Plus size={14} />Add coworker/operator</button><button className="danger-outline" disabled={operators.length <= 1} onClick={() => onRemoveOperator(activeOperatorId)}><Trash2 size={14} />Remove active</button></div><div className="settings-form-grid"><label><span>Name</span><input value={profile.name || ''} onChange={(event) => setProfileField('name', event.target.value)} /></label><label><span>Position</span><input value={profile.position || ''} onChange={(event) => setProfileField('position', event.target.value)} /></label><label><span>Company</span><input value={profile.company || ''} onChange={(event) => setProfileField('company', event.target.value)} /></label><label><span>Territory focus</span><select value={territory} onChange={(event) => { onTerritoryChange(event.target.value); setProfileField('territoryFocus', event.target.value) }}>{territories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><div className="settings-form-grid"><label><span>Show operator photo</span><select value={profile.showOperatorPhoto === false ? 'off' : 'on'} onChange={(event) => setProfileField('showOperatorPhoto', event.target.value === 'on')}><option value="on">On</option><option value="off">Off</option></select></label><label><span>Companion animations</span><select value={profile.companionMode || 'full'} onChange={(event) => setProfileField('companionMode', event.target.value)}><option value="full">Full</option><option value="minimal">Minimal</option><option value="off">Off</option></select></label><label><span>Companion location</span><select value={profile.companionLocation || 'auto'} onChange={(event) => setProfileField('companionLocation', event.target.value)}><option value="auto">Auto</option><option value="xp">XP Card</option><option value="profile">Operator Profile</option></select></label></div></section> : null}

            {tab === 'themes' ? <section><h3><Palette size={17} />Themes & background</h3><div className="theme-setting-grid">{themes.map(({ id, label, description, Icon }) => <button key={id} className={theme === id ? 'active' : ''} onClick={() => onThemeChange(id)}><Icon size={18} /><span><strong>{label}</strong><small>{description}</small></span></button>)}</div><div className="call-theme-setting"><div><Palette size={17} /><span><strong>Call Mode appearance</strong><small>Match the workspace automatically or keep a separate focused-call look.</small></span></div><select value={profile.callModeTheme || 'inherit'} onChange={(event) => setProfileField('callModeTheme', event.target.value)}><option value="inherit">Match workspace theme</option>{themes.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></div><h4>Background</h4><div className="background-grid">{backgrounds.map(([id, label]) => <button key={id} className={`${appearance.background === id ? 'active' : ''} background-preview-${id}`} onClick={() => setAppearance('background', id)}><i /><span>{label}</span></button>)}<button className={appearance.background === 'custom' ? 'active' : ''} onClick={() => backgroundRef.current?.click()}><i className="custom-background-preview" style={appearance.customBackground ? { backgroundImage: `url(${appearance.customBackground})` } : undefined}><Upload size={17} /></i><span>Upload custom</span></button></div><input ref={backgroundRef} hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onAppearanceChange({ ...appearance, background: 'custom', customBackground: await resizeBackground(file) }); event.target.value = '' }} /><div className="glass-sliders"><Range label="Glass intensity" value={appearance.intensity} onChange={(value) => setAppearance('intensity', value)} /><Range label="Blur strength" value={appearance.blur} onChange={(value) => setAppearance('blur', value)} /><Range label="Transparency" value={appearance.transparency} onChange={(value) => setAppearance('transparency', value)} /><Range label="Reflection / highlight" value={appearance.reflection} onChange={(value) => setAppearance('reflection', value)} /></div><div className="setting-toggles"><button className={appearance.dimBackground ? 'active' : ''} onClick={() => setAppearance('dimBackground', !appearance.dimBackground)}>Dim background for readability</button><button className={appearance.reducedMotion ? 'active' : ''} onClick={() => setAppearance('reducedMotion', !appearance.reducedMotion)}>Reduced motion</button><button onClick={() => onAppearanceChange({ ...appearance, background: 'auto', customBackground: '' })}><RotateCcw size={14} />Reset background</button></div></section> : null}

            {tab === 'mission' ? <section><h3><Target size={17} />Sales mission</h3><label><span>Daily sales goal</span><input value={profile.currentSalesGoal || ''} onChange={(event) => setProfileField('currentSalesGoal', event.target.value)} placeholder="5 quote-ready leads daily" /></label><label><span>Commission / reward goal</span><input value={profile.commissionGoal || ''} onChange={(event) => setProfileField('commissionGoal', event.target.value)} placeholder="Commission target or personal reward" /></label><label><span>Battle cry</span><input value={profile.battleCry || ''} onChange={(event) => setProfileField('battleCry', event.target.value)} placeholder="One call at a time." /></label><div className="practice-controls"><button onClick={onOpenOnboarding}><Eye size={15} />Open beginner field guide</button>{practiceMode ? <button className="danger-outline" onClick={onEndPractice}>Exit Practice Mode</button> : <button onClick={onStartPractice}><Play size={15} />Start Practice Mode</button>}<button className={demoMode ? 'active' : ''} onClick={onToggleDemo}><Eye size={15} />{demoMode ? 'Turn Demo Mode off' : 'Turn Demo Mode on'}</button></div><div className="settings-note"><AlertTriangle size={17} /><p>Practice Mode uses safe sample leads. Demo Mode blurs private contact data while keeping the product story visible.</p></div></section> : null}

            {tab === 'search' ? <section><h3><Globe2 size={17} />Lead search tools</h3><label><span>Provider</span><select value={profile.leadSearchProvider || 'nominatim'} onChange={(event) => setProfileField('leadSearchProvider', event.target.value)}>{providers.map(([id, label, future]) => <option key={id} value={id} disabled={future}>{label}</option>)}</select></label><label><span>Endpoint URL</span><input value={profile.leadSearchEndpoint || ''} onChange={(event) => setProfileField('leadSearchEndpoint', event.target.value)} placeholder="https://nominatim.openstreetmap.org/search" /></label><label><span>Future provider API key</span><input type="password" value="" disabled placeholder="Not connected in this local frontend build" /></label><div className="provider-cards">{providers.map(([id, label, future]) => <article key={id} className={(profile.leadSearchProvider || 'nominatim') === id ? 'active' : ''}><strong>{label}</strong><span>{future ? 'Future · not connected' : id === 'nominatim' ? 'Working · manual low-volume search' : 'Manual verification links only'}</span></article>)}</div><div className="settings-note"><AlertTriangle size={17} /><p>Do not place unrestricted secret API keys in a frontend production build. Google Places or Mapbox should use restrictions or a protected proxy when connected later.</p></div></section> : null}

            {tab === 'keys' ? <section><h3><KeyRound size={17} />Future provider connections</h3><p className="settings-intro">Structure only—no paid API or agent is connected in v0.07.</p><ProviderGroup title="LLM providers" items={['OpenAI', 'Anthropic', 'Gemini']} /><ProviderGroup title="Maps / search" items={['Google Places', 'Mapbox', 'OpenStreetMap / Nominatim']} /><ProviderGroup title="Google Workspace" items={['Sheets', 'Gmail', 'Calendar']} /><ProviderGroup title="Voice / calling" items={['Future calling provider']} /></section> : null}

            {tab === 'data' ? <section><h3><Database size={17} />Local data & export</h3><div className="settings-note"><Save size={17} /><p>CRM, operators, XP, settings, themes, and mission progress are stored in this browser’s localStorage. Export CRM CSV at the end of every important workday.</p></div><div className="data-actions"><button onClick={onExport}><Download size={15} />Export CRM CSV now</button><button className="settings-reset soft" onClick={onResetDaily}><RotateCcw size={16} /><span><strong>Fresh daily mission</strong><small>Clear roster/counters, keep CRM and career progress.</small></span></button></div></section> : null}

            {tab === 'agents' ? <section><h3><Bot size={17} />AI agents — future</h3><p className="settings-intro">These cards reserve a clean home for future assistance without pretending an agent is connected.</p><div className="agent-placeholder-grid">{agents.map((agent) => <article key={agent}><Bot size={18} /><strong>{agent}</strong><span>Future · not connected yet</span></article>)}</div></section> : null}

            {tab === 'privacy' ? <section><h3><ShieldCheck size={17} />Privacy & field rules</h3><ul className="field-rules"><li>Use a quick result after every call.</li><li>Send the company profile after every real contact.</li><li>Final quotations require Pricing Desk.</li><li>Export CRM CSV at the end of the day.</li><li>Lead Finder results must be verified before outreach.</li></ul><div className="settings-note"><ShieldCheck size={17} /><p>No login, cloud sync, payment system, outbound automation, or AI backend is active. Data stays in this browser unless you export it.</p></div><button className="settings-reset danger" onClick={onFactoryReset}><Trash2 size={16} /><span><strong>Factory reset local Sales OS</strong><small>Delete local CRM, operators, settings, and progress; restore seed data.</small></span></button></section> : null}
          </div>
        </div>
        <footer><p>Everything remains local-first in v0.071.</p><button className="primary-action" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  )
}

function Range({ label, value = 50, onChange }) {
  return <label><span>{label}<b>{value}%</b></span><input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function ProviderGroup({ title, items }) {
  return <div className="provider-group"><strong>{title}</strong><div>{items.map((item) => <span key={item}><i />{item}<small>Not connected</small></span>)}</div></div>
}

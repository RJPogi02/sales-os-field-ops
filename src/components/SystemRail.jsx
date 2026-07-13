import { Check, Eye, Focus, GraduationCap, Moon, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Settings, Snowflake, Sparkles, Sun } from 'lucide-react'
import { useRef, useState } from 'react'

const territories = ['ALL', 'NCR', 'NORTH', 'SOUTH']
export const themes = [
  { id: 'field', label: 'Light', description: 'Clear editorial field cockpit', Icon: Sun },
  { id: 'midnight', label: 'Dark', description: 'Dark focused operations', Icon: Moon },
  { id: 'glass', label: 'Liquid Glass', description: 'Glossy, reflective spatial glass', Icon: Sparkles },
  { id: 'frosted', label: 'Frosted Glass', description: 'Soft OS-style diffused glass', Icon: Snowflake },
]

function companyInitials(profile) {
  const value = profile.company || profile.name || 'Northstar Materials'
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'KJ'
}

async function resizeLogo(file) {
  const source = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 160
  const context = canvas.getContext('2d')
  const scale = Math.max(160 / source.width, 160 / source.height)
  const width = source.width * scale
  const height = source.height * scale
  context.drawImage(source, (160 - width) / 2, (160 - height) / 2, width, height)
  source.close()
  return canvas.toDataURL('image/png')
}

export function SystemRail({
  theme, onThemeChange, territory, onTerritoryChange, profile, onLogoChange, onOpenSettings,
  leftCollapsed, onToggleLeft, rightCollapsed, onToggleRight, focusMode, onToggleFocus,
  onOpenOnboarding, practiceMode, demoMode,
}) {
  const [themeOpen, setThemeOpen] = useState(false)
  const logoRef = useRef(null)
  const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(new Date())
  return (
    <header className="system-rail">
      <div className="brand-lockup">
        <button className="brand-mark" onClick={() => logoRef.current?.click()} title="Upload or change company mark" aria-label="Upload or change company logo">
          {profile?.companyLogo ? <img src={profile.companyLogo} alt="Company mark" /> : <span>{companyInitials(profile || {})}</span>}
        </button>
        <input ref={logoRef} hidden type="file" accept="image/*" onChange={async (event) => {
          const file = event.target.files?.[0]
          if (file) onLogoChange(await resizeLogo(file))
          event.target.value = ''
        }} />
        <strong>Sales OS</strong><span>// Field Ops</span><em className="version-badge">v0.071</em>
      </div>
      <div className="territory-switch"><span>Territory</span>{territories.map((item) => <button key={item} className={territory === item ? 'active' : ''} onClick={() => onTerritoryChange(item)}>{item === 'ALL' ? 'All' : item}</button>)}</div>
      <div className="system-date">{date}</div>
      <div className="system-status"><span>Status</span><i /> <strong>Online</strong><span>· Local save on</span></div>
      <div className="workspace-controls" aria-label="Workspace controls">
        <button onClick={onToggleLeft} aria-label={leftCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'} title={leftCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}>{leftCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}</button>
        <button onClick={onToggleRight} aria-label={rightCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'} title={rightCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}>{rightCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}</button>
        <button className={focusMode ? 'active' : ''} onClick={onToggleFocus} aria-label="Toggle Focus Mode" aria-pressed={focusMode} title="Focus Mode"><Focus size={15} /><span>Focus</span></button>
        <button onClick={onOpenOnboarding} aria-label="Open Sales OS field guide" title="Field guide"><GraduationCap size={15} /></button>
        {practiceMode || demoMode ? <span className="system-mode-badge"><Eye size={13} />{practiceMode ? 'Practice' : 'Demo'}</span> : null}
      </div>
      <button className="settings-toggle" onClick={onOpenSettings} aria-label="Open Sales OS settings"><Settings size={16} /></button>
      <div className="theme-control">
        <button className="theme-toggle" onClick={() => setThemeOpen((value) => !value)} aria-label="Choose visual theme" aria-expanded={themeOpen}><Palette size={16} /></button>
        {themeOpen ? <div className="theme-menu panel"><header><span>Visual themes</span><button onClick={() => setThemeOpen(false)}>Done</button></header>{themes.map(({ id, label, description, Icon }) => <button key={id} className={theme === id ? 'active' : ''} onClick={() => { onThemeChange(id); setThemeOpen(false) }}><i><Icon size={15} /></i><span><strong>{label}</strong><small>{description}</small></span>{theme === id ? <Check size={14} /> : null}</button>)}</div> : null}
      </div>
    </header>
  )
}

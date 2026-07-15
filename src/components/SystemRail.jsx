import { Check, Eye, Focus, GraduationCap, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { APP_VERSION_LABEL } from '../config/version.js'
import { themes } from '../lib/themes.js'

export { themes } from '../lib/themes.js'

const territories = ['ALL', 'NCR', 'NORTH', 'SOUTH']

function companyInitials(profile) {
  const value = profile.company || profile.name || 'Sales OS'
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
  onOpenOnboarding, practiceMode, demoMode, teamConnected = false,
}) {
  const [themeOpen, setThemeOpen] = useState(false)
  const logoRef = useRef(null)
  const themeControlRef = useRef(null)
  const themeToggleRef = useRef(null)
  const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(new Date())

  useEffect(() => {
    if (!themeOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!themeControlRef.current?.contains(event.target)) setThemeOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setThemeOpen(false)
      themeToggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [themeOpen])

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
        <strong>Sales OS</strong><span>// Field Ops</span><em className="version-badge">{APP_VERSION_LABEL}</em>
      </div>
      <div className="territory-switch"><span>Territory</span>{territories.map((item) => <button key={item} className={territory === item ? 'active' : ''} onClick={() => onTerritoryChange(item)}>{item === 'ALL' ? 'All' : item}</button>)}</div>
      <div className="system-date">{date}</div>
      <div className={`system-status ${teamConnected ? 'team-connected' : ''}`}><span>Status</span><i /> <strong>{teamConnected ? 'Team synced' : 'Local only'}</strong><span> · Local save on</span></div>
      <div className="workspace-controls" aria-label="Workspace controls">
        <button onClick={onToggleLeft} aria-label={leftCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'} title={leftCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}>{leftCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}</button>
        <button onClick={onToggleRight} aria-label={rightCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'} title={rightCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}>{rightCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}</button>
        <button className={focusMode ? 'active' : ''} onClick={onToggleFocus} aria-label="Toggle Focus Mode" aria-pressed={focusMode} title="Focus Mode"><Focus size={15} /><span>Focus</span></button>
        <button onClick={onOpenOnboarding} aria-label="Open Sales OS field guide" title="Field guide"><GraduationCap size={15} /></button>
        {practiceMode || demoMode ? <span className="system-mode-badge"><Eye size={13} />{practiceMode ? 'Practice' : 'Demo'}</span> : null}
      </div>
      <button className="settings-toggle" onClick={onOpenSettings} aria-label="Open Sales OS settings"><Settings size={16} /></button>
      <div className="theme-control" ref={themeControlRef}>
        <button ref={themeToggleRef} className="theme-toggle" onClick={() => setThemeOpen((value) => !value)} aria-label="Choose visual theme" aria-expanded={themeOpen} aria-controls="workspace-theme-menu"><Palette size={16} /></button>
        {themeOpen ? <div id="workspace-theme-menu" className="theme-menu theme-palette-menu panel" role="dialog" aria-label="Visual theme palette"><header><span><Palette size={13} />Visual themes</span><button onClick={() => setThemeOpen(false)} aria-label="Close theme palette"><X size={14} /></button></header><div className="theme-swatch-grid" role="group" aria-label="Available workspace themes">{themes.map(({ id, label, description, Icon, swatch }) => <button type="button" key={id} className={`theme-swatch ${theme === id ? 'active' : ''}`} onClick={() => { onThemeChange(id); setThemeOpen(false); themeToggleRef.current?.focus() }} aria-label={`${label}. ${description}`} aria-pressed={theme === id} title={description} style={{ '--swatch-base': swatch[0], '--swatch-accent': swatch[1], '--swatch-glow': swatch[2] }}><i className="theme-swatch-preview"><span /><Icon size={14} /></i><span><strong>{label}</strong><small>{theme === id ? 'Active' : 'Apply'}</small></span>{theme === id ? <Check className="theme-swatch-check" size={13} /> : null}</button>)}</div></div> : null}
      </div>
    </header>
  )
}

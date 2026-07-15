import { BarChart3, Box, Command, Crosshair, FileText, Globe2, List, ListTodo, LocateFixed, LogOut, Pencil, RefreshCcw, Target, Users } from 'lucide-react'
import { OperatorCompanion } from './OperatorCompanion.jsx'
import { TerritoryMap } from './TerritoryMap.jsx'

const navItems = [
  ['mission', Target, 'Mission'],
  ['manager', Command, 'Command center'],
  ['tasks', ListTodo, 'Tasks'],
  ['queue', List, 'Lead queue'],
  ['quotes', Box, 'Quote queue'],
  ['conversion', RefreshCcw, 'Conversion'],
  ['finder', Globe2, 'Lead finder'],
  ['crm', FileText, 'CRM'],
  ['team', Users, 'Team Hub'],
  ['reports', BarChart3, 'Reports'],
]

export function Sidebar({
  activeView, onViewChange, level, xp, nextXp, rank, selectedCount, rosterLocked, profile, onEditProfile,
  leads, selectedLead, territory, userLocation, onEnableLocation, onOpenLead, collapsed = false,
  rightCollapsed = false, operators = [], activeOperatorId, onOperatorChange, companionMode = 'full', reducedMotion = false, missionTarget = 20,
  showManager = true,
}) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="operator-card panel" onClick={onEditProfile} aria-label="Edit operator profile" title={collapsed ? `Edit ${profile.name}` : undefined}>
        {!collapsed ? <div className="section-label"><span>01 // Operator</span><span>Online</span></div> : null}
        <div className="operator-identity">
          <div className="avatar">{profile.photo ? <img src={profile.photo} alt="" /> : profile.initials}</div>
          {!collapsed ? <div><h2>{profile.name}</h2><p>{profile.position}</p><small>{profile.company}</small></div> : null}
          {!collapsed ? <Pencil className="edit-profile-icon" size={14} /> : null}
        </div>
        {!collapsed ? <>
          <p className="operator-battle-cry">“{profile.battleCry || 'One call at a time.'}”</p>
          <div className="rank-line"><span>Rank</span><strong>{profile.rankTitle || rank.title}</strong></div>
          <div className="xp-label"><span>Level {level}</span><span>{xp.toLocaleString()} / {nextXp.toLocaleString()} XP</span></div>
          <div className="progress"><span style={{ width: `${Math.min(100, (xp / nextXp) * 100)}%` }} /></div>
          <div className="operator-mission"><span>{profile.territoryFocus || territory} focus</span><strong>{selectedCount}/{missionTarget} {rosterLocked ? 'locked' : 'picked'}</strong></div>
          {rightCollapsed && companionMode !== 'off' ? <OperatorCompanion xp={xp} size="minimal" reducedMotion={reducedMotion} /> : null}
        </> : null}
      </button>

      {!collapsed && operators.length > 1 ? <label className="operator-switch panel"><Users size={15} /><span>Active operator</span><select value={activeOperatorId} onChange={(event) => onOperatorChange(event.target.value)}>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.profile?.name || 'Operator'}</option>)}</select></label> : null}

      {!collapsed ? <div className="territory-card panel">
        <div className="section-label"><span>02 // Territory map</span><span>{userLocation.status}</span></div>
        <TerritoryMap leads={leads} selectedLead={selectedLead} territory={territory} userPosition={userLocation.position} onOpenLead={onOpenLead} />
        <button className="locate-button" onClick={onEnableLocation}>{userLocation.enabled ? <Crosshair size={13} /> : <LocateFixed size={13} />}{userLocation.enabled ? 'Tracking my location' : 'Show my live location'}</button>
      </div> : null}

      <nav className="primary-nav" aria-label="Primary navigation">
        {navItems.filter(([id]) => id !== 'manager' || showManager).map(([id, Icon, label]) => <button key={id} className={activeView === id ? 'active' : ''} onClick={() => onViewChange(id)} aria-label={label} title={collapsed ? label : undefined}><Icon size={18} /><span>{label}</span></button>)}
      </nav>
      <button className="log-out" onClick={() => window.location.reload()} aria-label="Refresh session" title={collapsed ? 'Refresh session' : undefined}><LogOut size={16} /><span>Refresh session</span></button>
    </aside>
  )
}
